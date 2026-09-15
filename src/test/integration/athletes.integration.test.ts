import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';
import {
  approveJoinRequest,
  createJoinRequest,
  rejectJoinRequest,
} from '../../modules/athletes/service.js';
import {
  athleteDocuments,
  athleteTeams,
  auditLogs,
  requiredDocuments,
  teams,
} from '../../database/schema/index.js';
import { cleanupTestData, db, insertTestModality, insertTestUser } from './helpers.js';

// Exercises the real transactional service functions (no mocks) against a
// real Postgres — the join-request approval flow is the module's riskiest
// piece of business logic: it must atomically flip the request, insert the
// confirmed membership, seed required documents, and write an audit row.

const userIds: string[] = [];
const modalityIds: string[] = [];

afterAll(async () => {
  await cleanupTestData({ userIds, modalityIds });
});

async function setupTeamWithRequiredDoc() {
  const modalityId = await insertTestModality();
  modalityIds.push(modalityId);

  const [team] = await db.insert(teams).values({ modalityId, name: 'Test Team' }).returning({
    id: teams.id,
  });
  if (!team) throw new Error('failed to insert team');

  await db.insert(requiredDocuments).values({
    modalityId,
    type: 'id_document',
    required: true,
  });

  return { modalityId, teamId: team.id };
}

describe('team join request approval (real transaction)', () => {
  it('approving a request confirms membership, seeds required documents, and writes an audit row — atomically', async () => {
    const athleteUser = await insertTestUser('atleta');
    const gestor = await insertTestUser('gestao');
    userIds.push(athleteUser.id, gestor.id);
    const { teamId } = await setupTeamWithRequiredDoc();

    const request = await createJoinRequest({ id: athleteUser.id, role: 'atleta' }, teamId);
    expect(request.status).toBe('pending');

    const approved = await approveJoinRequest({
      actor: { id: gestor.id, role: 'gestao' },
      requestId: request.id,
    });
    expect(approved.status).toBe('approved');

    const membership = await db
      .select()
      .from(athleteTeams)
      .where(eq(athleteTeams.athleteId, request.athleteId));
    expect(membership).toHaveLength(1);

    const seededDocs = await db
      .select()
      .from(athleteDocuments)
      .where(eq(athleteDocuments.athleteId, request.athleteId));
    expect(seededDocs).toHaveLength(1);
    expect(seededDocs[0]?.status).toBe('pending');

    const audit = await db.select().from(auditLogs).where(eq(auditLogs.entityId, request.id));
    expect(audit.some((row) => row.action === 'TEAM_JOIN_REQUEST_APPROVED')).toBe(true);
  });

  it('rejecting a request never creates a membership or seeds documents', async () => {
    const athleteUser = await insertTestUser('atleta');
    const gestor = await insertTestUser('gestao');
    userIds.push(athleteUser.id, gestor.id);
    const { teamId } = await setupTeamWithRequiredDoc();

    const request = await createJoinRequest({ id: athleteUser.id, role: 'atleta' }, teamId);
    const rejected = await rejectJoinRequest({
      actor: { id: gestor.id, role: 'gestao' },
      requestId: request.id,
      reason: 'Incomplete application',
    });

    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Incomplete application');

    const membership = await db
      .select()
      .from(athleteTeams)
      .where(eq(athleteTeams.athleteId, request.athleteId));
    expect(membership).toHaveLength(0);
  });

  it('a second approve on an already-decided request is rejected (no double-decision)', async () => {
    const athleteUser = await insertTestUser('atleta');
    const gestor = await insertTestUser('gestao');
    userIds.push(athleteUser.id, gestor.id);
    const { teamId } = await setupTeamWithRequiredDoc();

    const request = await createJoinRequest({ id: athleteUser.id, role: 'atleta' }, teamId);
    await approveJoinRequest({ actor: { id: gestor.id, role: 'gestao' }, requestId: request.id });

    await expect(
      approveJoinRequest({ actor: { id: gestor.id, role: 'gestao' }, requestId: request.id }),
    ).rejects.toThrow();
  });
});
