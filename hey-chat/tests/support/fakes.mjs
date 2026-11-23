// What each test fakes, by module: "herdr", "net", "fs/promises", a Node built-in such as
// "node:fs", or a mod file such as "agent.js". Stand-ins and fakeable modules look here on every
// call, so a fake set in a test applies to code that was imported before it.

/** @type {Map<string, Record<string, any>>} */
export const fakes = new Map();

/**
 * Fakes some of a module's exports until the test ends. Calling it again for the same module adds
 * to (or replaces) what was faked.
 * @param {string} module @param {Record<string, any>} exports
 */
export function fake(module, exports) {
  fakes.set(module, { ...fakes.get(module), ...exports });
}

/**
 * Exports that look up the fake for `module` on each call, falling back to `defaults`.
 * @param {string} module @param {Record<string, Function>} defaults
 */
export function standIn(module, defaults) {
  return Object.fromEntries(Object.keys(defaults).map((name) => [name, (/** @type {any[]} */ ...args) => {
    const faked = fakes.get(module);
    return (faked && name in faked ? faked[name] : defaults[name])(...args);
  }]));
}
