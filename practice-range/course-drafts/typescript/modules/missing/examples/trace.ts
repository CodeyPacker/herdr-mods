function due(days: number | null): number {
  return days ?? 7;
}
console.log(due(0));
console.log(due(null));
