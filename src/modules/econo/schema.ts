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
  // Explicit — never inferred. Exactly one {win, loss} pair or a {draw, draw}
  // pair is valid for a match; anything else is rejected (see service.ts).
  outcome: z.enum(['win', 'draw', 'loss']),
  tiebreakValue: z.number().int().nullable().optional(),
});

export const recordMatchResultsSchema = z.object({
  results: z.array(matchResultInputSchema).min(1),
});

export const standingEntrySchema = z.object({
  participantId: z.string().uuid(),
  position: z.number().int().min(1).nullable(),
});

export const setStandingsSchema = z.object({
  entries: z.array(standingEntrySchema).min(1),
});

export const createScenarioSchema = z.object({
  name: z.string().trim().min(1).max(120),
  snapshot: z.unknown(),
});
