function extraHours(hours: number, included: number): number {
  if (hours > included) return hours;
  return 0;
}
