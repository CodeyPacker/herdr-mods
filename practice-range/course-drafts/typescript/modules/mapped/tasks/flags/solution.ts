type Flags<T> = { [K in keyof T]: boolean };
function allOff<T extends object>(obj: T): Flags<T> {
  const flags = {} as Flags<T>;
  for (const key of Object.keys(obj) as (keyof T)[]) flags[key] = false;
  return flags;
}
