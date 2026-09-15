import { z } from 'zod';

export const createCompetitionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  season: z.string().trim().min(1).max(20),
});

export const createGameSchema = z.object({
  modalityId: z.string().uuid(),
  competitionId: z.string().uuid().optional(),
  opponent: z.string().trim().min(1).max(120),
  date: z.string().datetime(),
  venue: z.string().trim().max(200).optional(),
  home: z.boolean().default(true),
  published: z.boolean().default(false),
});

export const updateGameSchema = z.object({
  opponent: z.string().trim().min(1).max(120).optional(),
  competitionId: z.string().uuid().optional(),
  date: z.string().datetime().optional(),
  venue: z.string().trim().max(200).optional(),
  home: z.boolean().optional(),
  published: z.boolean().optional(),
});

export const listRegistrationsQuerySchema = z.object({
  unseenOnly: z.coerce.boolean().optional(),
});

export const createRegistrationSchema = z.object({
  athleteId: z.string().uuid(),
  competitionId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  rankingLabel: z.string().trim().max(100).optional(),
});

export const createTrophySchema = z.object({
  year: z.number().int().min(1900).max(2200),
  competition: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  position: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

export const upsertBoardMemberSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  roleTitle: z.string().trim().min(1).max(120),
  photoUrl: z.string().url().optional(),
  order: z.number().int().optional(),
});
