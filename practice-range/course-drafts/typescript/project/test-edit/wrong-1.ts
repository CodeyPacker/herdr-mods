function catchesBrokenRename(rename: (task: TrackerTask, title: string) => TrackerTask): boolean {
  const original: TrackerTask = { id: "a", title: "Old", status: "open" };
  return rename(original, "New").title === "New";
}
