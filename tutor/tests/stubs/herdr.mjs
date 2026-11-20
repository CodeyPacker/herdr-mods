// A stand-in for Herdr's "herdr" module, so Tutor's files load under plain Node in tests.
// Tests set globalThis.herdrStub to change what these return.
import { readFile, writeFile } from "node:fs/promises";
const stub = () => globalThis.herdrStub ?? {};
export const appHome = () => stub().appHome ?? "/tmp/tutor-test-home";
export const window = () => ({ platform: stub().platform ?? "linux" });
export const settings = () => ({});
export const exec = async (...args) => (stub().exec ? stub().exec(...args) : { code: 0, stdout: "", stderr: "" });
export const run = (...args) => stub().run?.(...args);
export const hc = async () => ({ code: 0, stdout: "{}", stderr: "" });
export const panes = () => stub().panes ?? [];
export const readTextFile = path => readFile(path, "utf8");
export const writeTextFile = (path, text) => writeFile(path, text);
export const theme = () => ({});
export const nextCommand = () => new Promise(() => {});
export const focused = () => null;
export const pickFolder = async () => null;
export const spaces = () => [];
export const watchFolder = () => new Promise(() => {});
export const props = () => stub().props ?? {};
