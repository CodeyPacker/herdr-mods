function hasTitle(value: unknown): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && "title" in value && typeof value.title === "string";
}
console.log(hasTitle({ title: "" }));
console.log(hasTitle({ title: 7 }));
