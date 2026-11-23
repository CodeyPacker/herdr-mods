// Loads the mod's own files in Node, for tests. Import this first, then load mod files with mod().
//
// Herdr gives a mod the modules "herdr", "gpui-kit", "gpui-base", "net" and "fs/promises". Here
// those load stand-ins from stubs/ instead. Some files and Node built-ins (FAKEABLE below) load
// through a thin wrapper, so a test can replace what they export with fake(). Each test's fakes
// end with it.
import { registerHooks, createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach } from 'node:test';
import { fakes } from './fakes.mjs';

export { fake } from './fakes.mjs';
export { element, findElement } from './elements.mjs';

const MOD = new URL('../../mods/hey-chat/', import.meta.url).href;
const STUBS = new URL('./stubs/', import.meta.url).href;
const FAKES = new URL('./fakes.mjs', import.meta.url).href;
/** Herdr's own modules, for the mod's .js files (its .mjs files run in Node). */
const HERDR = { 'herdr': 'herdr.mjs', 'gpui-kit': 'gpui-kit.mjs', 'gpui-base': 'gpui-base.mjs', 'net': 'net.mjs', 'fs/promises': 'fs-promises.mjs' };
/** What a test can fake with fake(), when a mod file imports it. */
const FAKEABLE = new Set(['agent.js', 'store.js', 'me.js', 'folders.js', 'process.mjs', 'node:fs', 'node:net']);
const WRAPPED = 'hey-chat-fakeable:';

/** A mod file's or built-in's exports: functions (and classes), and other values. @param {string} name */
function exportsOf(name) {
  if (name.startsWith('node:')) {
    const real = createRequire(import.meta.url)(name);
    const names = Object.keys(real).filter(n => /^[A-Za-z_$][\w$]*$/.test(n));
    return { calls: names.filter(n => typeof real[n] === 'function'), values: names.filter(n => typeof real[n] !== 'function'), hasDefault: true };
  }
  const source = readFileSync(fileURLToPath(MOD + name), 'utf8');
  if (/^export\s*(\{|\*)/m.test(source)) throw new Error(`${name}: list its exports one by one so tests can fake them.`);
  const all = re => [...source.matchAll(re)].map(m => m[1]);
  return {
    calls: all(/^export\s+(?:async\s+)?(?:function\*?|class)\s+([\w$]+)/gm),
    values: all(/^export\s+(?:const|let|var)\s+([\w$]+)/gm),
    hasDefault: /^export\s+default\b/m.test(source),
  };
}

/** A module that passes each export through to `real`, or to the test's fake when there is one. @param {string} name */
function wrapper(name) {
  const real = name.startsWith('node:') ? name : `${MOD}${name}?real`;
  const { calls, values, hasDefault } = exportsOf(name);
  return [
    `import * as real from ${JSON.stringify(real)};`,
    `import { fakes } from ${JSON.stringify(FAKES)};`,
    `const pick = (n) => { const f = fakes.get(${JSON.stringify(name)}); return f && n in f ? f[n] : real[n]; };`,
    ...calls.map(n => `export function ${n}(...args) { const impl = pick(${JSON.stringify(n)}); return new.target ? Reflect.construct(impl, args, new.target === ${n} ? impl : new.target) : impl.apply(this, args); }`),
    ...values.map(n => `export const ${n} = real.${n};`),
    ...(hasDefault ? ['export default real.default;'] : []),
  ].join('\n');
}

registerHooks({
  resolve(specifier, context, next) {
    const parent = context.parentURL ?? '';
    if (!parent.startsWith(MOD)) return next(specifier, context);
    const herdrSide = parent.split('?')[0].endsWith('.js');
    if (herdrSide && HERDR[specifier]) return { url: STUBS + HERDR[specifier], shortCircuit: true };
    if (FAKEABLE.has(specifier)) return { url: WRAPPED + specifier, shortCircuit: true };
    const resolved = next(specifier, context);
    const name = resolved.url.startsWith(MOD) ? resolved.url.slice(MOD.length) : '';
    return FAKEABLE.has(name) ? { url: WRAPPED + name, shortCircuit: true } : resolved;
  },
  load(url, context, next) {
    if (!url.startsWith(WRAPPED)) return next(url, context);
    return { format: 'module', source: wrapper(url.slice(WRAPPED.length)), shortCircuit: true };
  },
});

afterEach(() => fakes.clear());

/** Loads a mod file, by its path in mods/hey-chat. A `?name` suffix loads a separate copy. @param {string} path */
export function mod(path) {
  return import(new URL(path, MOD).href);
}

/** A view with the mod's methods and no state but `fields`, as tests build it instead of running init(). @param {Record<string, any>} [fields] */
export async function view(fields = {}) {
  const { default: HeyChat } = await mod('main.js');
  return Object.assign(Object.create(HeyChat.prototype), fields);
}
