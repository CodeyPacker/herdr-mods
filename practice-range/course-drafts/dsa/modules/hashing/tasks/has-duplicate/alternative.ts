function hasDuplicate(values: number[]): boolean {
  return new Set(values).size !== values.length;
}
