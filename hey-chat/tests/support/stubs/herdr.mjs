// Stands in for Herdr's "herdr" module. Each function can be faked per test (fake("herdr", ...)).
// The defaults never touch the real computer: no files, no programs, no tabs.
import { standIn } from '../fakes.mjs';

const notFaked = name => async () => { throw new Error(`herdr ${name} is not faked in this test.`); };

export const {
  nextCommand, props, focused, closeOverlay, openOverlay, theme, layout, settings, checking, shared, setShared,
  home, appHome, panes, spaces, run, playSound, window, exec, hc, readTextFile, writeTextFile, pickFolder,
} = standIn('herdr', {
  nextCommand: () => new Promise(() => {}),
  props: () => ({}),
  focused: () => null,
  closeOverlay: () => {},
  openOverlay: () => {},
  theme: () => ({}),
  layout: () => null,
  settings: () => ({}),
  checking: () => false,
  shared: () => undefined,
  setShared: () => {},
  home: () => '/home/user',
  appHome: () => '/herdr-app',
  panes: () => [],
  spaces: () => [],
  run: () => {},
  playSound: () => {},
  window: () => ({ platform: 'linux' }),
  exec: notFaked('exec'),
  hc: notFaked('hc'),
  readTextFile: async () => null,
  writeTextFile: async () => {},
  pickFolder: async () => null,
});
