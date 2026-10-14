export interface Scored {
  score: number;
}

/** Team indexes, best score first; equal scores keep the playing order. */
export function rankTeams(teams: readonly Scored[]): number[] {
  return teams
    .map((_, index) => index)
    .sort((a, b) => (teams[b]?.score ?? 0) - (teams[a]?.score ?? 0));
}

/** Teams sharing the best score, in playing order. More than one means a tie-break. */
export function leaders(teams: readonly Scored[]): number[] {
  const best = Math.max(...teams.map((team) => team.score));
  return teams.flatMap((team, index) => (team.score === best ? [index] : []));
}
