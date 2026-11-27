/** Runs an action on an array, then returns that array. */
function __after(values: number[], action: (values: number[]) => void): number[] {
  action(values);
  return values;
}
