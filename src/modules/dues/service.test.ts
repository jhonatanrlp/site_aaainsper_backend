import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('../athletes/repository.js', () => ({
  findAthleteById: vi.fn(),
  isAthleteVisibleToDirector: vi.fn(),
}));
vi.mock('./repository.js', () => ({
  listDuesForAthlete: vi.fn(),
  upsertDues: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const { findAthleteById } = await import('../athletes/repository.js');
const { upsertDues } = await import('./repository.js');
const { markDues, listDues } = await import('./service.js');

describe('markDues', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a dm attempting to mark dues — gestão only', async () => {
    await expect(
      markDues({
        actor: { id: 'dm-1', role: 'dm' },
        athleteId: 'a1',
        semester: '2026-1',
        paymentStatus: 'paid',
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(upsertDues).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent athlete', async () => {
    vi.mocked(findAthleteById).mockResolvedValue(undefined);
    await expect(
      markDues({
        actor: { id: 'gestor-1', role: 'gestao' },
        athleteId: 'missing',
        semester: '2026-1',
        paymentStatus: 'paid',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('marks dues and records an audit entry', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1' } as never);
    vi.mocked(upsertDues).mockResolvedValue({ id: 'd1', paymentStatus: 'paid' } as never);

    const result = await markDues({
      actor: { id: 'gestor-1', role: 'gestao' },
      athleteId: 'a1',
      semester: '2026-1',
      paymentStatus: 'paid',
    });

    expect(result.paymentStatus).toBe('paid');
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ action: 'DUES_MARKED', entityId: 'd1' }),
    );
  });
});

describe('listDues', () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an athlete viewing someone else's dues", async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'someone-else' } as never);
    await expect(listDues({ id: 'u1', role: 'atleta' }, 'a1')).rejects.toThrow(ForbiddenError);
  });
});
