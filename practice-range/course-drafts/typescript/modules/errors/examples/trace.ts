function read(source: () => string): string {
  try {
    return source();
  } catch (problem) {
    if (problem instanceof Error) return problem.message;
    return "Unknown";
  }
}
console.log(read(() => "" ) === "");
console.log(read(() => { throw new Error("No file"); }));
