function firstOr<T>(items: T[], fallback: T): T {
  return items.length ? items[0] : fallback;
}
