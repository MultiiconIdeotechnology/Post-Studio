# Creative / Media Pipeline (Section H)

Status: PROPOSED (2026-10-28). Licences verified 2026-10-28 (see ARCHITECTURE.md C.3).

## H.1 Three levels, kept separate

| Level | What | Engine | Claude's role | Allowed on documentary photos? |
|---|---|---|---|---|
| **A. Deterministic** | crop, resize, straighten, exposure/white balance, contrast, denoise, sharpen, vignette-free brand frame, logo placement, typography overlays, thumbnails, video trim, concat, burned-in subtitles, loudness normalization (EBU R128), format conversion | sharp/libvips, FFmpeg | Chooses parameters (e.g. crop focus, trim points) inside bounded ranges; never renders | Yes |
| **B. Template / trend-aware** | editorial cards, quote cards, recap carousels, timeline, polaroid/scrapbook, annotation/scribble layouts, statistic overlays (verified facts only), before/after | Satori → SVG → resvg → PNG; FFmpeg for video slides | Picks template + fills slots with grounded text; may propose new template specs that a human/dev turns into a template | Yes (layout around unaltered photos) |
| **C. Generative** | illustrations, concept art, backdrops, approved avatars, compositing | Deferred (Phase 3+, optional self-hosted ComfyUI or an approved provider after review) | Writes the brief | **No** — never alters what happened in a documentary photo; generated assets carry a visible/metadata label |

Rule: **no generative model for resizing, colour correction, cropping or anything deterministic** (context §12, user principle).

## H.2 Recipe model (canonical source → many platform-native outputs)

An **edit recipe** is a small declarative, versioned program stored on `creative_variant.recipe`:

```json
{
  "recipe_version": 2,
  "sources": ["asset:0192a…", "asset:0192b…"],
  "steps": [
    {"op": "auto_orient"},
    {"op": "exposure", "ev": 0.3},
    {"op": "white_balance", "mode": "gray_world", "strength": 0.5},
    {"op": "crop", "aspect": "4:5", "focus": {"x": 0.42, "y": 0.38}, "min_short_side": 1080},
    {"op": "template", "id": "recap-cover.v3", "slots": {"title": "Robotics Day", "kicker": "fact:evt_fact_12"}}
  ],
  "outputs": [
    {"purpose": "ig_feed", "format": "jpeg", "quality": 88, "size": [1080, 1350]},
    {"purpose": "li_image", "format": "jpeg", "quality": 90, "size": [1200, 1500]},
    {"purpose": "fb_feed", "format": "jpeg", "quality": 88, "size": [1080, 1350]}
  ]
}
```

- `recipe_hash = sha256(canonical_json(recipe) ‖ source sha256s ‖ engine versions)` → `media_variant` is a **pure-function cache** (same hash = reuse).
- Originals are **immutable**; every output is reproducible from originals + recipe.
- Per-platform output profiles are config (validated against PLATFORM_CAPABILITIES): IG images **JPEG only**; carousel items share the first item's aspect ratio (IG crops to it); reels 9:16 1080×1920, 3–90 s for FB reels; LinkedIn images < 36,152,320 px, MultiImage 2–20; LinkedIn video MP4 3 s–30 min, ≤ 500 MB.
- A **spec validator** runs on every output before READY_FOR_REVIEW.

## H.3 Components

| Need | Component | Licence | Notes |
|---|---|---|---|
| Image decode/transform/encode | sharp 0.35 (libvips) | Apache-2.0 / LGPL-2.1+ | HEIC input needs libheif support in the libvips build (`NEEDS VERIFICATION` for chosen build) |
| Metadata | exifr 7 | MIT | Strip GPS/EXIF from all outputs by default |
| Perceptual hash | sharp-phash 2.2 (or own dHash) | MIT | |
| Smart crop | sharp `attention` strategy + Claude-proposed focus point (bounded) | — | Claude returns focus point only |
| Video | FFmpeg CLI 7.x via child process, argument arrays (no shell) | LGPL-2.1+ / GPL (x264) | Probe, transcode (H.264/AAC), trim, scale/pad, subtitles (SRT burn-in or LinkedIn caption file), loudnorm, keyframes |
| Subtitles text | Transcription is **out of MVP** (Claude doesn't transcribe audio). Options later: self-hosted Whisper (MIT code, weights MIT `NEEDS VERIFICATION`) | — | Deferred |
| Templates | Satori 0.63 + @resvg/resvg-js 2.6 | MPL-2.0 | Brand kit = fonts (licensed for server use — `NEEDS VERIFICATION` per font), colours, logo SVGs |
| Carousel slides (video) | FFmpeg image sequence → MP4 | — | |
| Complex layouts fallback | Playwright Chromium screenshot | Apache-2.0 | Only if Satori CSS subset insufficient |
| Generative (deferred) | ComfyUI self-hosted | GPL-3.0 (`NEEDS VERIFICATION`) | Model weights licences checked per model |
| Jobs | pg-boss queue `media.*` with per-queue concurrency (CPU-bound: concurrency = cores − 1) | MIT | |

## H.4 Processing jobs

| Job | Trigger | Output |
|---|---|---|
| `media.ingest` | object uploaded | hashes, EXIF, dims, thumbnails (256/1024 webp previews), quality metrics |
| `media.video_probe` | video uploaded | duration, codec, keyframes, loudness |
| `media.triage` (Claude) | batch reaches `processing` | descriptions, risk flags, storytelling scores (contact sheets of ≤ 24 thumbnails per call) |
| `media.render` | option needs preview/final | variants per output profile |
| `media.validate` | after render | spec report |
| `media.cleanup` | daily | retention enforcement |

## H.5 Safety rules for media

- Uploads are scanned for type by magic bytes (not extension), size-capped, decoded inside the worker with libvips' untrusted-input limits (`limitInputPixels`), FFmpeg run with timeouts and resource limits in a container without network.
- Outputs strip EXIF/GPS.
- "Do not use" assets are excluded at query level from planning and rendering.
- Documentary integrity: Level A operations limited to global tonal changes, crop, straighten, denoise; no object removal on documentary photos in MVP.
