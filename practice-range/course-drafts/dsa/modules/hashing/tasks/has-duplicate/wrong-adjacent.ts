function hasDuplicate(values: number[]): boolean {
  for (let index = 1; index < values.length; index++) {
    if (values[index] === values[index - 1]) return true;
  }
  return false;
}
