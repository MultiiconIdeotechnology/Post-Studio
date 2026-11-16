// App shell for the planner: one step on screen at a time, a step rail that shows where the
// week stands, and the week / approval summary in the top bar. It only reads planner state
// (window.PS); every action still lives in index.html and studio.js.
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const STEPS = ["s1", "s2", "s3", "s4", "s5"];
  // readable addresses that don't match an element id, so the browser never jumps to them
  const SLUG = { s1: "plan", s2: "photos", s3: "polish", s4: "write", s5: "review" };
  const byslug = Object.fromEntries(Object.entries(SLUG).map(([k, v]) => [v, k]));
  const NEXT_LABEL = { s1: "Event photos", s2: "Polish photos", s3: "Brief and write", s4: "Review and post" };
  const PREV_LABEL = { s2: "Plan the week", s3: "Event photos", s4: "Polish photos", s5: "Brief and write" };
  const chevL = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M12.5 4.5 7 10l5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const chevR = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5 13 10l-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const tick = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 10.5 3.2 3L15 6.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  let current = null;

  /* ---------- brand sections ---------- */
  // Each company has its own section: its own weeks and posts (kept per brand), voice, pillars
  // and colours. Switching reloads the page with ?brand=, so nothing from one brand leaks into another.
  const B = window.PS_BRAND;
  const BRANDS = window.PS_BRANDS || {};
  const escH = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const wordmark = (b) => b.wordmark.map(([t, c]) => (c === "accent" ? `<i>${escH(t)}</i>` : escH(t))).join("");
  function paintBrand() {
    if (!B) return;
    const wm = $("#railWm");
    if (wm) { wm.innerHTML = wordmark(B); wm.setAttribute("aria-label", B.name); }
    const sw = $("#brandSwitch");
    if (sw) {
      sw.innerHTML = `<span class="brandsw-h">Company</span>` + Object.values(BRANDS).map((b) =>
        `<a class="bs" href="?brand=${b.id}" data-brand="${b.id}" style="--bs-c:${b.slide.accent}"${b.id === B.id ? ' aria-current="page"' : ""} title="${escH(b.name + ": " + b.role)}">` +
        `<span class="bs-av" aria-hidden="true">${escH(b.monogram)}</span><span class="bs-tx"><b>${escH(b.name)}</b><small>${escH(b.handle)}</small></span></a>`).join("");
      sw.querySelectorAll("a.bs").forEach((a) => {
        a.onclick = (e) => {
          e.preventDefault();
          if (a.dataset.brand === B.id) return;
          const n = window.PS && window.PS.photos ? window.PS.photos.length : 0;
          if (n && !confirm(`Switch to ${BRANDS[a.dataset.brand].name}? The ${n} photo${n > 1 ? "s" : ""} loaded in this tab will be cleared. Written posts stay saved with ${B.name}.`)) return;
          try { localStorage.setItem("ps-brand", a.dataset.brand); } catch {}
          location.href = `?brand=${a.dataset.brand}${location.hash}`;
        };
      });
    }
    document.querySelectorAll("[data-copy]").forEach((el) => { const v = B.copy[el.dataset.copy]; if (v) el.textContent = v; });
    document.querySelectorAll("[data-tpl]").forEach((el) => { el.textContent = el.dataset.tpl.replace(/\{(\w+)\}/g, (_, k) => B.copy[k] || B[k] || ""); });
    document.querySelectorAll("[data-ph]").forEach((el) => { const v = B.copy[el.dataset.ph]; if (v) el.placeholder = v; });
    const pl = $("#pillars");
    if (pl) pl.innerHTML = B.pillars.map((x) => `<li><b>${escH(x.name)}</b>${escH(x.idea)}</li>`).join("");
    NEXT_LABEL.s1 = B.copy.photoNav;
    PREV_LABEL.s3 = B.copy.photoNav;
  }
  paintBrand();

  function facts() {
    const PS = window.PS;
    const S = PS.S;
    const photos = PS.photos;
    const picked = photos.filter((p) => p.pick).length;
    const posts = S.posts || [];
    const ready = posts.filter((p) => p.state === "ready");
    const approved = posts.filter((p) => p.approved).length;
    const event = Math.min(S.eventCount, S.postCount);
    return { S, photos, picked, posts, ready, approved, event };
  }

  function navState() {
    const f = facts();
    const s = {};
    s.s1 = { done: f.S.agreed, text: f.S.agreed ? `${f.S.postCount} posts agreed` : "Not agreed yet" };
    s.s2 =
      f.event === 0
        ? { done: true, text: "No event this week" }
        : { done: f.picked > 0, text: f.photos.length ? `${f.picked} of ${f.photos.length} picked` : "No photos yet" };
    s.s3 = f.event === 0 ? { done: true, text: "Nothing to polish" } : { done: f.picked > 0, text: f.picked ? `${f.picked} to polish` : "Nothing picked" };
    s.s4 = { done: f.posts.length > 0, text: f.posts.length ? `${f.posts.length} posts written` : "Not written yet" };
    s.s5 = {
      done: f.posts.length > 0 && f.approved === f.posts.length,
      text: f.posts.length ? `${f.approved} of ${f.posts.length} approved` : "Nothing to review",
    };
    return { s, f };
  }

  function sync() {
    if (!window.PS) return;
    const { s, f } = navState();
    for (const id of STEPS) {
      const a = $(`.steps a[data-step="${id}"]`);
      if (!a) continue;
      a.classList.toggle("done", !!s[id].done);
      $(`[data-nav="${id}"]`, a).textContent = s[id].text;
      $(".n", a).innerHTML = s[id].done && id !== current ? tick : String(STEPS.indexOf(id) + 1);
    }
    const wk = f.S.weekStart && window.PS.fmtDay ? `${window.PS.fmtDay(f.S.weekStart)} to ${window.PS.fmtDay(window.PS.addDays(f.S.weekStart, 6))}` : "–";
    $("#tbWeek").textContent = wk;
    const n = f.posts.length;
    const pct = n ? Math.round((f.approved / n) * 100) : 0;
    $("#tbProgress").innerHTML = n
      ? `<span class="tb-bar" aria-hidden="true"><i style="width:${pct}%"></i></span><span><b>${f.approved}</b> of ${n} posts approved</span>`
      : f.S.agreed
        ? `<span>${f.S.postCount} posts planned</span>`
        : `<span>Week not agreed yet</span>`;
  }

  function renderStepNav() {
    const i = STEPS.indexOf(current);
    const prev = STEPS[i - 1];
    const next = STEPS[i + 1];
    $("#stepnav").innerHTML =
      (prev ? `<a class="btn ghost" href="#${SLUG[prev]}">${chevL}<span>${PREV_LABEL[current]}</span></a>` : "<span></span>") +
      (next ? `<a class="btn primary" href="#${SLUG[next]}"><span>Next: ${NEXT_LABEL[current]}</span>${chevR}</a>` : "<span></span>");
  }

  function go(id, opts = {}) {
    if (!STEPS.includes(id)) id = "s1";
    const changed = id !== current;
    current = id;
    for (const sid of STEPS) {
      const sec = document.getElementById(sid);
      sec.classList.toggle("active", sid === id);
      const a = $(`.steps a[data-step="${sid}"]`);
      if (sid === id) a.setAttribute("aria-current", "step");
      else a.removeAttribute("aria-current");
    }
    if (location.hash !== `#${SLUG[id]}`) history.replaceState(null, "", `#${SLUG[id]}`);
    renderStepNav();
    sync();
    if (changed && !opts.keepScroll) window.scrollTo({ top: 0 });
    if (changed && window.PS) {
      // canvases drawn while their step was hidden are fine; this just refreshes previews after edits
      if (id === "s5" || id === "s3") window.PS.redrawAll();
    }
  }

  function fromHash() {
    const h = location.hash.slice(1);
    if (byslug[h]) return go(byslug[h]);
    if (STEPS.includes(h)) return go(h);
    if (h.startsWith("post-")) {
      // a link to a post card in the schedule table
      go("s5", { keepScroll: true });
      const el = document.getElementById(h);
      if (el) el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", "#review");
      return;
    }
    // first visit: start where the week stands
    const S = window.PS ? window.PS.S : null;
    go(S && S.posts && S.posts.length ? "s5" : S && S.agreed ? "s2" : "s1");
  }

  // theme: dark by default, light as a remembered choice
  const themeBtn = $("#themeT");
  function paintTheme() {
    const light = document.documentElement.dataset.theme === "light";
    themeBtn.textContent = light ? "Dark mode" : "Light mode";
    themeBtn.setAttribute("aria-pressed", String(light));
    const m = $('meta[name="theme-color"]');
    if (m) m.content = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || (light ? "#e9ecf4" : "#070b18");
  }
  if (themeBtn) {
    themeBtn.onclick = () => {
      const light = document.documentElement.dataset.theme !== "light";
      if (light) document.documentElement.dataset.theme = "light";
      else delete document.documentElement.dataset.theme;
      try { localStorage.setItem("ps-theme", light ? "light" : "dark"); } catch {}
      paintTheme();
    };
    paintTheme();
  }

  window.PSNav = { go, sync };
  window.addEventListener("hashchange", fromHash);
  document.addEventListener("ps:change", sync);
  document.addEventListener("click", (e) => {
    // photo picks, approvals and option switches change counts without a save() in some paths
    if (e.target.closest(".ph, .appr, .opts, #agreeBtn, #pickBtn")) setTimeout(sync, 50);
  });
  document.addEventListener("change", () => setTimeout(sync, 50));
  // photos load and posts stream in asynchronously; keep the rail in step with them
  const mo = new MutationObserver(() => { clearTimeout(mo.t); mo.t = setTimeout(sync, 80); });
  for (const id of ["photoGrid", "posts", "sched", "editGrid"]) { const el = document.getElementById(id); if (el) mo.observe(el, { childList: true }); }
  fromHash();
  document.body.classList.add("ready");
})();
