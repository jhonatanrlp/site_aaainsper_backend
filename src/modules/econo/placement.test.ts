import { describe, expect, it } from 'vitest';
import { computeRoundRobinStandings, computeSingleEliminationStandings } from './placement.js';
import type { RecordedMatchResult, StandingComputation } from './repository.js';

function result(
  matchId: string,
  round: string,
  participantId: string,
  outcome: 'win' | 'draw' | 'loss',
): RecordedMatchResult {
  return { matchId, round, participantId, outcome };
}

function byParticipant(standings: StandingComputation[]): Record<string, StandingComputation> {
  const map: Record<string, StandingComputation> = {};
  for (const s of standings) map[s.participantId] = s;
  return map;
}

function get(map: Record<string, StandingComputation>, id: string): StandingComputation {
  const row = map[id];
  if (!row) throw new Error(`No standing computed for participant ${id}`);
  return row;
}

describe('computeRoundRobinStandings', () => {
  it('ranks by points, then wins, then draws, then fewest losses', () => {
    const results: RecordedMatchResult[] = [
      result('m1', 'group', 'a', 'win'),
      result('m1', 'group', 'b', 'loss'),
      result('m2', 'group', 'a', 'win'),
      result('m2', 'group', 'c', 'loss'),
      result('m3', 'group', 'b', 'win'),
      result('m3', 'group', 'c', 'loss'),
    ];

    const standings = computeRoundRobinStandings(results);
    const byId = Object.fromEntries(standings.map((s) => [s.participantId, s]));

    expect(byId.a).toMatchObject({ position: 1, points: 6, wins: 2, losses: 0 });
    expect(byId.b).toMatchObject({ position: 2, points: 3, wins: 1, losses: 1 });
    expect(byId.c).toMatchObject({ position: 3, points: 0, wins: 0, losses: 2 });
  });

  it('gives tied participants the same rank and skips the next rank (standard competition ranking)', () => {
    const results: RecordedMatchResult[] = [
      result('m1', 'group', 'a', 'draw'),
      result('m1', 'group', 'b', 'draw'),
      result('m2', 'group', 'c', 'loss'),
      result('m2', 'group', 'd', 'win'),
    ];

    const standings = computeRoundRobinStandings(results);
    const byId = byParticipant(standings);

    // d won (3 points) — ranks above the two 1-point draws.
    expect(get(byId, 'd').position).toBe(1);
    // a and b both drew (1 point each) — tied for 2nd.
    expect(get(byId, 'a').position).toBe(2);
    expect(get(byId, 'b').position).toBe(2);
    // c lost, 0 points — last; two participants (d, then a/b tied) rank above, so next is rank 4.
    expect(get(byId, 'c').position).toBe(4);
  });

  it('accumulates a draw as 1 point for both sides, not a win for either', () => {
    const results: RecordedMatchResult[] = [
      result('m1', 'group', 'a', 'draw'),
      result('m1', 'group', 'b', 'draw'),
    ];
    const standings = computeRoundRobinStandings(results);
    expect(standings.find((s) => s.participantId === 'a')).toMatchObject({
      points: 1,
      wins: 0,
      draws: 1,
      losses: 0,
    });
  });
});

describe('computeSingleEliminationStandings', () => {
  it('derives 1st/2nd from the final and 3rd/4th from an explicit third-place match', () => {
    const results: RecordedMatchResult[] = [
      result('final', 'final', 'champion', 'win'),
      result('final', 'final', 'runnerup', 'loss'),
      result('bronze', 'third_place', 'third', 'win'),
      result('bronze', 'third_place', 'fourth', 'loss'),
    ];

    const standings = computeSingleEliminationStandings(results);
    const byId = byParticipant(standings);

    expect(get(byId, 'champion').position).toBe(1);
    expect(get(byId, 'runnerup').position).toBe(2);
    expect(get(byId, 'third').position).toBe(3);
    expect(get(byId, 'fourth').position).toBe(4);
  });

  it('ties both semifinal losers at 3rd when there is no third-place match', () => {
    const results: RecordedMatchResult[] = [
      result('final', 'final', 'champion', 'win'),
      result('final', 'final', 'runnerup', 'loss'),
      result('sf1', 'semifinal', 'champion', 'win'),
      result('sf1', 'semifinal', 'semiloser1', 'loss'),
      result('sf2', 'semifinal', 'runnerup', 'win'),
      result('sf2', 'semifinal', 'semiloser2', 'loss'),
    ];

    const standings = computeSingleEliminationStandings(results);
    const byId = byParticipant(standings);

    expect(get(byId, 'semiloser1').position).toBe(3);
    expect(get(byId, 'semiloser2').position).toBe(3);
  });

  it('ties all four quarterfinal losers at 5th in an 8-participant bracket', () => {
    const results: RecordedMatchResult[] = [
      result('qf1', 'quarterfinal', 'w1', 'win'),
      result('qf1', 'quarterfinal', 'l1', 'loss'),
      result('qf2', 'quarterfinal', 'w2', 'win'),
      result('qf2', 'quarterfinal', 'l2', 'loss'),
      result('qf3', 'quarterfinal', 'w3', 'win'),
      result('qf3', 'quarterfinal', 'l3', 'loss'),
      result('qf4', 'quarterfinal', 'w4', 'win'),
      result('qf4', 'quarterfinal', 'l4', 'loss'),
    ];

    const standings = computeSingleEliminationStandings(results);
    const byId = byParticipant(standings);

    for (const loser of ['l1', 'l2', 'l3', 'l4']) {
      expect(byId[loser]?.position).toBe(5);
    }
    // Quarterfinal winners haven't been placed yet (no SF/final result recorded).
    for (const winner of ['w1', 'w2', 'w3', 'w4']) {
      expect(byId[winner]?.position).toBeNull();
    }
  });

  it('leaves a participant unplaced (null) until their elimination round is recorded', () => {
    const results: RecordedMatchResult[] = [result('qf1', 'quarterfinal', 'w1', 'win')];
    const standings = computeSingleEliminationStandings(results);
    expect(standings.find((s) => s.participantId === 'w1')?.position).toBeNull();
  });

  it('recognizes round labels case- and separator-insensitively', () => {
    const results: RecordedMatchResult[] = [
      result('final', 'Final', 'champion', 'win'),
      result('final', 'Final', 'runnerup', 'loss'),
      result('bronze', '3rd_Place', 'third', 'win'),
      result('bronze', '3rd_Place', 'fourth', 'loss'),
    ];
    const standings = computeSingleEliminationStandings(results);
    const byId = byParticipant(standings);
    expect(get(byId, 'champion').position).toBe(1);
    expect(get(byId, 'third').position).toBe(3);
  });
});
