import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { writeFileAtomic } from '../src/fsx.ts';
import { renderMappingTs, renderIndexTs } from '../src/generate.ts';
import { fixHomoglyphs, mergeTrees, missingKeys, splitTree, validateAll, type Tree } from '../src/i18n.ts';
import { loadMapping } from '../src/mapping.ts';
import { generatedMappingFile, project } from '../src/project.ts';
import { listSpecOperations } from '../src/spec.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const p = project(ROOT);
const L = ['en', 'ru'] as const;

describe('spec → variants (xrocket-tools extractResponseEntries port)', () => {
  it('reads const types, oneOf + discriminator mapping, and 2xx', () => {
    const ops = listSpecOperations(JSON.parse(readFileSync(join(ROOT, 'examples/sample-backend/specs/wallet.json'), 'utf8')));
    const create = ops.find((o) => o.operationId === 'createTransfer');

    expect(ops).toHaveLength(6);
    expect(create?.variants.sort()).toEqual([
      '200',
      '400_/api/problems/amount_too_small',
      '400_/api/problems/insufficient_balance',
      '409_/api/problems/duplicate_transfer',
    ]);
  });
});

describe('generator', () => {
  it('committed <svc>.generated.ts and index are up to date with the JSON (no hand edits)', () => {
    for (const svc of ['auth', 'wallet']) {
      expect(readFileSync(generatedMappingFile(p, svc), 'utf8')).toBe(renderMappingTs(p, loadMapping(p, svc)!));
    }
    expect(readFileSync(join(p.mappingsDir, 'index.generated.ts'), 'utf8')).toBe(renderIndexTs(p, ['auth', 'wallet']));
  });

  it('emits satisfies VariantsOf, I18nParams and the factories', () => {
    const ts = renderMappingTs(p, loadMapping(p, 'wallet')!);

    expect(ts).toContain('satisfies EndpointResponseMapping<VariantsOf<paths, "/api/v1/wallet/transfers">>');
    expect(ts).toContain('POST: { minAmount: string };');
    expect(ts).toContain('mutationKey: ["wallet", "post", "/api/v1/wallet/transfers"] as const');
    expect(ts).toMatch(/getBalances: \(init\?: MaybeOptionalInit/);
  });
});

describe('i18n library (sync-i18n port)', () => {
  const all: Tree = {
    a: { en: 'Hello {{name}}', ru: 'Привет {{name}}', draft: true },
    g: { b: { en: '<b>Bold</b>', ru: '<b>Жирно</b>' } },
    items_one: { en: '{{count}} item', ru: '{{count}} предмет' },
    items_other: { en: '{{count}} items', ru: '{{count}} предметов' },
  };

  it('split drops meta keys and keeps nesting; merge is its inverse', () => {
    const trees = splitTree(all, L);

    expect(trees.en).toEqual({ a: 'Hello {{name}}', g: { b: '<b>Bold</b>' }, items_one: '{{count}} item', items_other: '{{count}} items' });
    expect(mergeTrees(all, trees, L)).toEqual(all);
  });

  it('plural-aware missing: ru needs one/few/many/other', () => {
    expect(missingKeys(all, L)).toEqual([
      { key: 'items_few', locale: 'ru' },
      { key: 'items_many', locale: 'ru' },
    ]);
  });

  it('validators: vars, tags, Cyrillic in en, homoglyph autofix', () => {
    const bad: Tree = {
      v: { en: 'Pay {{amount}}', ru: 'Оплатить {{sum}}' },
      t: { en: '<b>Hi</b>', ru: '<b>Привет' },
      c: { en: 'Привет', ru: 'Привет' },
      h: { en: 'Оrder', ru: 'Заказ' }, // Cyrillic "О"
    };
    const fixed = fixHomoglyphs(bad, L);

    expect(fixed.map((f) => f.key)).toEqual(['h']);
    expect((bad.h as { en: string }).en).toBe('Order');
    expect(validateAll(bad, L, 'x').map((i) => `${i.code}:${i.key}`).sort()).toEqual([
      'CYRILLIC_IN_EN:c',
      'TAGS_MISMATCH:t',
      'TAGS_UNBALANCED:t',
      'VARS_MISMATCH:v',
    ]);
  });
});

describe('write guard', () => {
  it('refuses paths outside the project and outside the allowlist', () => {
    expect(() => writeFileAtomic(ROOT, join(ROOT, '../evil.json'), '{}', p.allow)).toThrow(/outside the project/);
    expect(() => writeFileAtomic(ROOT, join(ROOT, 'package.json'), '{}', p.allow)).toThrow(/allowlist/);
  });
});
