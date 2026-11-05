"""Task 6 — dashboard export. The permanent bridge Airtable -> export/*.json.

Reads the cached tables in data/airtable/ (run scripts/fetch_airtable.py first
for a fresh pull) and writes six dashboard-ready JSON files. Re-run any time;
output is fully regenerated. Airtable remains the single source of truth.

Provenance: recovered byte-for-byte on 5 November 2026 from the Drive backup of
the working copy (last written 4 November 2026 17:48) and brought up to date with
the decisions taken on 5 November, which had been made only inside a cloud session
and were never written back. Before running this, diff it against your own copy in
Dashboard/Claude Code/hrc-dataset/scripts/ - if yours is newer, yours wins.
"""
import json
import os
import re
import sys
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(REPO, "data", "airtable")
OUT = os.path.join(REPO, "export")

# Bridge-level patch for the two protected hand-written records (4/8, OM/1/3),
# whose analytical fields were computed but never written to Airtable
# (reports/pending.md "Quick manual chores" 3-bis). Applied only while the
# Airtable field is still empty; once Helena fills them in Airtable, these
# entries become no-ops.
PROTECTED_FILL = {
    "A/HRC/RES/4/8": {"Resolution role": "founding",
                      "Criminal-accountability wording": "ambiguous accountability"},
    "A/HRC/OM/1/3": {"Resolution role": "renewal",
                     "Criminal-accountability wording": "none"},
}


# Texts excluded from the corpus at build time. The Airtable records are kept
# intact (nothing is deleted at source); they are simply not exported. Each
# entry carries the reason, which is also stated in the About & method notes.
EXCLUDED_RESOLUTIONS = {
    # 56/13 (EMLER) was taken out of the corpus in July 2026 by removing the record
    # at source; it is listed here only so the site can say why. Filtering a symbol
    # that is not in Airtable is a no-op.
    "A/HRC/RES/56/13": (
        "International Independent Expert Mechanism to Advance Racial Justice and "
        "Equality in Law Enforcement (EMLER): a thematic mechanism, not a "
        "country-specific one, so outside the scope of this dataset "
        "(decision of 17 July 2026)."
    ),
    "A/HRC/RES/S-23/1": (
        "Boko Haram, 1 April 2015: OP9 asks OHCHR to collect information from "
        "the affected States, in cooperation and consultation with them, for a "
        "report with a view towards accountability. No investigative or "
        "evidence mandate and no body created, so it fails limb (a) of the "
        "inclusion test (decision of 4 November 2026)."
    ),
    # Seven Syria texts, all adopted by recorded vote, each previously coded
    # "tasking". None contains a paragraph addressed to the commission of inquiry:
    # they welcome its reports, note the importance of its work, urge States or the
    # parties to cooperate with it or to heed its recommendations, or transmit its
    # reports onward. A paragraph addressed to States is not a task given to the
    # body and welcoming a report is an assessment, so all seven fail limb (c).
    # Decision of 5 November 2026; the reason for each is shown on the site.
    "A/HRC/RES/20/22": (
        "Syria, 6 July 2012: calls upon the Syrian authorities to cooperate with "
        "the commission of inquiry and decides to transmit its reports to all "
        "relevant United Nations bodies. A paragraph addressed to States, and an "
        "instruction to the Council's own organs, are not a task given to the body, "
        "so it fails limb (c) of the inclusion test (decision of 5 November 2026)."
    ),
    "A/HRC/RES/24/22": (
        "Syria, 27 September 2013: welcomes the report of the commission of inquiry "
        "and says nothing further about it. Welcoming a report is an assessment, not "
        "an investigative, monitoring, evidence or reporting task, so it fails limb "
        "(c) of the inclusion test (decision of 5 November 2026)."
    ),
    "A/HRC/RES/26/23": (
        "Syria, 27 June 2014: welcomes the reports of the commission of inquiry and "
        "notes the importance of its work. No task is given to the body, so it fails "
        "limb (c) of the inclusion test (decision of 5 November 2026)."
    ),
    "A/HRC/RES/27/16": (
        "Syria, 25 September 2014: welcomes the reports of the commission of inquiry "
        "and transmits them onward; the transmission paragraph instructs the "
        "Council's own organs, not the body. It fails limb (c) of the inclusion test "
        "(decision of 5 November 2026)."
    ),
    "A/HRC/RES/29/16": (
        "Syria, 2 July 2015: welcomes the work of the commission of inquiry and notes "
        "its importance. No task is given to the body, so it fails limb (c) of the "
        "inclusion test (decision of 5 November 2026)."
    ),
    "A/HRC/RES/36/20": (
        "Syria, 29 September 2017: fifty-six operative paragraphs, of which seven "
        "mention the commission of inquiry. It welcomes the commission's work, notes "
        "its findings and urges the parties to the conflict to heed its "
        "recommendations. Those paragraphs are addressed to the parties, not to the "
        "commission, so it fails limb (c) of the inclusion test "
        "(decision of 5 November 2026)."
    ),
    "A/HRC/RES/47/18": (
        "Syria, 13 July 2021: urges all States to cooperate with the commission of "
        "inquiry and takes note of its recommendations. Both paragraphs are addressed "
        "to States, not to the commission, so it fails limb (c) of the inclusion test "
        "(decision of 5 November 2026)."
    ),
}


# ---------------------------------------------------------------------------
# Mandate term (chart D). Derived at build time from the verbatim mandate
# paragraphs, so it regenerates with the data instead of drifting. One of five
# values: ongoing / 24 months / 12 months / other set term / not stated.
#
# Helena's hand decisions go in TERM_OVERRIDES and always win; the Airtable
# field "Mandate term", if it is ever created, would win over both (see
# term_of()). Only founding and renewal texts get a value: expansions and
# taskings set no term.
# ---------------------------------------------------------------------------
TERM_RULES = [
    ("ongoing", r"\b(?:establish|establishes?|decides to (?:urgently )?establish)\b[^.;]{0,120}?\bongoing\b"),
    ("ongoing", r"\bongoing (?:independent|international)[^.;]{0,80}?(?:mechanism|commission of inquiry)"),
    ("24 months", r"\bfor (?:(?:a|an|a further)[^.;]{0,40}?(?:period|duration)\s+of\s+(?:at least\s+)?)?(?:two years|2 years|twenty-four months|24 months)\b"),
    ("24 months", r"\bfor two years\b"),
    ("12 months", r"\bfor (?:(?:a|an|a further)[^.;]{0,40}?(?:period|duration)\s+of\s+(?:at least\s+)?)?(?:one year|1 year|twelve months|12 months)\b"),
    ("12 months", r"\bfor a further year\b"),
    ("12 months", r"\bfor one year\b"),
    ("other set term", r"\bfor (?:(?:a|an|a further)[^.;]{0,40}?(?:period|duration)\s+of\s+)?(?:six|seven|eight|nine|ten|eleven|three|four|five)\s+months\b"),
    ("other set term", r"\buntil (?:it|the (?:commission|mission|mechanism|group)[^.;]{0,40}?) presents? (?:its|a) final report\b"),
    ("other set term", r"\buntil the (?:submission|presentation) of (?:its|the) final report\b"),
    ("other set term", r"\buntil the restoration\b"),
    ("other set term", r"\buntil such time as\b"),
]
# Each entry is (value, phrase). A term written as a session reference or as a
# reporting condition is measured against the record - the closing date of the
# session named, or the date of the next renewal - and counted by what it came to.
# Decided 5 November 2026.
TERM_OVERRIDES = {
    # The twenty-eighth session closed on 27 March 2015: 12.0 months.
    "A/HRC/RES/25/23": ("12 months",
                        "through to the twenty-eighth session of the Human Rights "
                        "Council (ran 12.0 months, to 27 March 2015)"),
    # Renewed by 42/26 on 27 September 2019: 12.0 months.
    "A/HRC/RES/39/14": ("12 months",
                        "until it presents a final report (ran 12.0 months, to the "
                        "renewal of 27 September 2019)"),
    # Renewed by 45/19 on 6 October 2020: 12.3 months.
    "A/HRC/RES/42/26": ("12 months",
                        "until it presents a final report (ran 12.3 months, to the "
                        "renewal of 6 October 2020)"),
    # The fifty-fifth session closed on 5 April 2024: 16.3 months, so this one does
    # NOT collapse into twelve and keeps its own category.
    "A/HRC/RES/S-35/1": ("other set term",
                         "until the end of the fifty-fifth session of the Human "
                         "Rights Council (ran 16.3 months, to 5 April 2024)"),
}
# Texts that create a body or extend its mandate in time always get a value, even
# when the text states no term. An expansion or a tasking gets one only when its
# mandate paragraphs actually set a term - 43/28 (Syria, 2020) is coded expansion
# under the strongest-effect rule but OP67 extends the commission for a year, so
# it belongs on the chart; a pure tasking sets no term and stays off it.
TERM_ROLES = ("founding", "renewal")


def term_of(symbol, role, verbatim, airtable_value=None):
    """Return (value, op, phrase) for one text, or (None, None, None) to leave it out."""
    if symbol in TERM_OVERRIDES:
        value, phrase = TERM_OVERRIDES[symbol]
        return (value, None, phrase)
    if airtable_value:
        return (airtable_value, None, "from Airtable")
    vm = verbatim or ""
    for value, pattern in TERM_RULES:
        m = re.search(pattern, vm, re.I)
        if m:
            before = vm[:m.start()]
            ops = re.findall(r"OP\s*([0-9]+[a-z]?(?:\([a-z]\))?)\s*:", before, re.I)
            return (value, ("OP" + ops[-1]) if ops else None, m.group(0))
    return ("not stated", None, None) if role in TERM_ROLES else (None, None, None)


def iso_date(d):
    """Normalize 'Date adopted' to YYYY-MM-DD for sorting; two hand-written
    records use prose style ('30 March 2007')."""
    if not d or re.match(r"^\d{4}-\d{2}-\d{2}$", d):
        return d
    try:
        return datetime.strptime(d.strip(), "%d %B %Y").strftime("%Y-%m-%d")
    except ValueError:
        return d


def load(name):
    return json.load(open(os.path.join(A, name), encoding="utf-8"))


def main():
    os.makedirs(OUT, exist_ok=True)
    res = load("hrc_resolutions.json")
    dropped = [r for r in res if r["fields"].get("Resolution symbol") in EXCLUDED_RESOLUTIONS]
    res = [r for r in res if r["fields"].get("Resolution symbol") not in EXCLUDED_RESOLUTIONS]
    for r in dropped:
        print("excluded from the corpus: %s" % r["fields"].get("Resolution symbol"))
    ib = load("investigative_bodies.json")
    states = load("states.json")
    votes = load("votes.json")
    sponsors = load("sponsorships.json")
    docs = load("documents_except_resolutions.json")

    state_f = {s["id"]: s["fields"] for s in states}
    ib_f = {b["id"]: b["fields"] for b in ib}
    res_f = {r["id"]: r["fields"] for r in res}

    def tally_parts(t):
        m = re.match(r"^(\d+)-(\d+)-(\d+)$", (t or "").strip())
        return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else (None, None, None)

    # resolutions.json
    out_res = []
    for r in res:
        f = r["fields"]
        y, n, a = tally_parts(f.get("Adoption detail (tally)"))
        fill = PROTECTED_FILL.get(f.get("Resolution symbol"), {})
        term = term_of(f.get("Resolution symbol"),
                       fill.get("Resolution role") or f.get("Resolution role"),
                       f.get("Verbatim mandate"), f.get("Mandate term"))
        out_res.append({
            "id": r["id"],
            "symbol": f.get("Resolution symbol"),
            "title": f.get("Title"),
            "session": f.get("Session"),
            "year": f.get("Year"),
            "date_adopted": iso_date(f.get("Date adopted")),
            "adoption_mode": f.get("Adoption mode"),
            "tally": f.get("Adoption detail (tally)"),
            "votes_yes": y, "votes_no": n, "votes_abstain": a,
            "creates_renews": f.get("Creates / Renews"),
            "resolution_role": f.get("Resolution role") or fill.get("Resolution role"),
            "criminal_accountability": (f.get("Criminal-accountability wording")
                                        or fill.get("Criminal-accountability wording")),
            "gender_language": {
                "mandate": f.get("Gender language: mandate", []),
                "other_ops": f.get("Gender language: other OPs", []),
                "preamble": f.get("Gender language: preamble", []),
            },
            "children_language": f.get("Children language", []),
            "mechanism_type": f.get("Mechanism type"),
            "bodies": [ib_f[b].get("Short Name Investigative Body") for b in f.get("Body", []) if b in ib_f],
            "action_verbs": f.get("Action verbs", []),
            "legal_frameworks": f.get("Legal frameworks", []),
            "differentiated_analysis_mandate": f.get("Differentiated analysis", []),
            "differentiated_analysis_whole_text": f.get("Differentiated analysis (whole text)", []),
            "mandate_paragraphs": f.get("Mandate paragraphs (OPs)"),
            "verbatim_mandate": f.get("Verbatim mandate"),
            "verbatim_differentiated_references": f.get("Verbatim differentiated references"),
            "links": {
                "download": f.get("Download link"),
                "google_drive": f.get("Google Drive link"),
                "draft_un": f.get("Draft resolution link (UN)"),
                "voting_record_un": f.get("Voting record link (UN)"),
                "l_document_symbol": f.get("L-document symbol"),
            },
            # Added 5 November 2026 (the agenda item comes from MARC field 991 of
            # the UN Digital Library record and needs no judgement; the position of
            # the State concerned is coded only where a source supports it).
            "agenda_item": f.get("Agenda item"),
            "agenda_item_title": f.get("Agenda item title"),
            "vote_requested_by": f.get("Vote requested by"),
            "state_concerned_position": f.get("State concerned position"),
            "state_concerned_source": f.get("State concerned source"),
            "investigated_conduct_state_position": f.get("Investigated conduct State position"),
            "verify_flag": bool(f.get("Verify flag")),
            "mandate_term": term[0],
            "mandate_term_op": term[1],
            "mandate_term_phrase": term[2],
        })
    out_res.sort(key=lambda x: (x["date_adopted"] or "", x["symbol"] or ""))

    # votes.json (long format)
    out_votes = []
    for v in votes:
        f = v["fields"]
        rid = (f.get("Resolution") or [None])[0]
        sid = (f.get("State") or [None])[0]
        if not rid or not sid or rid not in res_f:
            continue
        sf = state_f.get(sid, {})
        out_votes.append({
            "resolution": res_f[rid].get("Resolution symbol"),
            "state": sf.get("State"),
            "regional_group": sf.get("UN regional group"),
            "position": f.get("Position"),
        })

    # sponsorships.json
    out_sp = []
    for s in sponsors:
        f = s["fields"]
        rid = (f.get("Resolution") or [None])[0]
        sid = (f.get("State") or [None])[0]
        if not rid or not sid or rid not in res_f:
            continue
        sf = state_f.get(sid, {})
        out_sp.append({
            "resolution": res_f[rid].get("Resolution symbol"),
            "state": sf.get("State"),
            "regional_group": sf.get("UN regional group"),
            "role": f.get("Role"),
        })

    # states.json
    out_states = [{"state": s["fields"].get("State"),
                   "regional_group": s["fields"].get("UN regional group")}
                  for s in states if s["fields"].get("State")]
    out_states.sort(key=lambda x: x["state"])

    # bodies.json
    out_ib = []
    for b in ib:
        f = b["fields"]
        out_ib.append({
            "short_name": f.get("Short Name Investigative Body"),
            "full_name": f.get("Full name"),
            "scope": f.get("Scope"),
            "mandate_type": f.get("Mandate type"),
            "mandate_status": f.get("Mandate status"),
            "country": f.get("Country Under Investigation"),
            "start_date": f.get("Start Date"),
            "end_date": f.get("End Date"),
            "mission_number": f.get("Mission Number"),
            "links": f.get("Links"),
            "mandate_action_verbs": f.get("Mandate action verbs", []),
            "mandate_legal_frameworks": f.get("Mandate legal frameworks", []),
            "resolutions": [res_f[r].get("Resolution symbol") for r in f.get("HRC Resolutions", []) if r in res_f],
        })
    out_ib.sort(key=lambda x: (x["start_date"] or ""))

    # documents.json (manifest for the future reports tab)
    out_docs = []
    for d in docs:
        f = d["fields"]
        out_docs.append({
            "id": d["id"],
            "doc_id": f.get("Doc ID"),
            "title": f.get("Title of doc"),
            "type": f.get("Type of document"),
            "date": f.get("Publication date"),
            "year": f.get("Publication Year"),
            "un_ref": f.get("UN ref"),
            "bodies": [ib_f[b].get("Short Name Investigative Body") for b in f.get("Investigative Bodies", []) if b in ib_f],
            "google_drive": f.get("Google Drive link"),
            "status": f.get("Status"),
            "verification_status": f.get("Verification status"),
            "scores": {k.replace("Score: ", ""): f[k] for k in f if k.startswith("Score:")},
        })
    out_docs.sort(key=lambda x: (x["date"] or "", x["doc_id"] or ""))

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with open(os.path.join(OUT, "excluded.json"), "w", encoding="utf-8") as fh:
        json.dump({"rows": [{"symbol": k, "reason": v}
                            for k, v in sorted(EXCLUDED_RESOLUTIONS.items())]},
                  fh, ensure_ascii=False, indent=1)

    for name, data in [("resolutions", out_res), ("votes", out_votes),
                       ("sponsorships", out_sp), ("states", out_states),
                       ("bodies", out_ib), ("documents", out_docs)]:
        path = os.path.join(OUT, f"{name}.json")
        with open(path, "w", encoding="utf-8") as fh:
            json.dump({"generated": stamp, "count": len(data), "rows": data},
                      fh, ensure_ascii=False, indent=1)
        print(f"export/{name}.json: {len(data)} rows")


if __name__ == "__main__":
    main()
