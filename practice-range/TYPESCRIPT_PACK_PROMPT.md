Implement a bundled TypeScript language pack for the existing Practice Range mod in this repository. Work in `practice-range/mods/practice-range`. This is a language pack inside the existing mod, not a second Herdr mod with its own practice interface.

Read the repository's AGENTS.md instructions and the Practice Range section in `README.md` first. Inspect the current code before changing it. If `GRAPHIFY_OUT` is set or `graphify-out/graph.json` exists, use `graphify query` before code searches. Follow existing naming and kit conventions. Do not change the shared kit or unrelated mods. Do not commit or push unless requested. Never add a co-author or assistant attribution to commits.

R1. Preserve the product's purpose.
This tool builds syntax fluency through repetition. It is not an algorithm puzzle engine. Users choose a language, topic, and exercise, and stay on that topic until they choose another. Hints reveal a little more each time. Revealing the full answer remains a separate action. Keep existing editor defaults, Neovim's automatic 50/50 split, VS Code's manual `o` action, and automatic checks on save.

R2. Follow the existing language-pack boundary.
Read these files before implementing:
- `languages/index.js`, `languages/types.js`, and `languages/runner.mjs`
- `languages/csharp/index.js`, `catalog.js`, `types.js`, `runner.mjs`, and `source.mjs`
- Base `catalog.js`, `practice.js`, `runner.mjs`, `process.mjs`, and `types.js`
- `setup.mjs`, `setup-panel.js`, `bridge.js`, and `main.js`
- Existing tests under `practice-range/tests/`

Create `languages/typescript/` with its own content, metadata, source generation, validation, and runtime setup. Keep UI-safe metadata separate from Node-only imports. Use the existing registry and loader. Metadata includes the language ID and name, `Exercise.ts`, `.ts`, the `typescript` Markdown fence, runtime requirements, setup instructions, runner module path, topics, and exercises.

The runner boundary currently exposes:
- `environment()` returns an installed runtime description containing `version`, or an actionable error.
- `createAnswer(exercise)` returns only the editable starter snippet.
- `migrateAnswer(exercise, source)` returns a replacement string or `null` to preserve an existing file.
- `prepareWorkspace(file, runtime)` prepares editor tooling without rewriting unchanged files.
- `check(root, exercise, answer)` returns `{ passed, kind, title, details }`.

Use the current implementation as the authority if the interface has changed. Keep compiler details and exercise-specific validation inside the TypeScript pack. Shared code should handle sessions, hints, progress, saving, editor integration, and presentation without branching on TypeScript syntax.

R3. Make language selection work in the real setup flow.
C# is currently the sole bundled pack, so some setup code still uses `defaultLanguage`. Extend the existing first-run flow to choose and enable either C# or TypeScript. Use pack metadata for names and runtime instructions. Check the selected language's requirements and editor command. Explain missing requirements, offer rechecks, and finish with the save-to-check tutorial. Existing users must be able to add or switch languages through Setup without clearing practice data.

Both packs are bundled. Do not add a remote marketplace or imply that bundled files are being downloaded. Make enabling a pack and installing an external dependency distinguishable in the UI. Reuse the existing setup screen and shared practice UI.

R4. Preserve existing data and isolate languages.
Keep all existing C# answer paths, progress, backups, and editor preferences working. Older sessions without `languageId` belong to C#. Introduce a distinct location for TypeScript sessions, answers, backups, and checker artifacts, so matching exercise IDs cannot overwrite C# data. Preserve each language's selected topic and exercise when switching. Apply the same separation to recent-topic selections and setup completion. Do not change the global default language just to make TypeScript appear.

Trace the language selection through setup, the bridge, the Node runner, catalog helpers, and rendering. Ensure they all use the selected pack. A registry entry by itself is not sufficient.

R5. Use real TypeScript checks.
Use the TypeScript compiler API for parsing and type checking. Validate the requested syntax with AST nodes belonging to the learner's answer, and validate behavior with trusted assertions generated separately. Comments, strings, or supplied setup must not satisfy syntax requirements. Accept equivalent valid syntax where the exercise permits it. Use compile-time assertions for type-only exercises and execution checks for runtime exercises.

Use an explicit, pinned, pack-local TypeScript dependency and lockfile. Explain its installation in setup. Do not depend on this computer's global packages, cached npx paths, or personal directories. Do not silently download packages while checking an answer. Node.js 20 or newer is the execution runtime. Keep execution in separate processes with bounded output and timeouts, and remove temporary check artifacts afterward.

R6. Keep answer files frictionless.
`Exercise.ts` contains only the practice snippet. Users may select all and replace everything. Add imports, supplied declarations, wrappers, and assertions internally. Do not introduce answer markers. Map compiler errors to the learner's file and line numbers. Keep asynchronous exercises, module imports when relevant, and type-only exercises working. Prepare a suitable TypeScript editor workspace without treating snippets as complete standalone programs when they need generated context.

R7. Supply substantial, reviewed practice content.
Add 20 topics with 40 distinct exercises each, matching the C# pack's breadth. Suggested topics are variables and constants, primitive types and conversions, strings and template literals, operators, conditionals and narrowing, loops, arrays and tuples, objects and records, functions, classes and accessors, interfaces and type aliases, unions and intersections, generics and constraints, callbacks and higher-order functions, promises and async/await, modules and imports/exports, utility types, keyof/typeof/indexed access, mapped and conditional types, and discriminated unions/type guards/exhaustiveness.

Adjust topic boundaries if needed for clear teaching. Each exercise needs a specific prompt, three progressively stronger hints, a starter, one valid reference answer, syntax checks, and semantic or type checks. Keep the final hint incomplete and the full answer separate. Exercises should practice meaningfully different syntax forms rather than repeat the same declaration with renamed variables. Avoid external services or npm dependencies in the exercise answers unless the mod supplies a trusted local fixture.

R8. Preserve save-check behavior.
Saving from either editor automatically checks the selected exercise without moving focus. Handle atomic saves, combine duplicate notifications, and recheck the latest save after an in-flight check finishes. Ignore saves for a previous exercise and generated starter writes. Unchanged files must not inflate attempt counts. Switching languages must not run or overwrite the previous language's answer.

R9. Verify the completed integration.
Add meaningful tests for pack registration, setup with missing and available requirements, selecting and switching languages, independent progress, backward-compatible C# sessions, editor workspace preparation, snippet source mapping, and save checks across language switches. Compile/type-check every TypeScript reference answer and execute all applicable behavioral checks. Test incorrect syntax, incorrect types, incorrect output, syntax spoofing through comments and strings, rejected hardcoded answers, and runaway code.

Run the existing C# regression tests and applicable editor tests. Extend the native Herdr panel fixtures to cover TypeScript setup, practice, hints, feedback, and topic/exercise lists. Run TypeScript checking for the mod itself, `git diff --check`, and the native checker. Use temporary practice directories for tests, not the user's real answers or configuration. Do not claim unsupported platforms were tested.

Keep code clean and human-maintainable. Use named topic files and straightforward functions. Document the pack's required local dependency and only the setup or interface changes needed to maintain it. Finish with a concise account of what works, what was tested, and any remaining limitations. Complete the implementation rather than stopping at a plan.
