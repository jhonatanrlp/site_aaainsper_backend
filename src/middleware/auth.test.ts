import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '../shared/errors.js';

vi.mock('../shared/supabase.js', () => ({
  supabaseAdmin: {
    auth: {
      getUser: vi.fn(),
    },
  },
}));
vi.mock('../modules/users/repository.js', () => ({
  findUserById: vi.fn(),
}));
vi.mock('../modules/modalities/repository.js', () => ({
  isDirectorOfModality: vi.fn(),
}));

const { supabaseAdmin } = await import('../shared/supabase.js');
const { findUserById } = await import('../modules/users/repository.js');
const { isDirectorOfModality } = await import('../modules/modalities/repository.js');
const { authenticate, verifyIdentity, requireRole, requireModalityAccess } =
  await import('./auth.js');

function fakeRequest(headers: Record<string, string> = {}): FastifyRequest {
  return { headers, user: undefined, identity: undefined } as unknown as FastifyRequest;
}

describe('authenticate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request with no Authorization header', async () => {
    await expect(authenticate(fakeRequest())).rejects.toThrow(UnauthorizedError);
  });

  it('rejects a malformed Authorization header', async () => {
    await expect(authenticate(fakeRequest({ authorization: 'Basic abc' }))).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejects a token Supabase does not recognize', async () => {
    vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
      data: { user: null },
      error: { message: 'invalid' } as never,
    } as never);

    await expect(authenticate(fakeRequest({ authorization: 'Bearer bad-token' }))).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejects a valid Supabase token for a user with no local users row (not yet bootstrapped)', async () => {
    vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@al.insper.edu.br' } },
      error: null,
    } as never);
    vi.mocked(findUserById).mockResolvedValue(undefined);

    await expect(authenticate(fakeRequest({ authorization: 'Bearer good-token' }))).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejects a deactivated account', async () => {
    vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@al.insper.edu.br' } },
      error: null,
    } as never);
    vi.mocked(findUserById).mockResolvedValue({
      id: 'user-1',
      email: 'a@al.insper.edu.br',
      role: 'atleta',
      active: false,
    } as never);

    await expect(authenticate(fakeRequest({ authorization: 'Bearer good-token' }))).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('attaches request.user for a valid, active, provisioned user', async () => {
    vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@al.insper.edu.br' } },
      error: null,
    } as never);
    vi.mocked(findUserById).mockResolvedValue({
      id: 'user-1',
      email: 'a@al.insper.edu.br',
      role: 'atleta',
      active: true,
    } as never);

    const request = fakeRequest({ authorization: 'Bearer good-token' });
    await authenticate(request);

    expect(request.user).toEqual({ id: 'user-1', email: 'a@al.insper.edu.br', role: 'atleta' });
  });
});

describe('verifyIdentity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a request with no Authorization header, without touching the users table', async () => {
    await expect(verifyIdentity(fakeRequest())).rejects.toThrow(UnauthorizedError);
    expect(findUserById).not.toHaveBeenCalled();
  });

  it('attaches request.identity without requiring a local users row (first-login path)', async () => {
    vi.mocked(supabaseAdmin.auth.getUser).mockResolvedValue({
      data: { user: { id: 'user-1', email: 'a@al.insper.edu.br' } },
      error: null,
    } as never);

    const request = fakeRequest({ authorization: 'Bearer good-token' });
    await verifyIdentity(request);

    expect(request.identity).toEqual({ id: 'user-1', email: 'a@al.insper.edu.br' });
    expect(findUserById).not.toHaveBeenCalled();
  });
});

describe('requireRole', () => {
  it('throws Unauthorized when request.user is missing', () => {
    expect(() => requireRole('gestao')(fakeRequest(), {} as never)).toThrow(UnauthorizedError);
  });

  it('throws Forbidden when the role does not match — atleta hitting a gestao-only route', () => {
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'atleta' };
    expect(() => requireRole('gestao')(request, {} as never)).toThrow(ForbiddenError);
  });

  it('throws Forbidden when a dm hits a gestao-only route', () => {
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'dm' };
    expect(() => requireRole('gestao')(request, {} as never)).toThrow(ForbiddenError);
  });

  it('allows an exact role match', () => {
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'gestao' };
    expect(() => requireRole('gestao')(request, {} as never)).not.toThrow();
  });

  it('allows any of several listed roles', () => {
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'dm' };
    expect(() => requireRole('dm', 'gestao')(request, {} as never)).not.toThrow();
  });
});

describe('requireModalityAccess', () => {
  const getModalityId = () => 'modality-1';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws Unauthorized when request.user is missing', async () => {
    await expect(requireModalityAccess(getModalityId)(fakeRequest(), {} as never)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('allows gestao regardless of modality', async () => {
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'gestao' };
    await expect(requireModalityAccess(getModalityId)(request, {} as never)).resolves.not.toThrow();
    expect(isDirectorOfModality).not.toHaveBeenCalled();
  });

  it('allows a dm who directs this modality', async () => {
    vi.mocked(isDirectorOfModality).mockResolvedValue(true);
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'dm' };
    await expect(requireModalityAccess(getModalityId)(request, {} as never)).resolves.not.toThrow();
  });

  it('rejects a dm who directs a *different* modality (cross-modality access)', async () => {
    vi.mocked(isDirectorOfModality).mockResolvedValue(false);
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'dm' };
    await expect(requireModalityAccess(getModalityId)(request, {} as never)).rejects.toThrow(
      ForbiddenError,
    );
  });

  it('rejects an atleta outright, without even checking director status', async () => {
    const request = fakeRequest();
    request.user = { id: 'u1', email: 'a@al.insper.edu.br', role: 'atleta' };
    await expect(requireModalityAccess(getModalityId)(request, {} as never)).rejects.toThrow(
      ForbiddenError,
    );
    expect(isDirectorOfModality).not.toHaveBeenCalled();
  });
});
