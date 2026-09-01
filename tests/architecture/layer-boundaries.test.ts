/// <reference types="node" />

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      return listTypeScriptFiles(path);
    }

    return entry.isFile() && (path.endsWith('.ts') || path.endsWith('.tsx'))
      ? [path]
      : [];
  });
}

function importSpecifiers(source: string): string[] {
  const patterns = [
    /\bfrom\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  return patterns.flatMap((pattern) =>
    Array.from(source.matchAll(pattern), (match) => match[1]),
  );
}

const sourceRoot = fileURLToPath(new URL('../../src/', import.meta.url));

test('domain contracts import only other domain modules', () => {
  const domainRoot = resolve(sourceRoot, 'domain');

  for (const file of listTypeScriptFiles(domainRoot)) {
    const source = readFileSync(file, 'utf8');

    for (const specifier of importSpecifiers(source)) {
      assert.ok(
        specifier.startsWith('.'),
        `${relative(sourceRoot, file)} imports forbidden dependency ${specifier}`,
      );
    }
  }
});

test('application contracts do not depend on presentation, infrastructure, React, or Expo', () => {
  const applicationRoot = resolve(sourceRoot, 'application');
  const forbiddenPackages = ['react', 'react-native'];

  for (const file of listTypeScriptFiles(applicationRoot)) {
    const source = readFileSync(file, 'utf8');

    for (const specifier of importSpecifiers(source)) {
      const forbiddenLayer =
        specifier.includes('/presentation/') || specifier.includes('/infrastructure/');
      const forbiddenPackage =
        forbiddenPackages.includes(specifier) || specifier.startsWith('expo');

      assert.equal(
        forbiddenLayer || forbiddenPackage,
        false,
        `${relative(sourceRoot, file)} imports forbidden dependency ${specifier}`,
      );
    }
  }
});

test('infrastructure adapters do not depend on presentation', () => {
  const infrastructureRoot = resolve(sourceRoot, 'infrastructure');

  for (const file of listTypeScriptFiles(infrastructureRoot)) {
    const source = readFileSync(file, 'utf8');

    for (const specifier of importSpecifiers(source)) {
      assert.equal(
        specifier.includes('/presentation/'),
        false,
        `${relative(sourceRoot, file)} imports forbidden dependency ${specifier}`,
      );
    }
  }
});

test('presentation does not access infrastructure adapters directly', () => {
  const presentationRoot = resolve(sourceRoot, 'presentation');

  for (const file of listTypeScriptFiles(presentationRoot)) {
    const source = readFileSync(file, 'utf8');

    for (const specifier of importSpecifiers(source)) {
      assert.equal(
        specifier.includes('/infrastructure/'),
        false,
        `${relative(sourceRoot, file)} imports forbidden dependency ${specifier}`,
      );
    }
  }
});
