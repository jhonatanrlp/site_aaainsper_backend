import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import {
  createCompetition,
  createCompetitionRegistration,
  createGame,
  createTrophy,
  listBoardMembers,
  listCompetitionRegistrations,
  listCompetitions,
  listGames,
  listTrophies,
  markRegistrationSeen,
  updateGame,
  upsertBoardMember,
} from './service.js';
import {
  createCompetitionSchema,
  createGameSchema,
  createRegistrationSchema,
  createTrophySchema,
  listRegistrationsQuerySchema,
  updateGameSchema,
  upsertBoardMemberSchema,
} from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function listCompetitionsController(_request: FastifyRequest, reply: FastifyReply) {
  reply.send(await listCompetitions());
}

export async function createCompetitionController(request: FastifyRequest, reply: FastifyReply) {
  const input = createCompetitionSchema.parse(request.body);
  reply.status(201).send(await createCompetition(input));
}

export async function listGamesController(request: FastifyRequest, reply: FastifyReply) {
  reply.send(await listGames(request.user));
}

export async function createGameController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const input = createGameSchema.parse(request.body);
  reply.status(201).send(
    await createGame(user, {
      ...input,
      date: new Date(input.date),
      competitionId: input.competitionId ?? null,
      venue: input.venue ?? null,
    }),
  );
}

export async function updateGameController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  const input = updateGameSchema.parse(request.body);
  reply.send(
    await updateGame(user, id, { ...input, date: input.date ? new Date(input.date) : undefined }),
  );
}

export async function listRegistrationsController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const query = listRegistrationsQuerySchema.parse(request.query);
  reply.send(await listCompetitionRegistrations(user, query));
}

export async function createRegistrationController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const input = createRegistrationSchema.parse(request.body);
  reply.status(201).send(
    await createCompetitionRegistration(user, {
      ...input,
      teamId: input.teamId ?? null,
      rankingLabel: input.rankingLabel ?? null,
    }),
  );
}

export async function markRegistrationSeenController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  reply.send(await markRegistrationSeen(user, id));
}

export async function listTrophiesController(_request: FastifyRequest, reply: FastifyReply) {
  reply.send(await listTrophies());
}

export async function createTrophyController(request: FastifyRequest, reply: FastifyReply) {
  const input = createTrophySchema.parse(request.body);
  reply.status(201).send(await createTrophy(input));
}

export async function listBoardMembersController(_request: FastifyRequest, reply: FastifyReply) {
  reply.send(await listBoardMembers());
}

export async function upsertBoardMemberController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const input = upsertBoardMemberSchema.parse(request.body);
  reply.send(await upsertBoardMember(user, input));
}
