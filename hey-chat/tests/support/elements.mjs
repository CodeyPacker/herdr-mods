// A stand-in for GPUI's elements. Every builder method returns the element, so views build as they
// do in Herdr. It records its children, its id and its click handler, so a test can find a button
// by id and press it.

/**
 * Herdr refuses any child but an element or a string, and then keeps showing the last frame that
 * worked. The stand-in throws the same error, so a test that draws a view catches it.
 * @param {any} child
 */
function checkChild(child) {
  if (typeof child === 'string' || child?.isElement) return child;
  throw new TypeError(`child(value) expects an element, a string, or an entity from cx.new(Class, props). Got ${child === null ? 'null' : typeof child}.`);
}

/** A new element. Any arguments (a path, an id, text) are ignored. */
export function element() {
  const data = { nodes: [], isElement: true };
  /** @type {any} */
  const el = new Proxy(data, { get(target, key) {
    if (key in target) return target[key];
    if (key === 'when') return (condition, fn) => { if (condition) fn(el); return el; };
    if (key === 'child') return child => { target.nodes.push(checkChild(child)); return el; };
    if (key === 'children') return children => { target.nodes.push(...[...children].map(checkChild)); return el; };
    if (key === 'id') return id => { target.elementId = id; return el; };
    if (key === 'on_click') return handler => { target.click = handler; return el; };
    if (key === 'then') return undefined; // not a promise
    return () => el;
  } });
  return el;
}

/** The element with `id` under `el`, or null. @param {any} el @param {string} id */
export function findElement(el, id) {
  if (!el || typeof el !== 'object') return null;
  if (el.elementId === id) return el;
  for (const child of el.nodes ?? []) {
    const found = findElement(child, id);
    if (found) return found;
  }
  return null;
}
