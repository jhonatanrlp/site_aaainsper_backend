import { eq, sql } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import {
  matchParticipants,
  matchResults,
  matches,
  standings,
  tournamentModalities,
  tournamentParticipants,
  tournamentScenarios,
  tournaments,
} from '../../database/schema/index.js';
import type {
  matches as MatchesTable,
  standings as StandingsTable,
  tournamentModalities as TournamentModalitiesTable,
  tournamentParticipants as TournamentParticipantsTable,
  tournamentScenarios as TournamentScenariosTable,
  tournaments as TournamentsTable,
} from '../../database/schema/index.js';

export type TournamentRow = typeof TournamentsTable.$inferSelect;
export type TournamentParticipantRow = typeof TournamentParticipantsTable.$inferSelect;
export type TournamentModalityRow = typeof TournamentModalitiesTable.$inferSelect;
export type MatchRow = typeof MatchesTable.$inferSelect;
export type StandingRow = typeof StandingsTable.$inferSelect;
export type TournamentScenarioRow = typeof TournamentScenariosTable.$inferSelect;

export async function findTournamentById(
  db: DbClient,
  id: string,
): Promise<TournamentRow | undefined> {
  const [row] = await db.select().from(tournaments).where(eq(tournaments.id, id)).limit(1);
  return row;
}

export async function createTournament(
  db: DbClient,
  values: Pick<TournamentRow, 'name' | 'season'>,
): Promise<TournamentRow> {
  const [row] = await db.insert(tournaments).values(values).returning();
  if (!row) throw new Error('Failed to create tournament');
  return row;
}

export async function updateTournament(
  db: DbClient,
  id: string,
  values: Partial<Pick<TournamentRow, 'name' | 'season' | 'active'>>,
): Promise<TournamentRow> {
  const [row] = await db
    .update(tournaments)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(tournaments.id, id))
    .returning();
  if (!row) throw new Error('Tournament not found');
  return row;
}

export async function listParticipants(
  db: DbClient,
  tournamentId: string,
): Promise<TournamentParticipantRow[]> {
  return db
    .select()
    .from(tournamentParticipants)
    .where(eq(tournamentParticipants.tournamentId, tournamentId));
}

export async function listModalities(
  db: DbClient,
  tournamentId: string,
): Promise<TournamentModalityRow[]> {
  return db
    .select()
    .from(tournamentModalities)
    .where(eq(tournamentModalities.tournamentId, tournamentId));
}

export async function findModalityById(
  db: DbClient,
  id: string,
): Promise<TournamentModalityRow | undefined> {
  const [row] = await db
    .select()
    .from(tournamentModalities)
    .where(eq(tournamentModalities.id, id))
    .limit(1);
  return row;
}

export async function listStandings(
  db: DbClient,
  tournamentModalityId: string,
): Promise<StandingRow[]> {
  return db
    .select()
    .from(standings)
    .where(eq(standings.tournamentModalityId, tournamentModalityId));
}

export async function listMatches(db: DbClient, tournamentModalityId: string): Promise<MatchRow[]> {
  return db.select().from(matches).where(eq(matches.tournamentModalityId, tournamentModalityId));
}

export async function findMatchById(db: DbClient, id: string): Promise<MatchRow | undefined> {
  const [row] = await db.select().from(matches).where(eq(matches.id, id)).limit(1);
  return row;
}

export async function listMatchParticipantIds(db: DbClient, matchId: string): Promise<string[]> {
  const rows = await db
    .select({ participantId: matchParticipants.participantId })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId));
  return rows.map((row) => row.participantId);
}

export async function upsertMatchResult(
  db: DbClient,
  values: {
    matchId: string;
    participantId: string;
    score: number | null;
    isWinner: boolean;
    tiebreakValue: number | null;
    recordedBy: string;
  },
): Promise<void> {
  await db
    .insert(matchResults)
    .values(values)
    .onConflictDoUpdate({
      target: [matchResults.matchId, matchResults.participantId],
      set: {
        score: values.score,
        isWinner: values.isWinner,
        tiebreakValue: values.tiebreakValue,
        recordedBy: values.recordedBy,
        recordedAt: new Date(),
      },
    });
}

export async function markMatchCompleted(db: DbClient, matchId: string): Promise<void> {
  await db
    .update(matches)
    .set({ status: 'completed', updatedAt: new Date() })
    .where(eq(matches.id, matchId));
}

// Running tally, incremented once per recorded result — win/draw/loss counts
// and points (win=3, draw=1, loss=0). Final bracket `position` is left null
// here and set explicitly via setStandingPosition once a tournament
// modality concludes (see module README note in the service layer).
export async function bumpStandingTally(
  db: DbClient,
  params: { tournamentModalityId: string; participantId: string; outcome: 'win' | 'draw' | 'loss' },
): Promise<void> {
  const pointsDelta = params.outcome === 'win' ? 3 : params.outcome === 'draw' ? 1 : 0;
  const winsDelta = params.outcome === 'win' ? 1 : 0;
  const drawsDelta = params.outcome === 'draw' ? 1 : 0;
  const lossesDelta = params.outcome === 'loss' ? 1 : 0;

  await db
    .insert(standings)
    .values({
      tournamentModalityId: params.tournamentModalityId,
      participantId: params.participantId,
      points: pointsDelta,
      wins: winsDelta,
      draws: drawsDelta,
      losses: lossesDelta,
    })
    .onConflictDoUpdate({
      target: [standings.tournamentModalityId, standings.participantId],
      set: {
        points: sql`${standings.points} + ${pointsDelta}`,
        wins: sql`${standings.wins} + ${winsDelta}`,
        draws: sql`${standings.draws} + ${drawsDelta}`,
        losses: sql`${standings.losses} + ${lossesDelta}`,
        updatedAt: new Date(),
      },
    });
}

export async function setStandingPosition(
  db: DbClient,
  params: {
    tournamentModalityId: string;
    participantId: string;
    position: number | null;
    points?: number;
  },
): Promise<void> {
  await db
    .insert(standings)
    .values({
      tournamentModalityId: params.tournamentModalityId,
      participantId: params.participantId,
      position: params.position,
      points: params.points ?? 0,
    })
    .onConflictDoUpdate({
      target: [standings.tournamentModalityId, standings.participantId],
      set: {
        position: params.position,
        ...(params.points !== undefined ? { points: params.points } : {}),
        updatedAt: new Date(),
      },
    });
}

export async function listScenarios(
  db: DbClient,
  tournamentId: string,
): Promise<TournamentScenarioRow[]> {
  return db
    .select()
    .from(tournamentScenarios)
    .where(eq(tournamentScenarios.tournamentId, tournamentId));
}

export async function createScenario(
  db: DbClient,
  values: { tournamentId: string; name: string; createdBy: string; snapshot: unknown },
): Promise<TournamentScenarioRow> {
  const [row] = await db.insert(tournamentScenarios).values(values).returning();
  if (!row) throw new Error('Failed to create scenario');
  return row;
}

export async function deleteScenario(db: DbClient, id: string): Promise<void> {
  await db.delete(tournamentScenarios).where(eq(tournamentScenarios.id, id));
}

export async function findScenarioById(
  db: DbClient,
  id: string,
): Promise<TournamentScenarioRow | undefined> {
  const [row] = await db
    .select()
    .from(tournamentScenarios)
    .where(eq(tournamentScenarios.id, id))
    .limit(1);
  return row;
}
