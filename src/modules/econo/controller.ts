import type { FastifyReply, FastifyRequest } from 'fastify';
import { UnauthorizedError } from '../../shared/errors.js';
import {
  createScenario,
  createTournament,
  deleteScenario,
  getModalityMatches,
  getTournamentView,
  listScenarios,
  recordMatchResults,
  setStandings,
  updateTournament,
} from './service.js';
import {
  createScenarioSchema,
  createTournamentSchema,
  recordMatchResultsSchema,
  setStandingsSchema,
  updateTournamentSchema,
} from './schema.js';

function requireUser(request: FastifyRequest) {
  if (!request.user) throw new UnauthorizedError();
  return request.user;
}

export async function getTournamentController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  reply.send(await getTournamentView(id));
}

export async function createTournamentController(request: FastifyRequest, reply: FastifyReply) {
  const input = createTournamentSchema.parse(request.body);
  reply.status(201).send(await createTournament(input));
}

export async function updateTournamentController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  const input = updateTournamentSchema.parse(request.body);
  reply.send(await updateTournament(id, input));
}

export async function listMatchesController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  reply.send(await getModalityMatches(id));
}

export async function recordMatchResultsController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  const { results } = recordMatchResultsSchema.parse(request.body);
  await recordMatchResults({ actor: user, matchId: id, results });
  reply.status(204).send();
}

export async function setStandingsController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { tournamentModalityId } = request.params as { tournamentModalityId: string };
  const { entries } = setStandingsSchema.parse(request.body);
  await setStandings({ actor: user, tournamentModalityId, entries });
  reply.status(204).send();
}

export async function listScenariosController(request: FastifyRequest, reply: FastifyReply) {
  const { id } = request.params as { id: string };
  reply.send(await listScenarios(id));
}

export async function createScenarioController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { id } = request.params as { id: string };
  const { name, snapshot } = createScenarioSchema.parse(request.body);
  reply.status(201).send(await createScenario({ actor: user, tournamentId: id, name, snapshot }));
}

export async function deleteScenarioController(request: FastifyRequest, reply: FastifyReply) {
  const user = requireUser(request);
  const { scenarioId } = request.params as { scenarioId: string };
  await deleteScenario(user, scenarioId);
  reply.status(204).send();
}
