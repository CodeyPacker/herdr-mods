function twoSum(values: number[], target: number): [number, number] | undefined {
  const positions = new Map<number, number>();
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    const partner = positions.get(target - value);
    if (partner !== undefined) return [partner, index];
    positions.set(value, index);
  }
  return undefined;
}
