function voteCounts(votes: string[]): Map<string, number> {
  return new Map(votes.map(k => [k, 1]));
}
