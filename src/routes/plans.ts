import { createHash } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth.js";
import { one, query } from "../db/index.js";
import { audit } from "../audit.js";
import { instagramStatus } from "../publish/instagram.js";
import { cancelScheduled, schedulePost, type PostRow } from "../publish/scheduler.js";
import { getAsset, mediaUrl } from "../storage.js";

// Plans hold the planner's state per week; posts hold what gets approved and published.
// Approval binds a hash of caption + images (ADR-008) so a later edit voids it.

const PlanBody = z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), state: z.record(z.string(), z.unknown()).default({}) });

const PostBody = z.object({
  kind: z.enum(["event", "idea"]),
  topic: z.string().min(1).max(200),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  options: z.array(z.unknown()).default([]),
  selectedOption: z.number().int().min(0).default(0),
  renderAssetIds: z.array(z.string().uuid()).max(10).default([]),
  caption: z.string().max(2200).optional(),
});

// Partial update: no defaults here, or an omitted field would be reset.
const PostPatch = z.object({
  topic: z.string().min(1).max(200).optional(),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
  options: z.array(z.unknown()).optional(),
  selectedOption: z.number().int().min(0).optional(),
  renderAssetIds: z.array(z.string().uuid()).max(10).optional(),
  caption: z.string().max(2200).optional(),
});

const ApproveBody = z.object({ approve: z.boolean() });
const ScheduleBody = z.object({ when: z.string().datetime({ offset: true }).optional() });

function approvalHash(caption: string | null, renderIds: string[]): string {
  return createHash("sha256").update(JSON.stringify([caption ?? "", renderIds])).digest("hex");
}

async function withUrls(p: PostRow) {
  const assets = await Promise.all(p.render_asset_ids.map((id) => getAsset(id)));
  return { ...p, render_urls: assets.filter((a): a is NonNullable<typeof a> => !!a).map((a) => mediaUrl(a.storage_key)) };
}

export function registerPlanRoutes(app: FastifyInstance) {
  app.get("/api/plans", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { plans: await query("select id, week_start, account, updated_at from plan order by week_start desc limit 52") };
  });

  app.put("/api/plans", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = PlanBody.parse(req.body);
    const plan = await one(
      `insert into plan (week_start, state) values ($1, $2)
       on conflict (account, week_start) do update set state = excluded.state, updated_at = now() returning *`,
      [body.weekStart, body.state],
    );
    return { plan };
  });

  app.get<{ Params: { weekStart: string } }>("/api/plans/:weekStart", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const plan = await one<{ id: string }>("select * from plan where account = 'multiicon.official' and week_start = $1", [req.params.weekStart]);
    if (!plan) return reply.code(404).send({ error: "not_found" });
    const posts = await query<PostRow>("select * from post where plan_id = $1 order by scheduled_for nulls last, created_at", [plan.id]);
    return { plan, posts: await Promise.all(posts.map(withUrls)) };
  });

  app.post<{ Params: { planId: string } }>("/api/plans/:planId/posts", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = PostBody.parse(req.body);
    const post = await one<PostRow>(
      `insert into post (plan_id, kind, topic, scheduled_for, options, selected_option, render_asset_ids, caption)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
      [req.params.planId, body.kind, body.topic, body.scheduledFor ?? null, JSON.stringify(body.options), body.selectedOption, body.renderAssetIds, body.caption ?? null],
    );
    return { post: post && (await withUrls(post)) };
  });

  // Any content change puts the post back to draft and voids approval.
  app.put<{ Params: { id: string } }>("/api/posts/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = PostPatch.parse(req.body);
    const cur = await one<PostRow>("select * from post where id = $1", [req.params.id]);
    if (!cur) return reply.code(404).send({ error: "not_found" });
    if (cur.state === "published" || cur.state === "publishing") return reply.code(409).send({ error: "locked", message: "A published post cannot be edited" });
    if (cur.state === "scheduled") await cancelScheduled(cur.id);
    const post = await one<PostRow>(
      `update post set topic = coalesce($2, topic), scheduled_for = coalesce($3, scheduled_for), options = coalesce($4, options),
         selected_option = coalesce($5, selected_option), render_asset_ids = coalesce($6, render_asset_ids), caption = coalesce($7, caption),
         state = 'draft', approved_at = null, approved_hash = null, updated_at = now()
       where id = $1 returning *`,
      [cur.id, body.topic ?? null, body.scheduledFor ?? null, body.options ? JSON.stringify(body.options) : null, body.selectedOption ?? null, body.renderAssetIds ?? null, body.caption ?? null],
    );
    return { post: post && (await withUrls(post)) };
  });

  app.post<{ Params: { id: string } }>("/api/posts/:id/approve", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = ApproveBody.parse(req.body);
    const cur = await one<PostRow>("select * from post where id = $1", [req.params.id]);
    if (!cur) return reply.code(404).send({ error: "not_found" });
    if (!body.approve) {
      await cancelScheduled(cur.id);
      const post = await one<PostRow>("update post set state = 'draft', approved_at = null, approved_hash = null, updated_at = now() where id = $1 returning *", [cur.id]);
      await audit("user", "post.unapproved", "post", cur.id);
      return { post: post && (await withUrls(post)) };
    }
    if (!cur.caption?.trim()) return reply.code(422).send({ error: "incomplete", message: "The post needs a caption" });
    if (/\[CONFIRM/i.test(cur.caption)) return reply.code(422).send({ error: "incomplete", message: "Fill every [CONFIRM] gap before approving" });
    if (!cur.render_asset_ids.length) return reply.code(422).send({ error: "incomplete", message: "The post needs at least one rendered image" });
    const hash = approvalHash(cur.caption, cur.render_asset_ids);
    const post = await one<PostRow>("update post set state = 'approved', approved_at = now(), approved_hash = $2, updated_at = now() where id = $1 returning *", [cur.id, hash]);
    await audit("user", "post.approved", "post", cur.id, { hash });
    return { post: post && (await withUrls(post)) };
  });

  app.post<{ Params: { id: string } }>("/api/posts/:id/schedule", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = ScheduleBody.parse(req.body);
    const cur = await one<PostRow>("select * from post where id = $1", [req.params.id]);
    if (!cur) return reply.code(404).send({ error: "not_found" });
    if (cur.state !== "approved" && cur.state !== "scheduled" && cur.state !== "failed") {
      return reply.code(409).send({ error: "not_approved", message: "Approve the post before scheduling it" });
    }
    if (cur.approved_hash !== approvalHash(cur.caption, cur.render_asset_ids)) {
      return reply.code(409).send({ error: "changed_since_approval", message: "The post changed after approval; approve it again" });
    }
    const ig = instagramStatus();
    if (!ig.publishEnabled) {
      return reply.code(503).send({ error: "instagram_not_connected", message: ig.configured ? "Instagram is connected but publishing is switched off (IG_PUBLISH_ENABLED)" : "Instagram is not connected yet. Download the post and publish it by hand." });
    }
    const when = body.when ? new Date(body.when) : cur.scheduled_for ? new Date(cur.scheduled_for) : new Date();
    const jobId = await schedulePost(cur.id, when);
    await query("update post set scheduled_for = $2 where id = $1", [cur.id, when.toISOString()]);
    await audit("user", "post.scheduled", "post", cur.id, { when: when.toISOString(), jobId });
    const post = await one<PostRow>("select * from post where id = $1", [cur.id]);
    return { post: post && (await withUrls(post)), jobId };
  });

  app.post<{ Params: { id: string } }>("/api/posts/:id/cancel", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await cancelScheduled(req.params.id);
    const post = await one<PostRow>("update post set state = 'cancelled', updated_at = now() where id = $1 and state in ('scheduled','failed','approved','draft') returning *", [req.params.id]);
    await audit("user", "post.cancelled", "post", req.params.id);
    return { post: post && (await withUrls(post)) };
  });
}
