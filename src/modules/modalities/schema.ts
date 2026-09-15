import { z } from 'zod';

export const createModalitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  sport: z.string().trim().min(1).max(120),
  category: z.enum(['masculino', 'feminino', 'misto']),
});

export const updateModalitySchema = createModalitySchema.partial().extend({
  active: z.boolean().optional(),
});

export const createTeamSchema = z.object({
  modalityId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export const updateTeamSchema = createTeamSchema.partial();

export const assignDirectorSchema = z.object({
  userId: z.string().uuid(),
});
