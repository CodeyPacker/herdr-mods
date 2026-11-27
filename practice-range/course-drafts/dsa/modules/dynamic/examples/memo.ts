let calls = 0;
const memo = new Map<number, number>();

function fib(n: number): number {
  calls++;
  if (n < 2) return n;
  const known = memo.get(n);
  if (known !== undefined) return known;
  const value = fib(n - 1) + fib(n - 2);
  memo.set(n, value);
  return value;
}

console.log(fib(20), calls);
console.log(fib(50));
