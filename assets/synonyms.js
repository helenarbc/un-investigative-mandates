// Curated query hints: everyday terms -> vocabulary used in UN investigative-mechanism reports.
// Shown only when a search returns zero results. Original curation for this project (2026).
window.HRC_SYNONYMS = {

  // ---- Conflict and attacks ----
  "massacre": ["mass killings", "summary executions", "unlawful killings"],
  "ethnic cleansing": ["forcible transfer", "forced displacement", "deportation"],
  "airstrikes on hospitals": ["attacks on medical facilities", "attacks on hospitals", "medical personnel"],
  "schools bombed": ["attacks on schools", "attacks on medical facilities"],
  "airstrike": ["air strike", "air strikes", "shelling"],
  "barrel bombs": ["barrel bomb", "air strikes", "indiscriminate attacks"],
  "chemical attack": ["chemical weapons", "toxic chemicals", "sarin"],
  "nerve gas": ["nerve agent", "sarin", "chemical weapons"],
  "poison gas attack": ["chlorine", "toxic chemicals", "chemical weapons"],
  "cluster bombs": ["cluster munitions"],
  "firebombing": ["incendiary weapons", "white phosphorus", "thermobaric"],
  "landmines": ["anti-personnel mines", "improvised explosive devices"],
  "drone strike": ["unmanned aerial vehicles", "drone", "air strikes"],
  "rebel groups": ["armed groups", "anti-Government armed groups"],

  // ---- Sexual and gender-based violence ----
  "rape as a weapon of war": ["conflict-related sexual violence", "sexual violence", "rape"],
  "sexual assault": ["sexual violence", "rape", "sexual and gender-based violence"],
  "sex slaves": ["sexual slavery", "forced marriage", "trafficking"],
  "honor killings": ["honour killings", "femicide", "gender-based violence"],
  "fgm": ["female genital mutilation"],
  "forced to marry": ["forced marriage", "child marriage"],
  "virginity tests": ["virginity", "sexual violence"],
  "persecution of women": ["gender persecution", "gender apartheid", "discrimination against women"],
  "lgbtq rights": ["LGBT", "sexual orientation"],

  // ---- Children ----
  "child soldiers": ["recruitment and use of children", "children associated with armed forces"],
  "kids in detention": ["children in detention", "minors"],
  "children taken to russia": ["deportation", "forcible transfer", "filtration"],
  "women banned from school": ["right to education", "gender apartheid", "edicts"],

  // ---- Detention, torture, disappearance ----
  "black site": ["secret detention", "incommunicado"],
  "disappeared": ["enforced disappearance", "missing persons", "abduction"],
  "arrested without charge": ["arbitrary detention", "arbitrary arrest", "due process"],
  "political prisoners": ["arbitrary detention", "political opponents"],
  "torture chamber": ["torture", "ill-treatment", "conditions of detention"],
  "waterboarded": ["waterboarding", "torture"],
  "electrocuted": ["electric shocks", "stress positions", "torture"],
  "gulag": ["kwanliso", "political prison camps"],
  "punishing families": ["guilt by association", "collective punishment"],
  "kidnapped": ["abduction", "hostage-taking", "enforced disappearance"],
  "hostages": ["hostage-taking", "abduction"],

  // ---- Executions and punishments ----
  "death penalty": ["capital punishment", "executions", "death sentences"],
  "beheadings": ["beheaded", "summary executions"],
  "lashes": ["flogging", "corporal punishment"],
  "stoned to death": ["stoning", "corporal punishment"],
  "death squads": ["extrajudicial executions", "FAES", "summary executions"],
  "show trials": ["fair trial", "due process", "military courts"],

  // ---- Accountability and justice ----
  "war crimes trial": ["prosecutions", "universal jurisdiction", "accountability"],
  "icc referral": ["International Criminal Court", "Rome Statute", "referral"],
  "the hague": ["International Criminal Court", "International Court of Justice"],
  "chain of command": ["command responsibility", "superior responsibility"],
  "sanctions": ["targeted sanctions", "arms embargo"],
  "truth commission": ["transitional justice", "reconciliation"],
  "compensation for victims": ["reparations", "restitution", "remedy"],
  "bodies dumped": ["mass graves", "exhumation", "forensic"],

  // ---- Mechanisms and their colloquial names ----
  "myanmar mechanism": ["Independent Investigative Mechanism for Myanmar", "IIMM"],
  "syria mechanism": ["International, Impartial and Independent Mechanism", "IIIM"],
  "syria files": ["Caesar", "International, Impartial and Independent Mechanism"],
  "fact finding mission": ["fact-finding mission"],
  "commission of enquiry": ["commission of inquiry"],
  "un investigators": ["commission of inquiry", "fact-finding mission", "special rapporteur"],

  // ---- Groups, actors, country shorthand ----
  "isis": ["ISIL", "Da'esh", "Islamic State"],
  "houthis": ["Ansar Allah", "de facto authorities"],
  "burma": ["Myanmar", "Tatmadaw", "Rohingya"],
  "myanmar junta": ["State Administration Council", "Tatmadaw"],
  "north korea": ["Democratic People's Republic of Korea", "DPRK"],
  "rsf": ["Rapid Support Forces", "Janjaweed"],
  "wagner group": ["Wagner", "mercenaries", "foreign fighters"],
  "taliban rules for women": ["edicts", "de facto authorities", "gender apartheid"],
  "hijab police": ["morality police", "mandatory hijab"],
  "mahsa amini protests": ["Mahsa Amini", "Woman, Life, Freedom"],
  "maduro regime": ["colectivos", "FAES", "Bolivarian"],
  "eritrea conscription": ["national service", "conscription", "forced labour"],
  "tigray war": ["Tigray"],
  "russian occupation": ["Russian Federation", "filtration", "occupied"],
  "bucha massacre": ["Bucha", "summary executions"],
  "ghouta chemical attack": ["Ghouta", "sarin", "chemical weapons"],
  "assad regime": ["Syrian Arab Republic", "Government forces"],
  "defense forces": ["defence forces"],

  // ---- Technology and information ----
  "internet blackout": ["internet shutdown", "telecommunications", "freedom of expression"],
  "pegasus spyware": ["spyware", "surveillance"],
  "deepfake": ["disinformation", "hate speech", "incitement"],
  "fake news": ["disinformation", "propaganda"],
  "satellite photos": ["satellite imagery", "open-source information"],
  "cctv surveillance": ["surveillance", "facial recognition", "biometric"],

  // ---- Humanitarian and displacement ----
  "starvation as weapon": ["starvation of civilians", "method of warfare", "objects indispensable"],
  "aid blockade": ["denial of humanitarian access", "humanitarian access", "blockade"],
  "aid workers killed": ["humanitarian personnel", "humanitarian access"],
  "siege tactics": ["besieged", "starvation of civilians"],
  "refugees": ["internally displaced persons", "asylum seekers", "refoulement"],
  "ethnic displacement": ["forced displacement", "forcible transfer"],
  "deported": ["deportation", "forcible transfer", "refoulement"],
  "human trafficking": ["trafficking", "sexual slavery"],

  // ---- Property, land, heritage ----
  "looted homes": ["pillage", "looting", "destruction of property"],
  "villages burned": ["arson", "scorched earth", "destruction of property"],
  "mosques destroyed": ["places of worship", "cultural heritage"],
  "land grab": ["confiscation", "annexation"],
  "settler attacks": ["settler violence", "settlements"],
  "segregation": ["apartheid", "persecution", "discrimination"],

  // ---- Protest and civic space ----
  "police brutality": ["excessive use of force", "ill-treatment", "arbitrary arrest"],
  "crackdown on protests": ["excessive use of force", "live ammunition", "less-lethal"],
  "journalists jailed": ["media workers", "journalists", "freedom of expression"],
  "activists arrested": ["human rights defenders", "civil society", "arbitrary detention"]
};
