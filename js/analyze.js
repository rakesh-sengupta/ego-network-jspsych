/* ==========================================================================
   In-browser analysis for the ego-network task.
   Reads egonet_*.json files, builds the same three tables as
   analysis/build_network_tables.py, draws one diagram per participant,
   and packs everything into a single zip download. Nothing leaves the browser.
   ========================================================================== */
(function () {
  "use strict";

  const C = CONFIG;
  const REL = Object.fromEntries(C.RELATIONSHIP_OPTIONS.map((o) => [o.value, o]));
  const LANG = Object.fromEntries(C.LANGUAGE_OPTIONS.map((o) => [o.value, o.label]));
  const CONTACT = Object.fromEntries(C.CONTACT_OPTIONS.map((o) => [o.value, o.label]));

  /* ---- colours (reference categorical slots 1–3; validated all-pairs) ---- */
  const COL = {
    family: "#2a78d6",   // slot 1 blue
    peers: "#eb6834",    // slot 2 orange
    other: "#1baf7a",    // slot 3 aqua
    ink: "#0b0b0b",
    ink2: "#52514e",
    muted: "#8a8985",
    spoke: "#b9b8b2",
    surface: "#ffffff",
  };
  const PEERS = new Set(["partner", "friend", "roommate", "classmate", "online_only"]);
  const groupOf = (rel) => (!rel ? "other" : REL[rel] && REL[rel].kin ? "family" : PEERS.has(rel) ? "peers" : "other");
  const GROUP_LABEL = { family: "Family", peers: "Partner, friends & peers", other: "Other / not answered" };

  const DW = 600, DH = 560; // diagram size (px)

  const ALTER_COLS = [
    "participant_id", "alter", "slot", "relationship", "relationship_other", "kin",
    "contact", "closeness", "language", "language_other", "ai_instead", "name_flag_ai_keyword",
  ];
  const TIE_COLS = ["participant_id", "alter_i", "alter_j", "knows"];

  let loaded = [];   // [{fileName, data}]
  let built = null;  // {alters, ties, ego, diagrams:[{pid, file, svg}]}

  const $ = (id) => document.getElementById(id);
  const esc = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNum = (x) => typeof x === "number" && Number.isFinite(x);
  const r4 = (x) => Math.round(x * 10000) / 10000;
  const blank = (x) => (x === null || x === undefined ? "" : x);
  const log = (msg) => ($("log").textContent += msg + "\n");

  /* ---------------- tables (mirror of build_network_tables.py) ------------- */
  function buildTables(files, includeTest, includePilot) {
    const alterRows = [], tieRows = [], egoRows = [], diagrams = [];
    const relCats = new Set();
    const seen = {};

    files.forEach(({ fileName, data: d }) => {
      if (!d || !d.meta || !d.ego || !Array.isArray(d.alters)) {
        log(`skip (not an egonet file): ${fileName}`);
        return;
      }
      const meta = d.meta, ego = d.ego, alters = d.alters, ties = d.ties || [];
      const stype = meta.session_type || (meta.test_mode ? "test" : "real");
      if ((meta.test_mode || stype === "test") && !includeTest) {
        log(`skip (test mode): ${fileName}`);
        return;
      }
      if (stype === "pilot" && !includePilot) {
        log(`skip (pilot): ${fileName}`);
        return;
      }
      if (meta.anonymisation_check !== "passed")
        log(`WARNING: anonymisation check did not pass in ${fileName}: open it and inspect before use`);
      const pid = meta.participant_id;
      seen[pid] = (seen[pid] || 0) + 1;

      alters.forEach((a) => {
        const row = {};
        ALTER_COLS.forEach((c) => (row[c] = blank(a[c])));
        alterRows.push(row);
        if (a.relationship) relCats.add(a.relationship);
      });
      ties.forEach((t) => {
        const row = {};
        TIE_COLS.forEach((c) => (row[c] = blank(t[c])));
        tieRows.push(row);
      });

      const n = alters.length;
      const pairs = (n * (n - 1)) / 2;
      const yes = ties.filter((t) => t.knows === "yes").length;
      const unsure = ties.filter((t) => t.knows === "unsure").length;
      const kinKnown = alters.filter((a) => a.kin !== null && a.kin !== undefined).map((a) => (a.kin ? 1 : 0));
      const langs = alters.map((a) => a.language).filter(Boolean);
      const lc = {};
      langs.forEach((l) => (lc[l] = (lc[l] || 0) + 1));
      const lcs = Object.entries(lc).sort((x, y) => y[1] - x[1]);
      const modal = lcs.length && (lcs.length === 1 || lcs[0][1] > lcs[1][1]) ? lcs[0][0] : null;
      const aiLang = ego.ai_language;
      const aiMatch = modal && aiLang && aiLang !== "na" ? (aiLang === modal ? 1 : 0) : "";
      const meanOf = (k) => {
        const xs = alters.map((a) => a[k]).filter(isNum);
        return xs.length ? r4(xs.reduce((s, x) => s + x, 0) / xs.length) : "";
      };
      const rels = {};
      alters.forEach((a) => a.relationship && (rels[a.relationship] = (rels[a.relationship] || 0) + 1));

      egoRows.push({
        participant_id: pid,
        session_type: stype,
        file: fileName,
        size: n,
        all_slots_used: ego.all_slots_used,
        more_beyond_cap: blank(ego.more_beyond_cap),
        n_pairs: pairs,
        n_ties_yes: yes,
        n_ties_unsure: unsure,
        n_ties_blank: ties.filter((t) => t.knows === null).length,
        density_strict: pairs ? r4(yes / pairs) : "",
        density_lenient: pairs ? r4((yes + unsure) / pairs) : "",
        n_kin: kinKnown.reduce((s, x) => s + x, 0),
        prop_kin: kinKnown.length ? r4(kinKnown.reduce((s, x) => s + x, 0) / kinKnown.length) : "",
        mean_closeness: meanOf("closeness"),
        mean_contact: meanOf("contact"),
        n_strong_ties: alters.filter((a) => Number.isInteger(a.closeness) && Number.isInteger(a.contact) && a.closeness >= 4 && a.contact >= 3).length,
        n_languages: new Set(langs).size,
        modal_language: modal || "",
        ai_frequency: blank(ego.ai_frequency),
        ai_closeness: blank(ego.ai_closeness),
        ai_language: blank(aiLang),
        ai_lang_matches_modal: aiMatch,
        ai_instead_any: blank(ego.ai_instead_any),
        ai_instead_n: blank(ego.ai_instead_n),
        n_alters_named_like_ai: alters.filter((a) => a.name_flag_ai_keyword).length,
        n_alters_rel_ai: alters.filter((a) => a.relationship === "ai").length,
        session_duration_s: blank(meta.session_duration_s),
        _pf: d.pilot_feedback || {},
        _rels: rels,
      });

      diagrams.push({ pid, file: fileName, svg: drawEgo(pid, ego, alters, ties) });
    });

    const cats = [...relCats].sort();
    egoRows.forEach((r) => {
      const rels = r._rels;
      delete r._rels;
      cats.forEach((c) => (r["n_rel_" + c] = rels[c] || 0));
      const pf = r._pf;
      delete r._pf;
      Object.keys(pf).forEach((k) => (r[k] = blank(pf[k])));
    });

    const dups = Object.keys(seen).filter((p) => seen[p] > 1);
    if (dups.length) log("WARNING: more than one file for participant(s): " + dups.join(", "));
    return { alters: alterRows, ties: tieRows, ego: egoRows, diagrams };
  }

  /* ---------------- CSV (same conventions as Python's csv module) ---------- */
  function toCSV(rows, cols) {
    if (!cols) {
      cols = [];
      rows.forEach((r) => Object.keys(r).forEach((k) => !cols.includes(k) && cols.push(k)));
    }
    const cell = (v) => {
      if (v === true) v = "True";
      else if (v === false) v = "False";
      v = v === null || v === undefined ? "" : String(v);
      return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return [cols.join(",")].concat(rows.map((r) => cols.map((c) => cell(r[c])).join(","))).join("\r\n") + "\r\n";
  }

  /* ---------------- diagram ------------------------------------------------ */
  function drawEgo(pid, ego, alters, ties) {
    const W = DW, H = DH, cx = DW / 2, cy = 262, R = 124;
    const n = alters.length;
    const pos = {};
    alters.forEach((a, k) => {
      const t = (2 * Math.PI * k) / Math.max(n, 1) - Math.PI / 2;
      pos[a.alter] = { x: cx + R * Math.cos(t), y: cy + R * Math.sin(t), t };
    });
    const nPairs = (n * (n - 1)) / 2;
    const yes = ties.filter((t) => t.knows === "yes").length;
    const density = nPairs ? (yes / nPairs).toFixed(2) : "–";

    const aiUsed = isNum(ego.ai_frequency) && ego.ai_frequency > 0;
    const AI = { x: W - 48, y: 64 };

    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">`;
    s += `<rect width="${W}" height="${H}" fill="${COL.surface}"/>`;
    s += `<text x="16" y="26" font-size="15" font-weight="600" fill="${COL.ink}">${esc(pid)}</text>`;
    s += `<text x="16" y="45" font-size="12" fill="${COL.ink2}">size ${n} · density ${density}${n === C.N_SLOTS && ego.more_beyond_cap === "yes" ? " · more beyond cap" : ""}</text>`;

    // ego -> alter spokes (width = closeness)
    alters.forEach((a) => {
      const p = pos[a.alter];
      const w = isNum(a.closeness) ? 1 + (a.closeness - 1) * 1.1 : 1;
      s += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="${COL.spoke}" stroke-width="${w}" stroke-linecap="round"${isNum(a.closeness) ? "" : ' stroke-dasharray="4 4"'}/>`;
    });
    // alter-alter ties
    ties.forEach((t) => {
      if (t.knows !== "yes" && t.knows !== "unsure") return;
      const a = pos[t.alter_i], b = pos[t.alter_j];
      if (!a || !b) return;
      s += t.knows === "yes"
        ? `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${COL.ink2}" stroke-width="2" stroke-linecap="round"/>`
        : `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${COL.muted}" stroke-width="1.5" stroke-dasharray="6 5"/>`;
    });
    // AI pseudo-node and "instead of" links
    if (aiUsed || ego.ai_instead_any === "yes") {
      const w = isNum(ego.ai_closeness) ? 1 + (ego.ai_closeness - 1) * 1.1 : 1;
      s += `<line x1="${cx}" y1="${cy}" x2="${AI.x}" y2="${AI.y}" stroke="${COL.spoke}" stroke-width="${w}" stroke-dasharray="7 4"/>`;
      alters.filter((a) => a.ai_instead === true).forEach((a) => {
        const p = pos[a.alter];
        s += `<line x1="${AI.x}" y1="${AI.y}" x2="${p.x}" y2="${p.y}" stroke="${COL.ink2}" stroke-width="1.5" stroke-dasharray="1.5 4" stroke-linecap="round"/>`;
      });
      const freq = (C.AI_FREQUENCY_OPTIONS.find((o) => o.value === ego.ai_frequency) || {}).label || "not answered";
      const aiTip = `AI chatbot\npersonal talk: ${freq}\ncloseness: ${blank(ego.ai_closeness) || "–"}\nlanguage: ${LANG[ego.ai_language] || ego.ai_language || "–"}`;
      s += `<g><title>${esc(aiTip)}</title>`;
      s += `<circle cx="${AI.x}" cy="${AI.y}" r="17" fill="${COL.surface}" stroke="${COL.ink2}" stroke-width="2" stroke-dasharray="4 3"/>`;
      s += `<text x="${AI.x}" y="${AI.y + 4}" font-size="11" font-weight="600" text-anchor="middle" fill="${COL.ink}">AI</text></g>`;
    }
    // ego
    s += `<circle cx="${cx}" cy="${cy}" r="21" fill="${COL.ink}" stroke="${COL.surface}" stroke-width="2"/>`;
    s += `<text x="${cx}" y="${cy + 4}" font-size="11" font-weight="600" text-anchor="middle" fill="${COL.surface}">ego</text>`;
    // alters
    alters.forEach((a) => {
      const p = pos[a.alter];
      const g = groupOf(a.relationship);
      const relLabel = a.relationship ? (a.relationship === "other" && a.relationship_other ? a.relationship_other : (REL[a.relationship] || {}).label || a.relationship) : "not answered";
      const tip = `${a.alter}: ${relLabel}\ncloseness: ${blank(a.closeness) || "–"}\ncontact: ${CONTACT[a.contact] || "–"}\nlanguage: ${LANG[a.language] || a.language_other || a.language || "–"}${a.ai_instead ? "\nAI used instead: yes" : ""}`;
      s += `<g><title>${esc(tip)}</title>`;
      s += `<circle cx="${p.x}" cy="${p.y}" r="15" fill="${COL[g]}" stroke="${COL.surface}" stroke-width="2"/>`;
      // label outside the node, radially
      const lx = cx + (R + 34) * Math.cos(p.t), ly = cy + (R + 34) * Math.sin(p.t);
      const anchor = Math.abs(Math.cos(p.t)) < 0.3 ? "middle" : Math.cos(p.t) > 0 ? "start" : "end";
      const short = relLabel.length > 18 ? relLabel.slice(0, 17) + "…" : relLabel;
      const langShort = LANG[a.language] ? LANG[a.language].replace(/ \(.*$/, "").replace("A mix of languages, with no main one", "mixed") : a.language_other || "";
      s += `<text x="${lx}" y="${ly - 3}" font-size="12" font-weight="600" text-anchor="${anchor}" fill="${COL.ink}">${esc(a.alter)}</text>`;
      s += `<text x="${lx}" y="${ly + 11}" font-size="10.5" text-anchor="${anchor}" fill="${COL.ink2}">${esc(short)}${langShort ? " · " + esc(langShort) : ""}</text></g>`;
    });
    if (n === 0)
      s += `<text x="${cx}" y="${cy + 52}" font-size="12" text-anchor="middle" fill="${COL.ink2}">named nobody</text>`;

    // legend
    let ly = H - 56;
    let lx = 16;
    Object.keys(GROUP_LABEL).forEach((g) => {
      s += `<circle cx="${lx + 6}" cy="${ly}" r="6" fill="${COL[g]}"/><text x="${lx + 17}" y="${ly + 4}" font-size="11" fill="${COL.ink2}">${esc(GROUP_LABEL[g])}</text>`;
      lx += 30 + GROUP_LABEL[g].length * 6.2;
    });
    ly += 22; lx = 16;
    const leg = [
      [`stroke="${COL.ink2}" stroke-width="2"`, "know each other"],
      [`stroke="${COL.muted}" stroke-width="1.5" stroke-dasharray="6 5"`, "not sure"],
      [`stroke="${COL.ink2}" stroke-width="1.5" stroke-dasharray="1.5 4" stroke-linecap="round"`, "AI instead of"],
      [`stroke="${COL.spoke}" stroke-width="4"`, "thicker = closer"],
    ];
    leg.forEach(([st, label]) => {
      s += `<line x1="${lx}" y1="${ly}" x2="${lx + 24}" y2="${ly}" ${st}/><text x="${lx + 30}" y="${ly + 4}" font-size="11" fill="${COL.ink2}">${esc(label)}</text>`;
      lx += 46 + label.length * 6.0;
    });
    s += `</svg>`;
    return s;
  }

  function overviewSVG(diagrams) {
    const cols = Math.min(4, Math.max(1, diagrams.length));
    const w = DW, h = DH, scale = 0.5;
    const rows = Math.ceil(diagrams.length / cols);
    const W = cols * w * scale, H = rows * h * scale;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>`;
    diagrams.forEach((d, i) => {
      const x = (i % cols) * w * scale, y = Math.floor(i / cols) * h * scale;
      s += d.svg.replace("<svg ", `<svg x="${x}" y="${y}" `).replace(` width="${DW}" height="${DH}"`, ` width="${w * scale}" height="${h * scale}"`);
    });
    return s + `</svg>`;
  }

  function svgToPng(svg, scale) {
    return new Promise((resolve, reject) => {
      const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
      const w = Number(m[1]) * scale, h = Number(m[2]) * scale;
      const img = new Image();
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        c.toBlob((b) => b.arrayBuffer().then((ab) => resolve(new Uint8Array(ab))), "image/png");
      };
      img.onerror = () => reject(new Error("could not render diagram to PNG"));
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  /* ---------------- minimal zip writer (stored, no compression) ------------ */
  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (u8) => {
    let c = 0xffffffff;
    for (let i = 0; i < u8.length; i++) c = CRC_TABLE[(c ^ u8[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  function makeZip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    files.forEach(({ name, data }) => {
      const bytes = typeof data === "string" ? enc.encode(data) : data;
      const nameB = enc.encode(name);
      const crc = crc32(bytes);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, bytes.length, true); lh.setUint32(22, bytes.length, true);
      lh.setUint16(26, nameB.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nameB, bytes);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, bytes.length, true); ch.setUint32(24, bytes.length, true);
      ch.setUint16(28, nameB.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), nameB);
      offset += 30 + nameB.length + bytes.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: "application/zip" });
  }

  function downloadBlob(name, blob) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ---------------- summary panel ------------------------------------------ */
  function describe(xs) {
    xs = xs.filter(isNum);
    if (!xs.length) return null;
    const n = xs.length, m = xs.reduce((a, b) => a + b, 0) / n;
    const sd = n > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1)) : 0;
    const s = xs.slice().sort((a, b) => a - b);
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    return { n, m, sd, med, min: s[0], max: s[n - 1] };
  }
  function renderStats(ego) {
    const f = (x, d = 2) => (x === null || x === undefined ? "–" : Number(x).toFixed(d));
    const rows = [
      ["Network size", "size"], ["Density (strict)", "density_strict"], ["Density (lenient)", "density_lenient"],
      ["Proportion family", "prop_kin"], ["Mean closeness (1–5)", "mean_closeness"], ["Mean contact (1–5)", "mean_contact"],
      ["Strong ties", "n_strong_ties"], ["AI personal-talk frequency (0–5)", "ai_frequency"],
    ];
    let h = `<table class="stats"><tr><th>Measure</th><th>n</th><th>mean</th><th>SD</th><th>median</th><th>min</th><th>max</th></tr>`;
    rows.forEach(([label, k]) => {
      const d = describe(ego.map((r) => (r[k] === "" ? null : Number(r[k]))));
      h += d
        ? `<tr><td>${label}</td><td>${d.n}</td><td>${f(d.m)}</td><td>${f(d.sd)}</td><td>${f(d.med)}</td><td>${f(d.min)}</td><td>${f(d.max)}</td></tr>`
        : `<tr><td>${label}</td><td>0</td><td colspan="5">–</td></tr>`;
    });
    h += `</table>`;

    const sizes = {};
    ego.forEach((r) => (sizes[r.size] = (sizes[r.size] || 0) + 1));
    const dens = ego.filter((r) => r.density_strict !== "");
    const atCeil = dens.filter((r) => Number(r.density_strict) === 1).length;
    const capped = ego.filter((r) => r.all_slots_used).length;
    const beyond = ego.filter((r) => r.more_beyond_cap === "yes").length;
    const aiYes = ego.filter((r) => r.ai_instead_any === "yes").length;
    const aiAns = ego.filter((r) => r.ai_instead_any !== "").length;
    h += `<p class="small"><b>${ego.length}</b> participants.
      Size distribution: ${Object.keys(sizes).sort((a, b) => a - b).map((k) => `${k} people: ${sizes[k]}`).join(" · ")}.<br>
      <b>Density ceiling check:</b> ${atCeil} of ${dens.length} participants with 2+ people (${dens.length ? Math.round((100 * atCeil) / dens.length) : 0}%) have density = 1.<br>
      <b>Cap check:</b> ${capped} filled all ${C.N_SLOTS} boxes; ${beyond} said there was someone else they would have listed.<br>
      <b>AI instead of a person:</b> ${aiYes} of ${aiAns} who answered.</p>`;
    const pilots = ego.filter((r) => r.session_type === "pilot");
    if (pilots.length) {
      const durs = describe(ego.map((r) => (r.session_duration_s === "" ? null : Number(r.session_duration_s))));
      const cell = (v) => `<td style="text-align:left">${esc(v === undefined ? "" : v)}</td>`;
      h += `<h3>Pilot feedback (${pilots.length} pilot participant${pilots.length > 1 ? "s" : ""})</h3>
        <p class="small">Task duration: ${durs ? `median ${(durs.med / 60).toFixed(1)} min, range ${(durs.min / 60).toFixed(1)}–${(durs.max / 60).toFixed(1)} min` : "–"}.</p>
        <table class="stats pf"><tr><th>code</th><th>clarity</th><th>names felt safe</th><th>length</th><th>min</th><th>confusing</th><th>uncomfortable</th><th>comments</th></tr>
        ${pilots.map((r) => `<tr><td>${esc(r.participant_id)}</td><td>${esc(blank(r.pf_clarity))}</td><td>${esc(blank(r.pf_names_felt_safe))}</td>
          <td>${esc(String(blank(r.pf_length)).replace(/_/g, " "))}</td><td>${r.session_duration_s === "" ? "" : (Number(r.session_duration_s) / 60).toFixed(1)}</td>
          ${cell(r.pf_confusing)}${cell(r.pf_uncomfortable)}${cell(r.pf_comments)}</tr>`).join("")}</table>`;
    }
    $("stats").innerHTML = h;
  }

  /* ---------------- UI wiring ---------------------------------------------- */
  async function readFiles(fileList) {
    $("log").textContent = "";
    const arr = [...fileList].filter((f) => /\.json$/i.test(f.name));
    loaded = [];
    for (const f of arr) {
      try {
        loaded.push({ fileName: f.name, data: JSON.parse(await f.text()) });
      } catch (e) {
        log(`could not read ${f.name}: ${e.message}`);
      }
    }
    run();
  }

  function run() {
    if (!loaded.length) return;
    $("log").textContent = $("log").textContent.split("\n").filter((l) => l.startsWith("could not")).join("\n");
    loaded.sort((a, b) => (a.fileName < b.fileName ? -1 : a.fileName > b.fileName ? 1 : 0)); // same order as Python sorted()
    built = buildTables(loaded, $("incTest").checked, $("incPilot").checked);
    $("results").classList.toggle("hidden", !built.ego.length);
    $("dlAll").disabled = !built.ego.length;
    if (!built.ego.length) { log("No usable files."); return; }
    renderStats(built.ego);
    $("grid").innerHTML = built.diagrams
      .map((d, i) => `<div class="card">${d.svg}<div class="small"><a href="#" data-i="${i}" data-kind="svg">SVG</a><a href="#" data-i="${i}" data-kind="png">PNG</a> <span>${esc(d.file)}</span></div></div>`)
      .join("");
  }

  $("grid").addEventListener("click", async (e) => {
    const a = e.target.closest("a[data-i]");
    if (!a) return;
    e.preventDefault();
    const d = built.diagrams[Number(a.dataset.i)];
    if (a.dataset.kind === "svg") downloadBlob(`network_${d.pid}.svg`, new Blob([d.svg], { type: "image/svg+xml" }));
    else downloadBlob(`network_${d.pid}.png`, new Blob([await svgToPng(d.svg, 2)], { type: "image/png" }));
  });

  $("dlAll").addEventListener("click", () =>
    buildZip().catch((e) => {
      log("ERROR while preparing the zip: " + e.message);
      $("dlAll").disabled = false;
      $("dlAll").textContent = "Download tables + diagrams (.zip)";
    })
  );
  async function buildZip() {
    if (!built) return;
    $("dlAll").disabled = true;
    $("dlAll").textContent = "Preparing…";
    const files = [
      { name: "alters.csv", data: toCSV(built.alters, ALTER_COLS) },
      { name: "ties.csv", data: toCSV(built.ties, TIE_COLS) },
      { name: "ego_summary.csv", data: toCSV(built.ego) },
    ];
    const used = {};
    for (const d of built.diagrams) {
      used[d.pid] = (used[d.pid] || 0) + 1;
      const base = `diagrams/network_${d.pid}${used[d.pid] > 1 ? "_" + used[d.pid] : ""}`;
      files.push({ name: base + ".svg", data: d.svg });
      files.push({ name: base + ".png", data: await svgToPng(d.svg, 2) });
    }
    const ov = overviewSVG(built.diagrams);
    files.push({ name: "all_networks.svg", data: ov });
    files.push({ name: "all_networks.png", data: await svgToPng(ov, 2) });
    const stamp = new Date().toISOString().slice(0, 10);
    downloadBlob(`egonet_analysis_${stamp}.zip`, makeZip(files));
    $("dlAll").disabled = false;
    $("dlAll").textContent = "Download tables + diagrams (.zip)";
  }

  $("files").addEventListener("change", (e) => readFiles(e.target.files));
  $("incTest").addEventListener("change", run);
  $("incPilot").addEventListener("change", run);
  const drop = $("drop");
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => readFiles(e.dataTransfer.files));
})();
