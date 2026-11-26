function readText(source: () => string): Result {
  try { return {kind:"ok",text:source()}; } catch { return {kind:"error",message:"Unknown"}; }
}
