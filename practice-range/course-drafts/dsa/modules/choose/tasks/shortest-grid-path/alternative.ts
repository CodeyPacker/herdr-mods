function shortestGridPath(grid: string[]): number {
  const target = (grid.length - 1) + "," + (grid[0].length - 1);
  const seen = new Set<string>(["0,0"]);
  let ring: [number, number][] = [[0, 0]];
  let moves = 0;
  while (ring.length > 0) {
    const nextRing: [number, number][] = [];
    for (const [row, column] of ring) {
      if (row + "," + column === target) return moves;
      for (const [nextRow, nextColumn] of [[row + 1, column], [row - 1, column], [row, column + 1], [row, column - 1]]) {
        const key = nextRow + "," + nextColumn;
        if (grid[nextRow]?.[nextColumn] !== "." || seen.has(key)) continue;
        seen.add(key);
        nextRing.push([nextRow, nextColumn]);
      }
    }
    ring = nextRing;
    moves++;
  }
  return -1;
}
