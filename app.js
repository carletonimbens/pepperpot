
/* ======= Pepperpot Static (LocalStorage) =======
   Re-implements essential Streamlit behaviors using just HTML+JS.
   - Users are stored in localStorage under key "pp_users" (object map)
   - Current session login lives in sessionStorage under "pp_user"
   - Per-user prefs live in localStorage under "pp_prefs_<username>"
   Password = SHA-256(username + "|" + dance + "|" + colorHex + "|" + salt)
================================================== */

const DANCE_OPTIONS = [
  "Amer. Waltz", "Amer. Tango", "Amer. Foxtrot", "Amer. Viennese Waltz",
  "Int'l Waltz", "Int'l Tango", "Int'l Viennese Waltz", "Int'l Foxtrot", "Quickstep",
  "Cha Cha", "Rumba", "Samba", "Paso Doble", "Jive", "Swing", "Bolero", "Mambo"
];

const COLOR_PALETTE = {
  "Pink": "#FFD1DC",
  "Coral": "#FFD8A8",
  "Mint": "#D3F9D8",
  "Sky": "#D0EBFF",
  "Lavender": "#E5D1FF",
  "Sunflower": "#FFE066",
  "Teal": "#63E6BE",
  "Red": "#FF6B6B",
  "Blue": "#74C0FC",
  "Green": "#8CE99A",
  "Orange": "#FFC078",
  "Gray": "#CED4DA"
};

// --- GitHub users.json bootstrap + export/import helpers ---
async function fetchRepoUsers() {
  try {
    const resp = await fetch("users.json", { cache: "no-store" });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && typeof data === "object") return data;
  } catch (e) { /* ignore */ }
  return null;
}
function mergeUsers(incoming) {
  if (!incoming || typeof incoming !== "object") return 0;
  const existing = getUsers();
  let added = 0;
  for (const [k, v] of Object.entries(incoming)) {
    if (!existing[k]) { existing[k] = v; added += 1; }
  }
  setUsers(existing);
  return added;
}
async function exportUsers() {
  const data = JSON.stringify(getUsers(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "users.json";
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(a.href);
  a.remove();
}
async function importUsersFromFile(file) {
  const text = await file.text();
  const obj = JSON.parse(text);
  return mergeUsers(obj);
}


const STYLE_LEVEL_ONLY = new Set(["Novice","Prechamp","Champ"]);
const LEVEL_SYNONYMS = { prechamp: ["prechamp","pre-champ","pre champ","prechampionship"],
                         champ: ["champ","championship"] };

function getUsers() {
  return JSON.parse(localStorage.getItem("pp_users") || "{}");
}
function setUsers(obj) {
  localStorage.setItem("pp_users", JSON.stringify(obj));
}
function getUser(username) {
  return getUsers()[username] || null;
}
function createUser(rec) {
  const users = getUsers();
  if (users[rec.username]) return false;
  users[rec.username] = rec;
  setUsers(users);
  return true;
}
function updateUser(username, updater) {
  const users = getUsers();
  if (!users[username]) return false;
  users[username] = Object.assign({}, users[username], updater);
  setUsers(users);
  return true;
}
function touchUser(username) {
  updateUser(username, { updated_at: new Date().toISOString() });
}
function getPrefs(username) {
  return JSON.parse(localStorage.getItem("pp_prefs_" + username) || "{}");
}
function setPrefs(username, prefs) {
  localStorage.setItem("pp_prefs_" + username, JSON.stringify(prefs));
}
function setSessionUser(u) {
  sessionStorage.setItem("pp_user", JSON.stringify(u));
}
function getSessionUser() {
  const raw = sessionStorage.getItem("pp_user");
  return raw ? JSON.parse(raw) : null;
}
function clearSession() { sessionStorage.removeItem("pp_user"); }

async function sha256Hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}

function genSalt(len=16) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i=0; i<len; i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}

async function makeHash(username, dance, colorHex, salt) {
  return await sha256Hex(`${username}|${dance}|${colorHex}|${salt}`);
}

// Theme + profile helpers
function loadThemeAndProfile(username=null) {
  const base = {
    theme_c1: "#FFD1DC", // ≥7
    theme_c2: "#FFD8A8", // negative → X
    theme_c3: "#D3F9D8", // 1–6
    theme_c4: "#D0EBFF", // extra/unused
    display_name: ""
  };
  if (username) {
    const p = getPrefs(username);
    for (const k of Object.keys(base)) if (k in p) base[k] = p[k];
  }
  return base;
}

/* =======================
   Shared UI helpers
======================= */

function renderHeader(active="") {
  const user = getSessionUser();
  fetchRepoUsers().then(db => { if (db) { const added = mergeUsers(db); if (added>0) toast(`Loaded ${added} account(s) from repo.`); }});
  const nav = [`<a href="./index.html"${active==="home"?' style="outline: 2px solid var(--accent)"':''}>Home</a>`];
  nav.push(`<a href="./my-account.html"${active==="acct"?' style="outline: 2px solid var(--accent)"':''}>My Account</a>`);
  nav.push(`<a href="./cda-lookup.html"${active==="cda"?' style="outline: 2px solid var(--accent)"':''}>CDA Lookup</a>`);
  const who = user ? `<span class="badge"><span class="dot" style="background:#22c55e"></span> ${user.id}</span>`
                   : `<span class="badge"><span class="dot" style="background:#ef4444"></span> Signed out</span>`;
  return `
  <div class="header container">
    <div class="brand">
      <img src="pepperpot_wordmark.png" alt="Pepperpot" onerror="this.src='assets/pepperpot_wordmark.png'; this.onerror=null;">
      <div>
        <div style="opacity:.85">Pepperpot</div>
        ${who}
      </div>
    </div>
    <nav>${nav.join("")}</nav>
  </div>`;
}

function ensureLoggedIn(redirectIfMissing=false) {
(redirectIfMissing=false) {
  const u = getSessionUser();
  if (!u && redirectIfMissing) { window.location.href = "index.html"; }
  return u;
}

/* =======================
   Home page logic
======================= */
async function homeInit() {
  document.getElementById("mount-header").innerHTML = renderHeader("home");
  const user = getSessionUser();
  fetchRepoUsers().then(db => { if (db) { const added = mergeUsers(db); if (added>0) toast(`Loaded ${added} account(s) from repo.`); }});
  const signed = document.getElementById("signed-in");
  const authWrap = document.getElementById("auth-wrap");

  if (user) {
    signed.style.display = "block";
    authWrap.style.display = "none";
    document.getElementById("signed-name").textContent = user.id;
    return;
  }

  // Sign up controls
  const suUser = document.getElementById("su_user");
  const suDance = document.getElementById("su_dance");
  const suColor = document.getElementById("su_color");
  for (const d of DANCE_OPTIONS) suDance.append(new Option(d, d));
  for (const name of Object.keys(COLOR_PALETTE)) suColor.append(new Option(name, name));

  document.getElementById("btn-signup").addEventListener("click", async () => {
    const username = suUser.value.trim();
    const dance = suDance.value;
    const colorName = suColor.value;
    if (!username || !/^[A-Za-z0-9_]+$/.test(username)) return toast("Username must be letters/numbers/underscores.", true);
    if (getUser(username)) return toast("That username is taken.", true);
    const salt = genSalt();
    const colorHex = COLOR_PALETTE[colorName];
    const passHash = await makeHash(username, dance, colorHex, salt);
    const ok = createUser({
      username, pass_hash: passHash, salt, fav_dance: dance,
      fav_color_name: colorName, fav_color_hex: colorHex,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    });
    if (ok) {
      setSessionUser({ id: username, name: username });
      toast("Account created and signed in!");
      window.location.reload();
    } else {
      toast("Could not create account. Try another username.", true);
    }
  });

  // Login controls
  const lgUser = document.getElementById("lg_user");
  const lgDance = document.getElementById("lg_dance");
  const lgColor = document.getElementById("lg_color");
  lgDance.append(new Option("—", "—"));
  for (const d of DANCE_OPTIONS) lgDance.append(new Option(d, d));
  lgColor.append(new Option("—", "—"));
  for (const name of Object.keys(COLOR_PALETTE)) lgColor.append(new Option(name, name));

  document.getElementById("btn-login").addEventListener("click", async () => {
    const username = lgUser.value.trim();
    const dance = lgDance.value;
    const colorName = lgColor.value;
    if (!username) return toast("Enter your username.", true);
    if (dance==="—" || colorName==="—") return toast("Select your favorite dance and color.", true);
    const rec = getUser(username);
    if (!rec) return toast("Unknown username.", true);
    const attempt = await makeHash(username, dance, COLOR_PALETTE[colorName], rec.salt);
    if (attempt === rec.pass_hash) {
      setSessionUser({ id: username, name: username });
      touchUser(username);
      toast("Signed in!");
      window.location.reload();
    } else {
      toast("Dance + color do not match. Try again.", true);
    }
  });
}

function signOut() {
  clearSession();
  sessionStorage.removeItem("pp_theme_overrides");
  toast("Signed out.");
  window.location.reload();
}

/* =======================
   Account page logic
======================= */
async function accountInit() {
  document.getElementById("mount-header").innerHTML = renderHeader("acct");
  const user = ensureLoggedIn(false);
  if (!user) {
    document.getElementById("need-login").style.display = "block";
    document.getElementById("account-wrap").style.display = "none";
    return;
  }

  const uid = user.id;
  const defaults = { display_name: "", theme_c1: "#FFD1DC", theme_c2: "#FFD8A8", theme_c3: "#D3F9D8", theme_c4: "#D0EBFF" };
  const db = getPrefs(uid);
  const prefs = Object.assign({}, defaults, db);

  // Load current login combo
  const row = getUser(uid);
  if (!row) {
    document.getElementById("account-wrap").innerHTML = `<div class="notice error">Account record not found. Please sign out and sign in again.</div>`;
    return;
  }

  // Populate fields
  document.getElementById("display_name").value = prefs.display_name;
  const [c1,c2,c3,c4] = ["theme_c1","theme_c2","theme_c3","theme_c4"].map(k => prefs[k]);
  document.getElementById("c1").value = c1;
  document.getElementById("c2").value = c2;
  document.getElementById("c3").value = c3;
  document.getElementById("c4").value = c4;

  const danceSel = document.getElementById("login_dance");
  const colorSel = document.getElementById("login_color");
  for (const d of DANCE_OPTIONS) danceSel.append(new Option(d, d));
  for (const name of Object.keys(COLOR_PALETTE)) colorSel.append(new Option(name, name));

  danceSel.value = row.fav_dance;
  colorSel.value = row.fav_color_name;
  document.getElementById("color_preview").style.background = row.fav_color_hex;

  colorSel.addEventListener("change", () => {
    document.getElementById("color_preview").style.background = COLOR_PALETTE[colorSel.value];
  });

  function snapshot() {
    return {
      display_name: document.getElementById("display_name").value.trim(),
      theme_c1: document.getElementById("c1").value,
      theme_c2: document.getElementById("c2").value,
      theme_c3: document.getElementById("c3").value,
      theme_c4: document.getElementById("c4").value
    };
  }
  const baselinePrefs = Object.assign({}, prefs);
  const baselineLogin = { dance: row.fav_dance, colorName: row.fav_color_name };

  function isDirty() {
    const cur = snapshot();
    for (const k of Object.keys(baselinePrefs)) if (String(cur[k]) !== String(baselinePrefs[k])) return true;
    if (danceSel.value !== baselineLogin.dance || colorSel.value !== baselineLogin.colorName) return true;
    return false;
  }

  function showBanner(show) {
    document.getElementById("unsaved-banner").style.display = show ? "block" : "none";
  }

  for (const id of ["display_name","c1","c2","c3","c4","login_dance","login_color"]) {
    document.getElementById(id).addEventListener("input", () => showBanner(isDirty()));
    document.getElementById(id).addEventListener("change", () => showBanner(isDirty()));
  }


// Wire sync/backup controls if present
const expBtn = document.getElementById("btn-export-users");
const impFile = document.getElementById("import-users-file");
const impBtn = document.getElementById("btn-import-users");
const syncBtn = document.getElementById("btn-sync-remote");
if (expBtn) expBtn.addEventListener("click", exportUsers);
if (impBtn && impFile) impBtn.addEventListener("click", async () => {
  if (!impFile.files || !impFile.files[0]) { toast("Choose a JSON file first.", true); return; }
  try { const added = await importUsersFromFile(impFile.files[0]); toast(`Imported ${added} account(s).`); }
  catch(e){ toast("Bad JSON file.", true); }
});
if (syncBtn) syncBtn.addEventListener("click", async () => {
  const db = await fetchRepoUsers(); if (!db) { toast("No users.json in repo.", true); return; }
  const added = mergeUsers(db); toast(`Loaded ${added} account(s) from repo.`);
});

document.getElementById("btn-save").addEventListener("click", async () => {

    // Save profile + theme
    const cur = snapshot();
    setPrefs(uid, cur);
    // Save login combo if changed
    if (danceSel.value !== baselineLogin.dance || colorSel.value !== baselineLogin.colorName) {
      const salt = genSalt();
      const newHex = COLOR_PALETTE[colorSel.value];
      const passHash = await makeHash(uid, danceSel.value, newHex, salt);
      updateUser(uid, {
        pass_hash: passHash, salt: salt,
        fav_dance: danceSel.value, fav_color_name: colorSel.value, fav_color_hex: newHex
      });
    }
    // Mirror overrides for other pages (read from localStorage on load)
    setPrefs(uid, Object.assign({}, getPrefs(uid), cur));
    baselineLogin.dance = danceSel.value;
    baselineLogin.colorName = colorSel.value;
    for (const k of Object.keys(cur)) baselinePrefs[k] = cur[k];
    showBanner(false);
    toast("Saved!");
  });
}

/* =======================
   CDA Lookup page logic
======================= */
function normalizeStr(s) { return (s||"").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function possibleLevelKeys(level) {
  const key = normalizeStr(level);
  const out = [key];
  if (LEVEL_SYNONYMS[key]) out.push(...LEVEL_SYNONYMS[key].map(normalizeStr));
  return Array.from(new Set(out));
}
function buildColumnIndex(headers) {
  const map = {};
  headers.forEach(h => { map[normalizeStr(h)] = h; });
  return map;
}
function findHeaderForCombo(colIndex, style, level, danceFull) {
  const styleN = normalizeStr(style), danceN = normalizeStr(danceFull);
  for (const lvlN of possibleLevelKeys(level)) {
    const t1 = `${styleN} ${lvlN} ${danceN}`, t2 = `${lvlN} ${styleN} ${danceN}`;
    if (t1 in colIndex) return colIndex[t1];
    if (t2 in colIndex) return colIndex[t2];
  }
  return null;
}
function findHeaderForStyleLevel(colIndex, style, level) {
  const styleN = normalizeStr(style);
  for (const lvlN of possibleLevelKeys(level)) {
    const t1 = `${styleN} ${lvlN}`, t2 = `${lvlN} ${styleN}`;
    if (t1 in colIndex) return colIndex[t1];
    if (t2 in colIndex) return colIndex[t2];
  }
  return null;
}
function toNum(x) {
  if (x==null) return 0;
  if (typeof x === "number") return isFinite(x) ? x : 0;
  const s = String(x).replace(/,/g,"").trim();
  const v = parseFloat(s);
  return isFinite(v) ? v : 0;
}
const LEVELS = ["Newcomer","Bronze","Silver","Gold","Novice","Prechamp","Champ"];
const STYLES = {
  "Standard": [["W","Waltz"],["T","Tango"],["V","Viennese Waltz"],["F","Foxtrot"],["Q","Quickstep"]],
  "Smooth":   [["W","Waltz"],["T","Tango"],["F","Foxtrot"],["V","Viennese Waltz"]],
  "Latin":    [["C","Cha cha"],["S","Samba"],["R","Rumba"],["P","Paso Doble"],["J","Jive"]],
  "Rhythm":   [["C","Cha cha"],["R","Rumba"],["S","Swing"],["B","Bolero"],["M","Mambo"]]
};
const THRESHOLD = 7;

function findNameColumn(headers, rows) {
  const lower = headers.map(h => h.toLowerCase());
  for (let i=0;i<headers.length;i++) {
    if (/\b(dancer|name|student|participant)\b/i.test(headers[i])) return headers[i];
  }
  // heuristic: column with >20% entries "like a full name"
  function looksLikeFullName(s) { return /^[A-Za-z][A-Za-z'\\-\\.]+(?:\\s+[A-Za-z][A-Za-z'\\-\\.]+)+$/.test((s||"").toString().trim()); }
  let best = headers[0], bestScore = -1;
  for (const h of headers) {
    let cnt = 0, tot = 0;
    for (const row of rows) {
      if (row[h]==null) continue;
      tot++;
      if (looksLikeFullName(row[h])) cnt++;
      if (tot>200) break; // sample
    }
    const frac = tot ? cnt/tot : 0;
    if (frac > bestScore) { bestScore = frac; best = h; }
  }
  return best;
}

function cellStyle(value, theme) {
  const pink = theme.theme_c1;
  const orange = theme.theme_c2;
  const green = theme.theme_c3;
  if (value < 0) return [`background:${orange};color:#000;`,"X"];
  if (value === 0) return [`background:transparent;color:#fff;opacity:.85;`,"0"];
  if (value >= THRESHOLD) return [`background:${pink};color:#000;`, String(Math.trunc(value))];
  return [`background:${green};color:#000;`, String(Math.trunc(value))];
}

function renderProficiencyTable(table, styleLevelValues, theme) {
  const borderColor = "#2b2b39";
  function headerHtml() {
    let html = `<thead><tr><th class="corner filled"></th>`;
    for (const style of Object.keys(STYLES)) {
      html += `<th class="stylehead" colspan="${STYLES[style].length}">${style}</th>`;
    }
    html += `</tr><tr><th class="leveltag">Level</th>`;
    for (const style of Object.keys(STYLES)) {
      for (const [letter,_] of STYLES[style]) html += `<th class="dancehead">${letter}</th>`;
    }
    html += `</tr></thead>`;
    return html;
  }
  function bodyHtml() {
    let rows = "<tbody>";
    for (const level of LEVELS) {
      rows += "<tr>";
      rows += `<th class="levelhead">${level}</th>`;
      for (const style of Object.keys(STYLES)) {
        if (STYLE_LEVEL_ONLY.has(level)) {
          const val = +((styleLevelValues[level]||{})[style] || 0);
          const [sty, txt] = cellStyle(val, theme);
          rows += `<td class="span" colspan="${STYLES[style].length}" style="${sty}">${txt}</td>`;
        } else {
          for (const [letter,_full] of STYLES[style]) {
            const v = +(((table[level]||{})[style]||{})[letter] || 0);
            const [sty, txt] = cellStyle(v, theme);
            rows += `<td style="${sty}">${txt}</td>`;
          }
        }
      }
      rows += "</tr>";
    }
    rows += "</tbody>";
    return rows;
  }
  return `<div class="proficiency-wrap"><table class="proficiency">${headerHtml()}${bodyHtml()}</table></div>`;
}

function csvHasHeaderRow(firstRow) {
  // If any cell equals "dancer" (case-insensitive), assume it's a label row above real header
  return Object.values(firstRow).some(v => typeof v === "string" && v.toLowerCase().trim() === "dancer");
}

function massageCsvData(results) {
  // results = { data: [ {col1:val,...}, ... ], meta: { fields: [...] } }
  let data = results.data;
  let fields = results.meta.fields;
  if (!data || !fields) return { rows: [], headers: [] };
  if (data.length === 0) return { rows: [], headers: fields };

  // If the first "row" actually contains the real headers, shift it into headers.
  if (csvHasHeaderRow(data[0])) {
    const realHeaders = fields = Object.values(data[0]).map((x,i) => (String(x||"").trim() || `col_${i}`));
    data = data.slice(1);
  }
  // Ensure every row has all fields
  for (const row of data) {
    for (const f of fields) if (!(f in row)) row[f] = "";
  }
  return { rows: data, headers: fields };
}

async function cdaInit() {
  document.getElementById("mount-header").innerHTML = renderHeader("cda");
  const user = getSessionUser();
  fetchRepoUsers().then(db => { if (db) { const added = mergeUsers(db); if (added>0) toast(`Loaded ${added} account(s) from repo.`); }});
  const theme = loadThemeAndProfile(user ? user.id : null);

  // Wire up file controls
  const upload = document.getElementById("csv_upload");
  const useDefault = document.getElementById("use_default");
  const defaultName = "PPMid-March2025.csv";
  const info = document.getElementById("load-info");
  const errors = document.getElementById("load-errors");
  const nameInput = document.getElementById("name-input");
  const selectBox = document.getElementById("name-select");
  const output = document.getElementById("output");

  let rows = [], headers = [];
  errors.innerHTML = "";

  async function loadDefault() {
    try {
      const resp = await fetch(defaultName, { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      return await new Promise((resolve, reject) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          complete: res => resolve(res),
          error: err => reject(err)
        });
      });
    } catch (e) {
      throw new Error(`Local file load error: ${e.message}`);
    }
  }

  async function loadUpload(file) {
    return await new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: res => resolve(res),
        error: err => reject(err)
      });
    });
  }

  async function refreshData() {
    info.textContent = "";
    errors.innerHTML = "";
    rows = []; headers = [];
    try {
      if (upload.files && upload.files[0]) {
        const res = await loadUpload(upload.files[0]);
        const m = massageCsvData(res);
        rows = m.rows; headers = m.headers;
        info.textContent = `Loaded ${rows.length.toLocaleString()} rows from upload.`;
      } else if (useDefault.checked) {
        const res = await loadDefault();
        const m = massageCsvData(res);
        rows = m.rows; headers = m.headers;
        info.textContent = `Loaded ${rows.length.toLocaleString()} rows from ${defaultName}.`;
      } else {
        info.textContent = "Upload a CSV or toggle the default local file.";
      }
    } catch (e) {
      errors.innerHTML = `<div class="notice error">${e.message}</div>`;
    }
    rebuildNamePicker();
    output.innerHTML = "";
  }

  function rebuildNamePicker() {
    selectBox.innerHTML = "";
    if (!headers.length) return;
    const nameCol = findNameColumn(headers, rows);
    let names = rows.map(r => String(r[nameCol]||"").trim()).filter(Boolean);
    // dedupe + sort
    names = Array.from(new Set(names)).sort((a,b) => a.localeCompare(b));
    // filter by query
    const q = nameInput.value.trim().toLowerCase();
    if (q) names = names.filter(n => n.toLowerCase().includes(q));
    // If logged in and display_name matches, bubble it
    if (user) {
      const prefs = loadThemeAndProfile(user.id);
      const defName = (prefs.display_name||"").trim();
      const idx = names.indexOf(defName);
      if (idx > 0) { names.splice(idx,1); names.unshift(defName); }
    }
    const frag = document.createDocumentFragment();
    for (const n of names.slice(0, 2000)) {
      const opt = document.createElement("option");
      opt.value = n; opt.textContent = n;
      frag.appendChild(opt);
    }
    selectBox.appendChild(frag);
  }

  async function renderForPerson(person) {
    if (!headers.length) return;
    const nameCol = findNameColumn(headers, rows);
    const colIndex = buildColumnIndex(headers);

    // subset rows
    const perRows = rows.filter(r => String(r[nameCol]||"").trim().toLowerCase() === String(person||"").trim().toLowerCase());

    // table[level][style][letter] = value
    const table = {};
    const styleLevelVals = {}; // { level: {style: value} }

    for (const level of LEVELS) {
      table[level] = {};
      for (const style of Object.keys(STYLES)) {
        table[level][style] = {};
        // Style-level column if present
        const hdrStyle = findHeaderForStyleLevel(colIndex, style, level);
        let styleSum = 0;
        if (hdrStyle) {
          styleSum = perRows.reduce((acc, r) => acc + toNum(r[hdrStyle]), 0);
        } else {
          // sum over dances for this style
          for (const [_letter, danceFull] of STYLES[style]) {
            const hdr = findHeaderForCombo(colIndex, style, level, danceFull);
            if (hdr) styleSum += perRows.reduce((acc, r) => acc + toNum(r[hdr]), 0);
          }
        }
        if (!styleLevelVals[level]) styleLevelVals[level] = {};
        styleLevelVals[level][style] = styleSum;

        for (const [letter, danceFull] of STYLES[style]) {
          const hdr = findHeaderForCombo(colIndex, style, level, danceFull);
          let v = 0;
          if (hdr) v = perRows.reduce((acc, r) => acc + toNum(r[hdr]), 0);
          if (STYLE_LEVEL_ONLY.has(level)) v = styleSum; // span cells
          table[level][style][letter] = v;
        }
      }
    }

    const html = renderProficiencyTable(table, styleLevelVals, theme);
    output.innerHTML = html;
    document.getElementById("caption").textContent = `Points calculated on ${new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'2-digit' })}`;
  }

  // Wire events
  document.getElementById("btn-refresh").addEventListener("click", refreshData);
  document.getElementById("btn-pick").addEventListener("click", () => {
    const v = selectBox.value;
    if (!v) { toast("Pick a person from the list.", true); return; }
    renderForPerson(v);
  });
  nameInput.addEventListener("input", rebuildNamePicker);

  // Initial
  await refreshData();
}

// Toasts
let toastTimer = null;
function toast(msg, isError=false) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.style.background = isError ? "rgba(127,29,29,.95)" : "rgba(12, 131, 52, .95)";
  el.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.display = "none"; }, 2200);
}
