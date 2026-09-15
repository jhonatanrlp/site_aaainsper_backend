import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/pagination.js';

export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  actorId: z.string().uuid().optional(),
  entity: z.string().min(1).optional(),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;
