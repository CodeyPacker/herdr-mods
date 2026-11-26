function readText(source: () => string): Result {
  try {
    return {kind:"ok", text:source()};
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : typeof problem === "string" ? problem : "Unknown";
    return {kind:"error", message};
  }
}
