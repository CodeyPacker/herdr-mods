function twoSum(values: number[], target: number): [number, number] | undefined {
  const positions = new Map<number, number>();
  values.forEach((value, index) => positions.set(value, index));
  for (let index = 0; index < values.length; index++) {
    const other = positions.get(target - values[index]);
    if (other !== undefined) return [index, other];
  }
  return undefined;
}
