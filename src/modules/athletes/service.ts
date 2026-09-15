import { db } from '../../database/client.js';
import { recordAudit } from '../audit/repository.js';
import { findTeamById } from '../modalities/repository.js';
import { listRegistrationsForAthlete, type RegistrationRow } from '../competitions/repository.js';
import { listAthleteDocuments, type AthleteDocumentWithType } from '../documents/repository.js';
import { findUserById } from '../users/repository.js';
import { maskCpf } from '../../shared/cpf.js';
import { isUniqueViolation } from '../../shared/db-errors.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';
import {
  confirmMembership,
  createJoinRequest as createJoinRequestRepo,
  decideJoinRequest,
  findAthleteById,
  findAthleteByUserId,
  findJoinRequestForUpdate,
  findOrCreateAthlete,
  isAthleteVisibleToDirector,
  listAllAthletes,
  listAthleteJoinRequests,
  listAthleteMemberships,
  listAthleteTeamIds,
  listAthletesForModality,
  seedRequiredDocuments,
  type AthleteMembership,
  type AthletePendingRequest,
  type AthleteSummary,
  type TeamJoinRequestRow,
} from './repository.js';

export interface Actor {
  id: string;
  role: 'atleta' | 'dm' | 'gestao';
}

// Throws unless the caller is the athlete themselves, a DM who directs a
// modality this athlete is connected to (member or applicant), or gestão.
export async function assertCanViewAthlete(actor: Actor, athleteId: string): Promise<void> {
  const athlete = await findAthleteById(db, athleteId);
  if (!athlete) throw new NotFoundError('Athlete');
  if (actor.role === 'gestao') return;
  if (athlete.userId === actor.id) return;
  if (actor.role === 'dm' && (await isAthleteVisibleToDirector(db, actor.id, athleteId))) return;
  throw new ForbiddenError();
}

export async function listAthletes(
  actor: Actor,
  filters: { modalityId?: string },
): Promise<AthleteSummary[]> {
  if (actor.role === 'atleta') throw new ForbiddenError();

  if (actor.role === 'gestao') {
    return filters.modalityId
      ? listAthletesForModality(db, filters.modalityId)
      : listAllAthletes(db);
  }

  // dm: modalityId is required and access to it is enforced by the route's
  // requireModalityAccess guard before this ever runs.
  if (!filters.modalityId) throw new ForbiddenError('modalityId is required for dm');
  return listAthletesForModality(db, filters.modalityId);
}

export async function createJoinRequest(actor: Actor, teamId: string): Promise<TeamJoinRequestRow> {
  const team = await findTeamById(db, teamId);
  if (!team) throw new NotFoundError('Team');

  try {
    return await db.transaction(async (tx) => {
      const athlete = await findOrCreateAthlete(tx, actor.id);
      return createJoinRequestRepo(tx, { athleteId: athlete.id, teamId });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError('A pending request for this team already exists');
    }
    throw error;
  }
}

export async function approveJoinRequest(params: {
  actor: Actor;
  requestId: string;
}): Promise<TeamJoinRequestRow> {
  return db.transaction(async (tx) => {
    const request = await findJoinRequestForUpdate(tx, params.requestId);
    if (!request) throw new NotFoundError('Team join request');
    if (request.status !== 'pending') {
      throw new ConflictError('This request has already been decided');
    }

    const team = await findTeamById(tx, request.teamId);
    if (!team) throw new NotFoundError('Team');

    if (params.actor.role === 'dm') {
      const visible = await isAthleteVisibleToDirector(tx, params.actor.id, request.athleteId);
      if (!visible) throw new ForbiddenError();
    } else if (params.actor.role !== 'gestao') {
      throw new ForbiddenError();
    }

    const decided = await decideJoinRequest(tx, request.id, {
      status: 'approved',
      decidedBy: params.actor.id,
      decidedAt: new Date(),
      rejectionReason: null,
    });

    await confirmMembership(tx, request.athleteId, request.teamId);
    await seedRequiredDocuments(tx, request.athleteId, team.modalityId);

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: 'TEAM_JOIN_REQUEST_APPROVED',
      entity: 'team_join_requests',
      entityId: request.id,
      metadata: { athleteId: request.athleteId, teamId: request.teamId },
    });

    return decided;
  });
}

export async function rejectJoinRequest(params: {
  actor: Actor;
  requestId: string;
  reason: string;
}): Promise<TeamJoinRequestRow> {
  return db.transaction(async (tx) => {
    const request = await findJoinRequestForUpdate(tx, params.requestId);
    if (!request) throw new NotFoundError('Team join request');
    if (request.status !== 'pending') {
      throw new ConflictError('This request has already been decided');
    }

    if (params.actor.role === 'dm') {
      const visible = await isAthleteVisibleToDirector(tx, params.actor.id, request.athleteId);
      if (!visible) throw new ForbiddenError();
    } else if (params.actor.role !== 'gestao') {
      throw new ForbiddenError();
    }

    const decided = await decideJoinRequest(tx, request.id, {
      status: 'rejected',
      decidedBy: params.actor.id,
      decidedAt: new Date(),
      rejectionReason: params.reason,
    });

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: 'TEAM_JOIN_REQUEST_REJECTED',
      entity: 'team_join_requests',
      entityId: request.id,
      metadata: { athleteId: request.athleteId, teamId: request.teamId, reason: params.reason },
    });

    return decided;
  });
}

export async function getMyAthleteSummary(userId: string) {
  const athlete = await findAthleteByUserId(db, userId);
  if (!athlete) return { athlete: null, teamIds: [] as string[] };
  const teamIds = await listAthleteTeamIds(db, athlete.id);
  return { athlete, teamIds };
}

export interface AthleteDetail {
  athleteId: string;
  userId: string;
  fullName: string | null;
  email: string;
  cpfMask: string | null;
  rg: string | null;
  birthDate: string | null;
  course: string | null;
  instagram: string | null;
  phone: string | null;
  memberships: AthleteMembership[];
  pendingRequests: AthletePendingRequest[];
  documents: AthleteDocumentWithType[];
  competitionRegistrations: RegistrationRow[];
}

// Full detail for DM/gestão review (and the athlete's own view of
// themselves) — authorization is the same rule as assertCanViewAthlete.
export async function getAthleteDetail(actor: Actor, athleteId: string): Promise<AthleteDetail> {
  await assertCanViewAthlete(actor, athleteId);

  const athlete = await findAthleteById(db, athleteId);
  if (!athlete) throw new NotFoundError('Athlete');
  const user = await findUserById(db, athlete.userId);
  if (!user) throw new NotFoundError('User');

  const [memberships, pendingRequests, documents, competitionRegistrations] = await Promise.all([
    listAthleteMemberships(db, athleteId),
    listAthleteJoinRequests(db, athleteId),
    listAthleteDocuments(db, athleteId),
    listRegistrationsForAthlete(db, athleteId),
  ]);

  return {
    athleteId: athlete.id,
    userId: user.id,
    fullName: user.fullName,
    email: user.email,
    cpfMask: maskCpf(user.cpf),
    rg: user.rg,
    birthDate: user.birthDate,
    course: user.course,
    instagram: user.instagram,
    phone: user.phone,
    memberships,
    pendingRequests,
    documents,
    competitionRegistrations,
  };
}
