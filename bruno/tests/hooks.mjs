export async function resolve(spec, ctx, next) {
  if (spec === "herdr") return { url: new URL("./herdr-shim.mjs", import.meta.url).href, shortCircuit: true };
  return next(spec, ctx);
}
