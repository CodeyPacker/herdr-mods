function firstOr<T>(items: T[], fallback: T): T {
  if (items.length === 0) return fallback;
  return items[0];
}
