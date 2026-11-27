// Every authored module converts to Markdown and back without losing anything.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseModuleMarkdown, moduleToMarkdown, readModule } from "../scripts/course-markdown.mjs";

const drafts = resolve(dirname(fileURLToPath(import.meta.url)), "../course-drafts");
const read = (folder, file) => readFile(join(folder, file), "utf8");

for (const language of ["csharp", "typescript", "sql", "api-design"]) {
  test(`${language} modules round-trip through Markdown`, async () => {
    const folder = join(drafts, language, "modules");
    for (const key of await readdir(folder)) {
      const path = join(folder, key, "module.json");
      const module = await readModule(path, read).catch(error => error.code === "ENOENT" ? null : Promise.reject(error));
      if (!module) continue;
      const text = moduleToMarkdown({ ...module, codeFence: language === "api-design" ? "text" : language });
      assert.deepEqual(parseModuleMarkdown(text), module, `${language}/${key}`);
    }
  });
}

test("a question needs a marked answer", () => {
  assert.throws(() => parseModuleMarkdown("---\nid: course:x/module/a\ntitle: A\n---\n\n## One\n\n:::question q\nWhich?\n- [ ] a :: no\n:::\n"), /marks no answer/);
});
