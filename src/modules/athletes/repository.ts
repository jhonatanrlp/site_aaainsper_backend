import { and, eq, exists, isNull, or } from 'drizzle-orm';
import type { DbClient } from '../../database/client.js';
import {
  athleteDocuments,
  athleteTeams,
  athletes,
  modalities,
  modalityDirectors,
  requiredDocuments,
  teamJoinRequests,
  teams,
  users,
} from '../../database/schema/index.js';
import type {
  athletes as AthletesTable,
  teamJoinRequests as TeamJoinRequestsTable,
} from '../../database/schema/index.js';

export type AthleteRow = typeof AthletesTable.$inferSelect;
export type TeamJoinRequestRow = typeof TeamJoinRequestsTable.$inferSelect;

export async function findAthleteByUserId(
  db: DbClient,
  userId: string,
): Promise<AthleteRow | undefined> {
  const [row] = await db.select().from(athletes).where(eq(athletes.userId, userId)).limit(1);
  return row;
}

export async function findAthleteById(db: DbClient, id: string): Promise<AthleteRow | undefined> {
  const [row] = await db.select().from(athletes).where(eq(athletes.id, id)).limit(1);
  return row;
}

// Demand-driven: an athletes row is created the first time a user requests to
// join a team, not automatically at signup — a user who never engages
// athletically (e.g. a gestão-only admin) never gets one.
export async function findOrCreateAthlete(db: DbClient, userId: string): Promise<AthleteRow> {
  const existing = await findAthleteByUserId(db, userId);
  if (existing) return existing;

  const [inserted] = await db
    .insert(athletes)
    .values({ userId })
    .onConflictDoNothing({ target: athletes.userId })
    .returning();
  if (inserted) return inserted;

  // Lost a concurrent insert race — the row now exists, fetch it.
  const row = await findAthleteByUserId(db, userId);
  if (!row) throw new Error('Failed to create athlete');
  return row;
}

export async function listAthleteTeamIds(db: DbClient, athleteId: string): Promise<string[]> {
  const rows = await db
    .select({ teamId: athleteTeams.teamId })
    .from(athleteTeams)
    .where(eq(athleteTeams.athleteId, athleteId));
  return rows.map((row) => row.teamId);
}

export interface AthleteMembership {
  teamId: string;
  teamName: string;
  modalityId: string;
  modalityName: string;
}

export async function listAthleteMemberships(
  db: DbClient,
  athleteId: string,
): Promise<AthleteMembership[]> {
  return db
    .select({
      teamId: teams.id,
      teamName: teams.name,
      modalityId: modalities.id,
      modalityName: modalities.name,
    })
    .from(athleteTeams)
    .innerJoin(teams, eq(teams.id, athleteTeams.teamId))
    .innerJoin(modalities, eq(modalities.id, teams.modalityId))
    .where(eq(athleteTeams.athleteId, athleteId));
}

export interface AthletePendingRequest {
  id: string;
  teamId: string;
  teamName: string;
  modalityId: string;
  modalityName: string;
  status: TeamJoinRequestRow['status'];
  createdAt: Date;
}

export async function listAthleteJoinRequests(
  db: DbClient,
  athleteId: string,
): Promise<AthletePendingRequest[]> {
  return db
    .select({
      id: teamJoinRequests.id,
      teamId: teams.id,
      teamName: teams.name,
      modalityId: modalities.id,
      modalityName: modalities.name,
      status: teamJoinRequests.status,
      createdAt: teamJoinRequests.createdAt,
    })
    .from(teamJoinRequests)
    .innerJoin(teams, eq(teams.id, teamJoinRequests.teamId))
    .innerJoin(modalities, eq(modalities.id, teams.modalityId))
    .where(eq(teamJoinRequests.athleteId, athleteId));
}

// True if the given director directs at least one modality this athlete has
// a confirmed membership OR a pending/decided join request in — a DM needs
// visibility into applicants, not just confirmed roster members.
export async function isAthleteVisibleToDirector(
  db: DbClient,
  directorUserId: string,
  athleteId: string,
): Promise<boolean> {
  const viaMembership = db
    .select({ one: athleteTeams.athleteId })
    .from(athleteTeams)
    .innerJoin(teams, eq(teams.id, athleteTeams.teamId))
    .innerJoin(
      modalityDirectors,
      and(
        eq(modalityDirectors.modalityId, teams.modalityId),
        eq(modalityDirectors.userId, directorUserId),
      ),
    )
    .where(eq(athleteTeams.athleteId, athleteId));

  const viaRequest = db
    .select({ one: teamJoinRequests.athleteId })
    .from(teamJoinRequests)
    .innerJoin(teams, eq(teams.id, teamJoinRequests.teamId))
    .innerJoin(
      modalityDirectors,
      and(
        eq(modalityDirectors.modalityId, teams.modalityId),
        eq(modalityDirectors.userId, directorUserId),
      ),
    )
    .where(eq(teamJoinRequests.athleteId, athleteId));

  const [row] = await db
    .select({ found: athletes.id })
    .from(athletes)
    .where(and(eq(athletes.id, athleteId), or(exists(viaMembership), exists(viaRequest))))
    .limit(1);

  return row !== undefined;
}

export interface AthleteSummary {
  athleteId: string;
  userId: string;
  fullName: string | null;
  email: string;
}

export async function listAthletesForModality(
  db: DbClient,
  modalityId: string,
): Promise<AthleteSummary[]> {
  const rows = await db
    .selectDistinct({
      athleteId: athletes.id,
      userId: athletes.userId,
      fullName: users.fullName,
      email: users.email,
    })
    .from(athletes)
    .innerJoin(users, eq(users.id, athletes.userId))
    .innerJoin(athleteTeams, eq(athleteTeams.athleteId, athletes.id))
    .innerJoin(teams, and(eq(teams.id, athleteTeams.teamId), eq(teams.modalityId, modalityId)));

  return rows;
}

export async function listAllAthletes(db: DbClient): Promise<AthleteSummary[]> {
  return db
    .select({
      athleteId: athletes.id,
      userId: athletes.userId,
      fullName: users.fullName,
      email: users.email,
    })
    .from(athletes)
    .innerJoin(users, eq(users.id, athletes.userId));
}

export async function createJoinRequest(
  db: DbClient,
  values: { athleteId: string; teamId: string },
): Promise<TeamJoinRequestRow> {
  const [row] = await db.insert(teamJoinRequests).values(values).returning();
  if (!row) throw new Error('Failed to create team join request');
  return row;
}

// Locks the row (SELECT ... FOR UPDATE) so two concurrent approve/reject
// calls on the same request can't both succeed.
export async function findJoinRequestForUpdate(
  db: DbClient,
  id: string,
): Promise<TeamJoinRequestRow | undefined> {
  const [row] = await db
    .select()
    .from(teamJoinRequests)
    .where(eq(teamJoinRequests.id, id))
    .for('update')
    .limit(1);
  return row;
}

export async function decideJoinRequest(
  db: DbClient,
  id: string,
  values: Pick<TeamJoinRequestRow, 'status' | 'decidedBy' | 'decidedAt' | 'rejectionReason'>,
): Promise<TeamJoinRequestRow> {
  const [row] = await db
    .update(teamJoinRequests)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(teamJoinRequests.id, id))
    .returning();
  if (!row) throw new Error('Team join request not found');
  return row;
}

export async function confirmMembership(
  db: DbClient,
  athleteId: string,
  teamId: string,
): Promise<void> {
  await db.insert(athleteTeams).values({ athleteId, teamId }).onConflictDoNothing();
}

// Seeds a pending athlete_documents row for every required document that
// applies to the team's modality (or is global) and doesn't already have one
// for this athlete — run inside the same transaction as approval.
export async function seedRequiredDocuments(
  db: DbClient,
  athleteId: string,
  modalityId: string,
): Promise<void> {
  const applicable = await db
    .select({ id: requiredDocuments.id })
    .from(requiredDocuments)
    .where(or(eq(requiredDocuments.modalityId, modalityId), isNull(requiredDocuments.modalityId)));

  for (const doc of applicable) {
    await db
      .insert(athleteDocuments)
      .values({ athleteId, requiredDocumentId: doc.id, status: 'pending' })
      .onConflictDoNothing();
  }
}
