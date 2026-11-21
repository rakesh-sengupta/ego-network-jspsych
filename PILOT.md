# Pilot run sheet: network task + trust game

The pilot uses the **full version** of both tasks, with real timings and every screen, exactly as real participants will see it.
The only differences: the researcher ticks **Pilot participant** on the setup screen, each task ends with a short **pilot feedback**
page, and the files are named and flagged as pilot so they never mix with real data.

> **Do not use `?test=1` for the pilot.** Test mode marks the files as test data and shortens the short pauses; the pilot should run
> exactly as real sessions will.

---

## Before the first pilot session

- [ ] **IRB.** The trust game is now version 3: Person A rounds, a Person B part, matching after the study, and no deception. Make
  sure the protocol describes this version.
- [ ] Pilot participants sign the **same consent form** as real participants.
- [x] Support contacts are built into both tasks (last screen). Check them once before the first session.
- [ ] Lab computer: Chrome or Edge; a browser profile with **autofill off** and **"Enhanced spell check" off**; Downloads folder empty.
- [ ] Open both `index.html` files once to check they load (no internet is needed).
- [ ] Prepare a code list: pilot codes **PIL01, PIL02, …**, kept separate from real codes (P001, …).
- [ ] Trust-game round order: rotate **1, 2, 3, 1, 2, 3 …** across pilot participants, and write each one on the code list.
- [ ] Have a stopwatch or clock ready to time the whole session, questionnaires included.

## Each pilot session (in IRB order)

| Step | What | Notes |
|---|---|---|
| 1 | Consent, explain the session | Say it is a pilot and that they'll be asked for feedback at the end of each part |
| 2 | Questionnaires (AI use, GTS, UCLA, SIAS) | On whatever platform they are run on; same participant code |
| 3 | **Network task**: `ego-network-jspsych/index.html` | Setup: code ×2 → **Pilot participant** → hand over |
| 4 | Check-in and short break | Note anything the participant says |
| 5 | **Trust game**: `trust-game-jspsych/index.html` | Setup: code ×2 → **Pilot participant** → order number → hand over. Part 1 as Person A, Part 2 as Person B. Nothing is hidden: answer questions honestly |
| 6 | Short chat | The task's "that's the game" screen explains it; ask how it went and answer questions |
| 7 | Support sheet + contacts | As for real participants |

After each task, check the last screen. It should say **PILOT session** and show the file name (`egonet_pilot_PIL01_…json`,
`trustgame_pilot_PIL01_…csv`); the network task should also show **Anonymisation check: passed**.
Move both files to the encrypted storage, into a **`pilot/`** folder.

**Write down** for each participant: total session time, any question they asked during the tasks, anything that seemed confusing
in Part 2 (Person B), and anything that seemed unclear in the matching explanation.

## After the pilot

Open each task's `analyze.html`, tick **include pilot sessions**, and load the pilot files. Things to decide from what you see:

| Look at | Where | Act if… |
|---|---|---|
| Task durations | Pilot feedback section (both pages) | Whole session much over the time stated in the consent form |
| Comprehension attempts | Trust summary table | Many people needed 2+ tries, so rewrite the instructions page they tripped on |
| Person B answers | Trust summary + "proportion returned" chart + Part 2 comments | Many blanks, odd patterns or confusion, so reword the Part 2 page |
| Same proportion every round | Trust summary line | Nearly everyone, so the amounts may not be distinct enough |
| Density = 1 (ceiling) | Network ceiling check | Most participants, so pre-register the ceiling as a known limitation (deck slide 16) |
| All 6 boxes used / "more beyond cap" | Network cap check | Often, so consider raising `N_SLOTS` (an IRB amendment) |
| Confusing / uncomfortable items | Both feedback tables | Reword in `config.js` before the real study |
| Spread of enacted trust and network size | Charts and summary | Use the SDs for the sample-size calculation the IRB mentions |

Then fix the final settings, **pre-register**, and switch to **Real participant** for data collection. The analysis pages and both
Python scripts skip pilot files by default, so the pilot data will not be mixed into the main analysis (`--include-pilot` /
the checkbox include them on purpose).
