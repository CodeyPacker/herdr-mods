function stockAfter(opening: number, delivered: number, sold: number): number {
  if (opening >= 0) {
    const remaining = opening + delivered - sold;
  }
  return remaining;
}
