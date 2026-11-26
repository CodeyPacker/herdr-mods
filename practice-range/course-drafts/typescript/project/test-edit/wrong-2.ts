function catchesBrokenRename(rename: (task: TrackerTask, title: string) => TrackerTask): boolean {
  const original: TrackerTask = { id: "a", title: "Old", status: "open" };
  const renamed = rename(original, "New");
  return renamed.title === "New" && original.title === "Old";
}
