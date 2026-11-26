function catchesBrokenRename(rename: (task: TrackerTask, title: string) => TrackerTask): boolean {
  const before: TrackerTask = { id: "t-7", title: "Draft", status: "blocked", owner: "kim" };
  const after = rename(before, "Final");
  if (before.title !== "Draft") return false;
  return after.id === before.id && after.title === "Final";
}
