function remainingAfter(opening: number, arrivals: number, completed: number): number {
  if (opening >= 0) {
    const remaining = opening + arrivals - completed;
  }
  return remaining;
}
