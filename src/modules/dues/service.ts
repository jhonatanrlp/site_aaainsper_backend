import { db } from '../../database/client.js';
import { findAthleteById, isAthleteVisibleToDirector } from '../athletes/repository.js';
import { recordAudit } from '../audit/repository.js';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';
import { listDuesForAthlete, upsertDues, type MembershipDuesRow } from './repository.js';

export interface Actor {
  id: string;
  role: 'atleta' | 'dm' | 'gestao';
}

async function assertCanViewDues(actor: Actor, athleteId: string): Promise<void> {
  const athlete = await findAthleteById(db, athleteId);
  if (!athlete) throw new NotFoundError('Athlete');
  if (actor.role === 'gestao') return;
  if (athlete.userId === actor.id) return;
  if (actor.role === 'dm' && (await isAthleteVisibleToDirector(db, actor.id, athleteId))) return;
  throw new ForbiddenError();
}

export async function listDues(actor: Actor, athleteId: string): Promise<MembershipDuesRow[]> {
  await assertCanViewDues(actor, athleteId);
  return listDuesForAthlete(db, athleteId);
}

// gestão only, audit-logged — manual entry (no external Google Sheets sync
// per the approved plan).
export async function markDues(params: {
  actor: Actor;
  athleteId: string;
  semester: string;
  paymentStatus: MembershipDuesRow['paymentStatus'];
}): Promise<MembershipDuesRow> {
  if (params.actor.role !== 'gestao') throw new ForbiddenError();

  const athlete = await findAthleteById(db, params.athleteId);
  if (!athlete) throw new NotFoundError('Athlete');

  return db.transaction(async (tx) => {
    const row = await upsertDues(tx, {
      athleteId: params.athleteId,
      semester: params.semester,
      paymentStatus: params.paymentStatus,
      markedBy: params.actor.id,
    });

    await recordAudit(tx, {
      actorId: params.actor.id,
      action: 'DUES_MARKED',
      entity: 'membership_dues',
      entityId: row.id,
      metadata: { semester: params.semester, paymentStatus: params.paymentStatus },
    });

    return row;
  });
}
