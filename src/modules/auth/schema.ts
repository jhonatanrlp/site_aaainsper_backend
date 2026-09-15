import { z } from 'zod';

export const bootstrapResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(['atleta', 'dm', 'gestao']),
  profileComplete: z.boolean(),
});

export type BootstrapResponse = z.infer<typeof bootstrapResponseSchema>;
