import { query } from "./db/index.js";

export async function audit(actor: string, action: string, subjectType?: string, subjectId?: string, detail: Record<string, unknown> = {}): Promise<void> {
  await query("insert into audit_event (actor, action, subject_type, subject_id, detail) values ($1,$2,$3,$4,$5)", [
    actor,
    action,
    subjectType ?? null,
    subjectId ?? null,
    detail,
  ]).catch((e) => console.error("[audit]", e));
}
