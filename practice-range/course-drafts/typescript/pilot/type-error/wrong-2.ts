function totalMinutes(entries: Entry[]): number {
  let total = 0;
  for (const entry of entries) total = entry.minutes;
  return total;
}
