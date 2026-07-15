// Cross-Access Control · Stage 1 dashboard client.
// Polls the API, renders live countdowns, and drives the grant/revoke/sweep controls.

const $ = (sel) => document.querySelector(sel);
const AVATAR_COLORS = [
  "linear-gradient(135deg,#8b5cf6,#ec4899)",
  "linear-gradient(135deg,#fb7185,#f97316)",
  "linear-gradient(135deg,#60a5fa,#8b5cf6)",
  "linear-gradient(135deg,#34d399,#06b6d4)",
  "linear-gradient(135deg,#f472b6,#a855f7)",
  "linear-gradient(135deg,#fbbf24,#fb7185)",
];

let state = { grants: [], users: [], summary: null, log: [] };
let lastGrantIds = new Set();
let nextSweepAt = 0;

function avatarFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { color: AVATAR_COLORS[h % AVATAR_COLORS.length], initials: name.slice(0, 2).toUpperCase() };
}

function fmtDuration(ms) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

function fmtClock(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function relTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ---------- render ---------- */

function renderTiles(s) {
  const tiles = [
    { cls: "", k: "Active grants", v: s.activeCount, sub: `${s.totalUsers} members in roster` },
    { cls: "warm", k: "Expiring < 1h", v: s.expiringSoonCount, sub: s.overdueCount ? `${s.overdueCount} overdue for sweep` : "all on schedule" },
    { cls: "good", k: "Revoked (24h)", v: s.revokedTodayCount, sub: "auto + manual" },
    { cls: "gold", k: "Verified+ members", v: s.verifiedPlusCount, sub: `of ${s.totalUsers} total` },
  ];
  $("#tiles").innerHTML = tiles
    .map((t) => `<div class="tile ${t.cls}"><div class="k">${t.k}</div><div class="v">${t.v}</div><div class="sub">${t.sub}</div></div>`)
    .join("");
}

function renderWorker(s) {
  const w = s.worker;
  $("#target-badge").textContent = w.discourseTarget;
  $("#xg-name").textContent = w.xaccessGroup;
  const last = w.lastResult
    ? `${w.lastResult.revoked} revoked · ${w.lastResult.scanned} scanned`
    : "—";
  $("#worker-stats").innerHTML = `
    <div class="wstat"><div class="k">Last sweep</div><div class="v">${w.lastSweepAt ? relTime(w.lastSweepAt) : "never"}</div></div>
    <div class="wstat"><div class="k">Last result</div><div class="v">${last}</div></div>
    <div class="wstat"><div class="k">Removes group</div><div class="v mono">${w.xaccessGroup}</div></div>
    <div class="wstat"><div class="k">Target</div><div class="v mono">${w.discourseTarget}</div></div>`;
}

function grantTiming(g) {
  const now = Date.now();
  const left = new Date(g.expires_at).getTime() - now;
  if (g.status === "revoked") return { key: "revoked", left };
  if (left <= 0) return { key: "overdue", left };
  if (left < 60 * 60 * 1000) return { key: "soon", left };
  return { key: "active", left };
}

const STATUS_LABEL = {
  active: "Active",
  soon: "Expiring",
  overdue: "Sweep due",
  revoked: "Revoked",
};

function renderGrants() {
  const body = $("#grants-body");
  const usersById = Object.fromEntries(state.users.map((u) => [u.external_id, u]));
  const rows = state.grants
    .map((g) => {
      const t = grantTiming(g);
      const av = avatarFor(g.username);
      const isNew = !lastGrantIds.has(g.id) && lastGrantIds.size > 0;
      const isPlus = usersById[g.user_external_id]?.verified === "plus";
      const timeCell =
        g.status === "revoked"
          ? `<span class="dash">revoked ${g.revoked_at ? relTime(g.revoked_at) : ""}</span>`
          : `<span class="countdown ${t.key === "soon" ? "soon" : ""}${t.key === "overdue" ? " overdue" : ""}" data-expires="${g.expires_at}">${t.left <= 0 ? "expired" : fmtDuration(t.left)}</span>`;
      const action =
        g.status === "active"
          ? `<button class="btn-revoke" data-revoke="${g.id}">Revoke now</button>`
          : `<span class="dash">—</span>`;
      const sourceCell = g.checkout_source === "storefront" ? `<span class="src">${g.source}</span> <span class="chip chip-buy" title="Bought via storefront">buy</span>` : `<span class="src">${g.source}</span>`;
      return `<tr class="${g.status === "revoked" ? "is-revoked" : ""}${isNew ? " flash" : ""}" data-id="${g.id}">
        <td><div class="member"><div class="avatar" style="background:${av.color}">${av.initials}</div>
          <div><div class="name">${g.username}${isPlus ? '<span class="verified-badge" title="Verified+">✓</span>' : ""}</div><div class="eid">${g.user_external_id.slice(0, 8)}…</div></div></div></td>
        <td><span class="chip chip-${g.base_gender}">${g.base_gender}</span></td>
        <td>${sourceCell}</td>
        <td><span class="expires">${g.status === "revoked" ? "—" : fmtClock(g.expires_at)}</span></td>
        <td>${timeCell}</td>
        <td><span class="status status-${t.key}"><span class="d"></span>${STATUS_LABEL[t.key]}</span></td>
        <td style="text-align:right">${action}</td>
      </tr>`;
    })
    .join("");
  body.innerHTML = rows || `<tr><td colspan="7" class="log-empty">No grants yet — grant cross-access above.</td></tr>`;
  lastGrantIds = new Set(state.grants.map((g) => g.id));

  body.querySelectorAll("[data-revoke]").forEach((btn) => {
    btn.addEventListener("click", () => revoke(btn.dataset.revoke, btn));
  });
}

const LOG_ICON = { success: "✓", error: "!", info: "+" };

function renderLog() {
  const list = $("#log-list");
  if (!state.log.length) {
    list.innerHTML = `<li class="log-empty">No worker activity yet.</li>`;
    return;
  }
  list.innerHTML = state.log
    .slice(0, 40)
    .map((e) => {
      const lvl = e.level || "info";
      const meta = e.discourse_status ? `sync_sso → ${e.discourse_status}` : e.action;
      return `<li class="lvl-${lvl}">
        <span class="ic">${LOG_ICON[lvl] || "•"}</span>
        <span class="msg">${e.message || e.action}<div class="meta">${meta}</div></span>
        <span class="time">${relTime(e.created_at)}</span>
      </li>`;
    })
    .join("");
}

/* ---------- live ticking ---------- */

function tickCountdowns() {
  document.querySelectorAll(".countdown[data-expires]").forEach((el) => {
    const left = new Date(el.dataset.expires).getTime() - Date.now();
    el.textContent = left <= 0 ? "expired" : fmtDuration(left);
    el.classList.toggle("overdue", left <= 0);
    el.classList.toggle("soon", left > 0 && left < 60 * 60 * 1000);
  });
  const nextEl = $("#next-sweep");
  if (nextEl) {
    const rem = Math.max(0, nextSweepAt - Date.now());
    nextEl.textContent = fmtDuration(rem);
  }
}

/* ---------- actions ---------- */

async function refresh() {
  try {
    const [summary, grantsData, logData] = await Promise.all([
      api("/api/summary"),
      api("/api/grants"),
      api("/api/worker/log"),
    ]);
    state.summary = summary;
    state.grants = grantsData.grants;
    state.users = grantsData.users;
    state.log = logData.log;
    renderTiles(summary);
    renderWorker(summary);
    renderGrants();
    renderLog();
    populateUsers();
    // align the next-sweep countdown to the worker cadence
    if (summary.worker.lastSweepAt) {
      nextSweepAt = new Date(summary.worker.lastSweepAt).getTime() + summary.worker.intervalMs;
    } else {
      nextSweepAt = Date.now() + summary.worker.intervalMs;
    }
  } catch (err) {
    console.error("refresh failed", err);
  }
}

let usersPopulated = false;
function populateUsers() {
  const sel = $("#grant-user");
  const activeIds = new Set(state.grants.filter((g) => g.status === "active").map((g) => g.user_external_id));
  const prev = sel.value;
  sel.innerHTML = state.users
    .map((u) => {
      const busy = activeIds.has(u.external_id);
      const plus = u.verified === "plus" ? " · Verified+" : "";
      return `<option value="${u.external_id}" ${busy ? "disabled" : ""}>${u.username} · ${u.gender}${plus}${busy ? " (has active grant)" : ""}</option>`;
    })
    .join("");
  if (prev) sel.value = prev;
  usersPopulated = true;
}

async function loadDurations() {
  const durations = await api("/api/durations");
  $("#grant-duration").innerHTML = durations
    .map((d) => `<option value="${d.key}"${d.key === "demo_30s" ? " selected" : ""}>${d.label}</option>`)
    .join("");
}

async function grant(e) {
  e.preventDefault();
  const btn = $("#grant-submit");
  const msg = $("#grant-msg");
  const external_id = $("#grant-user").value;
  const durationKey = $("#grant-duration").value;
  btn.disabled = true;
  msg.className = "form-msg";
  msg.textContent = "";
  try {
    const { grant } = await api("/api/grants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ external_id, durationKey }),
    });
    msg.className = "form-msg ok";
    msg.textContent = `Granted to ${grant.username}. It will auto-revoke at expiry.`;
    await refresh();
  } catch (err) {
    msg.className = "form-msg err";
    msg.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

async function revoke(id, btn) {
  btn.disabled = true;
  btn.textContent = "Revoking…";
  try {
    await api(`/api/grants/${id}/revoke`, { method: "POST" });
    await refresh();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Revoke now";
    console.error(err);
  }
}

async function runSweep() {
  const btn = $("#run-sweep");
  btn.disabled = true;
  try {
    await api("/api/worker/run", { method: "POST" });
    await refresh();
  } finally {
    setTimeout(() => (btn.disabled = false), 400);
  }
}

/* ---------- boot ---------- */

$("#grant-form").addEventListener("submit", grant);
$("#run-sweep").addEventListener("click", runSweep);

await loadDurations();
await refresh();
setInterval(refresh, 3000);   // pull fresh server state
setInterval(tickCountdowns, 1000); // smooth local countdowns
