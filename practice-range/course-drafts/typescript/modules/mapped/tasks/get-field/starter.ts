function getField<T>(obj: T, key: keyof T): unknown {
  return obj[key];
}
