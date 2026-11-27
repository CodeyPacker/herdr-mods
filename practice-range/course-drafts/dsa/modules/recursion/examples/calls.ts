let calls = 0;

function fib(n: number): number {
  calls++;
  return n < 2 ? n : fib(n - 1) + fib(n - 2);
}

console.log(fib(10), calls);
calls = 0;
console.log(fib(20), calls);
