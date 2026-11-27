function hasPairSum(values: number[], target: number): boolean {
  for (let i = 0; i + 1 < values.length; i++) {
    if (values[i] + values[i + 1] === target) return true;
  }
  return false;
}
