function issueText(problem: unknown): string {
  if (typeof problem === "string") return problem;
  return problem instanceof Error ? problem.message : "Unknown";
}
