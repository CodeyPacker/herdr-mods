function nextCount(count: number, edit: Edit): number {
  if (edit.kind === "set") return edit.value || count;
  if (edit.kind === "add") return count + edit.amount;
  return count;
}
