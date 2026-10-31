// Server-side features layered on the planner: sign-in, status chips, saving the plan,
// AI visuals for a post, and the real Post / Schedule flow.
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const api = async (method, path, body, isForm) => {
    const res = await fetch(path, { method, headers: isForm ? undefined : { "content-type": "application/json" }, body: isForm ? body : body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.message || res.statusText), { code: json.error, status: res.status });
    return json;
  };

  /* ---------- sign in ---------- */
  async function ensureSignedIn() {
    const me = await api("GET", "/api/auth/me").catch(() => ({ authRequired: false, signedIn: true }));
    if (me.signedIn) return;
    await new Promise((resolve) => {
      const box = document.createElement("div");
      box.className = "login";
      box.innerHTML = `<form><h2 style="margin:0">Post Studio</h2><label class="field"><span>Team password</span><input type="password" id="pw" autocomplete="current-password" required></label><button class="primary" type="submit">Sign in</button><span class="status err" id="pwErr"></span></form>`;
      document.body.appendChild(box);
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
    const chip = (ok, text) => `<span class="chip ${ok ? "ok" : "warn"}">${text}</span>`;
    const imgs = status.images.filter((p) => p.configured).map((p) => p.label.split(" (")[0]);
    el.innerHTML =
      chip(status.claude.configured, status.claude.configured ? `Claude: ${status.claude.model}` : "Claude: no API key") +
      chip(imgs.length > 0, imgs.length ? `Images: ${imgs.join(", ")}` : "Images: no provider key") +
      chip(status.instagram.publishEnabled, status.instagram.publishEnabled ? "Instagram: connected" : status.instagram.configured ? "Instagram: connected, publishing off" : "Instagram: not connected");
  }

  /* ---------- plan persistence (server copy of the planner state) ---------- */
  let planId = null;
  let saveTimer;
  async function savePlan() {
    const S = window.PS.S;
    try {
      const { plan } = await api("PUT", "/api/plans", { weekStart: S.weekStart, state: { postCount: S.postCount, agreed: S.agreed, eventCount: S.eventCount, ev: S.ev, trends: S.trends, focus: S.focus, suggestion: S.suggestion, posts: S.posts } });
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
  function addRemotePhoto(asset, p, desc) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const ph = { id: asset.id, name: asset.id, img, url: asset.url, score: null, desc: desc || asset.prompt || "AI visual", reason: "Generated", issues: "", pick: true, focal: { x: 0.5, y: 0.45 }, edit: { ...window.PS.EDIT0, auto: false, contrast: 0, sat: 0, sharp: 0 }, remote: true };
        window.PS.photos.push(ph);
        if (p && !(p.photoIds || []).includes(ph.id)) p.photoIds = [...(p.photoIds || []), ph.id];
        resolve(ph);
      };
      img.onerror = () => resolve(null);
      img.src = asset.url;
    });
  }

  /* ---------- AI visual for a post ---------- */
  async function generateVisual({ el, p }) {
    const PS = window.PS;
    const st = $(".pstatus", el);
    const box = $(".visuals", el);
    const configured = status && status.images.some((x) => x.configured);
    if (!configured) return PS.setStatus(st, "No image provider key on the server yet (FAL_KEY, GEMINI_API_KEY or OPENAI_API_KEY).", true);
    if (!PS.sample) return PS.setStatus(st, "Claude is not configured on the server.", true);
    const o = PS.opt(p);
    const provider = status.images.find((x) => x.default && x.configured) || status.images.find((x) => x.configured);
    PS.setStatus(st, "Writing the image brief…");
    try {
      const brief = await PS.sample.json(
        `Write ONE image-generation prompt for slide 1 of this Instagram post. Follow the VISUAL DIRECTION. The headline "${(o.slides[0] && o.slides[0].headline) || o.hook}" will be composited later, so leave clean space for it at the bottom third. No text, letters or logos in the image.
Post topic: ${p.topic}. Hook: ${o.hook}. Caption summary: ${(o.caption || "").slice(0, 400)}
Reply with only JSON: {"prompt":"the full prompt, 60 to 120 words, concrete subject, composition, lens, light, palette, mood","negative":"what to avoid"}`,
        { modelTier: "default" },
      );
      PS.setStatus(st, `Generating with ${provider.label.split(" (")[0]}… this can take 20 to 60 seconds`);
      const { assets } = await api("POST", "/api/images/generate", { planId, provider: provider.id, prompt: String(brief.prompt || ""), aspect: "4:5", n: 2 });
      box.hidden = false;
      for (const a of assets) {
        const img = document.createElement("img");
        img.src = a.url;
        img.alt = "AI visual option";
        img.title = "Use as the photo on this slide";
        img.onclick = async () => {
          box.querySelectorAll("img").forEach((i) => i.classList.toggle("sel", i === img));
          const ph = PS.photoById(a.id) || (await addRemotePhoto(a, p, p.topic));
          if (!ph) return;
          const s = PS.cur(p);
          if (!PS.PHOTO_TPL.has(s.template)) s.template = "photo";
          s.photoId = ph.id;
          p.approved = false;
          PS.save();
          PS.renderEdits();
          PS.fillSlide(el, p);
          PS.updateApproveGate(el);
          PS.setStatus(st, "Visual placed on this slide. Adjust light and crop in step 3.");
        };
        box.appendChild(img);
      }
      PS.setStatus(st, `${assets.length} visuals ready. Click one to use it on the current slide.`);
    } catch (e) {
      PS.setStatus(st, e.message || PS.errCopy(e), true);
    }
  }

  /* ---------- Post / Schedule against the server ---------- */
  async function postOrSchedule(el, p) {
    const PS = window.PS;
    const pn = $(".panel", el);
    pn.hidden = false;
    pn.innerHTML = `<b>Preparing…</b><span class="status"></span>`;
    const st = $(".status", pn);
    try {
      if (!planId) await savePlan();
      const o = PS.opt(p);
      await PS.fontsReady;
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
        pn.innerHTML = `<b>Scheduled.</b> This post goes to Instagram on ${PS.esc(when.toLocaleString("en-IN"))}. Status: ${PS.esc(r.post.state)}. <button class="small" data-x="cancel">Cancel schedule</button><span class="status"></span>`;
        $("[data-x=cancel]", pn).onclick = async () => {
          await api("POST", `/api/posts/${p.serverId}/cancel`);
          pn.innerHTML = `<b>Cancelled.</b> The post stays approved on the server; press Post / Schedule to schedule it again.`;
        };
      } catch (e) {
        if (e.code !== "instagram_not_connected") throw e;
        pn.innerHTML = `<b>Saved and approved on the server, not posted.</b> ${PS.esc(e.message)}
          <div class="row"><button class="small primary" data-x="zip">Download post (.zip)</button><button class="small" data-x="copy">Copy caption</button></div><span class="status"></span>
          <span class="hint">Once the Meta app and Instagram login are configured on the server, this button schedules the post for ${PS.esc(when.toLocaleString("en-IN"))}.</span>`;
        const st2 = $(".status", pn);
        $("[data-x=zip]", pn).onclick = async () => {
          const zip = new JSZip();
          for (let i = 0; i < o.slides.length; i++) zip.file(`${String(i + 1).padStart(2, "0")}.jpg`, await blob(PS.slideCanvas(o.slides[i], i, o.slides.length)));
          zip.file("caption.txt", `${p.day} ${p.time} IST\n\n${PS.fullCaption(o)}\n\nAlt text: ${o.alt}\n`);
          const data = await zip.generateAsync({ type: "blob" });
          const d = await window.claude.use("downloads");
          await d.save({ filename: `multiicon-${p.day}-${PS.slug(p.topic)}.zip`, data });
          p.exported = true;
          PS.save();
          PS.updateApproveGate(el);
          PS.renderSched();
          PS.setStatus(st2, "Saved.");
        };
        $("[data-x=copy]", pn).onclick = () => navigator.clipboard.writeText(PS.fullCaption(o)).then(() => PS.setStatus(st2, "Caption copied."), () => PS.setStatus(st2, "Copy was blocked; select the caption field and press Ctrl+C.", true));
      }
    } catch (e) {
      pn.innerHTML = `<b>Could not post.</b> ${PS.esc(e.message)}`;
    }
  }

  window.PSStudio = { post: postOrSchedule };
  document.addEventListener("ps:visual", (e) => generateVisual(e.detail));

  (async () => {
    await ensureSignedIn();
    await renderStatus();
    if (window.PS) {
      watchPlan();
      await savePlan();
    } else document.addEventListener("ps:ready", () => { watchPlan(); savePlan(); }, { once: true });
  })();
})();
