type Flags<T> = T;
function allOff<T extends object>(obj: T): Flags<T> {
  return obj;
}
