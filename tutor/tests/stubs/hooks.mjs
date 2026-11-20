const map = { herdr: "./herdr.mjs", "gpui-base": "./gpui.mjs", "gpui-kit": "./gpui.mjs" };
export async function resolve(specifier, context, next) {
  if (specifier in map) return { url: new URL(map[specifier], import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
