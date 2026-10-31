import { fal } from "@fal-ai/client";
import { config } from "../config.js";
import { type Aspect, type EditRequest, type GenerateRequest, type GeneratedImage, type ImageProvider, dataUrl, fetchImage } from "./provider.js";

// fal.ai hosts FLUX (Black Forest Labs), Ideogram and Kling behind one key, so one adapter
// covers three model families. Model ids are configurable because fal renames them over time.

let configured = false;
function ensure() {
  if (!config.FAL_KEY) throw new Error("FAL_KEY is not set");
  if (!configured) {
    fal.config({ credentials: config.FAL_KEY });
    configured = true;
  }
}

const FAL_ASPECT: Record<Aspect, string> = { "4:5": "portrait_4_3", "1:1": "square_hd", "9:16": "portrait_16_9", "16:9": "landscape_16_9" };
const FAL_RATIO: Record<Aspect, string> = { "4:5": "4:5", "1:1": "1:1", "9:16": "9:16", "16:9": "16:9" };

type FalImages = { images?: { url: string; content_type?: string }[]; image?: { url: string } };

async function run(model: string, input: Record<string, unknown>): Promise<GeneratedImage[]> {
  ensure();
  const result = await fal.subscribe(model, { input, logs: false });
  const data = result.data as FalImages;
  const urls = data.images?.map((i) => i.url) ?? (data.image ? [data.image.url] : []);
  if (!urls.length) throw new Error(`fal.ai returned no images for ${model}`);
  const images = await Promise.all(urls.map(fetchImage));
  return images.map((img) => ({ ...img, raw: { requestId: result.requestId, model } }));
}

function makeFalProvider(opts: {
  id: string;
  label: string;
  model: () => string;
  editModel?: () => string;
  typography: boolean;
  // fal models disagree on how aspect is spelled; each family gets its own input builder.
  input: (req: GenerateRequest) => Record<string, unknown>;
}): ImageProvider {
  return {
    id: opts.id,
    label: opts.label,
    capabilities: { generate: true, edit: !!opts.editModel, typography: opts.typography },
    configured: () => !!config.FAL_KEY,
    generate: (req) => run(opts.model(), opts.input(req)),
    edit: opts.editModel
      ? (req: EditRequest) =>
          run(opts.editModel!(), {
            prompt: req.prompt,
            image_url: dataUrl(req.image),
            aspect_ratio: FAL_RATIO[req.aspect ?? "4:5"],
            output_format: "jpeg",
            safety_tolerance: "2",
          })
      : undefined,
  };
}

export const flux = makeFalProvider({
  id: "flux",
  label: "FLUX (Black Forest Labs, via fal.ai)",
  model: () => config.FAL_FLUX_MODEL,
  editModel: () => config.FAL_FLUX_EDIT_MODEL,
  typography: false,
  input: (req) => ({
    prompt: req.prompt,
    aspect_ratio: FAL_RATIO[req.aspect],
    num_images: req.n ?? 1,
    output_format: "jpeg",
    safety_tolerance: "2",
    enable_safety_checker: true,
  }),
});

export const ideogram = makeFalProvider({
  id: "ideogram",
  label: "Ideogram v3 (via fal.ai)",
  model: () => config.FAL_IDEOGRAM_MODEL,
  typography: true,
  input: (req) => ({
    prompt: req.prompt,
    image_size: FAL_ASPECT[req.aspect],
    num_images: req.n ?? 1,
    rendering_speed: "QUALITY",
    style: "AUTO",
  }),
});

export const kling = makeFalProvider({
  id: "kling",
  label: "Kling image (via fal.ai)",
  model: () => config.FAL_KLING_IMAGE_MODEL,
  typography: false,
  input: (req) => ({
    prompt: req.prompt,
    aspect_ratio: FAL_RATIO[req.aspect],
    num_images: req.n ?? 1,
  }),
});
