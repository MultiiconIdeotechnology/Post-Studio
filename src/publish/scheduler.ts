import { PgBoss } from "pg-boss";
import { config } from "../config.js";
import { query, one } from "../db/index.js";
import { getAsset, mediaUrl } from "../storage.js";
import { publishToInstagram } from "./instagram.js";
import { audit } from "../audit.js";

// pg-boss keeps the queue inside Postgres (ADR-002): a job commits with the post state,
// survives restarts, and retries with backoff. Instagram has no native scheduling.

export const PUBLISH_QUEUE = "publish-post";

export interface PostRow {
  id: string;
  plan_id: string;
  kind: string;
  topic: string;
  scheduled_for: string | null;
  options: unknown[];
  selected_option: number;
  render_asset_ids: string[];
  caption: string | null;
  state: string;
  approved_hash: string | null;
  platform_post_id: string | null;
  permalink: string | null;
  last_error: string | null;
  attempts: number;
}

let boss: PgBoss | null = null;

export async function startScheduler(): Promise<PgBoss> {
  boss = new PgBoss({ connectionString: config.DATABASE_URL, schema: "pgboss" });
  boss.on("error", (e: unknown) => console.error("[pg-boss]", e));
  await boss.start();
  await boss.createQueue(PUBLISH_QUEUE, { retryLimit: 3, retryDelay: 120, retryBackoff: true, expireInSeconds: 600 });
  await boss.work<{ postId: string }>(PUBLISH_QUEUE, async (jobs) => {
    const job = jobs[0];
    if (!job) return;
    await runPublish(job.data.postId);
  });
  return boss;
}

export async function stopScheduler(): Promise<void> {
  await boss?.stop({ graceful: true, timeout: 10_000 });
  boss = null;
}

export async function schedulePost(postId: string, when: Date): Promise<string | null> {
  if (!boss) throw new Error("Scheduler is not running");
  // singletonKey keeps one queued job per post; re-scheduling cancels the old one first.
  await cancelScheduled(postId);
  const jobId = await boss.send(PUBLISH_QUEUE, { postId }, { startAfter: when, singletonKey: postId });
  await query("update post set state = 'scheduled', last_error = null, updated_at = now() where id = $1", [postId]);
  return jobId;
}

export async function cancelScheduled(postId: string): Promise<void> {
  if (!boss) return;
  const jobs = await query<{ id: string }>(
    `select id from pgboss.job where name = $1 and singleton_key = $2 and state in ('created','retry','active')`,
    [PUBLISH_QUEUE, postId],
  ).catch(() => [] as { id: string }[]);
  for (const j of jobs) await boss.cancel(PUBLISH_QUEUE, j.id).catch(() => undefined);
}

export async function runPublish(postId: string): Promise<void> {
  const post = await one<PostRow>("select * from post where id = $1", [postId]);
  if (!post) return;
  if (post.state === "published" || post.state === "cancelled") return;
  if (post.state !== "scheduled" && post.state !== "failed") {
    throw new Error(`Post ${postId} is ${post.state}, not scheduled; it must be approved and scheduled first`);
  }
  await query("update post set state = 'publishing', attempts = attempts + 1, updated_at = now() where id = $1", [postId]);
  try {
    const assets = await Promise.all(post.render_asset_ids.map((id) => getAsset(id)));
    const urls = assets.filter((a): a is NonNullable<typeof a> => !!a).map((a) => mediaUrl(a.storage_key));
    if (!urls.length) throw new Error("The post has no rendered images");
    const result = await publishToInstagram({ imageUrls: urls, caption: post.caption ?? "" });
    await query(
      `update post set state = 'published', platform_post_id = $2, permalink = $3, last_error = null, updated_at = now() where id = $1`,
      [postId, result.id, result.permalink ?? null],
    );
    await audit("system", "post.published", "post", postId, { platform_post_id: result.id, permalink: result.permalink });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await query("update post set state = 'failed', last_error = $2, updated_at = now() where id = $1", [postId, msg]);
    await audit("system", "post.publish_failed", "post", postId, { error: msg });
    throw e; // let pg-boss retry
  }
}
