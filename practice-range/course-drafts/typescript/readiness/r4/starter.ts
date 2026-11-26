function firstOr<T>(items: readonly T[], fallback: T): T {
  return fallback;
}

function summaries(tasks: readonly TrackerTask[]): Pick<TrackerTask, "id" | "title">[] {
  return [];
}
