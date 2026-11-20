// node --import ./tests/stubs/register.mjs: maps Herdr's built-in modules to the stubs.
import { register } from "node:module";
register(new URL("./hooks.mjs", import.meta.url));
