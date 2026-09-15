import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError } from '../../shared/errors.js';

vi.mock('../../database/client.js', () => ({
  db: { transaction: vi.fn((cb: (tx: unknown) => unknown) => cb('tx')) },
}));
vi.mock('../modalities/repository.js', () => ({ isDirectorOfModality: vi.fn() }));
vi.mock('../audit/repository.js', () => ({ recordAudit: vi.fn() }));
vi.mock('./repository.js', () => ({
  createGame: vi.fn(),
  findGameById: vi.fn(),
  updateGame: vi.fn(),
  listGames: vi.fn(),
}));

const { isDirectorOfModality } = await import('../modalities/repository.js');
const { createGame: createGameRepo } = await import('./repository.js');
const { createGame, listGames } = await import('./service.js');

describe('createGame', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a dm creating a game for a modality they do not direct', async () => {
    vi.mocked(isDirectorOfModality).mockResolvedValue(false);

    await expect(
      createGame(
        { id: 'dm-1', role: 'dm' },
        {
          modalityId: 'm1',
          competitionId: null,
          opponent: 'Rival FC',
          date: new Date(),
          venue: null,
          home: true,
          published: false,
        },
      ),
    ).rejects.toThrow(ForbiddenError);
    expect(createGameRepo).not.toHaveBeenCalled();
  });

  it('allows a dm creating a game for a modality they direct', async () => {
    vi.mocked(isDirectorOfModality).mockResolvedValue(true);
    vi.mocked(createGameRepo).mockResolvedValue({ id: 'g1' } as never);

    await createGame(
      { id: 'dm-1', role: 'dm' },
      {
        modalityId: 'm1',
        competitionId: null,
        opponent: 'Rival FC',
        date: new Date(),
        venue: null,
        home: true,
        published: false,
      },
    );

    expect(createGameRepo).toHaveBeenCalled();
  });

  it('rejects an atleta outright, without checking director status', async () => {
    await expect(
      createGame(
        { id: 'u1', role: 'atleta' },
        {
          modalityId: 'm1',
          competitionId: null,
          opponent: 'Rival FC',
          date: new Date(),
          venue: null,
          home: true,
          published: false,
        },
      ),
    ).rejects.toThrow(ForbiddenError);
    expect(isDirectorOfModality).not.toHaveBeenCalled();
  });
});

describe('listGames', () => {
  it('requests public-only games for an anonymous caller', async () => {
    const { listGames: listGamesRepo } = await import('./repository.js');
    vi.mocked(listGamesRepo).mockResolvedValue([]);

    await listGames(undefined);
    expect(listGamesRepo).toHaveBeenCalledWith(expect.anything(), true);
  });

  it('requests all games for gestão', async () => {
    const { listGames: listGamesRepo } = await import('./repository.js');
    vi.mocked(listGamesRepo).mockResolvedValue([]);

    await listGames({ id: 'gestor-1', role: 'gestao' });
    expect(listGamesRepo).toHaveBeenCalledWith(expect.anything(), false);
  });
});
