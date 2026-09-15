import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, NotFoundError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('./repository.js', () => ({
  findMatchById: vi.fn(),
  listMatchParticipantIds: vi.fn(),
  upsertMatchResult: vi.fn(),
  bumpStandingTally: vi.fn(),
  markMatchCompleted: vi.fn(),
  findModalityById: vi.fn(),
  setStandingPosition: vi.fn(),
  findTournamentById: vi.fn(),
  createScenario: vi.fn(),
}));

const { recordAudit } = await import('../audit/repository.js');
const {
  findMatchById,
  listMatchParticipantIds,
  upsertMatchResult,
  bumpStandingTally,
  markMatchCompleted,
} = await import('./repository.js');
const { recordMatchResults, setStandings } = await import('./service.js');

describe('recordMatchResults', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an atleta recording a result', async () => {
    await expect(
      recordMatchResults({
        actor: { id: 'u1', role: 'atleta' },
        matchId: 'm1',
        results: [{ participantId: 'p1', score: 1, isWinner: true }],
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('throws NotFoundError for a nonexistent match', async () => {
    vi.mocked(findMatchById).mockResolvedValue(undefined);
    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'missing',
        results: [{ participantId: 'p1', score: 1, isWinner: true }],
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('rejects a result for a participant not actually in this match', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);

    await expect(
      recordMatchResults({
        actor: { id: 'dm-1', role: 'dm' },
        matchId: 'm1',
        results: [{ participantId: 'p-not-in-match', score: 1, isWinner: true }],
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(upsertMatchResult).not.toHaveBeenCalled();
  });

  it('records a win/loss result, bumps the tally for each side, and marks the match completed', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);

    await recordMatchResults({
      actor: { id: 'dm-1', role: 'dm' },
      matchId: 'm1',
      results: [
        { participantId: 'p1', score: 3, isWinner: true },
        { participantId: 'p2', score: 1, isWinner: false },
      ],
    });

    expect(upsertMatchResult).toHaveBeenCalledTimes(2);
    expect(bumpStandingTally).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ participantId: 'p1', outcome: 'win' }),
    );
    expect(bumpStandingTally).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ participantId: 'p2', outcome: 'loss' }),
    );
    expect(markMatchCompleted).toHaveBeenCalledWith('tx', 'm1');
    expect(recordAudit).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ action: 'MATCH_RESULT_RECORDED', entityId: 'm1' }),
    );
  });

  it('treats a result with no winner (both isWinner=false) as a draw for both sides', async () => {
    vi.mocked(findMatchById).mockResolvedValue({ id: 'm1', tournamentModalityId: 'tm1' } as never);
    vi.mocked(listMatchParticipantIds).mockResolvedValue(['p1', 'p2']);

    await recordMatchResults({
      actor: { id: 'gestor-1', role: 'gestao' },
      matchId: 'm1',
      results: [
        { participantId: 'p1', score: 1, isWinner: false },
        { participantId: 'p2', score: 1, isWinner: false },
      ],
    });

    expect(bumpStandingTally).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ participantId: 'p1', outcome: 'draw' }),
    );
    expect(bumpStandingTally).toHaveBeenCalledWith(
      'tx',
      expect.objectContaining({ participantId: 'p2', outcome: 'draw' }),
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
});
