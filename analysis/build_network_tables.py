#!/usr/bin/env python3
"""
Turn the per-participant egonet_*.json files into three tidy CSV tables.

    python analysis/build_network_tables.py path/to/data_folder  -o path/to/output_folder

Writes
  alters.csv       Table A: one row per named person (alter)
  ties.csv         Table B: one row per pair of alters ("do they know each other?")
  ego_summary.csv  one row per participant: size, density, composition,
                   tie strength, and the AI / language measures

Only the Python standard library is used. Pilot sessions are skipped unless
--include-pilot is given, and test-mode files (?test=1) unless --include-test,
so real data are never mixed with either. For pilot files, ego_summary.csv also
carries session_duration_s and the pilot feedback (pf_* columns).

Definitions (fix these in the pre-registration before looking at the data):
  size              number of people named (0-6)
  density_strict    "yes" pairs / all possible pairs      (unsure + blank = no)
  density_lenient   ("yes" + "not sure") / all possible pairs
                    density is undefined (blank) when fewer than 2 people are named
  prop_kin          share of alters whose relationship is a family category
                    (parent, sibling, other family; see `kin` in config.js)
  mean_closeness    mean of 1-5 closeness ratings
  mean_contact      mean of 1-5 contact frequency (5 = every day)
  n_strong_ties     alters rated closeness >= 4 AND contact >= 3 (weekly or more)
  n_languages       number of distinct main languages across alters
  ai_lang_matches_modal
                    1 if the language used with AI chatbots equals the most common
                    language used with the named people, 0 if not, blank if either
                    is missing or the modal language is tied
"""
import argparse
import csv
import glob
import json
import os
import sys
from collections import Counter

ALTER_COLS = [
    "participant_id", "alter", "slot", "relationship", "relationship_other", "kin",
    "contact", "closeness", "language", "language_other", "ai_instead",
    "name_flag_ai_keyword",
]
TIE_COLS = ["participant_id", "alter_i", "alter_j", "knows"]


def mean(xs):
    xs = [x for x in xs if isinstance(x, (int, float)) and not isinstance(x, bool)]
    return round(sum(xs) / len(xs), 4) if xs else ""


def blank(x):
    return "" if x is None else x


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data_dir")
    ap.add_argument("-o", "--out", default=".")
    ap.add_argument("--include-test", action="store_true")
    ap.add_argument("--include-pilot", action="store_true")
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.data_dir, "egonet_*.json")))
    if not files:
        sys.exit(f"No egonet_*.json files found in {args.data_dir}")
    os.makedirs(args.out, exist_ok=True)

    alters_rows, tie_rows, ego_rows = [], [], []
    seen = Counter()
    rel_cats = set()

    for fn in files:
        with open(fn, encoding="utf-8") as f:
            d = json.load(f)
        meta, ego = d["meta"], d["ego"]
        stype = meta.get("session_type") or ("test" if meta.get("test_mode") else "real")
        if (meta.get("test_mode") or stype == "test") and not args.include_test:
            print(f"skip (test mode): {os.path.basename(fn)}")
            continue
        if stype == "pilot" and not args.include_pilot:
            print(f"skip (pilot): {os.path.basename(fn)}")
            continue
        if meta.get("anonymisation_check") != "passed":
            print(f"WARNING: anonymisation check did not pass in {fn}: open it and inspect before use")
        pid = meta["participant_id"]
        seen[pid] += 1

        alters = d["alters"]
        ties = d["ties"]
        for a in alters:
            alters_rows.append({c: blank(a.get(c)) for c in ALTER_COLS})
            if a.get("relationship"):
                rel_cats.add(a["relationship"])
        for t in ties:
            tie_rows.append({c: blank(t.get(c)) for c in TIE_COLS})

        n = len(alters)
        pairs = n * (n - 1) // 2
        yes = sum(t["knows"] == "yes" for t in ties)
        unsure = sum(t["knows"] == "unsure" for t in ties)
        kin_known = [a["kin"] for a in alters if a.get("kin") is not None]
        langs = [a["language"] for a in alters if a.get("language")]
        lang_counts = Counter(langs).most_common()
        modal = None
        if lang_counts and (len(lang_counts) == 1 or lang_counts[0][1] > lang_counts[1][1]):
            modal = lang_counts[0][0]
        ai_lang = ego.get("ai_language")
        ai_match = ""
        if modal and ai_lang and ai_lang != "na":
            ai_match = int(ai_lang == modal)

        row = {
            "participant_id": pid,
            "session_type": stype,
            "file": os.path.basename(fn),
            "size": n,
            "all_slots_used": ego.get("all_slots_used"),
            "more_beyond_cap": blank(ego.get("more_beyond_cap")),
            "n_pairs": pairs,
            "n_ties_yes": yes,
            "n_ties_unsure": unsure,
            "n_ties_blank": sum(t["knows"] is None for t in ties),
            "density_strict": round(yes / pairs, 4) if pairs else "",
            "density_lenient": round((yes + unsure) / pairs, 4) if pairs else "",
            "n_kin": sum(kin_known),
            "prop_kin": round(sum(kin_known) / len(kin_known), 4) if kin_known else "",
            "mean_closeness": mean([a.get("closeness") for a in alters]),
            "mean_contact": mean([a.get("contact") for a in alters]),
            "n_strong_ties": sum(
                1 for a in alters
                if isinstance(a.get("closeness"), int) and isinstance(a.get("contact"), int)
                and a["closeness"] >= 4 and a["contact"] >= 3
            ),
            "n_languages": len(set(langs)),
            "modal_language": modal or "",
            "ai_frequency": blank(ego.get("ai_frequency")),
            "ai_closeness": blank(ego.get("ai_closeness")),
            "ai_language": blank(ai_lang),
            "ai_lang_matches_modal": ai_match,
            "ai_instead_any": blank(ego.get("ai_instead_any")),
            "ai_instead_n": blank(ego.get("ai_instead_n")),
            "n_alters_named_like_ai": sum(bool(a.get("name_flag_ai_keyword")) for a in alters),
            "n_alters_rel_ai": sum(a.get("relationship") == "ai" for a in alters),
        }
        row["session_duration_s"] = blank(meta.get("session_duration_s"))
        row["_pf"] = d.get("pilot_feedback") or {}
        row["_rels"] = Counter(a["relationship"] for a in alters if a.get("relationship"))
        ego_rows.append(row)

    # composition counts, one column per relationship category
    for r in ego_rows:
        c = r.pop("_rels")
        for cat in sorted(rel_cats):
            r[f"n_rel_{cat}"] = c.get(cat, 0)
        for k, v in r.pop("_pf").items():  # pilot feedback last
            r[k] = blank(v)

    def write(name, rows, cols=None):
        path = os.path.join(args.out, name)
        if cols is None:  # union of keys, first-seen order (pilot rows add pf_* columns)
            cols = []
            for r in rows:
                cols += [k for k in r if k not in cols]
        with open(path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)
        print(f"wrote {path} ({len(rows)} rows)")

    write("alters.csv", alters_rows, ALTER_COLS)
    write("ties.csv", tie_rows, TIE_COLS)
    write("ego_summary.csv", ego_rows)

    dups = [p for p, k in seen.items() if k > 1]
    if dups:
        print("WARNING: more than one file for participant(s):", ", ".join(dups))


if __name__ == "__main__":
    main()
