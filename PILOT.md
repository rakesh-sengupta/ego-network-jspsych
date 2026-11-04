# Pilot run sheet: network task + trust game

The pilot uses the **full version** of both tasks, with real timings and every screen, exactly as real participants will see it.
The only differences: the researcher ticks **Pilot participant** on the setup screen, each task ends with a short **pilot feedback**
page, and the files are named and flagged as pilot so they never mix with real data.

> **Do not use `?test=1` for the pilot.** Test mode shortens all the waiting screens in the trust game, which is exactly what the pilot
> needs to check.

---

## Before the first pilot session

- [ ] **IRB.** The application allows a pilot of about 10 participants. The trust game has since changed to three rounds with one played
  out, and pilot feedback questions were added. Check with the committee whether the amendment must be approved **before** piloting.
- [ ] Pilot participants sign the **same consent form** as real participants.
- [ ] Fill in `SUPPORT_CONTACTS` in `config.js` (trust game). The setup screen shows a red banner until this is done.
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
| 5 | **Trust game**: `trust-game-jspsych/index.html` | Setup: code ×2 → **Pilot participant** → order number → hand over. Don't hint that partners are simulated |
| 6 | Verbal debrief | The task's debrief screen comes first; then talk it through |
| 7 | Support sheet + contacts | As for real participants |

After each task, check the last screen. It should say **PILOT session** and show the file name (`egonet_pilot_PIL01_…json`,
`trustgame_pilot_PIL01_…csv`); the network task should also show **Anonymisation check: passed**.
Move both files to the encrypted storage, into a **`pilot/`** folder.

**Write down** for each participant: total session time, any question they asked during the tasks, anything that seemed to break
the cover story, and how they reacted to the debrief.

## After the pilot

Open each task's `analyze.html`, tick **include pilot sessions**, and load the pilot files. Things to decide from what you see:

| Look at | Where | Act if… |
|---|---|---|
| Task durations | Pilot feedback section (both pages) | Whole session much over the time stated in the consent form |
| Comprehension attempts | Trust summary table | Many people needed 2+ tries, so rewrite the instructions page they tripped on |
| Belief that partners were real | Trust belief chart + "felt less real" comments | Many ratings ≤ 3, so strengthen the cover story (waits, wording) before real data |
| Same proportion every round | Trust summary line | Nearly everyone, so the amounts may not be distinct enough |
| Density = 1 (ceiling) | Network ceiling check | Most participants, so pre-register the ceiling as a known limitation (deck slide 16) |
| All 6 boxes used / "more beyond cap" | Network cap check | Often, so consider raising `N_SLOTS` (an IRB amendment) |
| Confusing / uncomfortable items | Both feedback tables | Reword in `config.js` before the real study |
| Spread of enacted trust and network size | Charts and summary | Use the SDs for the sample-size calculation the IRB mentions |

Then fix the final settings, **pre-register**, and switch to **Real participant** for data collection. The analysis pages and both
Python scripts skip pilot files by default, so the pilot data will not be mixed into the main analysis (`--include-pilot` /
the checkbox include them on purpose).
