import { z } from 'zod';

export const reviewDocumentSchema = z.object({
  approve: z.boolean(),
  reason: z.string().trim().min(1).max(500).optional(),
});
