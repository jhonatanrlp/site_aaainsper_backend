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
  findAthleteDocumentById: vi.fn(),
  findAthleteDocumentByRequirement: vi.fn(),
  markSubmitted: vi.fn(),
  reviewDocument: vi.fn(),
  listAthleteDocuments: vi.fn(),
}));
vi.mock('./storage.js', () => ({
  uploadDocumentFile: vi.fn(),
  createSignedDownloadUrl: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const { findAthleteById, isAthleteVisibleToDirector } = await import('../athletes/repository.js');
const { findAthleteDocumentById, findAthleteDocumentByRequirement, reviewDocument, markSubmitted } =
  await import('./repository.js');
const { uploadDocumentFile } = await import('./storage.js');
const { uploadAthleteDocument, reviewAthleteDocument } = await import('./service.js');

describe('uploadAthleteDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a DM uploading on behalf of an athlete — self-upload only', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'athlete-user' } as never);

    await expect(
      uploadAthleteDocument({
        actor: { id: 'dm-1', role: 'dm' },
        athleteId: 'a1',
        requiredDocumentId: 'rd1',
        filename: 'id.pdf',
        mimeType: 'application/pdf',
        data: Buffer.from('x'),
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(uploadDocumentFile).not.toHaveBeenCalled();
  });

  it('rejects an unsupported mime type', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'u1' } as never);

    await expect(
      uploadAthleteDocument({
        actor: { id: 'u1', role: 'atleta' },
        athleteId: 'a1',
        requiredDocumentId: 'rd1',
        filename: 'virus.exe',
        mimeType: 'application/x-msdownload',
        data: Buffer.from('x'),
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects upload for a requirement that does not apply to this athlete', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'u1' } as never);
    vi.mocked(findAthleteDocumentByRequirement).mockResolvedValue(undefined);

    await expect(
      uploadAthleteDocument({
        actor: { id: 'u1', role: 'atleta' },
        athleteId: 'a1',
        requiredDocumentId: 'rd-not-applicable',
        filename: 'id.pdf',
        mimeType: 'application/pdf',
        data: Buffer.from('x'),
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('accepts a valid self-upload and marks the document submitted', async () => {
    vi.mocked(findAthleteById).mockResolvedValue({ id: 'a1', userId: 'u1' } as never);
    vi.mocked(findAthleteDocumentByRequirement).mockResolvedValue({ id: 'doc1' } as never);
    vi.mocked(markSubmitted).mockResolvedValue({ id: 'doc1', status: 'submitted' } as never);

    const result = await uploadAthleteDocument({
      actor: { id: 'u1', role: 'atleta' },
      athleteId: 'a1',
      requiredDocumentId: 'rd1',
      filename: 'id.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('x'),
    });

    expect(result.status).toBe('submitted');
    expect(uploadDocumentFile).toHaveBeenCalled();
  });
});

describe('reviewAthleteDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an athlete attempting to review any document — no self-review', async () => {
    await expect(
      reviewAthleteDocument({
        actor: { id: 'u1', role: 'atleta' },
        documentId: 'd1',
        approve: true,
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects a dm reviewing a document belonging to an athlete outside their modalities', async () => {
    vi.mocked(findAthleteDocumentById).mockResolvedValue({ id: 'd1', athleteId: 'a1' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(false);

    await expect(
      reviewAthleteDocument({ actor: { id: 'dm-1', role: 'dm' }, documentId: 'd1', approve: true }),
    ).rejects.toThrow(ForbiddenError);
    expect(reviewDocument).not.toHaveBeenCalled();
  });

  it("approves and audit-logs for a dm who directs the athlete's modality", async () => {
    vi.mocked(findAthleteDocumentById).mockResolvedValue({ id: 'd1', athleteId: 'a1' } as never);
    vi.mocked(isAthleteVisibleToDirector).mockResolvedValue(true);
    vi.mocked(reviewDocument).mockResolvedValue({ id: 'd1', status: 'approved' } as never);

    const result = await reviewAthleteDocument({
      actor: { id: 'dm-1', role: 'dm' },
      documentId: 'd1',
      approve: true,
    });

    expect(result.status).toBe('approved');
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ action: 'DOCUMENT_APPROVED', entityId: 'd1' }),
    );
  });

  it('rejects with a reason and audit-logs it', async () => {
    vi.mocked(findAthleteDocumentById).mockResolvedValue({ id: 'd1', athleteId: 'a1' } as never);
    vi.mocked(reviewDocument).mockResolvedValue({ id: 'd1', status: 'rejected' } as never);

    await reviewAthleteDocument({
      actor: { id: 'gestor-1', role: 'gestao' },
      documentId: 'd1',
      approve: false,
      reason: 'Blurry photo',
    });

    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({
        action: 'DOCUMENT_REJECTED',
        metadata: expect.objectContaining({ reason: 'Blurry photo' }),
      }),
    );
  });
});
