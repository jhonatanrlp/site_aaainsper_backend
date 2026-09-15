import type { RecordedMatchResult, StandingComputation } from './repository.js';

// Pure functions — no DB access. Standings are always fully recomputed from
// the raw recorded results, never patched incrementally, so there is a
// single source of truth and no drift between a "live tally" and a "final"
// placement.

// round_robin and grouped_round_robin share this algorithm: every recorded
// match (including any final/tiebreaker match between group winners — those
// are just additional match rows in the same tournament modality) feeds one
// win/draw/loss/points tally, ranked by points, then wins, then draws, then
// fewest losses. Ties share a rank (standard "1224" competition ranking).
export function computeRoundRobinStandings(results: RecordedMatchResult[]): StandingComputation[] {
  const tally = new Map<string, { wins: number; draws: number; losses: number; points: number }>();

  for (const result of results) {
    const entry = tally.get(result.participantId) ?? { wins: 0, draws: 0, losses: 0, points: 0 };
    if (result.outcome === 'win') {
      entry.wins += 1;
      entry.points += 3;
    } else if (result.outcome === 'draw') {
      entry.draws += 1;
      entry.points += 1;
    } else {
      entry.losses += 1;
    }
    tally.set(result.participantId, entry);
  }

  const ranked = [...tally.entries()]
    .map(([participantId, t]) => ({ participantId, ...t }))
    .sort(
      (a, b) => b.points - a.points || b.wins - a.wins || b.draws - a.draws || a.losses - b.losses,
    );

  const out: StandingComputation[] = [];
  let rank = 0;
  let previous: (typeof ranked)[number] | null = null;

  ranked.forEach((row, index) => {
    const tiedWithPrevious =
      previous !== null &&
      row.points === previous.points &&
      row.wins === previous.wins &&
      row.draws === previous.draws &&
      row.losses === previous.losses;
    if (!tiedWithPrevious) rank = index + 1;

    out.push({
      participantId: row.participantId,
      position: rank,
      points: row.points,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
    });
    previous = row;
  });

  return out;
}

// single_elimination: placement is derived from bracket round semantics, not
// points (elimination formats don't have a natural points curve, and we're
// not reconstructing the legacy app's specific point table — see the
// Checkpoint B report). Recognized round labels (case/spacing-insensitive):
// "final", "third_place"/"3rd_place", "semifinal", "quarterfinal",
// "round_of_16", "round_of_32". Anyone eliminated in an unrecognized round
// label is left unplaced (position null) rather than guessed.
const ELIMINATION_TIERS: { keys: string[]; depth: number }[] = [
  { keys: ['final'], depth: 0 },
  { keys: ['semifinal', 'semifinals', 'sf'], depth: 1 },
  { keys: ['quarterfinal', 'quarterfinals', 'qf'], depth: 2 },
  { keys: ['roundof16', 'r16'], depth: 3 },
  { keys: ['roundof32', 'r32'], depth: 4 },
];
const THIRD_PLACE_KEYS = ['thirdplace', '3rdplace', 'third'];

function normalizeRound(round: string): string {
  return round.toLowerCase().replace(/[\s_-]/g, '');
}

function eliminationDepthFor(round: string): number | null {
  const normalized = normalizeRound(round);
  return ELIMINATION_TIERS.find((tier) => tier.keys.includes(normalized))?.depth ?? null;
}

function isThirdPlaceRound(round: string): boolean {
  return THIRD_PLACE_KEYS.includes(normalizeRound(round));
}

export function computeSingleEliminationStandings(
  results: RecordedMatchResult[],
): StandingComputation[] {
  const byMatch = new Map<string, { round: string; results: RecordedMatchResult[] }>();
  for (const result of results) {
    const entry = byMatch.get(result.matchId) ?? { round: result.round, results: [] };
    entry.results.push(result);
    byMatch.set(result.matchId, entry);
  }
  const matchesList = [...byMatch.values()];

  const tally = new Map<string, { wins: number; draws: number; losses: number }>();
  for (const result of results) {
    const entry = tally.get(result.participantId) ?? { wins: 0, draws: 0, losses: 0 };
    if (result.outcome === 'win') entry.wins += 1;
    else if (result.outcome === 'draw') entry.draws += 1;
    else entry.losses += 1;
    tally.set(result.participantId, entry);
  }

  const position = new Map<string, number>();

  for (const match of matchesList.filter((m) => eliminationDepthFor(m.round) === 0)) {
    const winner = match.results.find((r) => r.outcome === 'win');
    const loser = match.results.find((r) => r.outcome === 'loss');
    if (winner) position.set(winner.participantId, 1);
    if (loser) position.set(loser.participantId, 2);
  }

  for (const match of matchesList.filter((m) => isThirdPlaceRound(m.round))) {
    const winner = match.results.find((r) => r.outcome === 'win');
    const loser = match.results.find((r) => r.outcome === 'loss');
    if (winner) position.set(winner.participantId, 3);
    if (loser) position.set(loser.participantId, 4);
  }

  const otherDepths = [
    ...new Set(
      matchesList
        .map((m) => eliminationDepthFor(m.round))
        .filter((depth): depth is number => depth !== null && depth > 0),
    ),
  ].sort((a, b) => a - b);

  for (const depth of otherDepths) {
    // 2 losers at semifinal (depth 1) tie for 3rd unless a third-place match
    // already resolved them explicitly above; 4 losers at quarterfinal
    // (depth 2) tie for 5th; 8 at round-of-16 (depth 3) tie for 9th; etc.
    const loserPosition = 2 ** depth + 1;
    for (const match of matchesList.filter((m) => eliminationDepthFor(m.round) === depth)) {
      const loser = match.results.find((r) => r.outcome === 'loss');
      if (loser && !position.has(loser.participantId)) {
        position.set(loser.participantId, loserPosition);
      }
    }
  }

  return [...tally.entries()].map(([participantId, t]) => ({
    participantId,
    position: position.get(participantId) ?? null,
    points: 0,
    wins: t.wins,
    draws: t.draws,
    losses: t.losses,
  }));
}
