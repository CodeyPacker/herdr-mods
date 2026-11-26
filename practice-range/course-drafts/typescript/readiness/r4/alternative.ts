function firstOr<T>(items: readonly T[], fallback: T): T {
  for (const item of items) return item;
  return fallback;
}

function summaries(tasks: readonly TrackerTask[]): Pick<TrackerTask, "id" | "title">[] {
  const result: Pick<TrackerTask, "id" | "title">[] = [];
  for (const { id, title, done } of tasks) if (done === false) result.push({ id, title });
  return result;
}
