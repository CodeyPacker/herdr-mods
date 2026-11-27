// The checks count how many times your code compares two numbers.
let __comparisons = 0;

/** True when a must come before b. */
function before(a: number, b: number): boolean {
  __comparisons++;
  return a < b;
}
const __shuffled = Array.from({ length: 1024 }, (_, index) => (index * 389) % 1024);
const __ordered = Array.from({ length: 1024 }, (_, index) => index);
function __countCompares(action: () => unknown): number {
  __comparisons = 0;
  action();
  return __comparisons;
}
