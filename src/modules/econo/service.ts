import { db } from '../../database/client.js';
import { recordAudit } from '../audit/repository.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { computeRoundRobinStandings, computeSingleEliminationStandings } from './placement.js';
import {
  createScenario as createScenarioRepo,
  createTournament as createTournamentRepo,
  deleteScenario as deleteScenarioRepo,
  findMatchById,
  findModalityById,
  findScenarioById,
  findTournamentById,
  listMatchParticipantIds,
  listMatches,
  listModalities,
  listParticipants,
  listResultsForModality,
  listScenarios as listScenariosRepo,
  listStandings,
  markMatchCompleted,
  replaceStandings,
  setManualStandings,
  updateTournament as updateTournamentRepo,
  upsertMatchResult,
  type MatchOutcome,
  type MatchRow,
  type StandingComputation,
  type StandingRow,
  type TournamentModalityRow,
  type TournamentParticipantRow,
  type TournamentRow,
  type TournamentScenarioRow,
} from './repository.js';

export interface Actor {
  id: string;
  role: 'atleta' | 'dm' | 'gestao';
}

function assertStaff(actor: Actor): void {
  if (actor.role === 'atleta') throw new ForbiddenError();
}

const AUTO_COMPUTED_FORMATS = new Set<TournamentModalityRow['format']>([
  'single_elimination',
  'round_robin',
  'grouped_round_robin',
]);

export interface TournamentView {
  tournament: TournamentRow;
  participants: TournamentParticipantRow[];
  modalities: (TournamentModalityRow & { standings: StandingRow[] })[];
}

export async function getTournamentView(id: string): Promise<TournamentView> {
  const tournament = await findTournamentById(db, id);
  if (!tournament) throw new NotFoundError('Tournament');

  const [participants, modalities] = await Promise.all([
    listParticipants(db, id),
    listModalities(db, id),
  ]);

  const modalitiesWithStandings = await Promise.all(
    modalities.map(async (modality) => ({
      ...modality,
      standings: await listStandings(db, modality.id),
    })),
  );

  return { tournament, participants, modalities: modalitiesWithStandings };
}

export function createTournament(values: Pick<TournamentRow, 'name' | 'season'>) {
  return createTournamentRepo(db, values);
}

export async function updateTournament(
  id: string,
  values: Partial<Pick<TournamentRow, 'name' | 'season' | 'active'>>,
): Promise<TournamentRow> {
  const existing = await findTournamentById(db, id);
  if (!existing) throw new NotFoundError('Tournament');
  return updateTournamentRepo(db, id, values);
}

export async function getModalityMatches(tournamentModalityId: string): Promise<MatchRow[]> {
  const modality = await findModalityById(db, tournamentModalityId);
  if (!modality) throw new NotFoundError('Tournament modality');
  return listMatches(db, tournamentModalityId);
}

export interface MatchResultInput {
  participantId: string;
  score: number | null;
  outcome: MatchOutcome;
  tiebreakValue?: number | null;
}

function computeStandingsForFormat(
  format: TournamentModalityRow['format'],
  results: Parameters<typeof computeRoundRobinStandings>[0],
): StandingComputation[] {
  if (format === 'single_elimination') return computeSingleEliminationStandings(results);
  return computeRoundRobinStandings(results); // round_robin and grouped_round_robin
}

// Validates that `results` covers exactly this match's two participants with
// one of the only two valid outcome combinations — {win, loss} or
// {draw, draw}. Anything else (both win, both loss, a lone draw, a missing
// participant) is an explicit error, never silently reinterpreted.
function assertValidResultSet(participantIds: string[], results: MatchResultInput[]): void {
  if (results.length !== participantIds.length) {
    throw new ConflictError(
      'Results must be submitted for every participant in the match, exactly once',
    );
  }
  const resultParticipantIds = new Set(results.map((r) => r.participantId));
  if (resultParticipantIds.size !== results.length) {
    throw new ConflictError('Duplicate participant in results');
  }
  for (const id of participantIds) {
    if (!resultParticipantIds.has(id)) {
      throw new ForbiddenError("Results do not match this match's participants");
    }
  }

  const outcomes = results.map((r) => r.outcome).sort();
  const isWinLoss = outcomes.length === 2 && outcomes[0] === 'loss' && outcomes[1] === 'win';
  const isDrawDraw = outcomes.every((o) => o === 'draw');
  if (!isWinLoss && !isDrawDraw) {
    throw new ConflictError(
      'Invalid result combination — exactly one winner and one loser, or a draw for both sides',
    );
  }
}

// Records one row per participant per match (never a JSON blob), then fully
// recomputes standings for the whole tournament modality from every
// recorded result — position is always derived, never a second independent
// system alongside a live tally.
export async function recordMatchResults(params: {
  actor: Actor;
  matchId: string;
  results: MatchResultInput[];
}): Promise<void> {
  assertStaff(params.actor);

  const match = await findMatchById(db, params.matchId);
  if (!match) throw new NotFoundError('Match');

  const modality = await findModalityById(db, match.tournamentModalityId);
  if (!modality) throw new NotFoundError('Tournament modality');
  if (!AUTO_COMPUTED_FORMATS.has(modality.format)) {
    throw new ConflictError('This format does not use matches — set standings directly instead');
  }

  const participantIds = await listMatchParticipantIds(db, params.matchId);
  assertValidResultSet(participantIds, params.results);

  const isDraw = params.results.every((r) => r.outcome === 'draw');
  if (isDraw && modality.format === 'single_elimination') {
    throw new ConflictError('single_elimination matches require a decisive winner, not a draw');
  }

  await db.transaction(async (tx) => {
    for (const result of params.results) {
      await upsertMatchResult(tx, {
        matchId: params.matchId,
        participantId: result.participantId,
        score: result.score,
        outcome: result.outcome,
        tiebreakValue: result.tiebreakValue ?? null,
        recordedBy: params.actor.id,
      });
    }

    await markMatchCompleted(tx, params.matchId);

    const allResults = await listResultsForModality(tx, match.tournamentModalityId);
    const computed = computeStandingsForFormat(modality.format, allResults);
    await replaceStandings(tx, match.tournamentModalityId, computed);

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: 'MATCH_RESULT_RECORDED',
      entity: 'matches',
      entityId: params.matchId,
      metadata: { results: params.results },
    });
  });
}

export interface StandingEntryInput {
  participantId: string;
  position: number | null;
}

// dm/gestão only — restricted to fixed_ranking/reorderable_ranking, the two
// formats with no real matches. For the three auto-computed formats,
// standings can only change by recording match results (recordMatchResults
// above); this route rejects those to avoid two independent placement
// systems for the same modality.
export async function setStandings(params: {
  actor: Actor;
  tournamentModalityId: string;
  entries: StandingEntryInput[];
}): Promise<void> {
  assertStaff(params.actor);

  const modality = await findModalityById(db, params.tournamentModalityId);
  if (!modality) throw new NotFoundError('Tournament modality');
  if (AUTO_COMPUTED_FORMATS.has(modality.format)) {
    throw new ConflictError(
      'Standings for this format are computed automatically from match results',
    );
  }

  await db.transaction(async (tx) => {
    await setManualStandings(tx, params.tournamentModalityId, params.entries);

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: 'STANDINGS_SET',
      entity: 'tournament_modalities',
      entityId: params.tournamentModalityId,
      metadata: { entries: params.entries },
    });
  });
}

export function listScenarios(tournamentId: string): Promise<TournamentScenarioRow[]> {
  return listScenariosRepo(db, tournamentId);
}

export async function createScenario(params: {
  actor: Actor;
  tournamentId: string;
  name: string;
  snapshot: unknown;
}): Promise<TournamentScenarioRow> {
  assertStaff(params.actor);
  const tournament = await findTournamentById(db, params.tournamentId);
  if (!tournament) throw new NotFoundError('Tournament');

  return createScenarioRepo(db, {
    tournamentId: params.tournamentId,
    name: params.name,
    createdBy: params.actor.id,
    snapshot: params.snapshot,
  });
}

export async function deleteScenario(actor: Actor, id: string): Promise<void> {
  assertStaff(actor);
  const scenario = await findScenarioById(db, id);
  if (!scenario) throw new NotFoundError('Scenario');
  await deleteScenarioRepo(db, id);
}
