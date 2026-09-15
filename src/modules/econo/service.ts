import { db } from '../../database/client.js';
import { recordAudit } from '../audit/repository.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
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
  listScenarios as listScenariosRepo,
  listStandings,
  markMatchCompleted,
  bumpStandingTally,
  setStandingPosition,
  updateTournament as updateTournamentRepo,
  upsertMatchResult,
  type MatchRow,
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
  isWinner: boolean;
  tiebreakValue?: number | null;
}

// Records one row per participant per match (never a JSON blob — see the
// approved architecture note on ECONO). Also bumps each participant's
// running win/draw/loss tally in `standings`. Final bracket `position` is
// deliberately NOT auto-computed here — see setStandings below.
export async function recordMatchResults(params: {
  actor: Actor;
  matchId: string;
  results: MatchResultInput[];
}): Promise<void> {
  assertStaff(params.actor);

  const match = await findMatchById(db, params.matchId);
  if (!match) throw new NotFoundError('Match');

  const validParticipantIds = new Set(await listMatchParticipantIds(db, params.matchId));
  for (const result of params.results) {
    if (!validParticipantIds.has(result.participantId)) {
      throw new ForbiddenError('Participant is not part of this match');
    }
  }

  const isDraw = params.results.length > 1 && params.results.every((r) => !r.isWinner);

  await db.transaction(async (tx) => {
    for (const result of params.results) {
      await upsertMatchResult(tx, {
        matchId: params.matchId,
        participantId: result.participantId,
        score: result.score,
        isWinner: result.isWinner,
        tiebreakValue: result.tiebreakValue ?? null,
        recordedBy: params.actor.id,
      });

      const outcome = isDraw ? 'draw' : result.isWinner ? 'win' : 'loss';
      await bumpStandingTally(tx, {
        tournamentModalityId: match.tournamentModalityId,
        participantId: result.participantId,
        outcome,
      });
    }

    await markMatchCompleted(tx, params.matchId);

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
  points?: number;
}

// dm/gestão only. Used both for formats without real matches (fixed and
// reorderable ranking) and to finalize bracket placement once a
// single/round-robin modality concludes.
export async function setStandings(params: {
  actor: Actor;
  tournamentModalityId: string;
  entries: StandingEntryInput[];
}): Promise<void> {
  assertStaff(params.actor);

  const modality = await findModalityById(db, params.tournamentModalityId);
  if (!modality) throw new NotFoundError('Tournament modality');

  await db.transaction(async (tx) => {
    for (const entry of params.entries) {
      await setStandingPosition(tx, {
        tournamentModalityId: params.tournamentModalityId,
        participantId: entry.participantId,
        position: entry.position,
        points: entry.points,
      });
    }

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
