function shortestGridPath(grid: string[]): number {
  const rows = grid.length;
  const columns = grid[0].length;
  const moves: number[][] = grid.map(row => new Array(row.length).fill(-1));
  moves[0][0] = 1;
  const queue: [number, number][] = [[0, 0]];
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let head = 0; head < queue.length; head++) {
    const [row, column] = queue[head];
    if (row === rows - 1 && column === columns - 1) return moves[row][column];
    for (const [down, right] of directions) {
      const nextRow = row + down;
      const nextColumn = column + right;
      if (nextRow < 0 || nextRow >= rows || nextColumn < 0 || nextColumn >= columns) continue;
      if (grid[nextRow][nextColumn] === "#" || moves[nextRow][nextColumn] !== -1) continue;
      moves[nextRow][nextColumn] = moves[row][column] + 1;
      queue.push([nextRow, nextColumn]);
    }
  }
  return -1;
}
