function getField<T extends object, K extends keyof T>(obj: T, key: K): T[K] {
  const value: T[K] = obj[key];
  return value;
}
