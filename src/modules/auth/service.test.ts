import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../shared/errors.js';

vi.mock('../users/repository.js', () => ({
  upsertUserFromAuth: vi.fn(),
}));

const { upsertUserFromAuth } = await import('../users/repository.js');
const { bootstrapSession, isProfileComplete } = await import('./service.js');

describe('bootstrapSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an email outside the allowed domain — the real server-side enforcement point', async () => {
    await expect(bootstrapSession({ id: 'u1', email: 'someone@gmail.com' })).rejects.toThrow(
      ForbiddenError,
    );
    expect(upsertUserFromAuth).not.toHaveBeenCalled();
  });

  it('rejects the legacy-allowed @insper.edu.br domain (staff, no al. prefix) — tightened per migration 0012 intent', async () => {
    await expect(bootstrapSession({ id: 'u1', email: 'staff@insper.edu.br' })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('accepts a matching @al.insper.edu.br email and provisions the user', async () => {
    vi.mocked(upsertUserFromAuth).mockResolvedValue({
      id: 'u1',
      email: 'student@al.insper.edu.br',
      role: 'atleta',
      fullName: null,
      cpf: null,
    } as never);

    const result = await bootstrapSession({ id: 'u1', email: 'student@al.insper.edu.br' });
    expect(result.role).toBe('atleta');
    expect(upsertUserFromAuth).toHaveBeenCalledWith({
      id: 'u1',
      email: 'student@al.insper.edu.br',
    });
  });

  it('is case-insensitive on the domain check', async () => {
    vi.mocked(upsertUserFromAuth).mockResolvedValue({
      id: 'u1',
      email: 'Student@AL.INSPER.EDU.BR',
      role: 'atleta',
      fullName: null,
      cpf: null,
    } as never);

    await expect(
      bootstrapSession({ id: 'u1', email: 'Student@AL.INSPER.EDU.BR' }),
    ).resolves.toBeDefined();
  });
});

describe('isProfileComplete', () => {
  it('is false when full name is missing', () => {
    expect(isProfileComplete({ fullName: null, cpf: '12345678900' } as never)).toBe(false);
  });

  it('is false when cpf is missing', () => {
    expect(isProfileComplete({ fullName: 'Jane Doe', cpf: null } as never)).toBe(false);
  });

  it('is true when both are present', () => {
    expect(isProfileComplete({ fullName: 'Jane Doe', cpf: '12345678900' } as never)).toBe(true);
  });
});
