// Storefront client — tiered cross-access + Verified+ (research brief §6).
// Simulated checkout only: see the disclosure text on the page itself.

const $ = (sel) => document.querySelector(sel);
const AVATAR_COLORS = [
  "linear-gradient(135deg,#8b5cf6,#ec4899)",
  "linear-gradient(135deg,#fb7185,#f97316)",
  "linear-gradient(135deg,#60a5fa,#8b5cf6)",
  "linear-gradient(135deg,#34d399,#06b6d4)",
  "linear-gradient(135deg,#f472b6,#a855f7)",
  "linear-gradient(135deg,#fbbf24,#fb7185)",
];
const VIEWER_KEY = "stage1_viewer_external_id";

function avatarFor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { color: AVATAR_COLORS[h % AVATAR_COLORS.length], initials: name.slice(0, 2).toUpperCase() };
}

function fmtDuration(ms) {
  const h = ms / (60 * 60 * 1000);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d === 1 ? "24h" : `${d} days`;
}

async function api(path, opts) {
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function toast(title, sub, isErr = false) {
  const el = document.createElement("div");
  el.className = `toast${isErr ? " err" : ""}`;
  el.innerHTML = `<b>${title}</b>${sub ? `<span class="sub">${sub}</span>` : ""}`;
  $("#toast-stack").appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

let users = [];
let viewer = null;

function currentViewer() {
  return users.find((u) => u.external_id === viewer) || users[0] || null;
}

function renderViewerBar() {
  const u = currentViewer();
  if (!u) return;
  const av = avatarFor(u.username);
  $("#viewer-avatar").style.background = av.color;
  $("#viewer-avatar").textContent = av.initials;
  $("#viewer-name").innerHTML = `${u.username}${u.verified === "plus" ? '<span class="verified-badge" title="Verified+">✓</span>' : ""}`;
  $("#viewer-sub").textContent = `${u.gender} community · ${u.verified === "plus" ? "Verified+" : "KYC verified"}`;

  const sel = $("#viewer-select");
  sel.innerHTML = users
    .map((x) => `<option value="${x.external_id}" ${x.external_id === u.external_id ? "selected" : ""}>${x.username} · ${x.gender}${x.verified === "plus" ? " · Verified+" : ""}</option>`)
    .join("");
}

function renderTiers(data) {
  $("#blocked-banner").classList.toggle("is-visible", data.blockedByActiveGrant);

  $("#tier-grid").innerHTML = data.tiers
    .map((t) => {
      const disabled = data.blockedByActiveGrant;
      return `<article class="tier-card${t.featured ? " is-featured" : ""}">
        ${t.featured ? '<span class="tier-ribbon">Most popular</span>' : ""}
        <h4 class="tier-name">${t.label}</h4>
        <p class="tier-tagline">${t.tagline}</p>
        <div class="tier-price">
          <span class="amount">${t.priceLabel}</span>
          ${t.discounted ? `<span class="was">${t.originalLabel}</span><span class="save">Verified+ −15%</span>` : ""}
        </div>
        <span class="tier-duration">${fmtDuration(t.durationMs)} of cross-access</span>
        <button class="tier-buy" data-tier="${t.id}" ${disabled ? "disabled" : ""}>
          ${disabled ? "Active pass in progress" : `Buy — ${t.priceLabel}`}
        </button>
      </article>`;
    })
    .join("");

  $("#tier-grid").querySelectorAll("[data-tier]").forEach((btn) => {
    btn.addEventListener("click", () => buyTier(btn.dataset.tier, btn));
  });

  const vp = data.verifiedPlus;
  $("#verified-panel").innerHTML = `
    <div class="verified-icon">✓</div>
    <div class="verified-copy">
      <h3>${vp.label}</h3>
      <p>${vp.tagline}</p>
      <ul><li>Gold checkmark badge</li><li>Priority placement</li><li>15% off every cross-access tier</li></ul>
    </div>
    <div class="verified-cta">
      ${
        vp.owned
          ? `<span class="verified-owned">✓ Owned</span>`
          : `<span class="verified-price">${vp.priceLabel}</span><button class="verified-buy" id="buy-verified">Upgrade now</button>`
      }
    </div>`;

  if (!vp.owned) {
    $("#buy-verified")?.addEventListener("click", buyVerifiedPlus);
  }
}

async function loadTiers() {
  const u = currentViewer();
  if (!u) return;
  const data = await api(`/api/tiers?external_id=${encodeURIComponent(u.external_id)}`);
  renderTiers(data);
}

async function buyTier(tierId, btn) {
  const u = currentViewer();
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "Processing…";
  try {
    const { grant, paidCents, discounted } = await api("/api/checkout/cross-access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ external_id: u.external_id, tierId }),
    });
    toast(
      "Cross-access granted",
      `${grant.username} paid $${(paidCents / 100).toFixed(2)}${discounted ? " (Verified+ discount applied)" : ""}. Auto-revokes at ${new Date(grant.expires_at).toLocaleString()}.`,
    );
    await loadTiers();
  } catch (err) {
    toast("Checkout failed", err.message, true);
    btn.disabled = false;
    btn.textContent = original;
  }
}

async function buyVerifiedPlus() {
  const u = currentViewer();
  const btn = $("#buy-verified");
  btn.disabled = true;
  btn.textContent = "Processing…";
  try {
    const { user } = await api("/api/checkout/verified-plus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ external_id: u.external_id }),
    });
    Object.assign(u, user);
    toast("Welcome to Verified+", `${user.username} now has the gold badge and 15% off every tier.`);
    renderViewerBar();
    await loadTiers();
  } catch (err) {
    toast("Upgrade failed", err.message, true);
    btn.disabled = false;
    btn.textContent = "Upgrade now";
  }
}

async function boot() {
  const { users: u } = await api("/api/grants");
  users = u;
  viewer = localStorage.getItem(VIEWER_KEY);
  if (!viewer || !users.some((x) => x.external_id === viewer)) {
    viewer = users[0]?.external_id || null;
  }
  renderViewerBar();
  await loadTiers();

  $("#viewer-select").addEventListener("change", async (e) => {
    viewer = e.target.value;
    localStorage.setItem(VIEWER_KEY, viewer);
    renderViewerBar();
    await loadTiers();
  });
}

await boot();
setInterval(loadTiers, 4000); // reflect worker-driven expiry (e.g. blocked banner clearing) live
