function totalMinutes(entries: Entry[]): number {
  return entries.reduce((sum, entry) => sum + entry.minutes, 0);
}
