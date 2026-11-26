function readText(source: () => string): Result {
  try {
    const text = source();
    return {kind:"ok", text};
  } catch (e) {
    if (typeof e === "string") return {kind:"error", message:e};
    if (e instanceof Error) return {kind:"error", message:e.message};
    return {kind:"error", message:"Unknown"};
  }
}
