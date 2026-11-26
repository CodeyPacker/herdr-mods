function extraHours(hours: number, included: number): number {
  if (hours <= included) return 0;
  return hours - included;
}
