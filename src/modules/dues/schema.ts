import { z } from 'zod';

export const markDuesSchema = z.object({
  paymentStatus: z.enum(['paid', 'pending']),
});
