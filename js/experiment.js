/* ==========================================================================
   Ego-network task: name generator + name interpreters + alter–alter ties
   + an "AI as a pseudo-alter" block.

   PRIVACY DESIGN
   - The names a participant types are kept only in the in-memory array
     `ALTERS` so that later questions can say "How close do you feel to Anu?".
   - No name is ever written into jsPsych's data: every form trial uses a
     `transform` that stores codes (A1, A2, …) instead, and free-text answers
     are scrubbed of the names as they are recorded.
   - Before the file is built, a second, independent pass scrubs every string
     in the output, then checks the result. Only then is the file downloaded,
     and the names are wiped from memory.
   ========================================================================== */
(function () {
  "use strict";

  const C = CONFIG;
  const url = new URLSearchParams(window.location.search);
  const TEST = url.get("test") === "1";

  /** The only place names exist. [{ code: "A1", slot: 1, name: "Anu" }, …] */
  let ALTERS = [];

  const out = {
    participant_id: null,
    started_at: new Date().toISOString(),
    gen: null,       // name-generator summary (no names)
    beyond: null,    // "anyone else beyond the cap?"
    alters: {},      // code -> interpreter answers
    ties: [],        // pair rows
    ai: null,        // AI block
    saved_file: null,
    names_cleared: false,
  };

  /* ---------- helpers ---------- */
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const norm = (s) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const numOrNull = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
  const nameOf = (code) => (ALTERS.find((a) => a.code === code) || {}).name || code;
  const chip = (code) => `<span class="alter-chip">${esc(nameOf(code))}</span>`;

  function stampForFile() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  /* Whole-word, case-insensitive name matcher (Unicode-aware). */
  function namePatterns() {
    return ALTERS.filter((a) => a.name)
      .slice()
      .sort((x, y) => y.name.length - x.name.length)
      .map((a) => ({
        code: a.code,
        re: new RegExp("(?<![\\p{L}\\p{N}])" + escRe(a.name.trim()) + "(?![\\p{L}\\p{N}])", "giu"),
      }));
  }
  function scrubText(s) {
    if (typeof s !== "string") return s;
    return namePatterns().reduce((acc, p) => acc.replace(p.re, "[" + p.code + "]"), s);
  }

  /* Every saved answer option is a code from config.js; those strings are left
     untouched by the final scrub so a name like "Friend" cannot corrupt them. */
  const CONTROLLED = new Set(
    [
      ...C.RELATIONSHIP_OPTIONS, ...C.CONTACT_OPTIONS, ...C.CLOSENESS_OPTIONS,
      ...C.LANGUAGE_OPTIONS, ...C.TIE_OPTIONS, ...C.AI_FREQUENCY_OPTIONS,
    ].map((o) => String(o.value)).concat(["yes", "no", "none", "na", "unsure"])
  );
  /* Structural fields written by the code itself, never by the participant. */
  const STRUCTURAL_KEYS = new Set([
    "trial_type", "plugin_version", "phase", "task", "task_version", "participant_id",
    "started_at", "finished_at", "alter", "alter_i", "alter_j", "alter_codes", "name_generator_text",
  ]);
  function deepScrub(x, key) {
    if (key && STRUCTURAL_KEYS.has(key)) return x;
    if (typeof x === "string") return CONTROLLED.has(x) ? x : scrubText(x);
    if (Array.isArray(x)) return x.map((v) => deepScrub(v));
    if (x && typeof x === "object") {
      const o = {};
      for (const k of Object.keys(x)) o[k] = deepScrub(x[k], k);
      return o;
    }
    return x;
  }

  const warnUnload = (e) => {
    e.preventDefault();
    e.returnValue = "";
  };
  window.addEventListener("beforeunload", warnUnload);

  /* ---------- form-building helpers ---------- */
  const radioList = (name, opts, otherTextName) =>
    opts
      .map(
        (o) =>
          `<label class="opt"><input type="radio" name="${name}" value="${esc(o.value)}">${esc(o.label)}` +
          (o.text && otherTextName
            ? `<input type="text" class="inline-text" name="${otherTextName}" maxlength="40" spellcheck="false" autocomplete="off" placeholder="${esc(o.placeholder || "")}" aria-label="${esc(o.placeholder || "Please describe")}">`
            : "") +
          `</label>`
      )
      .join("");
  const radioScale = (name, opts) =>
    `<div class="scale">${opts
      .map((o) => `<label class="opt"><input type="radio" name="${name}" value="${esc(o.value)}">${esc(o.label)}</label>`)
      .join("")}</div>`;

  const blanksWarn = (values, keys, who) => {
    const n = keys.filter((k) => values[k] === null || (Array.isArray(values[k]) && values[k].length === 0)).length;
    if (!n) return null;
    return {
      warn:
        `You have left ${n === 1 ? "one question" : n + " questions"} ${who ? "about " + who + " " : ""}blank. ` +
        "That's fine if you'd rather not answer. Otherwise, go back and fill it in.",
    };
  };

  /* ---------- jsPsych ---------- */
  const jsPsych = initJsPsych({ display_element: "jspsych-target" });

  /* 1. Researcher setup ------------------------------------------------------ */
  const testBanner = TEST
    ? '<div class="banner-warn"><b>TEST MODE</b> (?test=1). Do not use for real participants.</div>'
    : "";
  const setup = {
    type: jsPsychFormPage,
    data: { phase: "setup" },
    button_label: "Start session",
    html: () => `
      ${testBanner}
      <div class="panel researcher">
        <h2>Researcher setup: network task</h2>
        <p class="small">Enter the participant's study code (the same code used on their questionnaires and the decision task).
        Never enter a name here.</p>
        <div class="q"><label class="q-label" for="pid">Participant code</label>
          <input type="text" id="pid" name="pid" value="${esc(url.get("pid") || "")}" spellcheck="false" autocomplete="off"></div>
        <div class="q"><label class="q-label" for="pid2">Type the code again</label>
          <input type="text" id="pid2" name="pid2" spellcheck="false" autocomplete="off"></div>
      </div>`,
    validate: (v) => {
      if (!v.pid || !C.PARTICIPANT_ID_PATTERN.test(v.pid))
        return { error: "Codes are 2–20 characters: letters, numbers, - or _ only." };
      if (v.pid !== v.pid2) return { error: "The two codes do not match." };
      return null;
    },
    transform: (v) => ({ participant_id: v.pid }),
    on_finish: (data) => {
      out.participant_id = data.response.participant_id;
      jsPsych.data.addProperties({
        participant_id: out.participant_id,
        task: "ego_network",
        task_version: C.TASK_VERSION,
        test_mode: TEST,
      });
    },
  };

  const enterFullscreen = {
    type: jsPsychFullscreen,
    fullscreen_mode: true,
    data: { phase: "fullscreen_on" },
    message: `<div class="panel researcher center"><p><b>Researcher:</b> please hand the computer to the participant now.</p></div>
      <p class="center">When you are ready, press the button below. The screen will switch to full-screen mode.</p>`,
    button_label: "Begin",
  };

  /* 2. Introduction ---------------------------------------------------------- */
  const intro = {
    type: jsPsychInstructions,
    data: { phase: "intro" },
    show_clickable_nav: true,
    allow_backward: true,
    button_label_previous: "Back",
    button_label_next: "Next",
    pages: [
      `<h2>The people you talk with</h2>
       <p>This part asks about the people you talk with about things that matter to you, and a little about how they are connected to each other.</p>
       <p>There are no right or wrong answers. You can leave any question blank.</p>`,
      `<h2>About names</h2>
       <div class="panel">
         <p>On the next page you can list up to ${C.N_SLOTS} people. Please type only a <b>first name, nickname, or initials</b>: just enough for you to tell them apart.</p>
         <p>The names are used only on this screen, so that the following questions can refer to the people you listed.
         <b>Before anything is saved, every name is replaced by a code</b> (Person 1, Person 2, …). The names themselves are never saved.</p>
       </div>`,
    ],
  };

  /* 3. Name generator -------------------------------------------------------- */
  const slots = Array.from({ length: C.N_SLOTS }, (_, i) =>
    `<div class="q slot"><label class="q-label" for="n${i}">Person ${i + 1}</label>
       <input type="text" id="n${i}" name="n${i}" maxlength="24" spellcheck="false" autocomplete="off"
              autocapitalize="words" data-lpignore="true"></div>`
  ).join("");

  const readNames = (v) =>
    Array.from({ length: C.N_SLOTS }, (_, i) => (v["n" + i] ? v["n" + i].trim().replace(/\s+/g, " ") : null));

  const looksAI = (name) => {
    const n = norm(name);
    return C.AI_NAME_KEYWORDS.some((k) => new RegExp("(?<![\\p{L}\\p{N}])" + escRe(k) + "(?![\\p{L}\\p{N}])", "iu").test(n));
  };

  const nameGenerator = {
    type: jsPsychFormPage,
    data: { phase: "name_generator" },
    html: `
      <h2>People you talk with</h2>
      <p class="panel">${esc(C.NAME_GENERATOR_TEXT)}</p>
      <p class="small">First names, nicknames or initials only. You may list up to ${C.N_SLOTS} people, and you may leave any box blank.</p>
      <div class="slots">${slots}</div>`,
    validate: (v) => {
      const names = readNames(v).filter(Boolean);
      const seen = new Map();
      for (const n of names) {
        const k = norm(n);
        if (seen.has(k))
          return { error: `Two boxes contain the same name. Please add an initial or a nickname so you can tell them apart.` };
        seen.set(k, true);
      }
      if (names.length === 0)
        return {
          warn: "You haven't listed anyone. That is a perfectly good answer if it's true for the last six months. " +
                "If you'd like to add someone, go back.",
        };
      const full = names.filter((n) => /\S{3,}\s+\S{3,}/.test(n));
      if (full.length)
        return { warn: "It looks like at least one entry might be a full name. A first name or initials are enough; you can go back and shorten it." };
      return null;
    },
    transform: (v) => {
      const raw = readNames(v);
      ALTERS = [];
      raw.forEach((n, i) => {
        if (n) ALTERS.push({ code: C.ALTER_CODE_PREFIX + (ALTERS.length + 1), slot: i + 1, name: n, ai_keyword: looksAI(n) });
      });
      // Stored: which slots were used, and flags. Never the names.
      return {
        n_named: ALTERS.length,
        slots_used: raw.map((n) => !!n),
        alter_codes: ALTERS.map((a) => a.code),
        ai_keyword_flags: ALTERS.map((a) => a.ai_keyword),
      };
    },
    on_finish: (data) => {
      out.gen = data.response;
    },
  };

  /* 4. Anyone beyond the cap? ----------------------------------------------- */
  const beyondCap = {
    timeline: [
      {
        type: jsPsychFormPage,
        data: { phase: "beyond_cap" },
        html: () => `
          <h2>One more question about your list</h2>
          <div class="q"><span class="q-label">You filled all ${C.N_SLOTS} boxes. Is there anyone else you would have listed if there had been more space?</span>
            ${radioList("more", [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }])}</div>
          <div class="q"><label class="q-label" for="howmany">If yes, about how many more people?</label>
            <input type="number" id="howmany" name="howmany" min="1" max="50" step="1" style="max-width:8em"></div>`,
        validate: (v) => {
          if (v.howmany !== null && (!Number.isInteger(Number(v.howmany)) || Number(v.howmany) < 1))
            return { error: "Please enter a whole number (or leave the box empty)." };
          return blanksWarn(v, ["more"]);
        },
        transform: (v) => ({ more_beyond_cap: v.more, n_more_beyond_cap: numOrNull(v.howmany) }),
        on_finish: (data) => {
          out.beyond = data.response;
        },
      },
    ],
    conditional_function: () => ALTERS.length === C.N_SLOTS,
  };

  /* 5. Name interpreters: one page per person -------------------------------- */
  function interpreterPage(i) {
    return {
      timeline: [
        {
          type: jsPsychFormPage,
          data: { phase: "interpreter", alter_index: i + 1 },
          html: () => {
            const a = ALTERS[i];
            return `
              <p class="small">Person ${i + 1} of ${ALTERS.length}</p>
              <h2>About ${chip(a.code)}</h2>
              <div class="q"><span class="q-label">Which of these best describes who ${chip(a.code)} is to you?</span>
                <div class="opts-grid">${radioList("rel", C.RELATIONSHIP_OPTIONS, "rel_other")}</div></div>
              <div class="q"><span class="q-label">How often are you in contact with ${chip(a.code)}? (in person, by phone, or by message)</span>
                ${radioList("contact", C.CONTACT_OPTIONS)}</div>
              <div class="q"><span class="q-label">How close do you feel to ${chip(a.code)}?</span>
                ${radioScale("close", C.CLOSENESS_OPTIONS)}</div>
              <div class="q"><span class="q-label">Which language do you mostly use with ${chip(a.code)}?</span>
                <div class="opts-grid">${radioList("lang", C.LANGUAGE_OPTIONS, "lang_other")}</div></div>`;
          },
          on_render: (form) => {
            // typing in an "other" box selects its radio
            form.querySelectorAll("input.inline-text").forEach((t) =>
              t.addEventListener("input", () => {
                const r = t.parentElement.querySelector('input[type="radio"]');
                if (r && t.value.trim()) r.checked = true;
              })
            );
          },
          validate: (v) => blanksWarn(v, ["rel", "contact", "close", "lang"], esc(ALTERS[i].name)),
          transform: (v) => {
            const a = ALTERS[i];
            const relOpt = C.RELATIONSHIP_OPTIONS.find((o) => o.value === v.rel);
            return {
              alter: a.code,
              slot: a.slot,
              relationship: v.rel,
              relationship_other: v.rel === "other" ? scrubText(v.rel_other) : null,
              kin: relOpt ? relOpt.kin : null,
              contact: numOrNull(v.contact),
              closeness: numOrNull(v.close),
              language: v.lang,
              language_other: v.lang === "other" ? scrubText(v.lang_other) : null,
              name_flag_ai_keyword: a.ai_keyword,
            };
          },
          on_finish: (data) => {
            out.alters[data.response.alter] = data.response;
          },
        },
      ],
      conditional_function: () => i < ALTERS.length,
    };
  }
  const interpreters = Array.from({ length: C.N_SLOTS }, (_, i) => interpreterPage(i));

  /* 6. Do these people know each other? (all pairs on one page) -------------- */
  const pairList = () => {
    const p = [];
    for (let i = 0; i < ALTERS.length; i++)
      for (let j = i + 1; j < ALTERS.length; j++) p.push([i, j]);
    return p;
  };

  function networkSVG() {
    const W = 380, H = 300, cx = W / 2, cy = H / 2, R = 112;
    const n = ALTERS.length;
    const pos = ALTERS.map((_, k) => {
      const t = (2 * Math.PI * k) / n - Math.PI / 2;
      return [cx + R * Math.cos(t), cy + R * Math.sin(t)];
    });
    const spokes = pos.map(([x, y]) => `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="spoke"/>`).join("");
    const nodes = pos
      .map(([x, y], k) => {
        const label = ALTERS[k].name.length > 12 ? ALTERS[k].name.slice(0, 11) + "…" : ALTERS[k].name;
        return `<g><circle cx="${x}" cy="${y}" r="24" class="alter-node"/><text x="${x}" y="${y + 5}" text-anchor="middle">${esc(label)}</text></g>`;
      })
      .join("");
    return `<svg id="netsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Diagram of the people you listed">
      ${spokes}<g id="tie-lines"></g>
      <circle cx="${cx}" cy="${cy}" r="26" class="ego-node"/><text x="${cx}" y="${cy + 5}" text-anchor="middle" class="ego-text">You</text>
      ${nodes}</svg>`;
  }

  const tiesPage = {
    timeline: [
      {
        type: jsPsychFormPage,
        data: { phase: "alter_ties" },
        html: () => {
          const rows = pairList()
            .map(
              ([i, j]) => `
              <tr><td class="pair">${chip(ALTERS[i].code)} and ${chip(ALTERS[j].code)}</td>
              <td class="tie-opts">${C.TIE_OPTIONS.map(
                (o) => `<label class="opt"><input type="radio" name="tie_${i}_${j}" value="${o.value}">${esc(o.label)}</label>`
              ).join("")}</td></tr>`
            )
            .join("");
          return `
            <h2>Do these people know each other?</h2>
            <p>For each pair, answer <b>Yes</b> if the two of them know each other personally (not just know <i>of</i> each other).</p>
            <div class="net-wrap">${networkSVG()}<p class="small center">The diagram fills in as you answer: solid line = yes, dashed = not sure.</p></div>
            <table class="pairs">${rows}</table>`;
        },
        on_render: (form) => {
          const svg = form.querySelector("#netsvg");
          const g = svg.querySelector("#tie-lines");
          const W = 380, H = 300, cx = W / 2, cy = H / 2, R = 112, n = ALTERS.length;
          const pos = ALTERS.map((_, k) => {
            const t = (2 * Math.PI * k) / n - Math.PI / 2;
            return [cx + R * Math.cos(t), cy + R * Math.sin(t)];
          });
          const redraw = () => {
            let html = "";
            pairList().forEach(([i, j]) => {
              const sel = form.querySelector(`input[name="tie_${i}_${j}"]:checked`);
              if (!sel || sel.value === "no") return;
              html += `<line x1="${pos[i][0]}" y1="${pos[i][1]}" x2="${pos[j][0]}" y2="${pos[j][1]}" class="tie ${sel.value}"/>`;
            });
            g.innerHTML = html;
          };
          form.addEventListener("change", redraw);
        },
        validate: (v) => blanksWarn(v, pairList().map(([i, j]) => `tie_${i}_${j}`)),
        transform: (v) => ({
          ties: pairList().map(([i, j]) => ({
            alter_i: ALTERS[i].code,
            alter_j: ALTERS[j].code,
            knows: v[`tie_${i}_${j}`],
          })),
        }),
        on_finish: (data) => {
          out.ties = data.response.ties;
        },
      },
    ],
    conditional_function: () => ALTERS.length >= 2,
  };

  /* 7. AI as a pseudo-alter ------------------------------------------------- */
  const aiPage = {
    type: jsPsychFormPage,
    data: { phase: "ai_block" },
    html: () => {
      const insteadQ =
        ALTERS.length > 0
          ? `<div class="q"><span class="q-label">In the last six months, have you talked something over with an AI chatbot <i>instead of</i> with any of the people you listed? Tick everyone this applies to.</span>
               ${ALTERS.map((a) => `<label class="opt"><input type="checkbox" name="instead" value="${a.code}">${chip(a.code)}</label>`).join("")}
               <label class="opt"><input type="checkbox" name="instead" value="none">No, none of them</label></div>`
          : `<div class="q"><span class="q-label">In the last six months, have you talked something over with an AI chatbot <i>instead of</i> with a person?</span>
               ${radioList("instead_any", [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }])}</div>`;
      return `
        <h2>AI chatbots</h2>
        <p>Finally, a few questions about AI chatbots (${esc(C.AI_EXAMPLES)}).</p>
        <div class="q"><span class="q-label">How often do you talk with an AI chatbot about personal matters, or about things that are important to you?</span>
          ${radioList("ai_freq", C.AI_FREQUENCY_OPTIONS)}</div>
        <div class="q"><span class="q-label">Thinking of the AI chatbot you use most, how close do you feel to it?</span>
          ${radioScale("ai_close", C.CLOSENESS_OPTIONS)}
          <label class="opt small"><input type="radio" name="ai_close" value="na">Does not apply: I don't use AI chatbots</label></div>
        <div class="q"><span class="q-label">Which language do you mostly use with AI chatbots?</span>
          <div class="opts-grid">${radioList("ai_lang", C.LANGUAGE_OPTIONS.concat([{ value: "na", label: "Does not apply: I don't use AI chatbots" }]), "ai_lang_other")}</div></div>
        ${insteadQ}`;
    },
    on_render: (form) => {
      form.querySelectorAll("input.inline-text").forEach((t) =>
        t.addEventListener("input", () => {
          const r = t.parentElement.querySelector('input[type="radio"]');
          if (r && t.value.trim()) r.checked = true;
        })
      );
      // "none" and named people are mutually exclusive
      form.querySelectorAll('input[name="instead"]').forEach((cb) =>
        cb.addEventListener("change", () => {
          if (!cb.checked) return;
          form.querySelectorAll('input[name="instead"]').forEach((o) => {
            if (o !== cb && (cb.value === "none" || o.value === "none")) o.checked = false;
          });
        })
      );
    },
    validate: (v) =>
      blanksWarn(v, ["ai_freq", "ai_close", "ai_lang", ALTERS.length > 0 ? "instead" : "instead_any"]),
    transform: (v) => {
      let insteadCodes = null, insteadAny = null;
      if (ALTERS.length > 0) {
        if (v.instead && v.instead.length) {
          insteadCodes = v.instead.filter((x) => x !== "none");
          insteadAny = insteadCodes.length > 0 ? "yes" : "no";
        }
      } else {
        insteadAny = v.instead_any;
      }
      return {
        ai_frequency: numOrNull(v.ai_freq),
        ai_closeness: v.ai_close === "na" ? "na" : numOrNull(v.ai_close),
        ai_language: v.ai_lang,
        ai_language_other: v.ai_lang === "other" ? scrubText(v.ai_lang_other) : null,
        ai_instead_any: insteadAny,
        ai_instead_of: insteadCodes, // list of alter codes, or null if unanswered / no alters
      };
    },
    on_finish: (data) => {
      out.ai = data.response;
    },
  };

  /* 8. Anonymise, verify, save, wipe ---------------------------------------- */
  function buildOutput() {
    const n = ALTERS.length;
    const nPairs = (n * (n - 1)) / 2;
    const yes = out.ties.filter((t) => t.knows === "yes").length;
    const unsure = out.ties.filter((t) => t.knows === "unsure").length;
    const missing = out.ties.filter((t) => t.knows === null).length;
    const ai = out.ai || {};
    const insteadSet = new Set(ai.ai_instead_of || []);

    const alters = ALTERS.map((a) => {
      const r = out.alters[a.code] || { alter: a.code, slot: a.slot, name_flag_ai_keyword: a.ai_keyword };
      return Object.assign(
        { participant_id: out.participant_id },
        r,
        { ai_instead: ai.ai_instead_of ? insteadSet.has(a.code) : null }
      );
    });

    return {
      meta: {
        participant_id: out.participant_id,
        task: "ego_network",
        task_version: C.TASK_VERSION,
        test_mode: TEST,
        started_at: out.started_at,
        finished_at: new Date().toISOString(),
        n_slots: C.N_SLOTS,
        name_generator_text: C.NAME_GENERATOR_TEXT,
        names_saved: false,
      },
      ego: {
        participant_id: out.participant_id,
        n_alters: n,
        all_slots_used: n === C.N_SLOTS,
        more_beyond_cap: out.beyond ? out.beyond.more_beyond_cap : null,
        n_more_beyond_cap: out.beyond ? out.beyond.n_more_beyond_cap : null,
        n_pairs: nPairs,
        n_ties_yes: yes,
        n_ties_unsure: unsure,
        n_ties_missing: missing,
        density: nPairs > 0 ? yes / nPairs : null, // unsure/missing counted as "no"; see README
        ai_frequency: ai.ai_frequency ?? null,
        ai_closeness: ai.ai_closeness ?? null,
        ai_language: ai.ai_language ?? null,
        ai_language_other: ai.ai_language_other ?? null,
        ai_instead_any: ai.ai_instead_any ?? null,
        ai_instead_n: ai.ai_instead_of ? ai.ai_instead_of.length : null,
      },
      alters: alters,
      ties: out.ties.map((t) => Object.assign({ participant_id: out.participant_id }, t)),
      trials: jsPsych.data.get().values(),
    };
  }

  function anonymiseAndSave() {
    // (a) build from coded data, (b) independent scrub of every string, (c) verify.
    let result = deepScrub(buildOutput());
    let text = JSON.stringify(result, null, 2);
    const leaks = namePatterns().filter((p) => {
      p.re.lastIndex = 0;
      return p.re.test(
        // ignore controlled-vocabulary values when checking (e.g. a person nicknamed "Friend")
        JSON.stringify(result, (k, v) =>
          (k && STRUCTURAL_KEYS.has(k)) || (typeof v === "string" && CONTROLLED.has(v)) ? undefined : v)
      );
    });
    result.meta.anonymisation_check = leaks.length === 0 ? "passed" : "FAILED";
    if (leaks.length) {
      // Should be unreachable; as a last resort replace in the serialised text.
      text = JSON.stringify(result, null, 2);
      leaks.forEach((p) => (text = text.replace(p.re, "[" + p.code + "]")));
    } else {
      text = JSON.stringify(result, null, 2);
    }

    // Wipe names from memory before anything else happens.
    ALTERS.forEach((a) => (a.name = null));
    out.names_cleared = true;

    const name = `${C.FILE_PREFIX}_${out.participant_id}_${stampForFile()}.json`;
    out.saved_file = { name, text, check: result.meta.anonymisation_check };
    download(name, text);
    window.removeEventListener("beforeunload", warnUnload);
  }

  const save = { type: jsPsychCallFunction, func: anonymiseAndSave, record_data: false };
  const exitFullscreen = { type: jsPsychFullscreen, fullscreen_mode: false, delay_after: 0, record_data: false };

  const finalScreen = {
    type: jsPsychHtmlKeyboardResponse,
    choices: "NO_KEYS",
    record_data: false,
    stimulus: () => `
      <h2>Thank you, you have finished this part</h2>
      <p>The names you typed have now been deleted from this computer. Only the codes were saved.</p>
      <p>Please let the researcher know you are done.</p>
      <div class="panel researcher small">
        Researcher: data file <code>${esc(out.saved_file ? out.saved_file.name : "")}</code> was downloaded.
        Anonymisation check: <b>${esc(out.saved_file ? out.saved_file.check : "")}</b>; names cleared from memory: <b>${out.names_cleared ? "yes" : "no"}</b>.
        <button class="jspsych-btn" id="redl">Download again</button>
      </div>`,
    on_load: () => {
      document.getElementById("redl").addEventListener("click", () => {
        if (out.saved_file) download(out.saved_file.name, out.saved_file.text);
      });
    },
  };

  jsPsych.run([
    setup,
    enterFullscreen,
    intro,
    nameGenerator,
    beyondCap,
    ...interpreters,
    tiesPage,
    aiPage,
    save,
    exitFullscreen,
    finalScreen,
  ]);
})();
