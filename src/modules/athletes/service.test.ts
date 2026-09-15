import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('../modalities/repository.js', () => ({ findTeamById: vi.fn() }));
vi.mock('./repository.js', () => ({
  findAthleteById: vi.fn(),
  findAthleteByUserId: vi.fn(),
  findOrCreateAthlete: vi.fn(),
  isAthleteVisibleToDirector: vi.fn(),
  findJoinRequestForUpdate: vi.fn(),
  decideJoinRequest: vi.fn(),
  confirmMembership: vi.fn(),
  seedRequiredDocuments: vi.fn(),
  createJoinRequest: vi.fn(),
  listAthleteTeamIds: vi.fn(),
  listAthletesForModality: vi.fn(),
  listAllAthletes: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const { findTeamById } = await import('../modalities/repository.js');
const {
  findAthleteById,
  isAthleteVisibleToDirector,
  findJoinRequestForUpdate,
  decideJoinRequest,
  confirmMembership,
  seedRequiredDocuments,
} = await import('./repository.js');
const { assertCanViewAthlete, approveJoinRequest, rejectJoinRequest, listAthletes } =
  await import('./service.js');

describe('assertCanViewAthlete', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError for a nonexistent athlete', async () => {
    vi.mocked(findAthleteById).mockResolvedValue(undefined);
    await expect(assertCanViewAthlete({ id: 'u1', role: 'gestao' }, 'a1')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('allows the athlete to view their own record', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'u1' } as never);
    await expect(assertCanViewAthlete({ id: 'u1', role: 'atleta' }, 'a1')).resolves.toBeUndefined();
  });

  it('rejects an athlete trying to view a *different* athlete', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'someone-else' } as never);
    await expect(assertCanViewAthlete({ id: 'u1', role: 'atleta' }, 'a1')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('rejects a dm who does not direct any modality this athlete is connected to', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'someone-else' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(false);
    await expect(assertCanViewAthlete({ id: 'dm-1', role: 'dm' }, 'a1')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('allows a dm who directs a modality this athlete is connected to', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'someone-else' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(true);
    await expect(assertCanViewAthlete({ id: 'dm-1', role: 'dm' }, 'a1')).resolves.toBeUndefined();
  });

  it('allows gestão regardless of connection', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'someone-else' } as never);
    await expect(
      assertCanViewAthlete({ id: 'gestor-1', role: 'gestao' }, 'a1'),
    ).resolves.toBeUndefined();
  });
});

describe('listAthletes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an atleta outright — roster listing is dm/gestão only', async () => {
    await expect(listAthletes({ id: 'u1', role: 'atleta' }, {})).rejects.toThrow(ForbiddenError);
  });

  it('rejects a dm who omits modalityId (cannot browse the global roster)', async () => {
    await expect(listAthletes({ id: 'dm-1', role: 'dm' }, {})).rejects.toThrow(ForbiddenError);
  });
});

describe('approveJoinRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws NotFoundError for a nonexistent request', async () => {
    vi.mocked(findJoinRequestForUpdate).mockResolvedValue(undefined);
    await expect(
      approveJoinRequest({ actor: { id: 'gestor-1', role: 'gestao' }, requestId: 'missing' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when the request was already decided (prevents double-approval)', async () => {
    vi.mocked(findJoinRequestForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'approved',
      athleteId: 'a1',
      teamId: 't1',
    } as never);
    await expect(
      approveJoinRequest({ actor: { id: 'gestor-1', role: 'gestao' }, requestId: 'r1' }),
    ).rejects.toThrow(ConflictError);
  });

  it("rejects a dm who does not direct this request's modality (cross-modality approval attempt)", async () => {
    vi.mocked(findJoinRequestForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'pending',
      athleteId: 'a1',
      teamId: 't1',
    } as never);
    vi.mocked(findTeamById).mockResolvedValue({ id: 't1', modalityId: 'm1' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(false);

    await expect(
      approveJoinRequest({ actor: { id: 'dm-1', role: 'dm' }, requestId: 'r1' }),
    ).rejects.toThrow(ForbiddenError);
    expect(decideJoinRequest).not.toHaveBeenCalled();
  });

  it('rejects an atleta attempting to approve a request outright', async () => {
    vi.mocked(findJoinRequestForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'pending',
      athleteId: 'a1',
      teamId: 't1',
    } as never);
    vi.mocked(findTeamById).mockResolvedValue({ id: 't1', modalityId: 'm1' } as never);

    await expect(
      approveJoinRequest({ actor: { id: 'u1', role: 'atleta' }, requestId: 'r1' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('approves, confirms membership, seeds required documents, and audit-logs — for a dm who directs the modality', async () => {
    vi.mocked(findJoinRequestForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'pending',
      athleteId: 'a1',
      teamId: 't1',
    } as never);
    vi.mocked(findTeamById).mockResolvedValue({ id: 't1', modalityId: 'm1' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(true);
    vi.mocked(decideJoinRequest).mockResolvedValue({ id: 'r1', status: 'approved' } as never);

    const result = await approveJoinRequest({
      actor: { id: 'dm-1', role: 'dm' },
      requestId: 'r1',
    });

    expect(result.status).toBe('approved');
    expect(confirmMembership).toHaveBeenCalledWith('tx', 'a1', 't1');
    expect(seedRequiredDocuments).toHaveBeenCalledWith('tx', 'a1', 'm1');
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ action: 'TEAM_JOIN_REQUEST_APPROVED', entityId: 'r1' }),
    );
  });
});

describe('rejectJoinRequest', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requires a reason and records it in the audit metadata', async () => {
    vi.mocked(findJoinRequestForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'pending',
      athleteId: 'a1',
      teamId: 't1',
    } as never);
    vi.mocked(decideJoinRequest).mockResolvedValue({ id: 'r1', status: 'rejected' } as never);

    await rejectJoinRequest({
      actor: { id: 'gestor-1', role: 'gestao' },
      requestId: 'r1',
      reason: 'Missing documents',
    });

    expect(decideJoinRequest).toHaveBeenCalledWith(
      'tx',
      'r1',
      expect.objectContaining({ status: 'rejected', rejectionReason: 'Missing documents' }),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({
        action: 'TEAM_JOIN_REQUEST_REJECTED',
        metadata: expect.objectContaining({ reason: 'Missing documents' }),
      }),
    );
  });

  it('throws ConflictError when the request was already decided', async () => {
    vi.mocked(findJoinRequestForUpdate).mockResolvedValue({
      id: 'r1',
      status: 'rejected',
      athleteId: 'a1',
      teamId: 't1',
    } as never);

    await expect(
      rejectJoinRequest({
        actor: { id: 'gestor-1', role: 'gestao' },
        requestId: 'r1',
        reason: 'x',
      }),
    ).rejects.toThrow(ConflictError);
  });
});
