import { z } from 'zod';

export const createJoinRequestSchema = z.object({
  teamId: z.string().uuid(),
});

export const rejectJoinRequestSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const listAthletesQuerySchema = z.object({
  modalityId: z.string().uuid().optional(),
});
