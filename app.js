/* ==========================================================================
   Animal ID App — Project Dashboard
   Data source: Google Sheet "Animal ID App — PM Tasks DB" via an Apps Script
   Web App (GET-only, so no CORS preflight). Falls back to the bundled
   seed_data.json + per-browser localStorage if no Apps Script URL is set.
   ========================================================================== */

// 1) After you deploy the Apps Script (see README), paste the Web App URL here:
const APPS_SCRIPT_URL = ""; // e.g. "https://script.google.com/macros/s/XXXX/exec"

const POLL_MS = 20000;

const CREDENTIALS = {
  navid:   { pass: "Navid@2026",   display: "Navid" },
  mehrdad: { pass: "Mehrdad@2026", display: "Mehrdad" }
};

const CATEGORY_META = {
  "Legal & Supply": { color: "var(--legal)", owner: "Mehrdad" },
  "Infrastructure":  { color: "var(--infra)", owner: "Navid" },
  "Development":     { color: "var(--dev)",   owner: "Navid" },
  "Marketing":       { color: "var(--mkt)",   owner: "Mehrdad" }
};
const CATEGORY_ORDER = ["Legal & Supply", "Infrastructure", "Development", "Marketing"];
const STATUS_COLS = ["To Do", "Waiting", "Done"];

const PHASES = [
  { n: "1", name: "Study & Preparation", range: "Sep 22 – Sep 28, 2026" },
  { n: "2", name: "Development & Pre-Launch (MVP)", range: "Sep 29 – Oct 12, 2026" },
  { n: "3", name: "Post-Launch & Marketing", range: "Oct 13 – Oct 19, 2026" }
];

let TASKS = [];
let activeOwnerFilter = "all";
let searchTerm = "";
let openPhase = "1"; // only Phase 1 open on first load

/* ---------------- LOGIN ---------------- */
function initLogin() {
  const saved = sessionStorage.getItem("aid_user");
  if (saved && CREDENTIALS[saved]) {
    showApp(saved);
    return;
  }
  document.getElementById("loginBtn").addEventListener("click", tryLogin);
  document.getElementById("pass").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
  document.getElementById("user").addEventListener("keydown", e => { if (e.key === "Enter") tryLogin(); });
}

function tryLogin() {
  const u = document.getElementById("user").value.trim().toLowerCase();
  const p = document.getElementById("pass").value;
  const err = document.getElementById("loginErr");
  const cred = CREDENTIALS[u];
  if (cred && cred.pass === p) {
    sessionStorage.setItem("aid_user", u);
    showApp(u);
  } else {
    err.textContent = "Wrong username or password.";
  }
}

function showApp(userKey) {
  const display = CREDENTIALS[userKey].display;
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("meName").textContent = display;
  const av = document.getElementById("meAvatar");
  av.textContent = display[0];
  av.classList.add(userKey);
  document.getElementById("logout").addEventListener("click", () => {
    sessionStorage.removeItem("aid_user");
    location.reload();
  });
  boot();
}

/* ---------------- DATA LAYER ---------------- */
function localOverrides() {
  try { return JSON.parse(localStorage.getItem("aid_overrides") || "{}"); }
  catch { return {}; }
}
function setLocalOverride(id, status) {
  const o = localOverrides();
  o[id] = status;
  localStorage.setItem("aid_overrides", JSON.stringify(o));
}

async function loadTasks() {
  if (APPS_SCRIPT_URL) {
    try {
      const res = await fetch(`${APPS_SCRIPT_URL}?action=list`, { cache: "no-store" });
      const data = await res.json();
      setSync(true);
      return data;
    } catch (e) {
      console.warn("Apps Script fetch failed, falling back to seed data", e);
      setSync(false, true);
    }
  } else {
    setSync(false, false);
  }
  const res = await fetch("seed_data.json", { cache: "no-store" });
  const data = await res.json();
  const overrides = localOverrides();
  return data.map(t => overrides[t.id] ? { ...t, status: overrides[t.id] } : t);
}

async function updateStatus(id, status) {
  // optimistic local update
  const t = TASKS.find(x => x.id === id);
  if (t) t.status = status;
  render();

  if (APPS_SCRIPT_URL) {
    try {
      await fetch(`${APPS_SCRIPT_URL}?action=update&id=${encodeURIComponent(id)}&status=${encodeURIComponent(status)}`, { cache: "no-store" });
      toast(`Saved to Google Sheet · ${id} → ${status}`);
      return;
    } catch (e) {
      console.warn("Write failed, saved locally only", e);
    }
  }
  setLocalOverride(id, status);
  toast(`Saved on this device only · ${id} → ${status} (connect Google Sheet to sync with your teammate)`);
}

function setSync(live, errored) {
  const dot = document.getElementById("syncDot");
  const label = document.getElementById("syncLabel");
  if (!dot) return;
  if (live) {
    dot.classList.add("live");
    label.textContent = "Live — Google Sheet connected";
  } else if (errored) {
    dot.classList.remove("live");
    label.textContent = "Sheet connection failed — showing local data";
  } else {
    dot.classList.remove("live");
    label.textContent = "Local seed data (Sheet not connected yet)";
  }
}

/* ---------------- RENDER ---------------- */
function normalizeStatus(s) {
  if (s === "Doing") return "Waiting";
  return STATUS_COLS.includes(s) ? s : "To Do";
}

function isOverdue(due, status) {
  if (status === "Done") return false;
  const d = new Date(due + "T23:59:59");
  return d < new Date();
}

function matchesFilters(t) {
  if (activeOwnerFilter !== "all" && t.owner !== activeOwnerFilter) return false;
  if (searchTerm) {
    const hay = (t.title + " " + t.description + " " + t.category).toLowerCase();
    if (!hay.includes(searchTerm)) return false;
  }
  return true;
}

function render() {
  renderOverview();
  renderPhases();
}

function renderOverview() {
  const total = TASKS.length;
  const done = TASKS.filter(t => normalizeStatus(t.status) === "Done").length;
  const waiting = TASKS.filter(t => normalizeStatus(t.status) === "Waiting").length;
  const overdue = TASKS.filter(t => isOverdue(t.due, t.status)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const el = document.getElementById("overview");
  el.innerHTML = `
    <div class="stat-card">
      <div class="label">Overall progress</div>
      <div class="value">${pct}%</div>
      <div class="bar"><div style="width:${pct}%"></div></div>
    </div>
    <div class="stat-card">
      <div class="label">Tasks done</div>
      <div class="value">${done} / ${total}</div>
    </div>
    <div class="stat-card">
      <div class="label">In progress / waiting</div>
      <div class="value">${waiting}</div>
    </div>
    <div class="stat-card">
      <div class="label">Overdue</div>
      <div class="value" style="color:${overdue ? 'var(--red)' : 'var(--text)'}">${overdue}</div>
    </div>
  `;
}

function renderPhases() {
  const container = document.getElementById("phases");
  container.innerHTML = "";

  PHASES.forEach(ph => {
    const phaseTasks = TASKS.filter(t => String(t.phase) === ph.n);
    const visible = phaseTasks.filter(matchesFilters);
    const done = phaseTasks.filter(t => normalizeStatus(t.status) === "Done").length;
    const pct = phaseTasks.length ? Math.round((done / phaseTasks.length) * 100) : 0;

    const wrap = document.createElement("div");
    wrap.className = "phase" + (openPhase === ph.n ? " open" : "");
    wrap.innerHTML = `
      <div class="phase-head" data-phase="${ph.n}">
        <div class="phase-title">
          <div class="phase-num">${ph.n}</div>
          <div>
            <h2>Phase ${ph.n} · ${ph.name}</h2>
            <span class="range">${ph.range} · ${phaseTasks.length} tasks</span>
          </div>
        </div>
        <div class="phase-progress">
          <div class="bar"><div style="width:${pct}%"></div></div>
          <span class="pct">${pct}%</span>
          <span class="chevron">▾</span>
        </div>
      </div>
      <div class="phase-body"><div class="phase-inner" id="phase-inner-${ph.n}"></div></div>
    `;
    container.appendChild(wrap);
    wrap.querySelector(".phase-head").addEventListener("click", () => {
      openPhase = openPhase === ph.n ? null : ph.n;
      render();
    });

    const inner = wrap.querySelector(`#phase-inner-${ph.n}`);
    CATEGORY_ORDER.forEach(cat => {
      const catTasks = visible.filter(t => t.category === cat);
      if (!catTasks.length && (activeOwnerFilter !== "all" || searchTerm)) return;
      const meta = CATEGORY_META[cat];
      const lane = document.createElement("div");
      lane.className = "category-lane";
      lane.innerHTML = `
        <div class="cat-label">
          <span class="cat-dot" style="background:${meta.color}"></span>
          ${cat}
          <span class="cat-owner">${meta.owner}</span>
        </div>
        <div class="board"></div>
      `;
      const board = lane.querySelector(".board");
      STATUS_COLS.forEach(col => board.appendChild(renderColumn(col, catTasks)));
      inner.appendChild(lane);
    });
  });
}

function renderColumn(status, tasks) {
  const items = tasks.filter(t => normalizeStatus(t.status) === status);
  const col = document.createElement("div");
  col.className = "col";
  col.dataset.status = status;
  col.innerHTML = `<div class="col-head"><span class="name">${status}</span><span class="count">${items.length}</span></div>`;

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-col";
    empty.textContent = "Drop a task here";
    col.appendChild(empty);
  }

  items.forEach(t => col.appendChild(renderCard(t)));

  col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("dragover"); });
  col.addEventListener("dragleave", () => col.classList.remove("dragover"));
  col.addEventListener("drop", e => {
    e.preventDefault();
    col.classList.remove("dragover");
    const id = e.dataTransfer.getData("text/plain");
    if (id) updateStatus(id, status);
  });
  return col;
}

function renderCard(t) {
  const card = document.createElement("div");
  card.className = "card";
  card.draggable = true;
  const ownerKey = t.owner.toLowerCase();
  const overdue = isOverdue(t.due, t.status);
  card.innerHTML = `
    <div class="id">${t.id}</div>
    <div class="title">${escapeHtml(t.title)}</div>
    <div class="desc">${escapeHtml(t.description || "")}</div>
    <div class="meta">
      <span class="owner-badge"><span class="owner-dot ${ownerKey}">${t.owner[0]}</span>${t.owner}</span>
      <span class="due ${overdue ? 'overdue' : ''}">${overdue ? '⚠ ' : ''}${formatDate(t.due)}</span>
    </div>
    ${t.notes ? `<div class="notes">${escapeHtml(t.notes)}</div>` : ""}
  `;
  card.addEventListener("dragstart", e => {
    e.dataTransfer.setData("text/plain", t.id);
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  return card;
}

function formatDate(d) {
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------------- FILTER BAR ---------------- */
function initFilters() {
  document.querySelectorAll(".chip[data-owner]").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip[data-owner]").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      activeOwnerFilter = chip.dataset.owner;
      render();
    });
  });
  document.getElementById("search").addEventListener("input", e => {
    searchTerm = e.target.value.trim().toLowerCase();
    render();
  });
}

/* ---------------- TOAST ---------------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------------- BOOT ---------------- */
async function boot() {
  initFilters();
  TASKS = await loadTasks();
  render();
  setInterval(async () => {
    TASKS = await loadTasks();
    render();
  }, POLL_MS);
}

initLogin();
