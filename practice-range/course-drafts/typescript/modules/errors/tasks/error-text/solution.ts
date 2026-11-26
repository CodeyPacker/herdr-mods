function issueText(problem: unknown): string {
  if (problem instanceof Error) return problem.message;
  if (typeof problem === "string") return problem;
  return "Unknown";
}
