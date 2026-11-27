function stockAfter(opening: number, delivered: number, sold: number): number {
  const remaining = opening + delivered - sold;
  return remaining;
}
