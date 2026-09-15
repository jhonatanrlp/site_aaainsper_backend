import { desc, eq, isNull } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import {
  boardMembers,
  competitionRegistrations,
  competitions,
  games,
  trophies,
} from '../../database/schema/index.js';
import type {
  boardMembers as BoardMembersTable,
  competitionRegistrations as RegistrationsTable,
  competitions as CompetitionsTable,
  games as GamesTable,
  trophies as TrophiesTable,
} from '../../database/schema/index.js';

export type CompetitionRow = typeof CompetitionsTable.$inferSelect;
export type GameRow = typeof GamesTable.$inferSelect;
export type RegistrationRow = typeof RegistrationsTable.$inferSelect;
export type TrophyRow = typeof TrophiesTable.$inferSelect;
export type BoardMemberRow = typeof BoardMembersTable.$inferSelect;

export async function listCompetitions(db: DbClient): Promise<CompetitionRow[]> {
  return db.select().from(competitions);
}

export async function createCompetition(
  db: DbClient,
  values: Pick<CompetitionRow, 'name' | 'season'>,
): Promise<CompetitionRow> {
  const [row] = await db.insert(competitions).values(values).returning();
  if (!row) throw new Error('Failed to create competition');
  return row;
}

export async function listGames(db: DbClient, publicOnly: boolean): Promise<GameRow[]> {
  const query = db.select().from(games).orderBy(desc(games.date));
  if (!publicOnly) return query;
  return db.select().from(games).where(eq(games.published, true)).orderBy(desc(games.date));
}

export async function findGameById(db: DbClient, id: string): Promise<GameRow | undefined> {
  const [row] = await db.select().from(games).where(eq(games.id, id)).limit(1);
  return row;
}

export async function createGame(
  db: DbClient,
  values: Pick<
    GameRow,
    'modalityId' | 'competitionId' | 'opponent' | 'date' | 'venue' | 'home' | 'published'
  >,
): Promise<GameRow> {
  const [row] = await db.insert(games).values(values).returning();
  if (!row) throw new Error('Failed to create game');
  return row;
}

export async function updateGame(
  db: DbClient,
  id: string,
  values: Partial<
    Pick<GameRow, 'opponent' | 'date' | 'venue' | 'home' | 'published' | 'competitionId'>
  >,
): Promise<GameRow> {
  const [row] = await db
    .update(games)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(games.id, id))
    .returning();
  if (!row) throw new Error('Game not found');
  return row;
}

export async function listCompetitionRegistrations(
  db: DbClient,
  params: { unseenOnly: boolean },
): Promise<RegistrationRow[]> {
  const query = db
    .select()
    .from(competitionRegistrations)
    .orderBy(desc(competitionRegistrations.createdAt));
  if (!params.unseenOnly) return query;
  return db
    .select()
    .from(competitionRegistrations)
    .where(isNull(competitionRegistrations.notifiedAt))
    .orderBy(desc(competitionRegistrations.createdAt));
}

export async function listRegistrationsForAthlete(
  db: DbClient,
  athleteId: string,
): Promise<RegistrationRow[]> {
  return db
    .select()
    .from(competitionRegistrations)
    .where(eq(competitionRegistrations.athleteId, athleteId))
    .orderBy(desc(competitionRegistrations.createdAt));
}

export async function findRegistrationById(
  db: DbClient,
  id: string,
): Promise<RegistrationRow | undefined> {
  const [row] = await db
    .select()
    .from(competitionRegistrations)
    .where(eq(competitionRegistrations.id, id))
    .limit(1);
  return row;
}

export async function createCompetitionRegistration(
  db: DbClient,
  values: Pick<
    RegistrationRow,
    'athleteId' | 'competitionId' | 'teamId' | 'rankingLabel' | 'registeredBy'
  >,
): Promise<RegistrationRow> {
  const [row] = await db.insert(competitionRegistrations).values(values).returning();
  if (!row) throw new Error('Failed to create competition registration');
  return row;
}

export async function markRegistrationSeen(db: DbClient, id: string): Promise<RegistrationRow> {
  const [row] = await db
    .update(competitionRegistrations)
    .set({ notifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(competitionRegistrations.id, id))
    .returning();
  if (!row) throw new Error('Registration not found');
  return row;
}

export async function listTrophies(db: DbClient): Promise<TrophyRow[]> {
  return db.select().from(trophies).orderBy(desc(trophies.year));
}

export async function createTrophy(
  db: DbClient,
  values: Pick<TrophyRow, 'year' | 'competition' | 'title' | 'position'>,
): Promise<TrophyRow> {
  const [row] = await db.insert(trophies).values(values).returning();
  if (!row) throw new Error('Failed to create trophy');
  return row;
}

export async function listBoardMembers(db: DbClient): Promise<BoardMemberRow[]> {
  return db.select().from(boardMembers).orderBy(boardMembers.order);
}

export async function upsertBoardMember(
  db: DbClient,
  member: { id?: string; name: string; roleTitle: string; photoUrl?: string; order?: number },
): Promise<BoardMemberRow> {
  if (member.id) {
    const [row] = await db
      .update(boardMembers)
      .set({
        name: member.name,
        roleTitle: member.roleTitle,
        photoUrl: member.photoUrl,
        order: member.order,
        updatedAt: new Date(),
      })
      .where(eq(boardMembers.id, member.id))
      .returning();
    if (!row) throw new Error('Board member not found');
    return row;
  }

  const [row] = await db
    .insert(boardMembers)
    .values({
      name: member.name,
      roleTitle: member.roleTitle,
      photoUrl: member.photoUrl,
      order: member.order ?? 0,
    })
    .returning();
  if (!row) throw new Error('Failed to create board member');
  return row;
}
