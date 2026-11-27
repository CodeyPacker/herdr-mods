function insertFront(values: number[], value: number): number {
  let moves = 0;
  for (let i = values.length; i > 0; i--) {
    values[i] = values[i - 1];
    moves++;
  }
  values[0] = value;
  return moves;
}

const small = [1, 2, 3];
console.log(insertFront(small, 0), small);
console.log(insertFront(new Array(1000).fill(7), 0));
