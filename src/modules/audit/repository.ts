import { and, desc, eq } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import { auditLogs } from '../../database/schema/index.js';
import type { auditLogs as AuditLogsTable } from '../../database/schema/index.js';
import type { Page } from '../../shared/pagination.js';

export type AuditLogRow = typeof AuditLogsTable.$inferSelect;

export interface RecordAuditParams {
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  metadata?: Record<string, unknown>;
}

// Written by every privileged service-layer transaction. Callers pass the
// same `tx` they used for the state change, so the audit row commits
// atomically with it — or not at all if the transaction rolls back.
export async function recordAudit(db: DbClient, params: RecordAuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    actorId: params.actorId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    metadata: params.metadata ?? null,
  });
}

export interface ListAuditLogsParams {
  actorId?: string;
  entity?: string;
  limit: number;
  offset: number;
}

export async function listAuditLogs(
  db: DbClient,
  params: ListAuditLogsParams,
): Promise<Page<AuditLogRow>> {
  const conditions = [];
  if (params.actorId) conditions.push(eq(auditLogs.actorId, params.actorId));
  if (params.entity) conditions.push(eq(auditLogs.entity, params.entity));
  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [items, total] = await Promise.all([
    db
      .select()
      .from(auditLogs)
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params.limit)
      .offset(params.offset),
    db.$count(auditLogs, where),
  ]);

  return { items, total, limit: params.limit, offset: params.offset };
}
