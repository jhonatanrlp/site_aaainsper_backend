import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, ForbiddenError, NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('./repository.js', () => ({
  findMatchById: vi.fn(),
  listMatchParticipantIds: vi.fn(),
  upsertMatchResult: vi.fn(),
  markMatchCompleted: vi.fn(),
  findModalityById: vi.fn(),
  listResultsForModality: vi.fn(),
  replaceStandings: vi.fn(),
  setManualStandings: vi.fn(),
  findTournamentById: vi.fn(),
  createScenario: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const {
  findMatchById,
  listMatchParticipantIds,
  upsertMatchResult,
  markMatchCompleted,
  findModalityById,
  listResultsForModality,
  replaceStandings,
  setManualStandings,
} = await import('./repository.js');
const { recordMatchResults, setStandings } = await import('./service.js');

describe('recordMatchResults', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an atleta recording a result', async () => {
    await expect(
      recordMatchResults({
        actor: { id: 'u1', role: 'atleta' },
        matchId: 'm1',
        results: [{ participantId: 'p1', score: 1, outcome: 'win' }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError for a nonexistent match', async () => {
    vi.mocked(findMatchById).mockResolvedValue(undefined);
    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'missing',
        results: [{ participantId: 'p1', score: 1, outcome: 'win' }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects a modality format that does not use matches (fixed_ranking)', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'fixed_ranking' } as never);

    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'm1',
        results: [{ participantId: 'p1', score: null, outcome: 'win' }],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects a result for a participant not actually in this match', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'round_robin' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);

    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'm1',
        results: [
          { participantId: 'p1', score: 1, outcome: 'win' },
          { participantId: 'p-not-in-match', score: 1, outcome: 'loss' },
        ],
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(upsertMatchResult).not.toHaveBeenCalled();
  });

  it('rejects an invalid outcome combination (both win) instead of guessing', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'round_robin' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);

    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'm1',
        results: [
          { participantId: 'p1', score: 2, outcome: 'win' },
          { participantId: 'p2', score: 2, outcome: 'win' },
        ],
      }),
    ).rejects.toThrow(ConflictError);
    expect(upsertMatchResult).not.toHaveBeenCalled();
  });

  it('rejects a lone draw not matched by the other side (e.g. win+draw)', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'round_robin' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);

    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'm1',
        results: [
          { participantId: 'p1', score: 1, outcome: 'win' },
          { participantId: 'p2', score: 1, outcome: 'draw' },
        ],
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('rejects a draw/draw result for single_elimination — elimination requires a winner', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(findModalityById).mockResolvedValue({
      id: 'tm1',
      format: 'single_elimination',
    } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);

    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'm1',
        results: [
          { participantId: 'p1', score: 1, outcome: 'draw' },
          { participantId: 'p2', score: 1, outcome: 'draw' },
        ],
      }),
    ).rejects.toThrow(ConflictError);
    expect(upsertMatchResult).not.toHaveBeenCalled();
  });

  it('accepts a draw/draw result for round_robin', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'round_robin' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);
    vi.mocked(listResultsForModality).mockResolvedValue([]);

    await recordMatchResults({
      actor: { id: 'dm-1', role: 'dm' },
      matchId: 'm1',
      results: [
        { participantId: 'p1', score: 1, outcome: 'draw' },
        { participantId: 'p2', score: 1, outcome: 'draw' },
      ],
    });

    expect(upsertMatchResult).toHaveBeenCalledTimes(2);
    expect(markMatchCompleted).toHaveBeenCalledWith('tx', 'm1');
  });

  it('records results, recomputes standings from ALL results (not incrementally), and audit-logs', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'round_robin' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);
    vi.mocked(listResultsForModality).mockResolvedValue([
      { matchId: 'm1', round: 'group', participantId: 'p1', outcome: 'win' },
      { matchId: 'm1', round: 'group', participantId: 'p2', outcome: 'loss' },
    ]);

    await recordMatchResults({
      actor: { id: 'dm-1', role: 'dm' },
      matchId: 'm1',
      results: [
        { participantId: 'p1', score: 3, outcome: 'win' },
        { participantId: 'p2', score: 1, outcome: 'loss' },
      ],
    });

    expect(listResultsForModality).toHaveBeenCalledWith('tx', 'tm1');
    expect(replaceStandings).toHaveBeenCalledWith(
      'tx',
      'tm1',
      expect.arrayContaining([
        expect.objectContaining({ participantId: 'p1', position: 1, points: 3, wins: 1 }),
        expect.objectContaining({ participantId: 'p2', position: 2, points: 0, losses: 1 }),
      ]),
    );
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ action: 'MATCH_RESULT_RECORDED', entityId: 'm1' }),
    );
  });
});

describe('setStandings', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an atleta setting standings', async () => {
    await expect(
      setStandings({
        actor: { id: 'u1', role: 'atleta' },
        tournamentModalityId: 'tm1',
        entries: [{ participantId: 'p1', position: 1 }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('rejects manual standings for an auto-computed format (round_robin)', async () => {
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'round_robin' } as never);

    await expect(
      setStandings({
        actor: { id: 'gestor-1', role: 'gestao' },
        tournamentModalityId: 'tm1',
        entries: [{ participantId: 'p1', position: 1 }],
      }),
    ).rejects.toThrow(ConflictError);
    expect(setManualStandings).not.toHaveBeenCalled();
  });

  it('allows manual standings for fixed_ranking', async () => {
    vi.mocked(findModalityById).mockResolvedValue({ id: 'tm1', format: 'fixed_ranking' } as never);

    await setStandings({
      actor: { id: 'gestor-1', role: 'gestao' },
      tournamentModalityId: 'tm1',
      entries: [{ participantId: 'p1', position: 1 }],
    });

    expect(setManualStandings).toHaveBeenCalledWith('tx', 'tm1', [
      { participantId: 'p1', position: 1 },
    ]);
  });
});
