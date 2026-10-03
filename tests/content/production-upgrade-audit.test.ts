import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(path.join(directory, entry.name))
      : [path.join(directory, entry.name)],
  );
}
it('production runtime dependency graph cannot reach fixture content, even indirectly', () => {
  const seen = new Set<string>();
  const visit = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    expect(file.replaceAll('\\', '/')).not.toMatch(
      /content\/(?:sample|fixture)|content\/samples/,
    );
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(
      /sampleContentPack|samplePresentation|\/api\/content\/sample/,
    );
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    const imports = (node: ts.Node) => {
      if (
        (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
        node.moduleSpecifier &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const name = node.moduleSpecifier.text;
        if (name.startsWith('.')) {
          const base = path.resolve(path.dirname(file), name);
          const target = [
            base,
            base + '.ts',
            base + '.tsx',
            base + '.json',
            path.join(base, 'index.ts'),
          ].find((candidate) => existsSync(candidate));
          expect(
            target,
            `Unresolved dependency ${file}: ${name}`,
          ).toBeDefined();
          if (target!.endsWith('.ts') || target!.endsWith('.tsx'))
            visit(target!);
          else
            expect(target!.replaceAll('\\', '/')).not.toContain(
              'content/samples/',
            );
        }
      }
      ts.forEachChild(node, imports);
    };
    imports(ast);
  };
  visit(path.resolve('worker/index.ts'));
  expect(seen.size).toBeGreaterThan(20);
});
it('major UI surfaces have no hardcoded English JSX copy or click-only Read controls', () => {
  const violations: string[] = [];
  for (const file of files('src/client').filter((file) =>
    file.endsWith('.tsx'),
  )) {
    const source = readFileSync(file, 'utf8');
    expect(source).not.toMatch(
      /Start sample match|Sample table|Sample adventurer|Read \{.*name/,
    );
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const visit = (node: ts.Node) => {
      if (
        ts.isJsxText(node) &&
        /[a-z]{3}/i.test(node.text) &&
        !(
          node.text.trim() === 'English' &&
          ts.isJsxElement(node.parent) &&
          node.parent.openingElement.tagName.getText(ast) === 'option'
        )
      )
        violations.push(`${file}: ${node.text.trim()}`);
      if (
        ts.isJsxAttribute(node) &&
        ['aria-label', 'title', 'placeholder', 'alt'].includes(
          node.name.getText(ast),
        ) &&
        node.initializer &&
        ts.isStringLiteral(node.initializer) &&
        /[a-z]{3}/i.test(node.initializer.text)
      )
        violations.push(`${file}: ${node.initializer.text}`);
      ts.forEachChild(node, visit);
    };
    visit(ast);
  }
  expect(violations).toEqual([]);
});
it('browser media construction stays in one auditable boundary with local asset paths', () => {
  const constructors = files('src/client').filter((file) =>
    /new Audio\(/.test(readFileSync(file, 'utf8')),
  );
  expect(constructors.map((file) => file.replaceAll('\\', '/'))).toEqual([
    'src/client/audio/audio-engine.ts',
  ]);
  const media = readFileSync(constructors[0]!, 'utf8');
  expect(media).toContain('/audio/bgm/the-old-tower-inn.wav');
  expect(media).toContain('/audio/sfx/turn-chime.wav');
  expect(media).not.toMatch(/https?:\/\//);
});
