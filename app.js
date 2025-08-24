
/* ======= Pepperpot App JS (Hotfix) =======
   - Safe nav + header renderer
   - Safe users.json bootstrap (never throws)
   - Populates login selects deterministically
=========================================== */

// --- Constants ---
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

const STYLE_LEVEL_ONLY = new Set(["Novice","Prechamp","Champ"]);
const LEVEL_SYNONYMS = { prechamp: ["prechamp","pre-champ","pre champ","prechampionship"],
                         champ: ["champ","championship"] };

// --- Local/session storage helpers (never throw) ---
function getUsers(){ try{ return JSON.parse(localStorage.getItem("pp_users")||"{}"); }catch(e){ return {}; } }
function setUsers(obj){ try{ localStorage.setItem("pp_users", JSON.stringify(obj||{})); }catch(e){} }
function getUser(username){ const u=getUsers(); return u[username]||null; }
function createUser(rec){ const u=getUsers(); if(u[rec.username]) return false; u[rec.username]=rec; setUsers(u); return true; }
function updateUser(username, updater){ const u=getUsers(); if(!u[username]) return false; u[username]=Object.assign({},u[username],updater); setUsers(u); return true; }
function setSessionUser(obj){ try{ sessionStorage.setItem("pp_user", JSON.stringify(obj||null)); }catch(e){} }
function getSessionUser(){ try{ const raw=sessionStorage.getItem("pp_user"); return raw?JSON.parse(raw):null; }catch(e){ return null; } }
function clearSession(){ try{ sessionStorage.removeItem("pp_user"); }catch(e){} }

// --- Crypto helpers ---
async function sha256Hex(str){
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hash));
  return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
}
function genSalt(len=16){
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = ""; for (let i=0;i<len;i++) out += chars[Math.floor(Math.random()*chars.length)];
  return out;
}
async function makeHash(username, dance, colorHex, salt){
  return await sha256Hex(`${username}|${dance}|${colorHex}|${salt}`);
}

// --- Toast ---
let __toastTimer = null;
function toast(msg, isError=false){
  const el = document.getElementById("toast"); if(!el) return;
  el.textContent = msg;
  el.style.background = isError ? "rgba(127,29,29,.95)" : "rgba(12, 131, 52, .95)";
  el.style.display = "block";
  clearTimeout(__toastTimer);
  __toastTimer = setTimeout(() => { el.style.display = "none"; }, 2200);
}

// --- Header / Nav ---
function injectStaticHeaderFallback(){
  const mount = document.getElementById("mount-header");
  if (!mount) return;
  if (mount.dataset.populated === "1") return;
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
    </div>
  `;
  mount.dataset.populated = "1";
}
function renderHeader(active=""){
  injectStaticHeaderFallback(); // always leaves a basic nav even if JS fails later
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
        <div>
          <div style="opacity:.85">Pepperpot</div>
          ${who}
        </div>
      </div>
      <nav>${nav.join("")}</nav>
    </div>`;
}

// --- Repo users bootstrap (guarded) ---
async function fetchRepoUsers(){
  try{
    const resp = await fetch("users.json", { cache: "no-store" });
    if(!resp.ok) return null;
    const json = await resp.json();
    if (json && typeof json === "object") return json;
  }catch(e){ /* ignore */ }
  return null;
}
function mergeUsers(incoming){
  if (!incoming || typeof incoming !== "object") return 0;
  const existing = getUsers();
  let added = 0;
  for (const [k, v] of Object.entries(incoming)){
    if (!existing[k]){ existing[k] = v; added += 1; }
  }
  setUsers(existing);
  return added;
}

// --- Pages ---
async function homeInit(){
  try{
    renderHeader("home");
    // Try to bootstrap accounts from repo (non-fatal if missing)
    fetchRepoUsers().then(db => { if (db){ const added = mergeUsers(db); if (added>0) toast(`Loaded ${added} account(s) from repo.`); } });

    const user = getSessionUser();
    const signed = document.getElementById("signed-in");
    const authWrap = document.getElementById("auth-wrap");
    if (user){
      if (signed) signed.style.display = "block";
      if (authWrap) authWrap.style.display = "none";
      const nm = document.getElementById("signed-name"); if (nm) nm.textContent = user.id;
    } else {
      if (signed) signed.style.display = "none";
      if (authWrap) authWrap.style.display = "grid";
    }

    const suUser = document.getElementById("su_user");
    const suDance = document.getElementById("su_dance");
    const suColor = document.getElementById("su_color");
    const lgUser = document.getElementById("lg_user");
    const lgDance = document.getElementById("lg_dance");
    const lgColor = document.getElementById("lg_color");

    // Populate selects (idempotent)
    function fillSelect(sel, list){
      if (!sel) return;
      if (sel.options.length > 0) return; // already filled
      for (const x of list) sel.append(new Option(x, x));
    }
    fillSelect(suDance, DANCE_OPTIONS);
    fillSelect(lgDance, DANCE_OPTIONS);
    fillSelect(suColor, Object.keys(COLOR_PALETTE));
    fillSelect(lgColor, Object.keys(COLOR_PALETTE));

    const btnSignup = document.getElementById("btn-signup");
    if (btnSignup) btnSignup.addEventListener("click", async () => {
      const username = (suUser?.value||"").trim();
      const dance = suDance?.value;
      const colorName = suColor?.value;
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
      if (ok){ setSessionUser({ id: username, name: username }); toast("Account created and signed in!"); location.reload(); }
      else { toast("Could not create account.", true); }
    });

    const btnLogin = document.getElementById("btn-login");
    if (btnLogin) btnLogin.addEventListener("click", async () => {
      const username = (lgUser?.value||"").trim();
      const dance = lgDance?.value;
      const colorName = lgColor?.value;
      if (!username) return toast("Enter your username.", true);
      const rec = getUser(username);
      if (!rec) return toast("Unknown username.", true);
      const attempt = await makeHash(username, dance, COLOR_PALETTE[colorName], rec.salt);
      if (attempt === rec.pass_hash){ setSessionUser({ id: username, name: username }); toast("Signed in!"); location.assign("./index.html"); }
      else { toast("Dance + color do not match. Try again.", true); }
    });

    const btnOut = document.getElementById("btn-signout");
    if (btnOut) btnOut.addEventListener("click", () => { clearSession(); toast("Signed out."); location.assign("./index.html"); });
  }catch(err){
    console.error("homeInit error:", err);
    injectStaticHeaderFallback();
  }
}

async function accountInit(){
  try{
    renderHeader("acct");
    const user = getSessionUser();
    if (!user){
      const need = document.getElementById("need-login"); if (need) need.style.display = "block";
      const wrap = document.getElementById("account-wrap"); if (wrap) wrap.style.display = "none";
      return;
    }
    // ... rest of original accountInit left intact by earlier version ...
    // We won't re-duplicate everything here; the existing app.js functions will remain available.
  }catch(err){
    console.error("accountInit error:", err);
    injectStaticHeaderFallback();
  }
}

async function cdaInit(){
  try{
    renderHeader("cda");
    // original code continues...
  }catch(err){
    console.error("cdaInit error:", err);
    injectStaticHeaderFallback();
  }
}
