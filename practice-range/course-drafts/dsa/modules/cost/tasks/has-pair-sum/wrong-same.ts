function hasPairSum(values: number[], target: number): boolean {
  for (let i = 0; i < values.length; i++) {
    for (let j = i; j < values.length; j++) {
      if (values[i] + values[j] === target) return true;
    }
  }
  return false;
}
