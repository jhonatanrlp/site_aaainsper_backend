import { db } from '../../database/client.js';
import { recordAudit } from '../audit/repository.js';
import { NotFoundError } from '../../shared/errors.js';
import {
  addModalityDirector,
  createModality as createModalityRepo,
  createTeam as createTeamRepo,
  findModalityById,
  findTeamById,
  listModalities as listModalitiesRepo,
  listTeamsByModality,
  removeModalityDirector,
  updateModality as updateModalityRepo,
  updateTeam as updateTeamRepo,
  type ModalityRow,
  type TeamRow,
} from './repository.js';

export function listModalities(): Promise<ModalityRow[]> {
  return listModalitiesRepo(db);
}

export async function createModality(
  values: Pick<ModalityRow, 'name' | 'sport' | 'category'>,
): Promise<ModalityRow> {
  return createModalityRepo(db, values);
}

export async function updateModality(
  id: string,
  values: Partial<Pick<ModalityRow, 'name' | 'sport' | 'category' | 'active'>>,
): Promise<ModalityRow> {
  const existing = await findModalityById(db, id);
  if (!existing) throw new NotFoundError('Modality');
  return updateModalityRepo(db, id, values);
}

export async function listTeams(modalityId: string): Promise<TeamRow[]> {
  const modality = await findModalityById(db, modalityId);
  if (!modality) throw new NotFoundError('Modality');
  return listTeamsByModality(db, modalityId);
}

export async function createTeam(
  modalityId: string,
  values: Pick<TeamRow, 'name'>,
): Promise<TeamRow> {
  const modality = await findModalityById(db, modalityId);
  if (!modality) throw new NotFoundError('Modality');
  return createTeamRepo(db, { modalityId, name: values.name });
}

export async function updateTeam(
  id: string,
  values: Partial<Pick<TeamRow, 'name'>>,
): Promise<TeamRow> {
  const existing = await findTeamById(db, id);
  if (!existing) throw new NotFoundError('Team');
  return updateTeamRepo(db, id, values);
}

export async function assignDirector(params: {
  actorId: string;
  modalityId: string;
  userId: string;
}): Promise<void> {
  const modality = await findModalityById(db, params.modalityId);
  if (!modality) throw new NotFoundError('Modality');

  await db.transaction(async (tx) => {
    await addModalityDirector(tx, params.userId, params.modalityId);
    await recordAudit(tx, {
      actorId: params.actorId,
      action: 'MODALITY_DIRECTOR_ASSIGNED',
      entity: 'modalities',
      entityId: params.modalityId,
      metadata: { userId: params.userId },
    });
  });
}

export async function unassignDirector(params: {
  actorId: string;
  modalityId: string;
  userId: string;
}): Promise<void> {
  const modality = await findModalityById(db, params.modalityId);
  if (!modality) throw new NotFoundError('Modality');

  await db.transaction(async (tx) => {
    await removeModalityDirector(tx, params.userId, params.modalityId);
    await recordAudit(tx, {
      actorId: params.actorId,
      action: 'MODALITY_DIRECTOR_REMOVED',
      entity: 'modalities',
      entityId: params.modalityId,
      metadata: { userId: params.userId },
    });
  });
}
