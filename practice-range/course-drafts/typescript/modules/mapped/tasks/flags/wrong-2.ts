type Flags<T> = Record<string, boolean>;
function allOff<T extends object>(obj: T): Flags<T> {
  const flags: Flags<T> = {};
  for (const key of Object.keys(obj)) flags[key] = false;
  return flags;
}
