function twoSum(values: number[], target: number): [number, number] | undefined {
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i] + values[j] === target) return [i, j];
    }
  }
  return undefined;
}
