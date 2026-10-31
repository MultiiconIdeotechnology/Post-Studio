// Gives the planner page the same `window.claude.use()` surface it had as a Claude artifact,
// backed by this server instead. Keys never reach the browser.
(() => {
  "use strict";
  const api = async (path, body) => {
    const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = { code: json.error || "api_error", message: json.message || res.statusText, text: json.text };
      if (res.status === 401) err.code = "not_granted";
      throw err;
    }
    return json;
  };
  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(",")[1]);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  const prepImages = async (images) => {
    if (!images) return undefined;
    const list = images instanceof Blob ? [images] : Array.from(images);
    return Promise.all(list.map(async (b) => ({ mime: b.type === "image/png" ? "image/png" : b.type === "image/webp" ? "image/webp" : "image/jpeg", data: await blobToBase64(b) })));
  };
  const toPrompt = (input) => (typeof input === "string" ? input : input.map((m) => `${m.role === "assistant" ? "Earlier answer" : "User"}: ${m.content}`).join("\n\n"));

  let status = null;
  const statusPromise = fetch("/api/status")
    .then((r) => r.json())
    .then((s) => (status = s))
    .catch(() => null);

  const sample = async (input, opts = {}) => {
    if (opts.onText) opts.onText({ text: "", delta: "" });
    const { text } = await api("/api/ai/text", { prompt: toPrompt(input), tier: opts.modelTier, images: await prepImages(opts.images) });
    if (opts.onText) opts.onText({ text, delta: text });
    return { text, truncated: false };
  };
  sample.json = async (input, opts = {}) => {
    const { value } = await api("/api/ai/json", { prompt: toPrompt(input), tier: opts.modelTier, images: await prepImages(opts.images) });
    if (opts.onText) opts.onText({ text: JSON.stringify(value), delta: "" });
    return value;
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 8, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ["image/jpeg", "image/png", "image/webp"] }, modelTiers: ["quick", "default", "complex"] });

  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      return "saved";
    },
  };

  window.claude = {
    async use(name) {
      await statusPromise;
      if (name === "sample") return status && status.claude && status.claude.configured ? sample : null;
      if (name === "downloads") return downloads;
      return null;
    },
    status: () => status,
  };
})();
