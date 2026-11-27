// The checks count how many times your code multiplies.
let __multiplications = 0;

/** Multiplies two numbers. */
function times(a: number, b: number): number {
  __multiplications++;
  return a * b;
}
function __countTimes(action: () => unknown): number {
  __multiplications = 0;
  action();
  return __multiplications;
}
