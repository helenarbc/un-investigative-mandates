"""Dashboard data build. export/*.json -> dashboard/data/*.js script payloads.

The site must work from file:// (offline), where fetch() of local JSON fails,
so all data ships as plain <script> files setting window globals. Votes and
sponsorships are re-encoded compactly (per-resolution code strings / state
index lists); everything else passes through lean.

Run after scripts/export.py (and scripts/build_paragraphs.py for the reports
corpus; paragraph shards are wrapped separately by this script if present).
"""
import hashlib
import json
import os
import re
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXP = os.path.join(REPO, "export")
OUT = os.path.join(REPO, "dashboard", "data")

VOTE_CODE = {"Yes": "Y", "No": "N", "Abstain": "A", "Did not vote / absent": "X"}


def load(name):
    return json.load(open(os.path.join(EXP, name), encoding="utf-8"))["rows"]


BANNER = """/*! © 2026 Helena Rodríguez-Bronchú Carceller. All rights reserved.
 *  UN Investigative Mandates — https://mandates.helenarbc.com/
 *  Original work. Text and data mining rights expressly reserved:
 *  art. 4(3) Directive (EU) 2019/790; art. L.122-5-3 French Intellectual Property Code;
 *  art. 67 Spanish Consolidated Copyright Act (TRLPI). No licence is granted for the
 *  training of artificial-intelligence models. See LICENSE and /tdm-policy.json.
 */
"""

RIGHTS = {
    "_copyright": "© 2026 Helena Rodríguez-Bronchú Carceller. All rights reserved.",
    "_license": "No licence granted. See https://mandates.helenarbc.com/LICENSE",
    "_cite": "Rodríguez-Bronchú Carceller, H., UN Investigative Mandates (2026)",
    "_tdm_reservation": 1,
    "_tdm_policy": "https://mandates.helenarbc.com/tdm-policy.json",
}


def dump_js(path, var, obj):
    payload = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(BANNER)
        fh.write("window.%s=%s;" % (var, payload))
    return len(payload)


def main():
    os.makedirs(OUT, exist_ok=True)
    resolutions = load("resolutions.json")
    votes = load("votes.json")
    sponsorships = load("sponsorships.json")
    states = load("states.json")
    bodies = load("bodies.json")
    documents = load("documents.json")

    state_idx = {s["state"]: i for i, s in enumerate(states)}

    # votes: per resolution, one char per state (state-array order).
    # Y yes / N no / A abstain / X absent / . not a Council member that vote
    vmat = {}
    for v in votes:
        sym, st = v["resolution"], v["state"]
        if sym not in vmat:
            vmat[sym] = ["."] * len(states)
        if st in state_idx:
            vmat[sym][state_idx[st]] = VOTE_CODE.get(v["position"], "?")
    vmat = {k: "".join(row) for k, row in vmat.items()}

    # sponsorships: per resolution, {m: [state indices], c: [state indices]}
    smat = {}
    for s in sponsorships:
        sym, st = s["resolution"], s["state"]
        if st not in state_idx:
            continue
        d = smat.setdefault(sym, {"m": [], "c": []})
        d["m" if s["role"].startswith("Main") else "c"].append(state_idx[st])

    # documents: lean manifest for the Reports tab
    docs = [{
        "rec_id": d["id"], "doc_id": d["doc_id"], "title": d["title"],
        "type": d["type"], "date": d["date"], "year": d["year"],
        "un_ref": d["un_ref"], "bodies": d["bodies"], "status": d["status"],
    } for d in documents]

    # Period under investigation: coded on the founding resolution only. Carry it
    # to the body, so the Mechanisms tab can filter on it; renewals inherit nothing
    # and change nothing. Where a body has several founding texts the earliest wins.
    # TOE DRC (2018) has no founding text of its own in the corpus (it continues the
    # ITE Kasai mandate created by 35/33), so it takes that text's value.
    PERIOD_INHERIT = {"TOE DRC (2018)": "ITE Kasai DRC (2017)"}
    period_by_body = {}
    for r in resolutions:
        if not r.get("period_scope"):
            continue
        for bname in (r.get("bodies") or []):
            cur = period_by_body.get(bname)
            if cur is None or (r.get("date_adopted") or "") < (cur.get("date_adopted") or ""):
                period_by_body[bname] = r
    for b in bodies:
        src = period_by_body.get(b["short_name"])
        inherited = False
        if src is None and b["short_name"] in PERIOD_INHERIT:
            src = period_by_body.get(PERIOD_INHERIT[b["short_name"]])
            inherited = True
        if src is None:
            continue
        b["period_scope"] = src["period_scope"]
        b["period_phrase"] = src.get("period_phrase") or ""
        b["period_source"] = src["symbol"] + (
            " (inherited: continuation of the %s mandate)" % PERIOD_INHERIT[b["short_name"]]
            if inherited else "")
    missing = [b["short_name"] for b in bodies
               if not b.get("period_scope")
               and b.get("scope") in ("HRC investigative mandate", "OHCHR investigation (broader)")]
    if missing:
        print("WARNING: in-scope bodies with no period under investigation: %s" % ", ".join(missing))

    excluded = []
    exc_path = os.path.join(EXP, "excluded.json")
    if os.path.exists(exc_path):
        excluded = json.load(open(exc_path, encoding="utf-8"))["rows"]

    core = {
        **RIGHTS,
        "built": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "excluded_texts": excluded,
        "resolutions": resolutions,
        "states": states,
        "bodies": bodies,
        "documents": docs,
        "votes": vmat,
        "sponsorships": smat,
    }
    n = dump_js(os.path.join(OUT, "core.js"), "HRC_DATA", core)
    print(f"dashboard/data/core.js: {n/1024:.0f} KB "
          f"({len(resolutions)} resolutions, {len(vmat)} recorded votes, "
          f"{len(docs)} documents)")

    # paragraph shards (if the extractor has run): wrap JSON -> lazy-loadable JS
    pdir = os.path.join(EXP, "paragraphs")
    outp = os.path.join(OUT, "paragraphs")
    if os.path.isdir(pdir) and os.path.exists(os.path.join(pdir, "manifest.json")):
        os.makedirs(outp, exist_ok=True)
        for old in os.listdir(outp):
            os.remove(os.path.join(outp, old))
        manifest = json.load(open(os.path.join(pdir, "manifest.json"), encoding="utf-8"))
        for name in sorted(manifest.get("shards", {})):
            shard = json.load(open(os.path.join(pdir, name), encoding="utf-8"))
            js = name[:-5] + ".js"
            payload = json.dumps(shard, ensure_ascii=False, separators=(",", ":"))
            with open(os.path.join(outp, js), "w", encoding="utf-8") as fh:
                fh.write("window.__HRC_SHARD(%s);" % payload)
        dump_js(os.path.join(outp, "manifest.js"), "HRC_PARAGRAPHS", manifest)
        print(f"dashboard/data/paragraphs/: {len(manifest.get('shards', {}))} shards wrapped")
    else:
        print("export/paragraphs/ not built yet - skipped shard wrapping")


if __name__ == "__main__":
    main()
