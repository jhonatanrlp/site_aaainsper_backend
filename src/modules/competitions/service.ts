import { db } from '../../database/client.js';
import { isDirectorOfModality } from '../modalities/repository.js';
import { recordAudit } from '../audit/repository.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import {
  createCompetition as createCompetitionRepo,
  createCompetitionRegistration as createRegistrationRepo,
  createGame as createGameRepo,
  createTrophy as createTrophyRepo,
  findGameById,
  listBoardMembers as listBoardMembersRepo,
  listCompetitionRegistrations as listRegistrationsRepo,
  listCompetitions as listCompetitionsRepo,
  listGames as listGamesRepo,
  listTrophies as listTrophiesRepo,
  markRegistrationSeen as markRegistrationSeenRepo,
  updateGame as updateGameRepo,
  upsertBoardMember as upsertBoardMemberRepo,
  type BoardMemberRow,
  type CompetitionRow,
  type GameRow,
  type RegistrationRow,
  type TrophyRow,
} from './repository.js';

export interface Actor {
  id: string;
  role: 'atleta' | 'dm' | 'gestao';
}

export function listCompetitions(): Promise<CompetitionRow[]> {
  return listCompetitionsRepo(db);
}

export function createCompetition(values: Pick<CompetitionRow, 'name' | 'season'>) {
  return createCompetitionRepo(db, values);
}

export function listGames(actor: Actor | undefined): Promise<GameRow[]> {
  const publicOnly = !actor || actor.role !== 'gestao';
  return listGamesRepo(db, publicOnly);
}

async function assertCanManageModality(actor: Actor, modalityId: string): Promise<void> {
  if (actor.role === 'gestao') return;
  if (actor.role === 'dm' && (await isDirectorOfModality(db, actor.id, modalityId))) return;
  throw new ForbiddenError();
}

export async function createGame(
  actor: Actor,
  values: Pick<
    GameRow,
    'modalityId' | 'competitionId' | 'opponent' | 'date' | 'venue' | 'home' | 'published'
  >,
): Promise<GameRow> {
  await assertCanManageModality(actor, values.modalityId);
  return createGameRepo(db, values);
}

export async function updateGame(
  actor: Actor,
  id: string,
  values: Partial<
    Pick<GameRow, 'opponent' | 'date' | 'venue' | 'home' | 'published' | 'competitionId'>
  >,
): Promise<GameRow> {
  const existing = await findGameById(db, id);
  if (!existing) throw new NotFoundError('Game');
  await assertCanManageModality(actor, existing.modalityId);
  return updateGameRepo(db, id, values);
}

export async function listCompetitionRegistrations(
  actor: Actor,
  params: { unseenOnly?: boolean },
): Promise<RegistrationRow[]> {
  if (actor.role === 'atleta') throw new ForbiddenError();
  return listRegistrationsRepo(db, { unseenOnly: Boolean(params.unseenOnly) });
}

export async function createCompetitionRegistration(
  actor: Actor,
  values: Pick<RegistrationRow, 'athleteId' | 'competitionId' | 'teamId' | 'rankingLabel'>,
): Promise<RegistrationRow> {
  if (actor.role === 'atleta') throw new ForbiddenError();
  return createRegistrationRepo(db, { ...values, registeredBy: actor.id });
}

export async function markRegistrationSeen(actor: Actor, id: string): Promise<RegistrationRow> {
  if (actor.role !== 'gestao') throw new ForbiddenError();
  return markRegistrationSeenRepo(db, id);
}

export function listTrophies(): Promise<TrophyRow[]> {
  return listTrophiesRepo(db);
}

export function createTrophy(
  values: Pick<TrophyRow, 'year' | 'competition' | 'title' | 'position'>,
) {
  return createTrophyRepo(db, values);
}

export function listBoardMembers(): Promise<BoardMemberRow[]> {
  return listBoardMembersRepo(db);
}

export async function upsertBoardMember(
  actor: Actor,
  member: { id?: string; name: string; roleTitle: string; photoUrl?: string; order?: number },
): Promise<BoardMemberRow> {
  return db.transaction(async (tx) => {
    const row = await upsertBoardMemberRepo(tx, member);
    await recordAudit(tx, {
      actorId: actor.id,
      action: member.id ? 'BOARD_MEMBER_UPDATED' : 'BOARD_MEMBER_CREATED',
      entity: 'board_members',
      entityId: row.id,
    });
    return row;
  });
}
