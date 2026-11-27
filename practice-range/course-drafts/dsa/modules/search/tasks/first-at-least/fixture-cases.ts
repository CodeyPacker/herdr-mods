// The checks count how many times your code reads an element of a watched array.
let __reads = 0;
function __watch(values: number[]): number[] {
  return new Proxy(values, {
    get(target, key, receiver) {
      if (typeof key === "string" && key !== "" && !Number.isNaN(Number(key))) __reads++;
      return Reflect.get(target, key, receiver);
    },
  });
}
function __count(action: () => unknown): number {
  __reads = 0;
  action();
  return __reads;
}

const __even = __watch(Array.from({ length: 100000 }, (_, index) => index * 2));
