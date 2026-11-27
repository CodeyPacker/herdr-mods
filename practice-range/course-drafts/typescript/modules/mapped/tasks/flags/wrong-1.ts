type Flags<T> = { [K in keyof T]?: boolean };
function allOff<T extends object>(obj: T): Flags<T> {
  return {};
}
