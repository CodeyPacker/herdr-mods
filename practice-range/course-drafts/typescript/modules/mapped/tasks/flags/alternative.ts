type Flags<T> = Record<keyof T, boolean>;
function allOff<T extends object>(obj: T): Flags<T> {
  return Object.fromEntries(Object.keys(obj).map(key => [key, false])) as Flags<T>;
}
