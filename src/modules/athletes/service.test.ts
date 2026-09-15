import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('../modalities/repository.js', () => ({ findTeamById: vi.fn() }));
vi.mock('../competitions/repository.js', () => ({ listRegistrationsForAthlete: vi.fn() }));
vi.mock('../documents/repository.js', () => ({ listAthleteDocuments: vi.fn() }));
vi.mock('../users/repository.js', () => ({ findUserById: vi.fn() }));
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
  listAthleteMemberships: vi.fn(),
  listAthleteJoinRequests: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const { findTeamById } = await import('../modalities/repository.js');
const { listRegistrationsForAthlete } = await import('../competitions/repository.js');
const { listAthleteDocuments } = await import('../documents/repository.js');
const { findUserById } = await import('../users/repository.js');
const {
  findAthleteById,
  isAthleteVisibleToDirector,
  findJoinRequestForUpdate,
  decideJoinRequest,
  confirmMembership,
  seedRequiredDocuments,
  listAthleteMemberships,
  listAthleteJoinRequests,
} = await import('./repository.js');
const {
  assertCanViewAthlete,
  approveJoinRequest,
  rejectJoinRequest,
  listAthletes,
  getAthleteDetail,
} = await import('./service.js');

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

describe('getAthleteDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a dm outside the athlete's modalities — enforces the same visibility rule as assertCanViewAthlete", async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'someone-else' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(false);

    await expect(getAthleteDetail({ id: 'dm-1', role: 'dm' }, 'a1')).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('returns full detail (profile, memberships, pending requests, documents, registrations) for an authorized dm', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'u1' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(true);
    vi.mocked(findUserById).mockResolvedValue({
      id: 'u1',
      email: 'a@al.insper.edu.br',
      fullName: 'Jane Doe',
      cpf: '12345678900',
      rg: 'MG-1',
      birthDate: '2000-01-01',
      course: 'Engineering',
      instagram: 'jane',
      phone: '11999999999',
    } as never);
    vi.mocked(listAthleteMemberships).mockResolvedValue([
      { teamId: 't1', teamName: 'Team A', modalityId: 'm1', modalityName: 'Futsal' },
    ] as never);
    vi.mocked(listAthleteJoinRequests).mockResolvedValue([]);
    vi.mocked(listAthleteDocuments).mockResolvedValue([]);
    vi.mocked(listRegistrationsForAthlete).mockResolvedValue([]);

    const detail = await getAthleteDetail({ id: 'dm-1', role: 'dm' }, 'a1');

    expect(detail.fullName).toBe('Jane Doe');
    // Raw CPF is never exposed — even in the "full" detail view.
    expect(detail).not.toHaveProperty('cpf');
    expect(detail.cpfMask).toBe('***.***.***-00');
    expect(detail.memberships).toHaveLength(1);
  });

  it("throws NotFoundError if the athlete's user record is somehow missing", async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'u1' } as never);
    vi.mocked(findUserById).mockResolvedValue(undefined);

    await expect(getAthleteDetail({ id: 'gestor-1', role: 'gestao' }, 'a1')).rejects.toThrow(
      NotFoundError,
    );
  });
});
