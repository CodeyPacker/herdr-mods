function voteCounts(votes: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const vote of votes) counts.set(vote, (counts.get(vote) ?? 0) + 1);
  return counts;
}
