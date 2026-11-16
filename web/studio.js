// Server-side features layered on the planner: sign-in, status chips, saving the plan,
// AI visuals for a post, and the real Post / Schedule flow.
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const BRAND = window.PS_BRAND;
  const api = async (method, path, body, isForm) => {
    const res = await fetch(path, { method, headers: isForm ? undefined : { "content-type": "application/json" }, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    // Long image jobs answer 200 and report a failure inside the body.
    if (!res.ok || json.error) throw Object.assign(new Error(json.message || res.statusText), { code: json.error, status: res.status });
    return json;
  };

  /* ---------- sign in ---------- */
  async function ensureSignedIn() {
    const me = await api("GET", "/api/auth/me").catch(() => ({ authRequired: false, signedIn: true }));
    if (me.signedIn) return;
    await new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "login";
      box.innerHTML = `<form><span class="wm" aria-label="${BRAND.name}">${BRAND.wordmark.map(([t, c]) => (c === "accent" ? `<i>${t}</i>` : t)).join("")}</span><div><h1>Post Studio</h1><p class="hint">Sign in with the team password to plan and approve this week's posts.</p></div><label class="field"><span>Team password</span><input type="password" id="pw" autocomplete="current-password" required autofocus></label><button class="go lg" type="submit">Sign in</button><span class="status err" id="pwErr" role="alert"></span></form>`;
      document.body.appendChild(box);
      $("#pw", box).focus();
      $("form", box).onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api("POST", "/api/auth/login", { password: $("#pw", box).value });
          box.remove();
          resolve();
        } catch (err) {
          $("#pwErr", box).textContent = err.message;
        }
      };
    });
  }

  /* ---------- status chips ---------- */
  let status = null;
  async function renderStatus() {
    status = await api("GET", "/api/status").catch(() => null);
    const el = $("#studioStatus");
    if (!status || !el) return;
    const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const row = (ok, name, detail) => `<div class="conn-row ${ok ? "ok" : "warn"}" title="${esc(name + ": " + detail)}"><span class="dot" aria-hidden="true"></span><span class="conn-n">${esc(name)}</span><span class="conn-d">${esc(detail)}</span></div>`;
    const imgs = status.images.filter((p) => p.configured).map((p) => p.label.split(" (")[0]);
    el.innerHTML =
      row(status.claude.configured, "Claude", status.claude.configured ? status.claude.model : "No API key") +
      row(imgs.length > 0, "Images", imgs.length ? imgs.join(", ") : "No provider key") +
      row(status.instagram.publishEnabled, "Instagram", status.instagram.publishEnabled ? "Connected" : status.instagram.configured ? "Publishing off" : "Not connected");
  }

  /* ---------- plan persistence (server copy of the planner state) ---------- */
  let planId = null;
  let saveTimer;
  async function savePlan() {
    const S = window.PS.S;
    try {
      const { plan } = await api("PUT", "/api/plans", { brand: BRAND.id, weekStart: S.weekStart, state: { postCount: S.postCount, agreed: S.agreed, eventCount: S.eventCount, ev: S.ev, trends: S.trends, focus: S.focus, suggestion: S.suggestion, posts: S.posts } });
      planId = plan.id;
    } catch (e) {
      console.warn("plan save failed", e.message);
    }
  }
  function watchPlan() {
    const orig = window.PS.save;
    // PS.save is the planner's debounced localStorage save; piggyback a server save on it.
    document.addEventListener("ps:saved", () => {});
    setInterval(() => {
      const snap = JSON.stringify([window.PS.S.weekStart, window.PS.S.postCount, window.PS.S.posts.length, window.PS.S.ev]);
      if (snap !== watchPlan.last) {
        watchPlan.last = snap;
        clearTimeout(saveTimer);
        saveTimer = setTimeout(savePlan, 800);
      }
    }, 1500);
    void orig;
  }

  /* ---------- helpers ---------- */
  const blob = (canvas, q = 0.92) => new Promise((r) => canvas.toBlob(r, "image/jpeg", q));

  /* ---------- Claude designs every slide of a post ---------- */
  // The planner fires "ps:design" when a post is written or rewritten. Each slide comes back as
  // one finished image (art and words together). Two posts at a time; the server pools its calls.
  const designQueue = [];
  let designing = 0;
  const photoAssets = new Map(); // planner photo id + edit settings -> uploaded asset id
  const cardOf = (p) => document.querySelector(`.post[data-id="${p.id}"]`);
  const textSig = (o) => JSON.stringify(o.slides.map((s) => [s.kicker, s.headline, s.body, s.template, s.photoId]));

  function requestDesign({ p, mode }) {
    const o = window.PS.opt(p);
    if (!o || !status || !status.claude || !status.claude.configured) return;
    if (designQueue.some((j) => j.o === o)) return;
    designQueue.push({ p, o, mode: mode || "fresh" });
    const el = cardOf(p);
    if (el) window.PS.setStatus($(".pstatus", el), "Waiting to design the slides…");
    pump();
  }
  function pump() {
    while (designing < 2 && designQueue.length) {
      const job = designQueue.shift();
      designing++;
      designPost(job).finally(() => { designing--; pump(); });
    }
  }
  async function uploadPhoto(id) {
    const PS = window.PS;
    const ph = PS.photoById(id);
    if (!ph || !ph.img) return null;
    if (ph.remote) return id; // already on the server
    const key = id + JSON.stringify(ph.edit || {});
    if (photoAssets.has(key)) return photoAssets.get(key);
    const form = new FormData();
    form.append("files", await blob(PS.processed(ph), 0.9), `${id}.jpg`);
    const { assets } = await api("POST", `/api/images/upload?planId=${planId}&kind=upload`, form, true);
    photoAssets.set(key, assets[0].id);
    return assets[0].id;
  }
  async function designPost({ p, o, mode }) {
    const PS = window.PS;
    const n = o.slides.length;
    const started = Date.now();
    const st = () => { const el = cardOf(p); return el && $(".pstatus", el); };
    const tick = () => { const s = st(); if (s) PS.setStatus(s, `Designing ${n} slide${n > 1 ? "s" : ""} with Claude… ${Math.round((Date.now() - started) / 1000)}s (usually one to three minutes)`); };
    tick();
    const timer = setInterval(tick, 1000);
    const sig = textSig(o);
    try {
      if (!planId) await savePlan();
      const slides = [];
      for (const s of o.slides) {
        slides.push({ kicker: s.kicker || "", headline: s.headline || "", body: s.body || "", template: s.template, photoAssetId: s.photoId && PS.PHOTO_TPL.has(s.template) ? (await uploadPhoto(s.photoId)) || undefined : undefined });
      }
      const r = await api("POST", "/api/design/post", { brand: BRAND.id, planId, mode: o.theme ? mode : "fresh", theme: o.theme || undefined, topic: p.topic || "", hook: o.hook || "", caption: o.caption || "", slides });
      clearInterval(timer);
      if (textSig(o) !== sig) { const s = st(); if (s) PS.setStatus(s, "The slides changed while they were being designed. Press New Generate themes to design them again."); return; }
      o.theme = r.theme;
      let ok = 0;
      r.slides.forEach((a, i) => { if (a && a.url && o.slides[i]) { o.slides[i].design = a.url; ok++; } });
      p.approved = false;
      PS.save();
      const el = cardOf(p);
      if (el) { PS.fill(el, p); PS.setStatus($(".pstatus", el), ok === n ? `Designed: "${r.theme.name}". Press New Generate themes for another look.` : `${ok} of ${n} slides designed ("${r.theme.name}"). The rest keep the plain layout; press New Generate themes to try again.`, ok < n); }
    } catch (e) {
      clearInterval(timer);
      const s = st();
      if (s) PS.setStatus(s, "Design failed: " + (e.message || PS.errCopy(e)), true);
    }
  }
  // "New Generate themes": a variation of the current look, or a completely new one.
  function chooseTheme({ el, p }) {
    const PS = window.PS;
    const box = $(".visuals", el);
    if (!PS.opt(p).theme) return requestDesign({ p, mode: "fresh" });
    box.hidden = false;
    box.innerHTML = `<div class="row"><span class="hint">New look for this post:</span><button class="small" data-m="variation">Variation of this look</button><button class="small ghost" data-m="fresh">Completely new look</button></div>`;
    box.querySelectorAll("button").forEach((b) => (b.onclick = () => { box.hidden = true; box.innerHTML = ""; requestDesign({ p, mode: b.dataset.m }); }));
  }

  /* ---------- Post / Schedule against the server ---------- */
  async function postOrSchedule(el, p) {
    const PS = window.PS;
    const pn = $(".panel", el);
    pn.hidden = false;
    pn.classList.remove("err");
    pn.innerHTML = `<b>Preparing the slides…</b><span class="status"></span>`;
    const st = $(".status", pn);
    try {
      if (!planId) await savePlan();
      const o = PS.opt(p);
      await PS.fontsReady;
      await PS.designsReady(o);
      // 1. render slides in the browser and upload them
      const form = new FormData();
      for (let i = 0; i < o.slides.length; i++) form.append("files", await blob(PS.slideCanvas(o.slides[i], i, o.slides.length)), `${i + 1}.jpg`);
      PS.setStatus(st, "Uploading slides…");
      const { assets } = await api("POST", `/api/images/upload?planId=${planId}&kind=render`, form, true);
      const when = new Date(`${p.day}T${p.time || "11:00"}:00`);
      const body = { kind: p.kind, topic: p.topic, scheduledFor: when.toISOString(), options: p.options, selectedOption: p.sel, renderAssetIds: assets.map((a) => a.id), caption: PS.fullCaption(o) };
      // 2. create or update the server post, then approve it there
      const saved = p.serverId ? await api("PUT", `/api/posts/${p.serverId}`, body) : await api("POST", `/api/plans/${planId}/posts`, body);
      p.serverId = saved.post.id;
      PS.save();
      await api("POST", `/api/posts/${p.serverId}/approve`, { approve: true });
      // 3. schedule (works only when Instagram is connected)
      try {
        const r = await api("POST", `/api/posts/${p.serverId}/schedule`, { when: when.toISOString() });
        p.exported = true;
        PS.save();
        PS.updateApproveGate(el);
        PS.renderSched();
        pn.innerHTML = `<b>Scheduled.</b> <span>This post goes to Instagram on ${PS.esc(when.toLocaleString("en-IN"))}. Status: ${PS.esc(r.post.state)}.</span><div class="row"><button class="small ghost" data-x="cancel">Cancel schedule</button></div><span class="status"></span>`;
        $("[data-x=cancel]", pn).onclick = async () => {
          await api("POST", `/api/posts/${p.serverId}/cancel`);
          pn.innerHTML = `<b>Cancelled.</b> The post stays approved on the server; press Post / Schedule to schedule it again.`;
        };
      } catch (e) {
        if (e.code !== "instagram_not_connected") throw e;
        pn.innerHTML = `<b>Saved and approved, not posted.</b> <span>${PS.esc(e.message)}</span>
          <div class="row"><button class="small primary" data-x="zip">Download post (.zip)</button><button class="small ghost" data-x="copy">Copy caption</button></div><span class="status"></span>
          <span class="hint">Once the Meta app and Instagram login are configured on the server, this button schedules the post for ${PS.esc(when.toLocaleString("en-IN"))}.</span>`;
        const st2 = $(".status", pn);
        $("[data-x=zip]", pn).onclick = async () => {
          const zip = new JSZip();
          for (let i = 0; i < o.slides.length; i++) zip.file(`${String(i + 1).padStart(2, "0")}.jpg`, await blob(PS.slideCanvas(o.slides[i], i, o.slides.length)));
          zip.file("caption.txt", `${p.day} ${p.time} IST\n\n${PS.fullCaption(o)}\n\nAlt text: ${o.alt}\n`);
          const data = await zip.generateAsync({ type: "blob" });
          const d = await window.claude.use("downloads");
          await d.save({ filename: `${BRAND.id}-${p.day}-${PS.slug(p.topic)}.zip`, data });
          p.exported = true;
          PS.save();
          PS.updateApproveGate(el);
          PS.renderSched();
          PS.setStatus(st2, "Saved.");
        };
        $("[data-x=copy]", pn).onclick = () => navigator.clipboard.writeText(PS.fullCaption(o)).then(() => PS.setStatus(st2, "Caption copied."), () => PS.setStatus(st2, "Copy was blocked; select the caption field and press Ctrl+C.", true));
      }
    } catch (e) {
      pn.classList.add("err"); pn.innerHTML = `<b>Could not post.</b> <span>${PS.esc(e.message)}</span>`;
    }
  }

  window.PSStudio = { post: postOrSchedule };
  document.addEventListener("ps:visual", (e) => chooseTheme(e.detail));
  document.addEventListener("ps:design", (e) => requestDesign(e.detail));

  (async () => {
    await ensureSignedIn();
    await renderStatus();
    if (window.PS) {
      watchPlan();
      await savePlan();
    } else document.addEventListener("ps:ready", () => { watchPlan(); savePlan(); }, { once: true });
  })();
})();
