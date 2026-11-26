function remainingAfter(opening: number, arrivals: number, completed: number): number {
  const remaining = opening + arrivals - completed;
  return remaining;
}
