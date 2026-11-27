function getField<T, K extends string>(obj: T, key: K): any {
  return (obj as any)[key];
}
