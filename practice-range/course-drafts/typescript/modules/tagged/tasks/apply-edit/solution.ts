function nextCount(count: number, edit: Edit): number {
  if (edit.kind === "add") return count + edit.amount;
  if (edit.kind === "set") return edit.value;
  return count;
}
