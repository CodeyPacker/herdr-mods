function voteCounts(votes: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const o of votes) if (o) counts.set(o,(counts.get(o)??0)+1);
  return counts;
}
