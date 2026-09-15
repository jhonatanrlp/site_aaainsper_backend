import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('./repository.js', () => ({
  findUserById: vi.fn(),
  updateOwnProfile: vi.fn(),
  updateUserRole: vi.fn(),
  listUsers: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const { findUserById, updateUserRole } = await import('./repository.js');
const { changeUserRole, revealCpf, toProfileResponse } = await import('./service.js');

describe('toProfileResponse', () => {
  it('never includes the raw cpf — only a masked version', () => {
    const response = toProfileResponse({
      id: 'u1',
      email: 'a@al.insper.edu.br',
      fullName: 'Jane Doe',
      cpf: '12345678900',
      rg: null,
      birthDate: null,
      course: null,
      instagram: null,
      phone: null,
      role: 'atleta',
      active: true,
    } as never);

    expect(response).not.toHaveProperty('cpf');
    expect(response.cpfMask).toBe('***.***.***-00');
  });
});

describe('changeUserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a user attempting to change their own role, even gestão', async () => {
    await expect(
      changeUserRole({ actorId: 'u1', targetUserId: 'u1', role: 'gestao' }),
    ).rejects.toThrow(ForbiddenError);
    expect(updateUserRole).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it('updates the target role and records an audit entry', async () => {
    vi.mocked(updateUserRole).mockResolvedValue({
      id: 'u2',
      email: 'b@al.insper.edu.br',
      fullName: null,
      cpf: null,
      rg: null,
      birthDate: null,
      course: null,
      instagram: null,
      phone: null,
      role: 'dm',
      active: true,
    } as never);

    const result = await changeUserRole({ actorId: 'u1', targetUserId: 'u2', role: 'dm' });

    expect(result.role).toBe('dm');
    expect(updateUserRole).toHaveBeenCalledWith('tx', 'u2', 'dm', 'u1');
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ actorId: 'u1', action: 'ROLE_CHANGED', entityId: 'u2' }),
    );
  });
});

describe('revealCpf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws NotFoundError for a nonexistent user, without logging an audit entry', async () => {
    vi.mocked(findUserById).mockResolvedValue(undefined);

    await expect(revealCpf({ actorId: 'gestor-1', targetUserId: 'missing' })).rejects.toThrow(
      NotFoundError,
    );
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it('returns the raw cpf and logs a CPF_VIEWED audit entry every time', async () => {
    vi.mocked(findUserById).mockResolvedValue({ id: 'u2', cpf: '12345678900' } as never);

    const result = await revealCpf({ actorId: 'gestor-1', targetUserId: 'u2' });

    expect(result.cpf).toBe('12345678900');
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ actorId: 'gestor-1', action: 'CPF_VIEWED', entityId: 'u2' }),
    );
  });
});
