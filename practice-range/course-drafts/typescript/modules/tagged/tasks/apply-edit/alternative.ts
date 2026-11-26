function nextCount(count: number, edit: Edit): number {
  switch (edit.kind) {
    case "keep": return count;
    case "set": return edit.value;
    case "add": return edit.amount + count;
  }
}
