import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('./repository.js', () => ({
  findModalityById: vi.fn(),
  addModalityDirector: vi.fn(),
  removeModalityDirector: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const { findModalityById, addModalityDirector } = await import('./repository.js');
const { assignDirector } = await import('./service.js');

describe('assignDirector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError for a nonexistent modality, without writing anything', async () => {
    vi.mocked(findModalityById).mockResolvedValue(undefined);

    await expect(
      assignDirector({ actorId: 'gestor-1', modalityId: 'missing', userId: 'u2' }),
    ).rejects.toThrow(NotFoundError);
    expect(addModalityDirector).not.toHaveBeenCalled();
  });

  it('assigns the director and records an audit entry', async () => {
    vi.mocked(findModalityById).mockResolvedValue({ id: 'm1' } as never);

    await assignDirector({ actorId: 'gestor-1', modalityId: 'm1', userId: 'u2' });

    expect(addModalityDirector).toHaveBeenCalledWith('tx', 'u2', 'm1');
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ action: 'MODALITY_DIRECTOR_ASSIGNED', entityId: 'm1' }),
    );
  });
});
