import { and, eq, inArray } from 'drizzle-orm';
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

export type MatchOutcome = 'win' | 'draw' | 'loss';

export async function upsertMatchResult(
  db: DbClient,
  values: {
    matchId: string;
    participantId: string;
    score: number | null;
    outcome: MatchOutcome;
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
        outcome: values.outcome,
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

export interface RecordedMatchResult {
  matchId: string;
  round: string;
  participantId: string;
  outcome: MatchOutcome;
}

// Every recorded result for every match in this tournament modality — the
// raw material the service layer recomputes standings from on every write.
// Nothing is stored pre-aggregated; there is exactly one source of truth.
export async function listResultsForModality(
  db: DbClient,
  tournamentModalityId: string,
): Promise<RecordedMatchResult[]> {
  return db
    .select({
      matchId: matches.id,
      round: matches.round,
      participantId: matchResults.participantId,
      outcome: matchResults.outcome,
    })
    .from(matchResults)
    .innerJoin(matches, eq(matches.id, matchResults.matchId))
    .where(eq(matches.tournamentModalityId, tournamentModalityId));
}

export interface StandingComputation {
  participantId: string;
  position: number | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
}

// Full recomputation, not an incremental patch: deletes every standings row
// for this modality and reinserts the freshly computed set in one
// transaction — there is never a stale row left over from a superseded
// computation.
export async function replaceStandings(
  db: DbClient,
  tournamentModalityId: string,
  rows: StandingComputation[],
): Promise<void> {
  await db.delete(standings).where(eq(standings.tournamentModalityId, tournamentModalityId));
  if (rows.length === 0) return;
  await db.insert(standings).values(
    rows.map((row) => ({
      tournamentModalityId,
      participantId: row.participantId,
      position: row.position,
      points: row.points,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
    })),
  );
}

// Manual placement — fixed_ranking / reorderable_ranking only (no real
// matches feed these formats). Position-only: these formats don't carry a
// win/draw/loss tally.
export async function setManualStandings(
  db: DbClient,
  tournamentModalityId: string,
  entries: { participantId: string; position: number | null }[],
): Promise<void> {
  const participantIds = entries.map((entry) => entry.participantId);
  await db
    .delete(standings)
    .where(
      and(
        eq(standings.tournamentModalityId, tournamentModalityId),
        inArray(standings.participantId, participantIds),
      ),
    );
  if (entries.length === 0) return;
  await db.insert(standings).values(
    entries.map((entry) => ({
      tournamentModalityId,
      participantId: entry.participantId,
      position: entry.position,
    })),
  );
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
