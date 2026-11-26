function readText(source: () => string): Result {
  return {kind:"ok", text:source()};
}
