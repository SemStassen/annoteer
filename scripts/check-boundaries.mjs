import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import ts from "typescript";

const source = resolve("packages/annoteer/src");
const errors = [];
async function visit(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await visit(path);
      continue;
    }
    if (!/\.tsx?$/.test(path)) continue;
    const owner = relative(source, path).split(sep)[0];
    const ast = ts.createSourceFile(
      path,
      await readFile(path, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const check = (specifier) => {
      const target = specifier.startsWith(".") ? resolve(dirname(path), specifier) : null;
      const targetModule = target && relative(source, target).split(sep)[0];
      let reason;
      if (target && !target.startsWith(source + sep))
        reason = "source imports must stay inside the package’s runtime modules";
      else if (targetModule && targetModule !== owner && targetModule !== "domain")
        reason = `${owner} must not import ${targetModule}`;
      else if (
        ["react", "domain"].includes(owner) &&
        /^(node:|alchemy(?:\/|$)|@cloudflare\/)/.test(specifier)
      )
        reason = `${owner} must not depend on Node or Cloudflare`;
      else if (owner === "domain" && !target && !/^effect(?:\/|$)/.test(specifier))
        reason = "domain may only depend on Effect and other domain modules";
      if (reason) errors.push(`${relative(process.cwd(), path)}: ${reason} (${specifier})`);
    };
    const walk = (node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      )
        check(node.moduleSpecifier.text);
      if (
        ts.isCallExpression(node) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
          (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      )
        check(node.arguments[0].text);
      ts.forEachChild(node, walk);
    };
    walk(ast);
  }
}
await visit(source);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else console.log("✓ Annoteer runtime import boundaries are intact.");
