/* ═══════════ Gayathri Pooja Store — Frontend Logic ═══════════ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const CFG = window.CFG || { services: [], stylists: [], whatsapp: "", maps_query: "" };
const money = amount => `${CFG.currency || ""}${Number(amount).toLocaleString()}`;
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

/* ── Toast ── */
let toastT;
function toast(msg, isErr = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (isErr ? " err" : "");
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.className = ""), 3400);
}

/* ── Preloader ── */
window.addEventListener("load", () => {
  setTimeout(() => $("#preloader")?.classList.add("gone"), 1600);
});

/* ── Mobile menu ── */
$("#menu-btn")?.addEventListener("click", () => $("#mobile-menu").classList.add("open"));
$("#menu-close")?.addEventListener("click", () => $("#mobile-menu").classList.remove("open"));
$$("#mobile-menu a").forEach(a => a.addEventListener("click", () => $("#mobile-menu").classList.remove("open")));

/* ── WhatsApp ── */
(() => {
  const number = CFG.whatsapp;
  if (number) {
    const url = `https://wa.me/${number}?text=${encodeURIComponent("Namaste! I would like to place an order at " + (CFG.salon || "Gayathri Pooja Store"))}`;
    $$(".wa-link").forEach(a => { a.href = url; a.target = "_blank"; a.rel = "noopener"; });
  } else {
    $$(".wa-link").forEach(a => { a.hidden = true; a.removeAttribute("href"); });
  }
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CFG.maps_query || "")}`;
  const ml = $("#maps-link");
  if (ml && CFG.maps_query) ml.href = maps;
  else if (ml) ml.hidden = true;
})();

/* ── Scroll fade-in ── */
(() => {
  const els = $$(".fade-in");
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
  }, { threshold: 0.12 });
  els.forEach(el => io.observe(el));
})();

/* ═══════════════════════════════════════════════
   PRODUCT CARDS (services page)
═══════════════════════════════════════════════ */
(() => {
  const grid = $("#services-grid");
  if (!grid) return;
  if (!CFG.services.length) {
    grid.innerHTML = `<p class="empty-state">Products are being updated. Please check back soon.</p>`;
    return;
  }
  grid.innerHTML = CFG.services.map(s => `
    <div class="card fade-in">
      <div class="icon">${escapeHTML(s.icon)}</div>
      <h3>${escapeHTML(s.name)}</h3>
      <p>${escapeHTML(s.desc)}</p>
      <div class="row">
        <span class="price">${money(s.price)}</span>
        <button class="mini-btn" data-book="${escapeHTML(s.id)}">Order →</button>
      </div>
    </div>`).join("");

  /* Re-attach scroll observer for dynamically created cards */
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  $$(".card.fade-in", grid).forEach(el => io.observe(el));
})();

/* ── Product highlights strip on home page ── */
(() => {
  const highlights = $("#service-highlights");
  if (!highlights) return;
  highlights.innerHTML = CFG.services.length
    ? CFG.services.slice(0, 4).map(s => `
      <a href="/services">
        <span class="strip-icon">${escapeHTML(s.icon)}</span>
        <span><b>${escapeHTML(s.name)}</b><small>${money(s.price)}</small></span>
      </a>`).join("")
    : `<p class="empty-state" style="grid-column:1/-1;padding:20px">Pooja products will appear here when added.</p>`;
})();

/* ═══════════════════════════════════════════════
   ORDER WIZARD — 3 steps:
   Step 1: Select items (multi-select checklist)
   Step 2: Pick date & time
   Step 3: Your details + confirm
═══════════════════════════════════════════════ */
const wiz = {
  step: 1,
  /* Multi-select: Set of selected service IDs */
  selectedIds: new Set(),
  stylist: null,
  date: null,
  time: null,
};
const MAXSTEP = 3;

function autoSetStylist() {
  if (CFG.stylists && CFG.stylists.length > 0) wiz.stylist = CFG.stylists[0].id;
}

function stepTitle() {
  return {
    1: "Select Your Pooja Items",
    2: "Choose Pickup Date & Time",
    3: "Your Details",
  }[wiz.step];
}

/* ── Render step 1: multi-select product checklist ── */
function renderStep1() {
  const container = $("#step-1-opts");
  if (!container) return;
  if (!CFG.services.length) {
    container.innerHTML = `<p class="empty-state">No products available to order right now. Please check back soon.</p>`;
    return;
  }
  container.innerHTML = CFG.services.map(s => `
    <button class="opt ${wiz.selectedIds.has(s.id) ? "sel" : ""}" data-svc="${escapeHTML(s.id)}" type="button">
      <span class="em">${escapeHTML(s.icon)}</span>
      <span><b>${escapeHTML(s.name)}</b><small>${escapeHTML(s.desc)}</small></span>
      <span class="p">${money(s.price)}</span>
    </button>`).join("");
  updateSelectionSummary();
}

function updateSelectionSummary() {
  const summary = $("#selection-summary");
  const namesEl = $("#selected-names");
  if (!summary || !namesEl) return;
  if (wiz.selectedIds.size === 0) {
    summary.classList.remove("visible");
    return;
  }
  const names = [...wiz.selectedIds]
    .map(id => CFG.services.find(s => s.id === id))
    .filter(Boolean)
    .map(s => `${s.icon} ${s.name}`)
    .join(", ");
  namesEl.textContent = names;
  summary.classList.add("visible");
}

function to12hr(t) {
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr);
  const ampm = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${mStr} ${ampm}`;
}

function todayStr(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function loadSlots() {
  const box = $("#slots");
  if (!wiz.date) { box.innerHTML = `<p style="color:var(--muted)">Pick a date above to see available slots.</p>`; return; }
  if (!wiz.stylist) { box.innerHTML = `<p style="color:var(--muted)">Store not fully configured yet. Please call us to book.</p>`; return; }
  if (!Object.keys(CFG.hours || {}).length) {
    box.innerHTML = `<p style="color:var(--muted)">Store hours not set yet. Please call us.</p>`;
    return;
  }
  const day = (new Date(wiz.date + "T12:00:00").getDay() + 6) % 7;
  const hrs = CFG.hours[String(day)];
  if (!hrs) { box.innerHTML = `<p style="color:var(--maroon)">Store is closed that day.</p>`; return; }

  const lunchStart = CFG.lunch_start;
  const lunchEnd   = CFG.lunch_end;
  let lunchNote = "";
  if (lunchStart && lunchEnd && lunchEnd > lunchStart) {
    lunchNote = `<p style="color:var(--muted);font-size:.85rem;margin-bottom:8px">Break: ${to12hr(String(lunchStart).padStart(2,"0")+":00")} – ${to12hr(String(lunchEnd).padStart(2,"0")+":00")} (unavailable)</p>`;
  }
  box.innerHTML = `${lunchNote}<p style="color:var(--muted)">Loading slots…</p>`;

  let taken = [];
  try {
    const r = await fetch(`/api/availability?date=${wiz.date}&stylist=${wiz.stylist}`);
    taken = (await r.json()).taken || [];
  } catch {
    box.innerHTML = `<p style="color:var(--red)">Could not load slots — please check your connection.</p>`;
    return;
  }

  const now = new Date();
  let html = lunchNote;
  for (let h = hrs[0]; h < hrs[1]; h++) {
    for (const m of [0, 30]) {
      const t = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      const isPast = wiz.date === todayStr() && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()));
      const isLunch = lunchStart && lunchEnd && h >= lunchStart && h < lunchEnd;
      const dis = taken.includes(t) || isPast || isLunch;
      const label = isLunch ? `${to12hr(t)} (Break)` : to12hr(t);
      html += `<button class="slot ${wiz.time === t ? "sel" : ""}" data-t="${t}" ${dis ? "disabled" : ""} type="button">${label}</button>`;
    }
  }
  box.innerHTML = html || `<p style="color:var(--muted)">No slots available that day.</p>`;
}

function renderSummary() {
  const items = [...wiz.selectedIds]
    .map(id => CFG.services.find(s => s.id === id))
    .filter(Boolean);
  const [y, m, d] = wiz.date.split("-");
  const displayDate = `${d}/${m}/${y}`;
  const total = items.reduce((sum, s) => sum + Number(s.price), 0);
  const itemsHtml = items.map(s =>
    `<div class="summary-item"><span>${escapeHTML(s.icon)}</span><span>${escapeHTML(s.name)}</span><span style="margin-left:auto;color:var(--maroon);font-weight:700">${money(s.price)}</span></div>`
  ).join("");
  $("#summary").innerHTML =
    `${itemsHtml}
     <div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px">
       <b>Date:</b> ${displayDate} at <b>${to12hr(wiz.time)}</b>
     </div>
     <div style="margin-top:6px;font-size:.82rem;color:var(--muted)">
       ${items.length} item${items.length > 1 ? "s" : ""} &nbsp;·&nbsp;
       Total: <strong style="color:var(--maroon)">${money(total)}</strong>
     </div>`;
}

function renderStep() {
  $$(".steps i").forEach((el, i) => el.classList.toggle("on", i < wiz.step));
  $$(".step").forEach(el => el.classList.remove("on"));
  $(`#step-${wiz.step}`)?.classList.add("on");
  const titleEl = $("#wiz-title");
  if (titleEl) titleEl.textContent = stepTitle();
  const back = $("#wiz-back");
  const next = $("#wiz-next");
  if (back) back.style.visibility = wiz.step === 1 ? "hidden" : "visible";
  if (next) next.textContent = wiz.step === MAXSTEP ? "🙏 Confirm Order" : "Next →";
  if (wiz.step === 2 && wiz.date) loadSlots();
  if (wiz.step === 3) renderSummary();
}

function wizValidate() {
  if (wiz.step === 1 && wiz.selectedIds.size === 0) {
    toast("Please select at least one item.", true); return false;
  }
  if (wiz.step === 2 && (!wiz.date || !wiz.time)) {
    toast("Please choose a date and time.", true); return false;
  }
  if (wiz.step === 3) {
    const name  = $("#f-name")?.value.trim();
    const phone = $("#f-phone")?.value.trim();
    if (!name || name.length < 2)  { toast("Please enter your name.", true);         return false; }
    if (!phone || phone.length < 7){ toast("Please enter a valid phone number.", true); return false; }
  }
  return true;
}

async function submitOrder() {
  const btn = $("#wiz-next");
  btn.disabled = true;
  btn.textContent = "Placing order…";

  try {
    /* Build comma-separated service_ids for the first field (backward-compat)
       and full array in service_ids (new backend field) */
    const ids   = [...wiz.selectedIds];
    const names = ids.map(id => (CFG.services.find(s => s.id === id) || {}).name || id).join(", ");

    const r = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:       $("#f-name").value.trim(),
        phone:      $("#f-phone").value.trim(),
        service_id: ids[0],          /* first item — keeps backend validation happy */
        service_ids: ids,            /* full list — new field */
        stylist_id: wiz.stylist,
        date:       wiz.date,
        time:       wiz.time,
        notes:      ($("#f-notes").value.trim() || "") + (ids.length > 1 ? ` | Items: ${names}` : ""),
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "Order could not be placed.");
    toast(`🙏 Order confirmed! Your Order ID: ${data.id}. We will contact you soon.`);
    wiz.selectedIds.clear();
    wiz.date = wiz.time = null;
    autoSetStylist();
    if ($("#f-name"))   $("#f-name").value   = "";
    if ($("#f-phone"))  $("#f-phone").value  = "";
    if ($("#f-notes"))  $("#f-notes").value  = "";
    wiz.step = 1;
    renderStep1();
    renderStep();
  } catch (e) {
    toast(e.message, true);
  }
  btn.disabled = false;
  renderStep();
}

function bindWizard() {
  const w = $("#wizard");
  if (!w) return;
  autoSetStylist();

  /* Pre-select service from URL param */
  const requestedService = new URLSearchParams(window.location.search).get("service");
  if (requestedService && CFG.services.some(s => s.id === requestedService)) {
    wiz.selectedIds.add(requestedService);
  }

  renderStep1();

  /* Date input (DD/MM/YYYY) */
  const displayInput = $("#book-date-display");
  const hiddenInput  = $("#book-date");

  function parseDisplayDate(val) {
    const clean = val.replace(/\D/g, "");
    if (clean.length === 8) {
      return `${clean.slice(4,8)}-${clean.slice(2,4)}-${clean.slice(0,2)}`;
    }
    return null;
  }
  function isValidFutureDate(iso) {
    return iso >= todayStr() && iso <= todayStr(30);
  }

  displayInput?.addEventListener("input", e => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 2) val = val.slice(0,2) + "/" + val.slice(2);
    if (val.length > 5) val = val.slice(0,5) + "/" + val.slice(5);
    if (val.length > 10) val = val.slice(0,10);
    displayInput.value = val;

    const iso = parseDisplayDate(val.replace(/\//g,""));
    if (iso && isValidFutureDate(iso)) {
      hiddenInput.value = iso;
      wiz.date = iso;
      wiz.time = null;
      displayInput.style.borderColor = "";
      loadSlots();
    } else if (val.length === 10) {
      displayInput.style.borderColor = "var(--red)";
      hiddenInput.value = "";
      wiz.date = null;
      $("#slots").innerHTML = `<p style="color:var(--red)">Please enter a valid future date (today up to 30 days ahead).</p>`;
    }
  });

  /* Click handlers for step 1 (item select) and step 2 (slot select) */
  w.addEventListener("click", e => {
    /* Toggle item selection */
    const svc = e.target.closest("[data-svc]");
    if (svc) {
      const id = svc.dataset.svc;
      if (wiz.selectedIds.has(id)) wiz.selectedIds.delete(id);
      else wiz.selectedIds.add(id);
      svc.classList.toggle("sel", wiz.selectedIds.has(id));
      updateSelectionSummary();
    }
    /* Slot selection */
    const slot = e.target.closest(".slot");
    if (slot && !slot.disabled) {
      wiz.time = slot.dataset.t;
      $$(".slot").forEach(x => x.classList.remove("sel"));
      slot.classList.add("sel");
    }
  });

  $("#wiz-back")?.addEventListener("click", () => {
    if (wiz.step > 1) { wiz.step--; renderStep(); }
  });

  $("#wiz-next")?.addEventListener("click", async () => {
    if (!wizValidate()) return;
    if (wiz.step < MAXSTEP) { wiz.step++; renderStep(); }
    else await submitOrder();
  });

  renderStep();
}
bindWizard();

/* "Order" buttons on product cards → jump to wizard */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-book]");
  if (!b) return;
  const id = b.dataset.book;
  wiz.selectedIds.add(id);
  wiz.step = 2;
  if (!$("#wizard")) {
    window.location.href = `/booking?service=${encodeURIComponent(id)}`;
    return;
  }
  renderStep1();
  renderStep();
  $("#book")?.scrollIntoView({ behavior: "smooth" });
  toast("Item added — now choose a pickup date.");
});

/* ═══════════════════════════════════════════════
   REVIEWS
═══════════════════════════════════════════════ */
let myRating = 5;

async function loadReviews() {
  const box = $("#reviews-list");
  if (!box) return;
  try {
    const { reviews } = await (await fetch("/api/reviews")).json();
    const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
    $("#avg-stars").textContent = avg ? `${avg.toFixed(1)} / 5 ⭐` : "✦ ✦ ✦ ✦ ✦";
    $("#avg-num").textContent = reviews.length
      ? `${reviews.length} review${reviews.length > 1 ? "s" : ""} from our customers`
      : "No reviews yet — be the first to share your blessing!";
    box.innerHTML = reviews.slice(0, 12).map(r => `
      <div class="rev-card">
        <div class="stars">${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</div>
        <div class="who">${r.name.replace(/[<>&]/g, "")}</div>
        <p>${r.text.replace(/[<>&]/g, "")}</p>
      </div>`).join("");
  } catch {
    box.innerHTML = `<p style="color:var(--muted)">Could not load reviews.</p>`;
  }
}

function bindReviews() {
  const row = $("#rate-row");
  if (!row) return;
  const stars = ["⭐","⭐","⭐","⭐","⭐"];
  const paint = () => $$("#rate-row button").forEach((b, i) => b.classList.toggle("lit", i < myRating));
  row.innerHTML = stars.map((s, i) => `<button data-r="${i+1}" type="button">${s}</button>`).join("");
  row.addEventListener("click", e => {
    const b = e.target.closest("[data-r]");
    if (b) { myRating = +b.dataset.r; paint(); }
  });
  paint();

  $("#rev-form")?.addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#rev-name").value.trim();
    const text = $("#rev-text").value.trim();
    if (name.length < 2 || text.length < 3) {
      toast("Please enter your name and a short review.", true); return;
    }
    try {
      const r = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text, rating: myRating }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not submit review.");
      toast("🙏 Thank you for your blessing!");
      $("#rev-name").value = $("#rev-text").value = "";
      myRating = 5; paint();
      loadReviews();
    } catch (err) { toast(err.message, true); }
  });
  loadReviews();
}
bindReviews();

/* ═══════════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════════ */
async function adminFetch(url, opts = {}) {
  opts.headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  return fetch(url, opts);
}

async function loadAdmin() {
  const r = await adminFetch("/api/admin/bookings");
  if (r.status === 401) { window.location.href = "/admin/login"; return; }
  const { bookings, stats } = await r.json();

  const chip = $("#mode-chip");
  chip.textContent = stats.firebase ? "FIREBASE LIVE" : "DEMO MODE";
  chip.className   = "mode-chip" + (stats.firebase ? " live" : "");

  $("#stat-grid").innerHTML = [
    ["Total",     stats.total],
    ["Pending",   stats.pending],
    ["Confirmed", stats.confirmed],
    ["Done",      stats.done],
    ["Cancelled", stats.cancelled],
    ["Revenue",   "—"],
  ].map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");

  const svcName = id => {
    const s = adminServiceCatalog.find(x => x.id === id);
    return s ? s.name : id;
  };
  const fmtDate = iso => { if (!iso) return ""; const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const fmtTime = t => {
    if (!t) return "";
    const [hStr, mStr] = t.split(":");
    let h = parseInt(hStr);
    const ap = h >= 12 ? "PM" : "AM";
    if (h === 0) h = 12; else if (h > 12) h -= 12;
    return `${h}:${mStr} ${ap}`;
  };

  /* Resolve item names from notes field if multiple items were stored there */
  const resolveItems = b => {
    const noteMatch = (b.notes || "").match(/\| Items: (.+)/);
    if (noteMatch) return noteMatch[1];
    return svcName(b.service_id);
  };

  $("#bk-list").innerHTML = bookings.length
    ? [...bookings].reverse().map(b => {
        const isPending   = b.status === "pending";
        const isConfirmed = b.status === "confirmed";
        const isDone      = b.status === "done";
        const isCancelled = b.status === "cancelled";
        const confirmBtn = isPending   ? `<button data-act="confirmed" data-id="${b.id}">Confirm</button>` : "";
        const doneBtn    = isConfirmed ? `<button data-act="done"      data-id="${b.id}">Done</button>`    : "";
        const cancelBtn  = (!isDone && !isCancelled) ? `<button data-act="cancelled" data-id="${b.id}">Cancel</button>` : "";
        const cleanNotes = (b.notes || "").replace(/\| Items: .+/, "").replace(/[<>&]/g,"").trim();
        return `
        <div class="bk-row s-${b.status}">
          <div class="top">
            <b>${(b.name || "").replace(/[<>&]/g,"")}</b>
            <span class="st ${b.status}">${b.status}</span>
          </div>
          <small>🛍 ${resolveItems(b)} &nbsp;·&nbsp; 📅 ${fmtDate(b.date)} at ${fmtTime(b.time)}</small>
          <small>📞 ${(b.phone || "").replace(/[<>&]/g,"")}${cleanNotes ? " · Note: " + cleanNotes : ""}</small>
          <div class="bk-actions">
            ${confirmBtn}${doneBtn}${cancelBtn}
            <button class="danger" data-del="${b.id}">Delete</button>
          </div>
        </div>`;
      }).join("")
    : `<p style="color:var(--muted);text-align:center;padding:28px">No orders yet. Share your store link to get started.</p>`;
}

let adminServiceCatalog = [...CFG.services];

async function loadAdminProducts() {
  const r = await adminFetch("/api/admin/services");
  if (!r.ok) throw new Error("Could not load products.");
  const { services } = await r.json();
  adminServiceCatalog = services;
  $("#service-list").innerHTML = services.length
    ? services.map(s => `
      <article class="managed-row">
        <div>
          <span class="managed-icon">${escapeHTML(s.icon)}</span>
          <div><b>${escapeHTML(s.name)}</b><small>${escapeHTML(s.desc)}</small></div>
        </div>
        <p><strong>${money(s.price)}</strong></p>
        <div class="managed-actions">
          <button data-service-edit="${escapeHTML(s.id)}">Edit</button>
          <button class="danger" data-service-delete="${escapeHTML(s.id)}">Delete</button>
        </div>
      </article>`).join("")
    : `<p class="empty-state">No products yet. Add the first one above.</p>`;
}

const weekDays = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function renderAdminSettings(settings) {
  $("#settings-salon").value     = settings.salon      || "";
  $("#settings-currency").value  = settings.currency   || "";
  $("#settings-maps").value      = settings.maps_query || "";
  $("#settings-whatsapp").value  = settings.whatsapp   || "";
  $("#settings-max-per-slot").value = settings.max_per_slot || 1;

  const lunchS = settings.lunch_start || 0;
  const lunchE = settings.lunch_end   || 0;
  $("#settings-lunch-start").value = lunchS;
  $("#settings-lunch-end").value   = lunchE;

  const updateLunchHints = () => {
    const s  = Number($("#settings-lunch-start").value);
    const e  = Number($("#settings-lunch-end").value);
    const sh = $("#lunch-start-hint");
    const eh = $("#lunch-end-hint");
    if (sh) sh.textContent = s > 0 ? (s >= 12 ? `${s > 12 ? s-12 : s} PM` : `${s} AM`) : "";
    if (eh) eh.textContent = e > 0 ? (e >= 12 ? `${e > 12 ? e-12 : e} PM` : `${e} AM`) : "";
  };
  updateLunchHints();
  $("#settings-lunch-start").addEventListener("input", updateLunchHints);
  $("#settings-lunch-end").addEventListener("input",   updateLunchHints);

  $("#stylist-list").innerHTML = (settings.stylists || []).map(st => `
    <div class="stylist-editor-row" data-stylist-id="${escapeHTML(st.id)}">
      <div class="field"><label>Name</label><input data-stylist-field="name"     value="${escapeHTML(st.name)}"  maxlength="60" required></div>
      <div class="field"><label>Role</label><input data-stylist-field="role"     value="${escapeHTML(st.role)}"  maxlength="80" required></div>
      <div class="field"><label>Specialty</label><input data-stylist-field="tag" value="${escapeHTML(st.tag)}"   maxlength="120" required></div>
      <button class="stylist-remove" type="button" aria-label="Remove ${escapeHTML(st.name)}" data-stylist-remove>Remove</button>
    </div>`).join("");

  $("#hours-editor").innerHTML = weekDays.map((day, index) => {
    const hours  = settings.hours?.[String(index)];
    const closed = !hours;
    const open   = hours ? hours[0] : 9;
    const close  = hours ? hours[1] : 17;
    return `<div class="hours-editor-row" data-hours-day="${index}">
      <b>${day}</b>
      <label class="hour-field">Open
        <input data-hours-open type="number" min="0" max="23" value="${open}" aria-label="${day} opening hour" ${closed?"disabled":""}>
        <span class="ampm-hint">${closed?"": open>=12?"PM":"AM"}</span>
      </label>
      <label class="closed-toggle"><input data-hours-closed type="checkbox" ${closed?"checked":""}> Closed</label>
      <label class="hour-field">Close
        <input data-hours-close type="number" min="1" max="24" value="${close}" aria-label="${day} closing hour" ${closed?"disabled":""}>
        <span class="ampm-hint">${closed?"": close>=12?"PM":"AM"}</span>
      </label>
    </div>`;
  }).join("");

  $$("[data-hours-closed]").forEach(toggle => toggle.addEventListener("change", () => {
    const row = toggle.closest("[data-hours-day]");
    row.querySelectorAll("[data-hours-open],[data-hours-close]").forEach(inp => {
      inp.disabled = toggle.checked;
      const hint = inp.nextElementSibling;
      if (hint) hint.textContent = toggle.checked ? "" : (Number(inp.value)>=12 ? "PM" : "AM");
    });
  }));
  $$("[data-hours-open],[data-hours-close]").forEach(inp => {
    inp.addEventListener("input", () => {
      const hint = inp.nextElementSibling;
      if (hint) hint.textContent = Number(inp.value) >= 12 ? "PM" : "AM";
    });
  });
}

async function loadAdminSettings() {
  const r = await adminFetch("/api/admin/settings");
  if (!r.ok) throw new Error("Could not load store settings.");
  renderAdminSettings((await r.json()).settings);
}

function resetProductForm() {
  const form = $("#service-form");
  if (!form) return;
  form.reset();
  $("#service-id").value  = "";
  $("#service-icon").value = "🪔";
  /* Keep duration hidden at 0 */
  if ($("#service-minutes")) $("#service-minutes").value = "0";
  $("#service-submit").textContent = "Add Product";
  $("#service-cancel").hidden = true;
}

async function bindAdmin() {
  /* ── Login form ── */
  const loginForm = $("#login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      const r = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("#admin-username").value.trim(),
          password: $("#admin-pw").value,
        }),
      });
      if (r.ok) window.location.href = "/admin/dashboard";
      else toast("Username or password is incorrect.", true);
    });
  }

  /* ── Signup form ── */
  const signupForm = $("#signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async event => {
      event.preventDefault();
      const r = await fetch("/api/admin/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username:  $("#signup-username").value.trim(),
          password:  $("#signup-password").value,
          setup_key: $("#setup-key")?.value || "",
        }),
      });
      const result = await r.json();
      if (!r.ok) return toast(result.error || "Account could not be created.", true);
      window.location.href = "/admin/dashboard";
    });
  }

  const bookingList = $("#bk-list");
  if (!bookingList) return;

  /* ── Logout ── */
  $("#logout-btn")?.addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  });

  /* ── Booking actions ── */
  bookingList.addEventListener("click", async event => {
    const action   = event.target.closest("[data-act]");
    const deletion = event.target.closest("[data-del]");
    if (action) {
      const resp   = await adminFetch(`/api/admin/bookings/${action.dataset.id}/status`, {
        method: "PATCH", body: JSON.stringify({ status: action.dataset.act }),
      });
      const result = await resp.json();
      toast("Order updated.");
      if (action.dataset.act === "confirmed" && result.whatsapp_url) {
        if (confirm("Send WhatsApp confirmation to customer?")) {
          window.open(result.whatsapp_url, "_blank");
        }
      }
      loadAdmin();
    } else if (deletion) {
      if (!confirm("Delete this order permanently?")) return;
      await adminFetch(`/api/admin/bookings/${deletion.dataset.del}`, { method: "DELETE" });
      toast("Order deleted.");
      loadAdmin();
    }
  });

  /* ── Tab switching (Orders / Products / Settings — no Gallery) ── */
  $$("[data-admin-tab]").forEach(tab => tab.addEventListener("click", async () => {
    $$("[data-admin-tab]").forEach(item => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    $$(".admin-panel").forEach(panel => { panel.hidden = panel.id !== tab.dataset.adminTab; });
    try {
      if (tab.dataset.adminTab === "services-panel") await loadAdminProducts();
      if (tab.dataset.adminTab === "settings-panel") await loadAdminSettings();
    } catch (error) { toast(error.message, true); }
  }));

  /* ── Product form submit (add / edit) ── */
  const serviceForm = $("#service-form");
  serviceForm?.addEventListener("submit", async event => {
    event.preventDefault();
    const serviceId = $("#service-id").value;
    /* Always send mins=0 silently */
    const r = await adminFetch(
      serviceId ? `/api/admin/services/${serviceId}` : "/api/admin/services",
      {
        method: serviceId ? "PUT" : "POST",
        body: JSON.stringify({
          name:  $("#service-name").value,
          desc:  $("#service-description").value,
          price: $("#service-price").value,
          mins:  10,   /* minimum accepted by backend validation (10-600) */
          icon:  $("#service-icon").value,
        }),
      }
    );
    const result = await r.json();
    if (!r.ok) return toast(result.error || "Product could not be saved.", true);
    resetProductForm();
    await loadAdminProducts();
    toast("Product saved.");
  });

  $("#service-cancel")?.addEventListener("click", resetProductForm);

  /* ── Product list actions (edit / delete) ── */
  $("#service-list")?.addEventListener("click", async event => {
    const edit   = event.target.closest("[data-service-edit]");
    const remove = event.target.closest("[data-service-delete]");
    if (edit) {
      const s = adminServiceCatalog.find(x => x.id === edit.dataset.serviceEdit);
      if (!s) return;
      $("#service-id").value          = s.id;
      $("#service-name").value        = s.name;
      $("#service-description").value = s.desc;
      $("#service-price").value       = s.price;
      if ($("#service-minutes")) $("#service-minutes").value = s.mins || 10;
      $("#service-icon").value        = s.icon;
      $("#service-submit").textContent = "Save Changes";
      $("#service-cancel").hidden = false;
      /* Scroll to form */
      serviceForm?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (remove && confirm("Delete this product?")) {
      const r = await adminFetch(`/api/admin/services/${remove.dataset.serviceDelete}`, { method: "DELETE" });
      if (r.ok) { await loadAdminProducts(); toast("Product deleted."); }
    }
  });

  /* ── Staff add / remove ── */
  $("#stylist-add")?.addEventListener("click", () => {
    const id = `staff-${crypto.randomUUID ? crypto.randomUUID().slice(0,8) : Math.random().toString(36).slice(2,10)}`;
    const current = $$(".stylist-editor-row", $("#stylist-list")).map(row => ({
      id:   row.dataset.stylistId,
      name: row.querySelector('[data-stylist-field="name"]').value,
      role: row.querySelector('[data-stylist-field="role"]').value,
      tag:  row.querySelector('[data-stylist-field="tag"]').value,
    }));
    renderAdminSettings({
      salon:       $("#settings-salon").value,
      currency:    $("#settings-currency").value,
      maps_query:  $("#settings-maps").value,
      whatsapp:    $("#settings-whatsapp").value,
      max_per_slot: Number($("#settings-max-per-slot").value),
      lunch_start: Number($("#settings-lunch-start").value) || 0,
      lunch_end:   Number($("#settings-lunch-end").value)   || 0,
      stylists: [...current, { id, name: "", role: "", tag: "" }],
      hours: Object.fromEntries($$("[data-hours-day]").map(row => [row.dataset.hoursDay,
        row.querySelector("[data-hours-closed]").checked ? null : [
          Number(row.querySelector("[data-hours-open]").value),
          Number(row.querySelector("[data-hours-close]").value),
        ],
      ])),
    });
    $("#stylist-list .stylist-editor-row:last-child [data-stylist-field=name]")?.focus();
  });

  $("#stylist-list")?.addEventListener("click", event => {
    const remove = event.target.closest("[data-stylist-remove]");
    if (remove) remove.closest(".stylist-editor-row").remove();
  });

  /* ── Settings form submit ── */
  $("#settings-form")?.addEventListener("submit", async event => {
    event.preventDefault();
    const stylists = $$(".stylist-editor-row", $("#stylist-list")).map(row => ({
      id:   row.dataset.stylistId,
      name: row.querySelector('[data-stylist-field="name"]').value,
      role: row.querySelector('[data-stylist-field="role"]').value,
      tag:  row.querySelector('[data-stylist-field="tag"]').value,
    }));
    const hours = Object.fromEntries($$("[data-hours-day]").map(row => [row.dataset.hoursDay,
      row.querySelector("[data-hours-closed]").checked ? null : [
        Number(row.querySelector("[data-hours-open]").value),
        Number(row.querySelector("[data-hours-close]").value),
      ],
    ]));
    const r = await adminFetch("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        salon:        $("#settings-salon").value,
        currency:     $("#settings-currency").value,
        maps_query:   $("#settings-maps").value,
        whatsapp:     $("#settings-whatsapp").value,
        max_per_slot: Number($("#settings-max-per-slot").value),
        lunch_start:  Number($("#settings-lunch-start").value) || null,
        lunch_end:    Number($("#settings-lunch-end").value)   || null,
        stylists,
        hours,
      }),
    });
    const result = await r.json();
    if (!r.ok) return toast(result.error || "Settings could not be saved.", true);
    CFG.salon       = result.settings.salon;
    CFG.currency    = result.settings.currency;
    CFG.whatsapp    = result.settings.whatsapp;
    CFG.maps_query  = result.settings.maps_query;
    CFG.stylists    = result.settings.stylists;
    CFG.hours       = result.settings.hours;
    const currencyLabel = $("#admin-currency");
    if (currencyLabel) currencyLabel.textContent = CFG.currency;
    toast("Store settings saved. 🙏");
  });

  loadAdmin();
}
bindAdmin();
