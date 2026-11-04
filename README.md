# Ego-network task (jsPsych)

A personal-network ("ego network") questionnaire for in-person lab sessions, built with jsPsych 8.
It is the social-network component of the PSYC490 capstone *Emotional Use of AI Chatbots and Human Social Trust*
(Computational Cognition Laboratory, Krea University; PI Rakesh Sengupta, student researcher Archana Namboodiri).

It uses the General Social Survey "important matters" **name generator** (Burt, 1984), up to six people, then
**name interpreters** about each person and about each pair of people, and finally places **AI chatbots** on the same scales.

**Names are anonymised in the browser.** Participants type first names, nicknames or initials so that later questions can
say "How close do you feel to *Anu*?". Those names exist only in the page's memory. What is saved uses codes `A1`–`A6`,
and the names are wiped when the file is written. See [Privacy](#privacy-how-the-anonymisation-works).

---

## Running it

1. Download or clone the repository onto the lab computer. No internet connection is needed.
2. Open `index.html` in Chrome or Edge.
3. The researcher enters the participant code twice (the same code as on the questionnaires and the trust game), then hands over the computer.
4. At the end a JSON file downloads automatically. Move it to the encrypted university storage. The last screen shows
   the file name, confirms that the **anonymisation check passed** and the names were cleared, and has a **Download again** button.

`index.html?test=1` marks the file as test data; `index.html?pid=P014` pre-fills the code.
GitHub Pages also works, since data are still saved only to the lab computer.

**Lab-computer settings (do once):** use a browser profile with **autofill off** and **"Enhanced spell check" off**
(in Chrome, enhanced spell check sends typed text to Google). The name boxes already set `autocomplete="off"` and
`spellcheck="false"`, but the browser settings are the safer layer.


## Pilot sessions

Tick **Pilot participant** on the setup screen (or open `index.html?pilot=1` to pre-select it). The pilot runs the full version with real
timings. It adds a short feedback page at the end (clarity, anything confusing, length, comments, anything uncomfortable, and whether the name boxes felt safe), names the file
`egonet_pilot_<code>_…`, and records `session_type = pilot` and the session duration. Pilot files are skipped by `analyze.html` and the
Python script unless you ask for them (checkbox / `--include-pilot`); the analysis page then shows a pilot feedback table and durations.
Real sessions are marked `session_type = real`. **See `PILOT.md` for the full run sheet.**

---

## What the participant sees

| # | Screen | What is asked |
|---|--------|---------------|
| 1 | Researcher setup → hand-over → full screen | |
| 2 | Introduction (2 pages) | what the task is; **names are replaced by codes before anything is saved** |
| 3 | **Name generator** | *"From time to time, most people discuss important matters with other people. Looking back over the last six months, who are the people with whom you discussed matters important to you?"* Six boxes, any may be left blank. Duplicate names are blocked; listing nobody, or typing what looks like a full name, gets a gentle "are you sure?" |
| 4 | *(only if all 6 boxes used)* | "Is there anyone else you would have listed?" + how many. Measures how often the cap was binding |
| 5 | **One page per person** | relationship (12 categories incl. *An AI chatbot or assistant*), contact frequency (5-point), closeness (5-point), main language used with them |
| 6 | **Do these people know each other?** *(if ≥ 2 named)* | every pair on one page, Yes / No / Not sure, with a live diagram that draws the ties as they answer |
| 7 | **AI chatbots** | how often they discuss personal / important matters with an AI chatbot; closeness to the one they use most; language used with it; and "have you talked something over with an AI chatbot *instead of* any of these people?" (tick each person, or "none") |
| 8 | Thank-you | |

Every question can be skipped (as the IRB application promises). A blank triggers one soft
*"You left 1 question blank — go back or continue?"* so that blanks are deliberate, not accidental.

All wording and answer options are in **`config.js`**. Options are saved as stable codes (`friend`, `malayalam`, `4`, …),
so you can reword labels without breaking the analysis.

---

## Before real data collection: checklist

- [ ] **IRB materials.** The application describes the name generator, closeness / tie strength, and whether the people know
  each other. Attach the full item list (relationship categories, contact, closeness, **language**, and the **AI block**) so the
  committee sees exactly what is asked. The handbook (4.4) and the networks deck (slides 25–27) are where those extra items come from.
- [ ] **Freeze the name-generator wording** and `N_SLOTS` in the pre-registration. Size and density are properties of the question
  (deck slide 7).
- [ ] Pre-register the **density rule** for "Not sure" (default `density_strict` counts it as *no*; `density_lenient` as *yes*),
  and the **strong-tie** cut-off used by the analysis script.
- [ ] Check the **language list** in `config.js` against your likely sample.
- [ ] Set the lab browser profile as above, then pilot on the real machine.

---

## Data

One file per participant: `egonet_<code>_<YYYYMMDD-HHMMSS>.json`

```text
meta     participant code, timestamps, version, the exact name-generator wording, anonymisation_check: "passed"
ego      size, ties yes/unsure/blank, density, cap info, and the AI block
alters   Table A: one object per person: alter (A1…), slot, relationship, kin, contact, closeness, language,
         ai_instead (did the AI stand in for this person?), name_flag_ai_keyword
ties     Table B: one object per pair: alter_i, alter_j, knows (yes / no / unsure / null)
trials   the raw jsPsych record (already coded; no names)
```

`name_flag_ai_keyword` is true when the *typed name* looked like an AI product (ChatGPT, Gemini, "bot", …). It is a flag only,
because the name itself is not kept, and it tells you when a participant listed an AI as one of their "people" (deck slide 25).

### Analyse: no installation needed

Open **`analyze.html`** (or click *Analyse collected data* on the researcher setup screen), then drop in or choose the
`egonet_*.json` files. Everything runs in the browser and nothing is uploaded. The page shows:

- a **summary table** (n, mean, SD, median, range) for size, density, proportion family, closeness, contact, strong ties and AI use;
- the **checks the deck asks for**: size distribution, how many have density = 1 (ceiling), how often the 6-box cap was hit, and how many
  used an AI instead of a named person;
- **one network diagram per participant**. Node colour = family / partner, friends & peers / other; spoke thickness = closeness;
  solid or dashed lines = the two people know each other / not sure; a dashed **AI** node, with dotted lines to the people the AI stood in for.
  Hover a node for its details.

**Download tables + diagrams (.zip)** gives `alters.csv`, `ties.csv`, `ego_summary.csv`, every diagram as SVG (for papers) and PNG
(for slides), and `all_networks.svg/.png`, an overview sheet of all participants. Tick *include test-mode files* to analyse pilot data.
Diagrams show codes (A1…) only; no names exist in the data.

### Or with Python

```bash
python analysis/build_network_tables.py path/to/data_folder -o path/to/output_folder
```

Standard library only, and it produces the same three tables as the browser page (checked to match value for value). Writes:

- `alters.csv` (Table A) and `ties.csv` (Table B), the layout of deck slide 11
- `ego_summary.csv`, one row per participant, with the four network measures of the deck:
  **size**, **density** (`density_strict`, `density_lenient`), **composition** (`n_kin`, `prop_kin`, `n_rel_<category>`),
  **tie strength** (`mean_closeness`, `mean_contact`, `n_strong_ties` = closeness ≥ 4 and contact weekly or more),
  plus `n_languages`, `modal_language`, `ai_lang_matches_modal`, and the AI-block variables.

Check the distribution of density for a ceiling before testing anything with it (deck slide 16).

---

## Privacy: how the anonymisation works

1. Names typed into the generator are held only in a JavaScript array in the open page. They are never put into jsPsych's data.
2. Every screen that mentions a name records only coded answers: the custom `form-page` plugin never records page HTML,
   and each screen's `transform` stores `A1`, `A2`, … instead of names.
3. Free-text answers ("Someone else: ___", "Another language: ___") are scrubbed as they are recorded:
   any listed name is replaced with its code, e.g. *"Ravi's cousin"* → *"[A2]'s cousin"*.
4. Before the file is built, an **independent second pass** scrubs every string in the output (whole-word, case-insensitive,
   Unicode-aware), then **checks** the serialised file for every name. The result is written to `meta.anonymisation_check`.
5. The names are then overwritten in memory, the file is downloaded, and the final screen confirms both.

If the browser is closed mid-task, nothing is saved, names included.
This was tested with awkward entries (HTML tags, single-letter initials, "ChatGPT", a name identical to an answer option such as "Friend",
and a name typed inside another answer): no name survived into any saved file.

---

## Files

```
PILOT.md                         pilot run sheet (both tasks)
index.html                       entry point (the task)
analyze.html                     analysis page: tables + network diagrams, zip download
config.js                        ← wording, answer options, slots
js/experiment.js                 the task timeline + anonymisation
js/analyze.js                    analysis page logic (tables, diagrams, zip; no libraries)
js/plugin-form-page.js           small custom jsPsych plugin (forms with hard/soft checks; never records page HTML)
css/style.css
lib/jspsych/                     jsPsych 8.3.0 + plugins, vendored for offline use (MIT licence)
analysis/build_network_tables.py
```

## References

Bearman, P., & Parigi, P. (2004). Cloning headless frogs and other important matters: Conversation topics and network structure. *Social Forces, 83*(2), 535–557.

Burt, R. S. (1984). Network items and the General Social Survey. *Social Networks, 6*(4), 293–339.

de Leeuw, J. R., Gilbert, R. A., & Luchterhandt, B. (2023). jsPsych: Enabling an open-source collaborative ecosystem of behavioral experiments. *Journal of Open Source Software, 8*(85), 5351. https://doi.org/10.21105/joss.05351

## Licence

MIT (see `LICENSE`). jsPsych is © its authors, MIT licence.
