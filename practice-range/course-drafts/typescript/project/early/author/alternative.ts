function remainingAfter(opening: number, arrivals: number, completed: number): number {
  const total = arrivals + opening;
  return total - completed;
}
