
/* ======= Pepperpot App JS (Full, with CDA) =======
   - White+purple theme compatible
   - Static-nav fallback + dynamic header
   - LocalStorage accounts + optional users.json bootstrap
   - CDA Lookup: auto-detect local CSV in repo root + upload
==================================================== */

/* ---------- Constants ---------- */
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

const LEVELS = ["Newcomer","Bronze","Silver","Gold","Novice","Prechamp","Champ"];
const STYLES = {
  "Standard": [["W","Waltz"],["T","Tango"],["V","Viennese Waltz"],["F","Foxtrot"],["Q","Quickstep"]],
  "Smooth":   [["W","Waltz"],["T","Tango"],["F","Foxtrot"],["V","Viennese Waltz"]],
  "Latin":    [["C","Cha cha"],["S","Samba"],["R","Rumba"],["P","Paso Doble"],["J","Jive"]],
  "Rhythm":   [["C","Cha cha"],["R","Rumba"],["S","Swing"],["B","Bolero"],["M","Mambo"]]
};
const STYLE_LEVEL_ONLY = new Set(["Novice","Prechamp","Champ"]); // span cells
const LEVEL_SYNONYMS = { prechamp: ["prechamp","pre-champ","pre champ","prechampionship"],
                         champ: ["champ","championship"] };
const THRESHOLD = 7;

/* ---------- Storage helpers ---------- */
function getUsers(){ try{ return JSON.parse(localStorage.getItem("pp_users")||"{}"); }catch(e){ return {}; } }
function setUsers(obj){ try{ localStorage.setItem("pp_users", JSON.stringify(obj||{})); }catch(e){} }
function getUser(username){ const u=getUsers(); return u[username]||null; }
function createUser(rec){ const u=getUsers(); if(u[rec.username]) return false; u[rec.username]=rec; setUsers(u); return true; }
function updateUser(username, updater){ const u=getUsers(); if(!u[username]) return false; u[username]=Object.assign({},u[username],updater); setUsers(u); return true; }
function setSessionUser(obj){ try{ sessionStorage.setItem("pp_user", JSON.stringify(obj||null)); }catch(e){} }
function getSessionUser(){ try{ const raw=sessionStorage.getItem("pp_user"); return raw?JSON.parse(raw):null; }catch(e){ return null; } }
function clearSession(){ try{ sessionStorage.removeItem("pp_user"); }catch(e){} }

/* ---------- Crypto ---------- */
async function sha256Hex(str){
  const enc = new TextEncoder(); const data = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b=>b.toString(16).padStart(2,"0")).join("");
}
function genSalt(len=16){ const chars="abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; let out=""; for(let i=0;i<len;i++) out+=chars[Math.floor(Math.random()*chars.length)]; return out; }
async function makeHash(username, dance, colorHex, salt){ return await sha256Hex(`${username}|${dance}|${colorHex}|${salt}`); }

/* ---------- Toast ---------- */
let __toastTimer = null;
function toast(msg, isError=false){
  const el = document.getElementById("toast"); if(!el) return;
  el.textContent = msg;
  el.style.background = isError ? "rgba(127,29,29,.95)" : "rgba(12, 131, 52, .95)";
  el.style.display = "block";
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => { el.style.display = "none"; }, 2200);
}

/* ---------- Header / Nav ---------- */
function injectStaticHeaderFallback(){
  const mount = document.getElementById("mount-header");
  if (!mount || mount.dataset.populated==="1") return;
  mount.innerHTML = `
    <div class="header container">
      <div class="brand">
        <img src="pepperpot_wordmark.png" alt="Pepperpot" onerror="this.src='assets/pepperpot_wordmark.png'; this.onerror=null;">
        <div><div style="opacity:.85">Pepperpot</div></div>
      </div>
      <nav>
        <a href="./index.html">Home</a>
        <a href="./my-account.html">My Account</a>
        <a href="./cda-lookup.html">CDA Lookup</a>
      </nav>
    </div>`;
  mount.dataset.populated = "1";
}
function renderHeader(active=""){
  injectStaticHeaderFallback();
  const user = getSessionUser();
  const mount = document.getElementById("mount-header"); if (!mount) return;
  const nav = [`<a href="./index.html"${active==="home"?' style="outline: 2px solid var(--accent)"':''}>Home</a>`];
  nav.push(`<a href="./my-account.html"${active==="acct"?' style="outline: 2px solid var(--accent)"':''}>My Account</a>`);
  nav.push(`<a href="./cda-lookup.html"${active==="cda"?' style="outline: 2px solid var(--accent)"':''}>CDA Lookup</a>`);
  const who = user ? `<span class="badge"><span class="dot" style="background:#22c55e"></span> ${user.id}</span>`
                   : `<span class="badge"><span class="dot" style="background:#ef4444"></span> Signed out</span>`;
  mount.innerHTML = `
    <div class="header container">
      <div class="brand">
        <img src="pepperpot_wordmark.png" alt="Pepperpot" onerror="this.src='assets/pepperpot_wordmark.png'; this.onerror=null;">
        <div><div style="opacity:.85">Pepperpot</div>${who}</div>
      </div>
      <nav>${nav.join("")}</nav>
    </div>`;
}

/* ---------- users.json bootstrap + import/export ---------- */
async function fetchRepoUsers(){
  try { const resp = await fetch("users.json", { cache: "no-store" }); if (!resp.ok) return null; const j = await resp.json(); return (j && typeof j === "object") ? j : null; }
  catch { return null; }
}
function mergeUsers(incoming){
  if (!incoming || typeof incoming !== "object") return 0;
  const existing = getUsers();
  let added = 0;
  for (const [k,v] of Object.entries(incoming)){ if (!existing[k]) { existing[k] = v; added++; } }
  setUsers(existing); return added;
}
async function exportUsers(){
  const data = JSON.stringify(getUsers(), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "users.json";
  document.body.appendChild(a); a.click(); URL.revokeObjectURL(a.href); a.remove();
}
async function importUsersFromFile(file){ const text = await file.text(); const obj = JSON.parse(text); return mergeUsers(obj); }

/* ---------- Home ---------- */
async function homeInit(){
  try{
    renderHeader("home");
    fetchRepoUsers().then(db => { if (db){ const added = mergeUsers(db); if (added>0) toast(`Loaded ${added} account(s) from repo.`); } });
    const user = getSessionUser();
    const signed = document.getElementById("signed-in");
    const authWrap = document.getElementById("auth-wrap");
    if (user){ if (signed) signed.style.display="block"; if(authWrap) authWrap.style.display="none"; const nm=document.getElementById("signed-name"); if(nm) nm.textContent=user.id; }
    else { if (signed) signed.style.display="none"; if(authWrap) authWrap.style.display="grid"; }

    // Populate selects
    function fillSelect(sel, list){ if(!sel) return; if (sel.options.length>0) return; for (const x of list) sel.append(new Option(x,x)); }
    fillSelect(document.getElementById("su_dance"), DANCE_OPTIONS);
    fillSelect(document.getElementById("lg_dance"), DANCE_OPTIONS);
    fillSelect(document.getElementById("su_color"), Object.keys(COLOR_PALETTE));
    fillSelect(document.getElementById("lg_color"), Object.keys(COLOR_PALETTE));

    document.getElementById("btn-signup")?.addEventListener("click", async () => {
      const suUser = document.getElementById("su_user");
      const suDance = document.getElementById("su_dance");
      const suColor = document.getElementById("su_color");
      const username = (suUser?.value||"").trim();
      const dance = suDance?.value; const colorName = suColor?.value;
      if(!username || !/^[A-Za-z0-9_]+$/.test(username)) return toast("Username must be letters/numbers/underscores.", true);
      if(getUser(username)) return toast("That username is taken.", true);
      const salt = genSalt(); const colorHex = COLOR_PALETTE[colorName]; const passHash = await makeHash(username,dance,colorHex,salt);
      const ok = createUser({ username, pass_hash: passHash, salt, fav_dance: dance, fav_color_name: colorName, fav_color_hex: colorHex, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      if(ok){ setSessionUser({ id: username, name: username }); toast("Account created and signed in!"); location.reload(); }
      else { toast("Could not create account.", true); }
    });

    document.getElementById("btn-login")?.addEventListener("click", async () => {
      const username = (document.getElementById("lg_user")?.value||"").trim();
      const dance = document.getElementById("lg_dance")?.value;
      const colorName = document.getElementById("lg_color")?.value;
      if (!username) return toast("Enter your username.", true);
      const rec = getUser(username); if (!rec) return toast("Unknown username.", true);
      const attempt = await makeHash(username, dance, COLOR_PALETTE[colorName], rec.salt);
      if (attempt === rec.pass_hash){ setSessionUser({ id: username, name: username }); toast("Signed in!"); location.assign("./index.html"); }
      else toast("Dance + color do not match. Try again.", true);
    });

    document.getElementById("btn-signout")?.addEventListener("click", () => { clearSession(); toast("Signed out."); location.assign("./index.html"); });
  }catch(e){ console.error(e); injectStaticHeaderFallback(); }
}

/* ---------- Account ---------- */
async function accountInit(){
  try{
    renderHeader("acct");
    const user = getSessionUser();
    if(!user){ document.getElementById("need-login").style.display="block"; document.getElementById("account-wrap").style.display="none"; return; }

    // Defaults + load prefs
    const defaults = { display_name: "", theme_c1: "#FFD1DC", theme_c2: "#FFD8A8", theme_c3: "#D3F9D8", theme_c4: "#D0EBFF" };
    const prefs = Object.assign({}, defaults, JSON.parse(localStorage.getItem("pp_prefs_"+user.id) || "{}"));
    const row = getUser(user.id); if(!row){ document.getElementById("account-wrap").innerHTML = `<div class="notice error">Account record not found. Please sign out and in.</div>`; return; }

    document.getElementById("display_name").value = prefs.display_name || "";
    ["c1","c2","c3","c4"].forEach((id,i)=>{ const key = ["theme_c1","theme_c2","theme_c3","theme_c4"][i]; const el=document.getElementById(id); if(el) el.value = prefs[key]; });

    const danceSel = document.getElementById("login_dance");
    const colorSel = document.getElementById("login_color");
    function fillSelect(sel, list){ if(!sel) return; if (sel.options.length>0) return; for(const x of list) sel.append(new Option(x,x)); }
    fillSelect(danceSel, DANCE_OPTIONS);
    fillSelect(colorSel, Object.keys(COLOR_PALETTE));
    danceSel.value = row.fav_dance;
    colorSel.value = row.fav_color_name;
    document.getElementById("color_preview").style.background = row.fav_color_hex;
    colorSel.addEventListener("change", ()=>{ document.getElementById("color_preview").style.background = COLOR_PALETTE[colorSel.value]; });

    function snapshot(){ return { display_name: document.getElementById("display_name").value.trim(), theme_c1: document.getElementById("c1").value, theme_c2: document.getElementById("c2").value, theme_c3: document.getElementById("c3").value, theme_c4: document.getElementById("c4").value }; }
    const baselinePrefs = Object.assign({}, prefs);
    const baselineLogin = { dance: row.fav_dance, colorName: row.fav_color_name };
    function isDirty(){ const cur = snapshot(); for(const k of Object.keys(baselinePrefs)) if(String(cur[k])!==String(baselinePrefs[k])) return true; return (danceSel.value!==baselineLogin.dance || colorSel.value!==baselineLogin.colorName); }
    function showBanner(show){ const b=document.getElementById("unsaved-banner"); if(b) b.style.display = show ? "block":"none"; }
    ["display_name","c1","c2","c3","c4","login_dance","login_color"].forEach(id => { const el=document.getElementById(id); if(el){ el.addEventListener("input",()=>showBanner(isDirty())); el.addEventListener("change",()=>showBanner(isDirty())); }});

    // Sync/Backup wiring (optional)
    document.getElementById("btn-export-users")?.addEventListener("click", exportUsers);
    const impFile = document.getElementById("import-users-file");
    document.getElementById("btn-import-users")?.addEventListener("click", async ()=>{
      if (!impFile || !impFile.files || !impFile.files[0]) return toast("Choose a JSON file first.", true);
      try { const added = await importUsersFromFile(impFile.files[0]); toast(`Imported ${added} account(s).`); } catch { toast("Bad JSON file.", true); }
    });
    document.getElementById("btn-sync-remote")?.addEventListener("click", async ()=>{
      const db = await fetchRepoUsers(); if (!db) return toast("No users.json in repo.", true);
      const added = mergeUsers(db); toast(`Loaded ${added} account(s) from repo.`);
    });

    document.getElementById("btn-save").addEventListener("click", async ()=>{
      const cur = snapshot();
      localStorage.setItem("pp_prefs_"+user.id, JSON.stringify(cur));

      if (danceSel.value !== baselineLogin.dance || colorSel.value !== baselineLogin.colorName){
        const salt = genSalt(); const newHex = COLOR_PALETTE[colorSel.value];
        const passHash = await makeHash(user.id, danceSel.value, newHex, salt);
        updateUser(user.id, { pass_hash: passHash, salt, fav_dance: danceSel.value, fav_color_name: colorSel.value, fav_color_hex: newHex });
      }
      Object.assign(baselinePrefs, cur); baselineLogin.dance = danceSel.value; baselineLogin.colorName = colorSel.value;
      showBanner(false); toast("Saved!");
    });
  }catch(e){ console.error(e); injectStaticHeaderFallback(); }
}

/* ---------- CDA ---------- */
function normalizeStr(s){ return (s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim(); }
function possibleLevelKeys(level){ const key = normalizeStr(level); const out=[key]; if (LEVEL_SYNONYMS[key]) out.push(...LEVEL_SYNONYMS[key].map(normalizeStr)); return Array.from(new Set(out)); }
function buildColumnIndex(headers){ const map={}; headers.forEach(h=>{ map[normalizeStr(h)]=h; }); return map; }
function findHeaderForCombo(colIndex, style, level, danceFull){
  const styleN=normalizeStr(style), danceN=normalizeStr(danceFull);
  for (const lvlN of possibleLevelKeys(level)){
    const t1 = `${styleN} ${lvlN} ${danceN}`, t2 = `${lvlN} ${styleN} ${danceN}`;
    if (t1 in colIndex) return colIndex[t1];
    if (t2 in colIndex) return colIndex[t2];
  }
  return null;
}
function findHeaderForStyleLevel(colIndex, style, level){
  const styleN=normalizeStr(style);
  for (const lvlN of possibleLevelKeys(level)){
    const t1 = `${styleN} ${lvlN}`, t2 = `${lvlN} ${styleN}`;
    if (t1 in colIndex) return colIndex[t1];
    if (t2 in colIndex) return colIndex[t2];
  }
  return null;
}
function toNum(x){ if(x==null) return 0; if(typeof x==="number") return isFinite(x)?x:0; const s=String(x).replace(/,/g,"").trim(); const v=parseFloat(s); return isFinite(v)?v:0; }
function csvHasHeaderRow(firstRow){ return Object.values(firstRow).some(v=>typeof v==="string" && v.toLowerCase().trim()==="dancer"); }
function massageCsvData(results){
  let data = results.data; let fields = results.meta.fields;
  if (!data || !fields) return { rows: [], headers: [] };
  if (data.length===0) return { rows: [], headers: fields };
  if (csvHasHeaderRow(data[0])){ const realHeaders = fields = Object.values(data[0]).map((x,i)=> (String(x||"").trim() || `col_${i}`)); data = data.slice(1); }
  for (const row of data){ for (const f of fields) if(!(f in row)) row[f] = ""; }
  return { rows: data, headers: fields };
}
function findNameColumn(headers, rows){
  for (const h of headers){ if (/\b(dancer|name|student|participant)\b/i.test(h)) return h; }
  function looksLikeName(s){ return /^[A-Za-z][A-Za-z'\-\.]+(?:\s+[A-Za-z][A-Za-z'\-\.]+)+$/.test((s||"").toString().trim()); }
  let best=headers[0], score=-1;
  for (const h of headers){ let cnt=0, tot=0; for (const r of rows){ const v=r[h]; if(v==null) continue; tot++; if (looksLikeName(v)) cnt++; if (tot>200) break; } const frac = tot?cnt/tot:0; if (frac>score){ score=frac; best=h; } }
  return best;
}
function cellStyle(value, theme){
  const pink = (theme?.theme_c1) || "#FFD1DC";
  const orange = (theme?.theme_c2) || "#FFD8A8";
  const green = (theme?.theme_c3) || "#D3F9D8";
  if (value < 0) return [`background:${orange};color:#111827;`,"X"];
  if (value === 0) return [`background:transparent;color:#111827;opacity:.85;`,"0"];
  if (value >= THRESHOLD) return [`background:${pink};color:#111827;`, String(Math.trunc(value))];
  return [`background:${green};color:#111827;`, String(Math.trunc(value))];
}
function renderProficiencyTable(table, styleLevelValues, theme){
  function headerHtml(){
    let html = `<thead><tr><th class="corner filled"></th>`;
    for (const style of Object.keys(STYLES)){ html += `<th class="stylehead" colspan="${STYLES[style].length}">${style}</th>`; }
    html += `</tr><tr><th class="leveltag">Level</th>`;
    for (const style of Object.keys(STYLES)){ for (const [letter,_] of STYLES[style]) html += `<th class="dancehead">${letter}</th>`; }
    html += `</tr></thead>`; return html;
  }
  function bodyHtml(){
    let rows = "<tbody>";
    for (const level of LEVELS){
      rows += "<tr>";
      rows += `<th class="levelhead">${level}</th>`;
      for (const style of Object.keys(STYLES)){
        if (STYLE_LEVEL_ONLY.has(level)){
          const val = +((styleLevelValues[level]||{})[style] || 0);
          const [sty, txt] = cellStyle(val, theme);
          rows += `<td class="span" colspan="${STYLES[style].length}" style="${sty}">${txt}</td>`;
        }else{
          for (const [letter, _full] of STYLES[style]){
            const v = +(((table[level]||{})[style]||{})[letter] || 0);
            const [sty, txt] = cellStyle(v, theme);
            rows += `<td style="${sty}">${txt}</td>`;
          }
        }
      }
      rows += "</tr>";
    }
    rows += "</tbody>"; return rows;
  }
  return `<div class="proficiency-wrap"><table class="proficiency">${headerHtml()}${bodyHtml()}</table></div>`;
}
function loadThemeAndProfile(username=null){
  const base = { theme_c1:"#FFD1DC", theme_c2:"#FFD8A8", theme_c3:"#D3F9D8", theme_c4:"#D0EBFF", display_name:"" };
  if (!username) return base;
  try{ const p = JSON.parse(localStorage.getItem("pp_prefs_"+username)||"{}"); return Object.assign({}, base, p); }catch{ return base; }
}


async function cdaInit() {
  try {
    renderHeader("cda");
    const user = getSessionUser();
    const theme = (typeof loadThemeAndProfile === "function") ? loadThemeAndProfile(user ? user.id : null) : { theme_c1:"#FFD1DC", theme_c2:"#FFD8A8", theme_c3:"#D3F9D8" };

    const upload = document.getElementById("csv_upload");
    const useDefault = document.getElementById("use_default");
    const nameBox = document.getElementById("local_name");
    const info = document.getElementById("load-info");
    const errors = document.getElementById("load-errors");
    const nameInput = document.getElementById("name-input");
    const selectBox = document.getElementById("name-select");
    const output = document.getElementById("output");

    let rows = [], headers = [];
    errors.innerHTML = "";

    function localFileName(){
      const val = (nameBox && nameBox.value || "").trim();
      return val || "PPMid-March2025.csv";
    }

    function normalizeStr(s) { return (s||"").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
    const DANCE_SYNONYMS = {
      "cha cha": ["cha cha","chacha","cha-cha","cha  cha"],
      "viennese waltz": ["viennese waltz","vw","v waltz","v. waltz","viennese"],
      "paso doble": ["paso doble","paso","paso-doble"],
      "quickstep": ["quickstep","qs"],
      "foxtrot": ["foxtrot","f.t.","fox trot","fox-trot"],
      "waltz": ["waltz","w"],
      "tango": ["tango","t"],
      "rumba": ["rumba","r"],
      "samba": ["samba","s"],
      "jive": ["jive","j"],
      "swing": ["swing","sw"],
      "bolero": ["bolero","b"],
      "mambo": ["mambo","m"]
    };
    function danceMatches(a,b){
      const A = normalizeStr(a), B = normalizeStr(b);
      if (A === B) return true;
      for (const [canon, list] of Object.entries(DANCE_SYNONYMS)){
        if (list.includes(A) && (canon===B || list.includes(B))) return true;
        if (list.includes(B) && (canon===A || list.includes(A))) return true;
      }
      return false;
    }

    function buildColumnIndex(headers) {
      const map = {};
      headers.forEach(h => { map[normalizeStr(h)] = h; });
      return map;
    }
    function possibleLevelKeys(level) {
      const key = normalizeStr(level);
      const out = [key];
      if (LEVEL_SYNONYMS[key]) out.push(...LEVEL_SYNONYMS[key].map(normalizeStr));
      return Array.from(new Set(out));
    }
    function findHeaderForCombo(colIndex, style, level, danceFull) {
      const styleN = normalizeStr(style);
      const danceN = normalizeStr(danceFull);
      for (const lvlN of possibleLevelKeys(level)) {
        const candidates = [
          `${styleN} ${lvlN} ${danceN}`,
          `${lvlN} ${styleN} ${danceN}`,
          `${styleN} ${lvlN} ${danceN} points`,
          `${lvlN} ${styleN} ${danceN} points`
        ];
        for (const key of candidates) if (key in colIndex) return colIndex[key];
        for (const key in colIndex) {
          const parts = key.split(" ");
          if (parts.includes(styleN) && parts.includes(lvlN)) {
            if (danceMatches(parts.slice(-2).join(" "), danceN) || danceMatches(parts.slice(-1)[0], danceN)) {
              return colIndex[key];
            }
          }
        }
      }
      return null;
    }
    function findHeaderForStyleLevel(colIndex, style, level) {
      const styleN = normalizeStr(style);
      for (const lvlN of possibleLevelKeys(level)) {
        const t1 = `${styleN} ${lvlN}`, t2 = `${lvlN} ${styleN}`, t3 = `${styleN} ${lvlN} points`, t4 = `${lvlN} ${styleN} points`;
        if (t1 in colIndex) return colIndex[t1];
        if (t2 in colIndex) return colIndex[t2];
        if (t3 in colIndex) return colIndex[t3];
        if (t4 in colIndex) return colIndex[t4];
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
      "Latin":    [["C","Cha Cha"],["S","Samba"],["R","Rumba"],["P","Paso Doble"],["J","Jive"]],
      "Rhythm":   [["C","Cha Cha"],["R","Rumba"],["S","Swing"],["B","Bolero"],["M","Mambo"]]
    };
    const THRESHOLD = 7;

    function findNameColumn(headers, rows) {
      for (let i=0;i<headers.length;i++) {
        if (/\b(dancer|name|student|participant|competitor)\b/i.test(headers[i])) return headers[i];
      }
      function looksLikeFullName(s) { return /^[A-Za-z][A-Za-z'\-\.]+(?:\s+[A-Za-z][A-Za-z'\-\.]+)+$/.test((s||"").toString().trim()); }
      let best = headers[0], bestScore = -1;
      for (const h of headers) {
        let cnt = 0, tot = 0;
        for (const row of rows.slice(0, 200)) {
          if (row[h]==null) continue;
          tot++;
          if (looksLikeFullName(row[h])) cnt++;
        }
        const frac = tot ? cnt/tot : 0;
        if (frac > bestScore) { bestScore = frac; best = h; }
      }
      return best;
    }

    function cellStyle(value, theme) {
      const pink = theme.theme_c1 || "#FFD1DC";
      const orange = theme.theme_c2 || "#FFD8A8";
      const green = theme.theme_c3 || "#D3F9D8";
      if (value < 0) return [`background:${orange};color:#111827;`,"X"];
      if (value === 0) return [`background:transparent;color:#111827;opacity:.85;`,"0"];
      if (value >= THRESHOLD) return [`background:${pink};color:#111827;`, String(Math.trunc(value))];
      return [`background:${green};color:#111827;`, String(Math.trunc(value))];
    }

    function renderProficiencyTable(table, styleLevelValues, theme) {
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
              for (const [letter,danceFull] of STYLES[style]) {
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
      return Object.values(firstRow).some(v => typeof v === "string" && v.toLowerCase().trim() === "dancer");
    }

    function massageCsvData(results) {
      let data = results.data;
      let fields = results.meta.fields;
      if (!data || !fields) return { rows: [], headers: [] };
      if (data.length === 0) return { rows: [], headers: fields };
      if (csvHasHeaderRow(data[0])) {
        const realHeaders = fields = Object.values(data[0]).map((x,i) => (String(x||"").trim() || `col_${i}`));
        data = data.slice(1);
      }
      for (const row of data) {
        for (const f of fields) if (!(f in row)) row[f] = "";
      }
      return { rows: data, headers: fields };
    }

    async function loadDefault() {
      const fileName = localFileName();
      try {
        const resp = await fetch(fileName, { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${fileName}`);
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
          info.textContent = `Loaded ${rows.length.toLocaleString()} rows from ${localFileName()}.`;
        } else {
          info.textContent = "Upload a CSV or toggle 'Use local file' and set the filename.";
        }
      } catch (e) {
        errors.innerHTML = `<div class="notice error">${e.message}</div>`;
      }
      rebuildNamePicker();
      output.innerHTML = "";
    }

    function buildColumnIndexFromHeaders(headers) {
      const idx = {};
      for (const h of headers) {
        idx[normalizeStr(h)] = h;
      }
      return idx;
    }

    function rebuildNamePicker() {
      selectBox.innerHTML = "";
      if (!headers.length) return;
      const nameCol = findNameColumn(headers, rows);
      let names = rows.map(r => String(r[nameCol]||"").trim()).filter(Boolean);
      names = Array.from(new Set(names)).sort((a,b) => a.localeCompare(b));
      const q = nameInput.value.trim().toLowerCase();
      if (q) names = names.filter(n => n.toLowerCase().includes(q));
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
      const colIndex = buildColumnIndexFromHeaders(headers);

      const perRows = rows.filter(r => String(r[nameCol]||"").trim().toLowerCase() === String(person||"").trim().toLowerCase());

      const table = {};
      const styleLevelVals = {};

      for (const level of LEVELS) {
        table[level] = {};
        for (const style of Object.keys(STYLES)) {
          table[level][style] = {};
          const hdrStyle = findHeaderForStyleLevel(colIndex, style, level);
          let styleSum = 0;
          if (hdrStyle) {
            styleSum = perRows.reduce((acc, r) => acc + toNum(r[hdrStyle]), 0);
          } else {
            for (const [letter, danceFull] of STYLES[style]) {
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
            if (STYLE_LEVEL_ONLY.has(level)) v = styleSum;
            table[level][style][letter] = v;
          }
        }
      }

      const html = renderProficiencyTable(table, styleLevelVals, theme);
      output.innerHTML = html;
      const cap = document.getElementById("caption");
      if (cap) cap.textContent = `Points calculated on ${new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'2-digit' })}`;
    }

    document.getElementById("btn-refresh").addEventListener("click", refreshData);
    document.getElementById("btn-pick").addEventListener("click", () => {
      const v = selectBox.value;
      if (!v) { toast("Pick a person from the list.", true); return; }
      renderForPerson(v);
    });
    nameInput.addEventListener("input", rebuildNamePicker);
    if (nameBox) nameBox.addEventListener("change", () => { if (useDefault.checked) refreshData(); });
    if (useDefault) useDefault.addEventListener("change", refreshData);

    await refreshData();
  } catch (err) {
    console.error("cdaInit error:", err);
    injectStaticHeaderFallback();
  }
}

    async function tryLocalFiles(){
      for (const f of CANDIDATES){
        try { const text = await fetchText(f); return { name: f, text }; } catch(e){ /* try next */ }
      }
      return null;
    }
    async function parseCsvText(text){
      return await new Promise((resolve, reject)=>{
        if (!window.Papa){
          const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
          s.onload = () => {
            Papa.parse(text, { header:true, skipEmptyLines:true, complete: res=>resolve(res), error: err=>reject(err) });
          };
          s.onerror = ()=>reject(new Error("Papa Parse failed to load."));
          document.head.appendChild(s);
        } else {
          Papa.parse(text, { header:true, skipEmptyLines:true, complete: res=>resolve(res), error: err=>reject(err) });
        }
      });
    }
    async function parseCsvFile(file){
      return await new Promise((resolve, reject)=>{
        if (!window.Papa){
          const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js";
          s.onload = () => Papa.parse(file, { header:true, skipEmptyLines:true, complete: res=>resolve(res), error: err=>reject(err) });
          s.onerror = ()=>reject(new Error("Papa Parse failed to load."));
          document.head.appendChild(s);
        } else {
          Papa.parse(file, { header:true, skipEmptyLines:true, complete: res=>resolve(res), error: err=>reject(err) });
        }
      });
    }

    function rebuildNamePicker(){
      selectBox.innerHTML = "";
      if (!headers.length) return;
      const nameCol = findNameColumn(headers, rows);
      let names = rows.map(r => String(r[nameCol]||"").trim()).filter(Boolean);
      names = Array.from(new Set(names)).sort((a,b)=>a.localeCompare(b));
      const q = nameInput.value.trim().toLowerCase();
      if (q) names = names.filter(n => n.toLowerCase().includes(q));
      const frag = document.createDocumentFragment();
      for (const n of names.slice(0, 2000)){ const opt=document.createElement("option"); opt.value=n; opt.textContent=n; frag.appendChild(opt); }
      selectBox.appendChild(frag);
    }

    async function refreshData(){
      info.textContent = ""; errors.innerHTML = ""; rows = []; headers = []; output.innerHTML = "";
      try {
        if (upload && upload.files && upload.files[0]){
          const res = await parseCsvFile(upload.files[0]);
          const m = massageCsvData(res); rows = m.rows; headers = m.headers;
          info.textContent = `Loaded ${rows.length.toLocaleString()} rows from upload.`;
        } else {
          // If checkbox exists, honor it; otherwise auto-try local file
          let used = null;
          if (useDefault && useDefault.checked){
            used = await tryLocalFiles();
          } else {
            used = await tryLocalFiles();
          }
          if (used){
            const res = await parseCsvText(used.text);
            const m = massageCsvData(res); rows = m.rows; headers = m.headers;
            info.textContent = `Loaded ${rows.length.toLocaleString()} rows from ${used.name}.`;
          } else {
            info.textContent = "Upload a CSV or add a CSV to the repo root named one of: " + CANDIDATES.join(", ");
          }
        }
      } catch (e){
        errors.innerHTML = `<div class="notice error">${e.message}</div>`;
      }
      rebuildNamePicker();
    }

    async function renderForPerson(person){
      if (!headers.length) return;
      const nameCol = findNameColumn(headers, rows);
      const colIndex = buildColumnIndex(headers);
      const perRows = rows.filter(r => String(r[nameCol]||"").trim().toLowerCase() === String(person||"").trim().toLowerCase());

      const table = {}; const styleLevelVals = {};
      for (const level of LEVELS){
        table[level] = {};
        for (const style of Object.keys(STYLES)){
          table[level][style] = {};
          const hdrStyle = findHeaderForStyleLevel(colIndex, style, level);
          let styleSum = 0;
          if (hdrStyle){ styleSum = perRows.reduce((acc,r)=> acc + toNum(r[hdrStyle]), 0); }
          else {
            for (const [letter, danceFull] of STYLES[style]){
              const hdr = findHeaderForCombo(colIndex, style, level, danceFull);
              if (hdr) styleSum += perRows.reduce((acc,r)=> acc + toNum(r[hdr]), 0);
            }
          }
          if (!styleLevelVals[level]) styleLevelVals[level] = {};
          styleLevelVals[level][style] = styleSum;

          for (const [letter, danceFull] of STYLES[style]){
            const hdr = findHeaderForCombo(colIndex, style, level, danceFull);
            let v = 0;
            if (hdr) v = perRows.reduce((acc,r)=> acc + toNum(r[hdr]), 0);
            if (STYLE_LEVEL_ONLY.has(level)) v = styleSum;
            table[level][style][letter] = v;
          }
        }
      }

      output.innerHTML = renderProficiencyTable(table, styleLevelVals, theme);
      const cap = document.getElementById("caption");
      if (cap) cap.textContent = `Points calculated on ${new Date().toLocaleDateString(undefined, { year:'numeric', month:'long', day:'2-digit' })}`;
    }

    // Wire events
    document.getElementById("btn-refresh")?.addEventListener("click", refreshData);
    document.getElementById("btn-pick")?.addEventListener("click", ()=>{ const v = selectBox.value; if (!v) return toast("Pick a person from the list.", true); renderForPerson(v); });
    nameInput?.addEventListener("input", rebuildNamePicker);

    // Initial
    await refreshData();
  }catch(e){ console.error(e); injectStaticHeaderFallback(); }
}

/* expose for HTML onload */
window.homeInit = homeInit;
window.accountInit = accountInit;
window.cdaInit = cdaInit;
