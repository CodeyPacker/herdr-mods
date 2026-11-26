function issueText(problem: unknown): string {
  if (problem instanceof Error) return problem.message;
  if (typeof problem === "string" && problem) return problem;
  return "Unknown";
}
