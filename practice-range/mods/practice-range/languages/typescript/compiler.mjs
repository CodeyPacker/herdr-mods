// Compiler access for the TypeScript pack. Only the pack-local, pinned compiler is loaded.
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { locateLine, displayCheck } from "./source.mjs";

export const packDirectory = dirname(fileURLToPath(import.meta.url));
const compilerFile = join(packDirectory, "node_modules", "typescript", "lib", "typescript.js");
const require = createRequire(import.meta.url);

export async function pinnedVersion() {
  return JSON.parse(await readFile(join(packDirectory, "package.json"), "utf8")).dependencies.typescript;
}

export function installMessage(version) {
  return `Install this pack's TypeScript compiler (${version}): run npm ci in ${packDirectory}, then recheck. `
    + "npm downloads the pinned compiler from its registry once. Checks never download packages.";
}

/** Read the installed version without loading the compiler. */
export async function installedVersion() {
  try { return JSON.parse(await readFile(join(packDirectory, "node_modules", "typescript", "package.json"), "utf8")).version; }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}

let loaded = null;
/** Load by absolute path, so a global or parent-folder TypeScript can never be used. */
export async function loadTypeScript() {
  if (loaded) return loaded;
  const version = await pinnedVersion();
  if (await installedVersion() !== version) throw new Error(installMessage(version));
  const ts = require(compilerFile);
  if (ts.version !== version) throw new Error(installMessage(version));
  loaded = ts;
  return ts;
}

export function compilerOptions(ts) {
  return {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    moduleDetection: ts.ModuleDetectionKind.Force, lib: ["lib.es2023.d.ts"], types: [], strict: true,
    skipLibCheck: true, noEmitOnError: true, inlineSourceMap: true, newLine: ts.NewLineKind.LineFeed,
  };
}

// Library declarations never change, so reuse their parsed files across checks in one process.
const libraryFiles = new Map();
function createHost(ts, options) {
  const host = ts.createCompilerHost(options, true);
  const getSourceFile = host.getSourceFile;
  host.getSourceFile = (name, version, onError, create) => {
    const library = name.includes(`${join("node_modules", "typescript", "lib")}`) || name.includes("node_modules/typescript/lib");
    if (library && libraryFiles.has(name)) return libraryFiles.get(name);
    const file = getSourceFile(name, version, onError, create);
    if (library && file) libraryFiles.set(name, file);
    return file;
  };
  return host;
}

function message(ts, diagnostic) { return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"); }

/** Syntax errors in the answer alone. A balanced answer cannot swallow the generated checks. */
export function answerSyntaxErrors(ts, answer) {
  const { diagnostics } = ts.transpileModule(answer, {
    fileName: "Exercise.ts", reportDiagnostics: true,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, moduleDetection: ts.ModuleDetectionKind.Force },
  });
  return diagnostics.map(diagnostic => formatAt(ts, diagnostic, "Exercise.ts", diagnostic.file ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line + 1 : 1));
}

function formatAt(ts, diagnostic, file, line) {
  const column = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).character + 1 : 1;
  return `${file}:${line}:${column} - error TS${diagnostic.code}: ${message(ts, diagnostic)}`;
}

/**
 * Type-check the generated files and sort diagnostics by who owns them.
 * Returns answer errors, failed type checks, and the program for emitting.
 */
export function typeCheck(ts, directory, exercise, segments) {
  const options = compilerOptions(ts);
  const roots = [join(directory, "check.ts"), join(directory, "globals.d.ts")];
  const program = ts.createProgram({ rootNames: roots, options, host: createHost(ts, options) });
  const answerErrors = [], checkFailures = [], internal = [];
  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    const file = diagnostic.file ? basename(diagnostic.file.fileName) : "";
    const line = diagnostic.file && diagnostic.start !== undefined ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start).line : 0;
    if (file === "Exercise.ts") { answerErrors.push(formatAt(ts, diagnostic, "Exercise.ts", line + 1)); continue; }
    if (file !== "check.ts") { internal.push(`${file || "compiler"}: ${message(ts, diagnostic)}`); continue; }
    const place = locateLine(segments, line);
    if (place.kind === "answer") answerErrors.push(formatAt(ts, diagnostic, "Exercise.ts", place.line));
    else if (place.kind === "supplied") answerErrors.push(`Your answer conflicts with the supplied code: ${message(ts, diagnostic)}`);
    else if (place.kind === "check") checkFailures.push(`Check ${place.index}: ${displayCheck(exercise.checks[place.index - 1])}\n${message(ts, diagnostic)}`);
    else if (place.kind === "type") checkFailures.push(`Type check ${place.index} is not true: ${displayCheck(exercise.typeChecks[place.index - 1])}`);
    else if (place.kind === "reject") {
      const expected = diagnostic.code === 2578 ? "should be a type error, but it compiles" : message(ts, diagnostic);
      checkFailures.push(`This ${expected}: ${exercise.rejects[place.index - 1]}`);
    } else internal.push(message(ts, diagnostic));
  }
  return { program, answerErrors, checkFailures: [...new Set(checkFailures)], internal };
}

// Syntax rules match nodes of the learner's answer only. Comments and strings are not nodes
// of the requested kinds, and supplied code lives in other files.
function calleeName(ts, expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  if (ts.isNonNullExpression(expression) || ts.isParenthesizedExpression(expression)) return calleeName(ts, expression.expression);
  return undefined;
}

function nodeName(ts, node) {
  if (ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isExpressionWithTypeArguments(node)) return calleeName(ts, node.expression);
  if (ts.isTaggedTemplateExpression(node)) return calleeName(ts, node.tag);
  if (ts.isTypeReferenceNode(node)) return ts.isIdentifier(node.typeName) ? node.typeName.text : node.typeName.right.text;
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) ? node.moduleSpecifier.text : undefined;
  if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  const name = node.name;
  if (name && (ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name))) return name.text;
  return undefined;
}

function operatorText(ts, node) {
  if (ts.isBinaryExpression(node)) return ts.tokenToString(node.operatorToken.kind);
  if (ts.isPrefixUnaryExpression(node) || ts.isPostfixUnaryExpression(node) || ts.isTypeOperatorNode(node)) return ts.tokenToString(node.operator);
  if (ts.isHeritageClause(node)) return ts.tokenToString(node.token);
  return undefined;
}

function declarationKeyword(ts, node) {
  const list = ts.isVariableDeclaration(node) ? node.parent : ts.isVariableStatement(node) ? node.declarationList : node;
  if (!list || !ts.isVariableDeclarationList(list)) return undefined;
  const scoped = list.flags & ts.NodeFlags.BlockScoped;
  return scoped === ts.NodeFlags.Const ? "const" : scoped === ts.NodeFlags.Let ? "let" : scoped === 0 ? "var" : "using";
}

function hasModifier(ts, node, modifier) {
  return ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(item => ts.tokenToString(item.kind) === modifier);
}

function hasAncestor(node, kind) {
  for (let parent = node.parent; parent; parent = parent.parent) if (parent.kind === kind) return true;
  return false;
}

const normalize = text => text.replace(/'/g, '"').replace(/\s+/g, "").replace(/;$/, "");

function matches(ts, printer, sourceFile, node, rule) {
  if (rule.kind && node.kind !== ts.SyntaxKind[rule.kind]) return false;
  if (rule.name !== undefined && nodeName(ts, node) !== rule.name) return false;
  if (rule.operator !== undefined && operatorText(ts, node) !== rule.operator) return false;
  if (rule.modifier !== undefined && !hasModifier(ts, node, rule.modifier)) return false;
  if (rule.declaration !== undefined && declarationKeyword(ts, node) !== rule.declaration) return false;
  if (rule.has !== undefined && !node[rule.has]) return false;
  if (rule.within !== undefined && !hasAncestor(node, ts.SyntaxKind[rule.within])) return false;
  // Tokens compare by their own text, which keeps literal spellings such as 1_000_000. Larger
  // nodes are printed without comments.
  const print = target => normalize(target.getChildCount(sourceFile) === 0 ? target.getText(sourceFile) : printer.printNode(ts.EmitHint.Unspecified, target, sourceFile));
  if (rule.type !== undefined && (!node.type || print(node.type) !== normalize(rule.type))) return false;
  if (rule.text !== undefined && print(node) !== normalize(rule.text)) return false;
  return true;
}

function count(ts, printer, sourceFile, rule) {
  let total = 0;
  const visit = node => { if (matches(ts, printer, sourceFile, node, rule)) total++; ts.forEachChild(node, visit); };
  ts.forEachChild(sourceFile, visit);
  return total;
}

function satisfied(ts, printer, sourceFile, rule) {
  if (rule.anyOf) return rule.anyOf.some(option => satisfied(ts, printer, sourceFile, option));
  const total = count(ts, printer, sourceFile, rule);
  return total >= (rule.min ?? (rule.max === 0 ? 0 : 1)) && (rule.max === undefined || total <= rule.max);
}

/** Return the message of every unmet rule. */
export function ruleFailures(ts, answer, rules) {
  const sourceFile = ts.createSourceFile("Exercise.ts", answer, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const printer = ts.createPrinter({ removeComments: true });
  return rules.filter(rule => !satisfied(ts, printer, sourceFile, rule)).map(rule => rule.message);
}

/** Every rule kind must name a real syntax kind, so a typo cannot pass silently. */
export function unknownRuleKinds(ts, rules) {
  return rules.flatMap(rule => rule.anyOf ? unknownRuleKinds(ts, rule.anyOf) : [rule.kind, rule.within])
    .filter(kind => kind !== undefined && typeof ts.SyntaxKind[kind] !== "number");
}
