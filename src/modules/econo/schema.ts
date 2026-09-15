import { z } from 'zod';

export const createTournamentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  season: z.string().trim().min(1).max(20),
});

export const updateTournamentSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  season: z.string().trim().min(1).max(20).optional(),
  active: z.boolean().optional(),
});

export const matchResultInputSchema = z.object({
  participantId: z.string().uuid(),
  score: z.number().int().nullable().default(null),
  isWinner: z.boolean().default(false),
  tiebreakValue: z.number().int().nullable().optional(),
});

export const recordMatchResultsSchema = z.object({
  results: z.array(matchResultInputSchema).min(1),
});

export const standingEntrySchema = z.object({
  participantId: z.string().uuid(),
  position: z.number().int().min(1).nullable(),
  points: z.number().int().min(0).optional(),
});

export const setStandingsSchema = z.object({
  entries: z.array(standingEntrySchema).min(1),
});

export const createScenarioSchema = z.object({
  name: z.string().trim().min(1).max(120),
  snapshot: z.unknown(),
});
