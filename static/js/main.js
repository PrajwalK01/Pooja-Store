/* Shared salon frontend logic */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const CFG = window.CFG || { services: [], stylists: [], whatsapp: "", maps_query: "" };
const money = amount => `${CFG.currency || ""}${Number(amount).toLocaleString()}`;
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

/* ── toast ── */
let toastT;
function toast(msg, isErr = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "show" + (isErr ? " err" : "");
  clearTimeout(toastT);
  toastT = setTimeout(() => (t.className = ""), 3200);
}

/* ── preloader ── */
window.addEventListener("load", () => {
  setTimeout(() => $("#preloader")?.classList.add("gone"), 1400);
});

/* ── mobile menu ── */
$("#menu-btn")?.addEventListener("click", () => $("#mobile-menu").classList.add("open"));
$("#menu-close")?.addEventListener("click", () => $("#mobile-menu").classList.remove("open"));
$$("#mobile-menu a").forEach(a => a.addEventListener("click", () => $("#mobile-menu").classList.remove("open")));

/* ── WhatsApp ── */
(() => {
  const number = CFG.whatsapp;
  if (number) {
    const url = `https://wa.me/${number}?text=${encodeURIComponent("Hi! I'd like to book an appointment at " + (CFG.salon || "the salon"))}`;
    $$(".wa-link").forEach(a => { a.href = url; a.target = "_blank"; a.rel = "noopener"; });
  } else {
    $$(".wa-link").forEach(a => { a.hidden = true; a.removeAttribute("href"); });
  }
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CFG.maps_query)}`;
  const ml = $("#maps-link");
  if (ml && CFG.maps_query) ml.href = maps;
  else if (ml) ml.hidden = true;
})();

/* ── services cards ── */
(() => {
  const grid = $("#services-grid");
  if (grid && !CFG.services.length) {
    grid.innerHTML = `<p class="empty-state">Services are being updated. Please check back soon.</p>`;
  }
  if (grid && CFG.services.length) grid.innerHTML = CFG.services.map(s => `
    <div class="card">
      <div class="icon">${s.icon}</div>
        <h3 class="neon-cyan">${escapeHTML(s.name)}</h3>
      <p>${escapeHTML(s.desc)}</p>
      <div class="row">
        <span class="price">${money(s.price)}</span>
        <span class="mins">${s.mins} min</span>
        <button class="mini-btn" data-book="${escapeHTML(s.id)}">Book</button>
      </div>
    </div>`).join("");
})();

(() => {
  const highlights = $("#service-highlights");
  if (!highlights) return;
  highlights.innerHTML = CFG.services.length ? CFG.services.slice(0, 4).map(service => `
    <a href="/services">
      <span class="strip-icon">${escapeHTML(service.icon)}</span>
      <span><b>${escapeHTML(service.name)}</b><small>${money(service.price)} · ${service.mins} min</small></span>
    </a>`).join("") : `<p class="empty-state">Salon services will appear here when added.</p>`;
})();

/* ═══ BOOKING WIZARD — 3 steps: service → date/time → details ═══ */
const wiz = { step: 1, service: null, stylist: null, date: null, time: null };
const MAXSTEP = 3;

// Auto-assign the first (and only) stylist — no selection needed
function autoSetStylist() {
  if (CFG.stylists && CFG.stylists.length > 0) wiz.stylist = CFG.stylists[0].id;
}

function stepTitle() {
  return { 1: "Pick your service", 2: "Pick date & time", 3: "Your details" }[wiz.step];
}

function renderStep() {
  $$(".steps i").forEach((el, i) => el.classList.toggle("on", i < wiz.step));
  $$(".step").forEach(el => el.classList.remove("on"));
  $(`#step-${wiz.step}`).classList.add("on");
  $("#wiz-title").textContent = stepTitle();
  $("#wiz-back").style.visibility = wiz.step === 1 ? "hidden" : "visible";
  $("#wiz-next").textContent = wiz.step === MAXSTEP ? "CONFIRM BOOKING" : "NEXT";
  if (wiz.step === 2) { if (wiz.date) loadSlots(); }
  if (wiz.step === 3) renderSummary();
}

function renderStep1() {
  if (!CFG.services.length) {
    $("#step-1 .opts").innerHTML = `<p class="empty-state">No services are currently available to book.</p>`;
    return;
  }
  $("#step-1 .opts").innerHTML = CFG.services.map(s => `
    <button class="opt ${wiz.service === s.id ? "sel" : ""}" data-svc="${s.id}">
      <span class="em">${escapeHTML(s.icon)}</span>
      <span><b>${escapeHTML(s.name)}</b><small>${s.mins} min — ${escapeHTML(s.desc)}</small></span>
      <span class="p">${money(s.price)}</span>
    </button>`).join("");
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
  if (!wiz.date) { box.innerHTML = `<p style="color:var(--muted)">Pick a date above to see available times.</p>`; return; }
  if (!wiz.stylist) { box.innerHTML = `<p style="color:var(--muted)">Salon not fully configured yet. Please call us to book.</p>`; return; }
  if (!Object.keys(CFG.hours || {}).length) {
    box.innerHTML = `<p style="color:var(--muted)">Opening hours not set yet. Please call us to book.</p>`;
    return;
  }
  const day = (new Date(wiz.date + "T12:00:00").getDay() + 6) % 7;
  const hrs = CFG.hours[String(day)];
  if (!hrs) { box.innerHTML = `<p style="color:var(--pink)">Closed that day.</p>`; return; }
  const lunchStart = CFG.lunch_start;
  const lunchEnd = CFG.lunch_end;
  let lunchNote = "";
  if (lunchStart && lunchEnd && lunchEnd > lunchStart) {
    lunchNote = `<p style="color:var(--muted);font-size:.85rem;margin-bottom:8px">Lunch break: ${to12hr(String(lunchStart).padStart(2,"0")+":00")} - ${to12hr(String(lunchEnd).padStart(2,"0")+":00")} (not available)</p>`;
  }
  box.innerHTML = `${lunchNote}<p style="color:var(--muted)">Loading slots...</p>`;
  let taken = [];
  try {
    const r = await fetch(`/api/availability?date=${wiz.date}&stylist=${wiz.stylist}`);
    taken = (await r.json()).taken || [];
  } catch { box.innerHTML = `<p style="color:var(--pink)">Could not load slots — check connection.</p>`; return; }
  const now = new Date();
  let html = lunchNote;
  for (let h = hrs[0]; h < hrs[1]; h++) {
    for (const m of [0, 30]) {
      const t = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const isPast = wiz.date === todayStr() && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()));
      const isLunch = lunchStart && lunchEnd && h >= lunchStart && h < lunchEnd;
      const dis = taken.includes(t) || isPast || isLunch;
      const label = isLunch ? `${to12hr(t)} (Lunch)` : to12hr(t);
      html += `<button class="slot ${wiz.time === t ? "sel" : ""}" data-t="${t}" ${dis ? "disabled" : ""}>${label}</button>`;
    }
  }
  box.innerHTML = html || `<p style="color:var(--muted)">No slots that day.</p>`;
}

function renderSummary() {
  const s = CFG.services.find(x => x.id === wiz.service);
  const [y, m, d] = wiz.date.split("-");
  const displayDate = `${d}/${m}/${y}`;
  $("#summary").innerHTML =
    `<b>${escapeHTML(s.icon)} ${escapeHTML(s.name)}</b> — ${money(s.price)} (${s.mins} min)<br>` +
    `Date: <b>${displayDate}</b> at <b>${to12hr(wiz.time)}</b>`;
}

function wizValidate() {
  if (wiz.step === 1 && !wiz.service) return toast("Pick a service first.", true);
  if (wiz.step === 2 && (!wiz.date || !wiz.time)) return toast("Pick a date and time.", true);
  if (wiz.step === 3) {
    const name = $("#f-name").value.trim(), phone = $("#f-phone").value.trim();
    if (name.length < 2) return toast("Please enter your name.", true);
    if (phone.length < 7) return toast("Please enter a valid phone number.", true);
  }
  return true;
}

async function submitBooking() {
  const btn = $("#wiz-next");
  btn.disabled = true; btn.textContent = "BOOKING...";
  try {
    const r = await fetch("/api/bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: $("#f-name").value.trim(), phone: $("#f-phone").value.trim(),
        service_id: wiz.service, stylist_id: wiz.stylist,
        date: wiz.date, time: wiz.time, notes: $("#f-notes").value.trim(),
      }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Booking failed");
    toast(`Booked! Your appointment ID: ${d.id}. ${d.message}`);
    wiz.service = wiz.date = wiz.time = null;
    autoSetStylist();
    $("#f-name").value = $("#f-phone").value = $("#f-notes").value = "";
    wiz.step = 1; renderStep1(); renderStep();
  } catch (e) { toast(e.message, true); }
  btn.disabled = false; renderStep();
}

function bindWizard() {
  const w = $("#wizard");
  if (!w) return;
  autoSetStylist();

  // Pre-select service from URL param — stay on step 1 so user sees it highlighted
  const requestedService = new URLSearchParams(window.location.search).get("service");
  if (requestedService && CFG.services.some(s => s.id === requestedService)) {
    wiz.service = requestedService;
  }

  renderStep1();

  // Custom DD/MM/YYYY date input
  const displayInput = $("#book-date-display");
  const hiddenInput = $("#book-date");

  function parseDisplayDate(val) {
    // Accept DD/MM/YYYY or DDMMYYYY
    const clean = val.replace(/\D/g, "");
    if (clean.length === 8) {
      const dd = clean.slice(0, 2);
      const mm = clean.slice(2, 4);
      const yyyy = clean.slice(4, 8);
      return `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD for internal use
    }
    return null;
  }

  function isValidFutureDate(yyyy_mm_dd) {
    const today = todayStr();
    const max = todayStr(30);
    return yyyy_mm_dd >= today && yyyy_mm_dd <= max;
  }

  function formatDisplay(yyyy_mm_dd) {
    if (!yyyy_mm_dd) return "";
    const [y, m, d] = yyyy_mm_dd.split("-");
    return `${d}/${m}/${y}`;
  }

  displayInput.addEventListener("input", e => {
    let val = e.target.value.replace(/\D/g, "");
    // Auto-insert slashes
    if (val.length > 2) val = val.slice(0, 2) + "/" + val.slice(2);
    if (val.length > 5) val = val.slice(0, 5) + "/" + val.slice(5);
    if (val.length > 10) val = val.slice(0, 10);
    displayInput.value = val;

    const isoDate = parseDisplayDate(val.replace(/\//g, ""));
    if (isoDate && isValidFutureDate(isoDate)) {
      hiddenInput.value = isoDate;
      wiz.date = isoDate;
      wiz.time = null;
      displayInput.style.borderColor = "";
      loadSlots();
    } else if (val.length === 10) {
      displayInput.style.borderColor = "var(--pink)";
      hiddenInput.value = "";
      wiz.date = null;
      $("#slots").innerHTML = `<p style="color:var(--pink)">Please enter a valid future date (today to 30 days ahead).</p>`;
    }
  });

  w.addEventListener("click", e => {
    const svc = e.target.closest("[data-svc]");
    if (svc) { wiz.service = svc.dataset.svc; renderStep1(); }
    const slot = e.target.closest(".slot");
    if (slot && !slot.disabled) {
      wiz.time = slot.dataset.t;
      $$(".slot").forEach(x => x.classList.remove("sel"));
      slot.classList.add("sel");
    }
  });

  $("#wiz-back").addEventListener("click", () => { if (wiz.step > 1) { wiz.step--; renderStep(); } });
  $("#wiz-next").addEventListener("click", async () => {
    if (wizValidate() !== true) return;
    if (wiz.step < MAXSTEP) { wiz.step++; renderStep(); }
    else await submitBooking();
  });
  renderStep();
}
bindWizard();

/* service card "Book" buttons jump to wizard with preselected service */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-book]");
  if (!b) return;
  wiz.service = b.dataset.book; wiz.step = 2;
  if (!$("#wizard")) {
    window.location.href = `/booking?service=${encodeURIComponent(wiz.service)}`;
    return;
  }
  renderStep1(); renderStep();
  $("#book").scrollIntoView({ behavior: "smooth" });
  toast("Service selected — now pick your date.");
});

/* CTA buttons scroll to booking */
$$("[data-goto-book]").forEach(b => b.addEventListener("click", () =>
  $("#book").scrollIntoView({ behavior: "smooth" })));

/* ═══ REVIEWS ═══ */
let myRating = 5;
async function loadReviews() {
  const box = $("#reviews-list");
  if (!box) return;
  try {
    const { reviews } = await (await fetch("/api/reviews")).json();
    const avg = reviews.length ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length) : 0;
    $("#avg-stars").textContent = avg.toFixed(1) + " / 5";
    $("#avg-num").textContent = reviews.length ? `${reviews.length} review${reviews.length > 1 ? "s" : ""}` : "No reviews yet — be the first.";
    box.innerHTML = reviews.slice(0, 12).map(r => `
      <div class="rev-card">
      <div class="stars">${r.rating}/5</div>
        <div class="who">${r.name.replace(/[<>&]/g, "")}</div>
        <p>${r.text.replace(/[<>&]/g, "")}</p>
      </div>`).join("");
  } catch { box.innerHTML = `<p style="color:var(--muted)">Couldn't load reviews.</p>`; }
}

function bindReviews() {
  const row = $("#rate-row");
  if (!row) return;
  const paint = () => $$("#rate-row button").forEach((b, i) => b.classList.toggle("lit", i < myRating));
  row.innerHTML = Array.from({ length: 5 }, (_, i) => `<button data-r="${i + 1}">${i + 1}</button>`).join("");
  row.addEventListener("click", e => {
    const b = e.target.closest("[data-r]");
    if (b) { myRating = +b.dataset.r; paint(); }
  });
  paint();
  $("#rev-form").addEventListener("submit", async e => {
    e.preventDefault();
    const name = $("#rev-name").value.trim(), text = $("#rev-text").value.trim();
    if (name.length < 2 || text.length < 3) return toast("Please enter your name and a short review.", true);
    try {
      const r = await fetch("/api/reviews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text, rating: myRating }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      toast(d.message);
      $("#rev-name").value = $("#rev-text").value = ""; myRating = 5; paint();
      loadReviews();
    } catch (err) { toast(err.message, true); }
  });
  loadReviews();
}
bindReviews();

/* ═══ ADMIN (admin.html) ═══ */
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
  chip.className = "mode-chip" + (stats.firebase ? " live" : "");
  $("#stat-grid").innerHTML = [
    ["Total", stats.total], ["Pending", stats.pending], ["Confirmed", stats.confirmed],
    ["Done", stats.done], ["Cancelled", stats.cancelled], ["Revenue", "—"],
  ].map(([l, v]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join("");
  const svcName = id => (adminServiceCatalog.find(s => s.id === id) || {}).name || id;
  const styName = id => (CFG.stylists.find(s => s.id === id) || {}).name || id;
  const fmtDate = iso => { if (!iso) return ""; const [y,m,d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const fmtTime = t => { if (!t) return ""; const [hStr,mStr] = t.split(":"); let h=parseInt(hStr); const ap=h>=12?"PM":"AM"; if(h===0)h=12; else if(h>12)h-=12; return `${h}:${mStr} ${ap}`; };
  $("#bk-list").innerHTML = bookings.length ? [...bookings].reverse().map(b => {
    const isPending   = b.status === "pending";
    const isConfirmed = b.status === "confirmed";
    const isDone      = b.status === "done";
    const isCancelled = b.status === "cancelled";
    const confirmBtn  = isPending   ? `<button data-act="confirmed" data-id="${b.id}">Confirm</button>` : "";
    const doneBtn     = isConfirmed ? `<button data-act="done" data-id="${b.id}">Done</button>` : "";
    const cancelBtn   = (!isDone && !isCancelled) ? `<button data-act="cancelled" data-id="${b.id}">Cancel</button>` : "";
    return `
    <div class="bk-row s-${b.status}">
      <div class="top">
        <b>${(b.name || "").replace(/[<>&]/g, "")}</b>
        <span class="st ${b.status}">${b.status}</span>
      </div>
      <small>${svcName(b.service_id)} · ${fmtDate(b.date)} ${fmtTime(b.time)}</small>
      <small>Ph: ${(b.phone || "").replace(/[<>&]/g, "")}${b.notes ? " · Note: " + b.notes.replace(/[<>&]/g, "") : ""}</small>
      <div class="bk-actions">
        ${confirmBtn}${doneBtn}${cancelBtn}
        <button class="danger" data-del="${b.id}">Delete</button>
      </div>
    </div>`;
  }).join("") : `<p style="color:var(--muted);text-align:center">No bookings yet. Share your website to get started.</p>`;
}

let adminServiceCatalog = [...CFG.services];

async function loadAdminServices() {
  const response = await adminFetch("/api/admin/services");
  if (!response.ok) throw new Error("Could not load services.");
  const { services } = await response.json();
  adminServiceCatalog = services;
  $("#service-list").innerHTML = services.length ? services.map(service => `
    <article class="managed-row">
      <div><span class="managed-icon">${escapeHTML(service.icon)}</span><div><b>${escapeHTML(service.name)}</b><small>${escapeHTML(service.desc)}</small></div></div>
      <p><strong>${money(service.price)}</strong><small>${service.mins} min</small></p>
      <div class="managed-actions"><button data-service-edit="${escapeHTML(service.id)}">Edit</button><button class="danger" data-service-delete="${escapeHTML(service.id)}">Delete</button></div>
    </article>`).join("") : `<p class="empty-state">No services yet. Add the first one above.</p>`;
}

async function loadAdminGallery() {
  const response = await adminFetch("/api/admin/gallery");
  if (!response.ok) throw new Error("Could not load gallery photos.");
  const { photos } = await response.json();
  $("#admin-gallery-list").innerHTML = photos.length ? photos.map(photo => `
    <article class="managed-photo">
      <img src="${escapeHTML(photo.src || `/static/images/${photo.filename}`)}" alt="${escapeHTML(photo.title)}" loading="lazy">
      <div><b>${escapeHTML(photo.title)}</b><small>${escapeHTML(photo.stylist || "Salon photo")}</small>
      <button class="danger" data-photo-delete="${escapeHTML(photo.id)}">Remove photo</button></div>
    </article>`).join("") : `<p class="empty-state">No gallery photos yet.</p>`;
}

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function renderAdminSettings(settings) {
  $("#settings-salon").value = settings.salon || "";
  $("#settings-currency").value = settings.currency || "";
  $("#settings-maps").value = settings.maps_query || "";
  $("#settings-whatsapp").value = settings.whatsapp || "";
  $("#settings-max-per-slot").value = settings.max_per_slot || 1;
  const lunchStartVal = settings.lunch_start || 0;
  const lunchEndVal = settings.lunch_end || 0;
  $("#settings-lunch-start").value = lunchStartVal;
  $("#settings-lunch-end").value = lunchEndVal;
  // Show AM/PM hints for lunch
  const updateLunchHints = () => {
    const s = Number($("#settings-lunch-start").value);
    const e = Number($("#settings-lunch-end").value);
    const sh = $("#lunch-start-hint");
    const eh = $("#lunch-end-hint");
    if (sh) sh.textContent = s > 0 ? (s >= 12 ? `${s > 12 ? s-12 : s} PM` : `${s} AM`) : "";
    if (eh) eh.textContent = e > 0 ? (e >= 12 ? `${e > 12 ? e-12 : e} PM` : `${e} AM`) : "";
  };
  updateLunchHints();
  $("#settings-lunch-start").addEventListener("input", updateLunchHints);
  $("#settings-lunch-end").addEventListener("input", updateLunchHints);
  $("#stylist-list").innerHTML = (settings.stylists || []).map(stylist => `
    <div class="stylist-editor-row" data-stylist-id="${escapeHTML(stylist.id)}">
      <div class="field"><label>Name</label><input data-stylist-field="name" value="${escapeHTML(stylist.name)}" maxlength="60" required></div>
      <div class="field"><label>Role</label><input data-stylist-field="role" value="${escapeHTML(stylist.role)}" maxlength="80" required></div>
      <div class="field"><label>Specialty</label><input data-stylist-field="tag" value="${escapeHTML(stylist.tag)}" maxlength="120" required></div>
      <button class="stylist-remove" type="button" aria-label="Remove ${escapeHTML(stylist.name)}" data-stylist-remove>Remove</button>
    </div>`).join("");
  $("#hours-editor").innerHTML = weekDays.map((day, index) => {
    const hours = settings.hours?.[String(index)];
    const closed = !hours;
    const open = hours ? hours[0] : 9;
    const close = hours ? hours[1] : 17;
    const openAmPm = open >= 12 ? "PM" : "AM";
    const closeAmPm = close >= 12 ? "PM" : "AM";
    return `<div class="hours-editor-row" data-hours-day="${index}">
      <b>${day}</b>
      <label class="hour-field">Open<input data-hours-open type="number" min="0" max="23" value="${open}" aria-label="${day} opening hour" ${closed ? "disabled" : ""}><span class="ampm-hint">${closed ? "" : openAmPm}</span></label>
      <label class="closed-toggle"><input data-hours-closed type="checkbox" ${closed ? "checked" : ""}> Closed</label>
      <label class="hour-field">Close<input data-hours-close type="number" min="1" max="24" value="${close}" aria-label="${day} closing hour" ${closed ? "disabled" : ""}><span class="ampm-hint">${closed ? "" : closeAmPm}</span></label>
    </div>`;
  }).join("");
  $$("[data-hours-closed]").forEach(toggle => toggle.addEventListener("change", () => {
    const row = toggle.closest("[data-hours-day]");
    row.querySelectorAll("[data-hours-open], [data-hours-close]").forEach(input => {
      input.disabled = toggle.checked;
      const hint = input.nextElementSibling;
      if (hint) hint.textContent = toggle.checked ? "" : (Number(input.value) >= 12 ? "PM" : "AM");
    });
  }));
  // Live AM/PM update as user types
  $$("[data-hours-open], [data-hours-close]").forEach(input => {
    input.addEventListener("input", () => {
      const hint = input.nextElementSibling;
      if (hint) hint.textContent = Number(input.value) >= 12 ? "PM" : "AM";
    });
  });
}

async function loadAdminSettings() {
  const response = await adminFetch("/api/admin/settings");
  if (!response.ok) throw new Error("Could not load salon settings.");
  renderAdminSettings((await response.json()).settings);
}

function resetServiceForm() {
  const form = $("#service-form");
  if (!form) return;
  form.reset();
  $("#service-id").value = "";
  $("#service-icon").value = "-";
  $("#service-submit").textContent = "Add service";
  $("#service-cancel").hidden = true;
}

async function bindAdmin() {
  const loginForm = $("#login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      const response = await fetch("/api/admin/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("#admin-username").value.trim(),
          password: $("#admin-pw").value,
        }),
      });
      if (response.ok) window.location.href = "/admin/dashboard";
      else toast("Username or password is incorrect.", true);
    });
  }

  const signupForm = $("#signup-form");
  if (signupForm) {
    signupForm.addEventListener("submit", async event => {
      event.preventDefault();
      const response = await fetch("/api/admin/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: $("#signup-username").value.trim(),
          password: $("#signup-password").value,
          setup_key: $("#setup-key")?.value || "",
        }),
      });
      const result = await response.json();
      if (!response.ok) return toast(result.error || "Account could not be created.", true);
      window.location.href = "/admin/dashboard";
    });
  }

  const bookingList = $("#bk-list");
  if (!bookingList) return;

  $("#logout-btn").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  });
    bookingList.addEventListener("click", async event => {
    const action = event.target.closest("[data-act]");
    const deletion = event.target.closest("[data-del]");
    if (action) {
      const resp = await adminFetch(`/api/admin/bookings/${action.dataset.id}/status`, {
        method: "PATCH", body: JSON.stringify({ status: action.dataset.act }),
      });
      const result = await resp.json();
      toast("Booking updated.");
      // If confirmed and WhatsApp URL available, open it
      if (action.dataset.act === "confirmed" && result.whatsapp_url) {
        if (confirm("Send WhatsApp confirmation to customer?")) {
          window.open(result.whatsapp_url, "_blank");
        }
      }
      loadAdmin();
    } else if (deletion) {
      if (!confirm("Delete this booking permanently?")) return;
      await adminFetch(`/api/admin/bookings/${deletion.dataset.del}`, { method: "DELETE" });
      toast("Booking deleted."); loadAdmin();
    }
  });

  $$("[data-admin-tab]").forEach(tab => tab.addEventListener("click", async () => {
    $$("[data-admin-tab]").forEach(item => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    $$(".admin-panel").forEach(panel => { panel.hidden = panel.id !== tab.dataset.adminTab; });
    try {
      if (tab.dataset.adminTab === "services-panel") await loadAdminServices();
      if (tab.dataset.adminTab === "gallery-panel") await loadAdminGallery();
      if (tab.dataset.adminTab === "settings-panel") await loadAdminSettings();
    } catch (error) { toast(error.message, true); }
  }));

  const serviceForm = $("#service-form");
  serviceForm.addEventListener("submit", async event => {
    event.preventDefault();
    const serviceId = $("#service-id").value;
    const response = await adminFetch(serviceId ? `/api/admin/services/${serviceId}` : "/api/admin/services", {
      method: serviceId ? "PUT" : "POST",
      body: JSON.stringify({
        name: $("#service-name").value,
        desc: $("#service-description").value,
        price: $("#service-price").value,
        mins: $("#service-minutes").value,
        icon: $("#service-icon").value,
      }),
    });
    const result = await response.json();
    if (!response.ok) return toast(result.error || "Service could not be saved.", true);
    resetServiceForm();
    await loadAdminServices();
    toast("Service saved.");
  });
  $("#service-cancel").addEventListener("click", resetServiceForm);
  $("#service-list").addEventListener("click", async event => {
    const edit = event.target.closest("[data-service-edit]");
    const remove = event.target.closest("[data-service-delete]");
    if (edit) {
      const service = adminServiceCatalog.find(item => item.id === edit.dataset.serviceEdit);
      if (!service) return;
      $("#service-id").value = service.id;
      $("#service-name").value = service.name;
      $("#service-description").value = service.desc;
      $("#service-price").value = service.price;
      $("#service-minutes").value = service.mins;
      $("#service-icon").value = service.icon;
      $("#service-submit").textContent = "Save changes";
      $("#service-cancel").hidden = false;
    } else if (remove && confirm("Delete this service from the menu?")) {
      const response = await adminFetch(`/api/admin/services/${remove.dataset.serviceDelete}`, { method: "DELETE" });
      if (response.ok) { await loadAdminServices(); toast("Service removed."); }
    }
  });

  $("#gallery-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const response = await fetch("/api/admin/gallery", { method: "POST", body: new FormData(form) });
    const result = await response.json();
    if (!response.ok) return toast(result.error || "Photo could not be uploaded.", true);
    form.reset();
    await loadAdminGallery();
    toast("Photo added to the gallery.");
  });
  $("#admin-gallery-list").addEventListener("click", async event => {
    const remove = event.target.closest("[data-photo-delete]");
    if (!remove || !confirm("Remove this gallery photo?")) return;
    const response = await adminFetch(`/api/admin/gallery/${remove.dataset.photoDelete}`, { method: "DELETE" });
    if (response.ok) { await loadAdminGallery(); toast("Photo removed."); }
  });

  $("#stylist-add").addEventListener("click", () => {
    const id = `stylist-${crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10)}`;
    const settings = {
      ...CFG,
      stylists: [...$$(".stylist-editor-row", $("#stylist-list")).map(row => ({
        id: row.dataset.stylistId,
        name: row.querySelector('[data-stylist-field="name"]').value,
        role: row.querySelector('[data-stylist-field="role"]').value,
        tag: row.querySelector('[data-stylist-field="tag"]').value,
      })), { id, name: "", role: "", tag: "" }],
      hours: CFG.hours,
    };
    renderAdminSettings({
      ...settings,
      salon: $("#settings-salon").value,
      maps_query: $("#settings-maps").value,
      whatsapp: $("#settings-whatsapp").value,
      hours: Object.fromEntries($$("[data-hours-day]").map(row => [row.dataset.hoursDay,
        row.querySelector("[data-hours-closed]").checked ? null : [
          Number(row.querySelector("[data-hours-open]").value),
          Number(row.querySelector("[data-hours-close]").value),
        ],
      ])),
    });
    const newName = $("#stylist-list .stylist-editor-row:last-child [data-stylist-field=name]");
    newName?.focus();
  });
  $("#stylist-list").addEventListener("click", event => {
    const remove = event.target.closest("[data-stylist-remove]");
    if (remove) remove.closest(".stylist-editor-row").remove();
  });
  $("#settings-form").addEventListener("submit", async event => {
    event.preventDefault();
    const stylists = $$(".stylist-editor-row", $("#stylist-list")).map(row => ({
      id: row.dataset.stylistId,
      name: row.querySelector('[data-stylist-field="name"]').value,
      role: row.querySelector('[data-stylist-field="role"]').value,
      tag: row.querySelector('[data-stylist-field="tag"]').value,
    }));
    const hours = Object.fromEntries($$("[data-hours-day]").map(row => [row.dataset.hoursDay,
      row.querySelector("[data-hours-closed]").checked ? null : [
        Number(row.querySelector("[data-hours-open]").value),
        Number(row.querySelector("[data-hours-close]").value),
      ],
    ]));
    const response = await adminFetch("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify({
        salon: $("#settings-salon").value,
        currency: $("#settings-currency").value,
        maps_query: $("#settings-maps").value,
        whatsapp: $("#settings-whatsapp").value,
        max_per_slot: Number($("#settings-max-per-slot").value),
        lunch_start: Number($("#settings-lunch-start").value) || null,
        lunch_end: Number($("#settings-lunch-end").value) || null,
        stylists,
        hours,
      }),
    });
    const result = await response.json();
    if (!response.ok) return toast(result.error || "Settings could not be saved.", true);
    CFG.salon = result.settings.salon;
    CFG.currency = result.settings.currency;
    const currencyLabel = $("#admin-currency");
    if (currencyLabel) currencyLabel.textContent = CFG.currency;
    CFG.whatsapp = result.settings.whatsapp;
    CFG.maps_query = result.settings.maps_query;
    CFG.stylists = result.settings.stylists;
    CFG.hours = result.settings.hours;
    toast("Salon settings saved.");
  });

  loadAdmin();
}
bindAdmin();
