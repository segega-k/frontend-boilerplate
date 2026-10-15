import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readJson } from '../src/fsx.ts';
import type { MappingFile } from '../src/mapping.ts';

const ROOT = resolve(import.meta.dirname, '../../..');
const CLI = join(ROOT, 'packages/devtools-core/src/cli.ts');
let dir = '';

function cli(...args: string[]): { code: number; out: Record<string, unknown> } {
  const r = spawnSync(process.execPath, [CLI, ...args, '--json', '--root', dir], { encoding: 'utf8' });

  try {
    return { code: r.status ?? -1, out: JSON.parse(r.stdout) as Record<string, unknown> };
  } catch {
    throw new Error(`not JSON (code ${r.status}): ${r.stdout}\n${r.stderr}`);
  }
}

const codes = (out: Record<string, unknown>) =>
  (out.issues as { level: string; code: string }[]).filter((i) => i.level === 'error').map((i) => i.code);
const walletFile = () => join(dir, 'examples/sample-backend/src/mappings/wallet.json');
const editWallet = (fn: (m: MappingFile) => void) => {
  const m = readJson<MappingFile>(walletFile());

  fn(m);
  writeFileSync(walletFile(), JSON.stringify(m, null, 2));
};

beforeEach(() => {
  // A throwaway copy of the project inside a temp dir (the CLI never touches the committed files in tests).
  dir = mkdtempSync(join(tmpdir(), 'devtools-cli-'));
  cpSync(join(ROOT, 'devtools.config.json'), join(dir, 'devtools.config.json'));
  for (const sub of [
    'packages/api/src/errors/mapping.schema.json',
    'examples/sample-backend/specs',
    'examples/sample-backend/src/mappings',
    'examples/sample-backend/translations',
  ]) {
    cpSync(join(ROOT, sub), join(dir, sub), { recursive: true });
  }
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe('errors:check', () => {
  it('passes on the committed state', () => {
    const { code, out } = cli('errors:check');

    expect(code).toBe(0);
    expect(out.summary).toMatchObject({ errors: 0 });
  });

  it.each([
    ['ERR', 'MISSING_ERR'],
    ['NET', 'MISSING_NET'],
    ['200', 'MISSING_2XX'],
  ])('fails when an operation lacks %s', (variant, code) => {
    editWallet((m) => {
      const op = m.operations.createTransfer!;

      op.responses = op.responses.filter((r) => !r.variants.includes(variant));
    });

    const r = cli('errors:check');

    expect(r.code).toBe(1);
    expect(codes(r.out)).toContain(code);
  });

  it('fails when a text key is missing in a locale', () => {
    const all = join(dir, 'examples/sample-backend/translations/all/apiErrors.json');
    const json = readJson<Record<string, Record<string, string>>>(all);

    delete json.transferSent!.ru;
    writeFileSync(all, JSON.stringify(json, null, 2));
    // split, not sync: sync merges ru/ back into all/ and would resurrect the text (the xRocket all/ trap, both ways)
    cli('i18n:split');

    const r = cli('errors:check');

    expect(r.code).toBe(1);
    expect(r.out.issues).toContainEqual(expect.objectContaining({ code: 'MISSING_TEXT', key: 'transferSent', locale: 'ru' }));
  });

  it('fails on an operation added to the spec without a mapping, on a variant not in the spec, and on a schema error', () => {
    const specPath = join(dir, 'examples/sample-backend/specs/wallet.json');
    const spec = readJson<{ paths: Record<string, unknown> }>(specPath);

    spec.paths['/api/v1/wallet/limits'] = { get: { operationId: 'getLimits', responses: { 200: { description: 'ok' } } } };
    writeFileSync(specPath, JSON.stringify(spec));
    editWallet((m) => {
      m.operations.getAsset!.responses[0]!.variants.push('410_/api/problems/gone');
    });

    expect(codes(cli('errors:check').out)).toEqual(expect.arrayContaining(['NO_MAPPING', 'UNKNOWN_VARIANT']));

    editWallet((m) => {
      (m.operations.getAsset!.responses[0] as unknown as Record<string, unknown>).type = 'popup';
    });
    expect(codes(cli('errors:check').out)).toContain('SCHEMA');
  });

  it('fails when params differ from the {{vars}} of the text', () => {
    editWallet((m) => {
      delete m.operations.createTransfer!.responses.find((r) => r.type === 'custom')!.params;
    });
    expect(codes(cli('errors:check').out)).toContain('PARAMS_MISMATCH');
  });
});

describe('errors:add / errors:set / errors:list / errors:sync', () => {
  it('agent flow: sync scaffolds a new operation as draft, add writes mapping + texts on all locales, check is green', () => {
    const specPath = join(dir, 'examples/sample-backend/specs/wallet.json');
    const spec = readJson<{ paths: Record<string, unknown> }>(specPath);

    spec.paths['/api/v1/wallet/limits'] = {
      get: {
        operationId: 'getLimits',
        responses: {
          200: { description: 'ok' },
          429: {
            description: 'Too many',
            content: { 'application/problem+json': { schema: { type: 'object', properties: { type: { const: '/api/problems/rate_limited' } } } } },
          },
        },
      },
    };
    writeFileSync(specPath, JSON.stringify(spec));

    expect(cli('errors:sync', 'wallet').out.added).toEqual(['getLimits']);

    const add = cli('errors:add', 'wallet', 'getLimits', '--variants', '429_/api/problems/rate_limited', '--type', 'toast',
      '--severity', 'warning', '--title-en', 'Too many requests, wait a minute', '--title-ru', 'Слишком много запросов, подождите минуту', '--draft');

    expect(add.code).toBe(0);
    expect(add.out.response).toMatchObject({ i18n: { title: 'tooManyRequestsWaitAMinute' }, draft: true });

    const ru = readJson<Record<string, string>>(join(dir, 'examples/sample-backend/translations/ru/apiErrors.json'));

    expect(ru.tooManyRequestsWaitAMinute).toBe('Слишком много запросов, подождите минуту');
    expect(cli('errors:check').code).toBe(0);

    const drafts = cli('errors:list', '--draft').out;

    expect((drafts.entries as { operationId: string }[]).some((e) => e.operationId === 'getLimits')).toBe(true);
    expect(drafts.draftTexts).toContain('tooManyRequestsWaitAMinute');

    // a human edit without --draft approves the entry and the text
    cli('errors:set', 'wallet', 'getLimits', '429_/api/problems/rate_limited', '--title-en', 'Too many requests, wait a minute', '--title-ru', 'Слишком много запросов. Подождите минуту');
    expect(cli('errors:list', '--draft', '--service', 'wallet').out.draftTexts).not.toContain('tooManyRequestsWaitAMinute');
  });

  it('reuses the key of an identical English text and refuses an already mapped variant', () => {
    const r = cli('errors:add', 'wallet', 'getAsset', '--variants', 'ERR', '--type', 'toast', '--severity', 'error', '--title-en', 'Asset not found');

    expect(r.code).toBe(1);
    expect(String(r.out.error)).toMatch(/Already mapped: ERR/);
  });

  it('errors:list --json lists every entry', () => {
    const entries = cli('errors:list').out.entries as unknown[];

    expect(entries.length).toBeGreaterThan(20);
  });
});

describe('i18n:* commands', () => {
  it('i18n:set writes all/ and splits; i18n:missing and i18n:check see the gap', () => {
    expect(cli('i18n:set', 'retryLater', '--en', 'Retry in {{sec}} s').code).toBe(0);

    const missing = cli('i18n:missing');

    expect(missing.code).toBe(1);
    expect(missing.out.missing).toEqual([{ ns: 'apiErrors', key: 'retryLater', locale: 'ru' }]);

    cli('i18n:set', 'retryLater', '--ru', 'Повторите через {{seconds}} с');
    expect(cli('i18n:check').out.issues).toContainEqual(expect.objectContaining({ code: 'VARS_MISMATCH', key: 'retryLater' }));
  });

  it('i18n:check catches split files edited by hand; i18n:sync merges them back', () => {
    const en = join(dir, 'examples/sample-backend/translations/en/apiErrors.json');

    writeFileSync(en, readFileSync(en, 'utf8').replace('Transfer sent', 'Transfer is sent'));
    expect(cli('i18n:check').out.issues).toContainEqual(expect.objectContaining({ code: 'OUT_OF_SYNC', locale: 'en' }));
    cli('i18n:sync');
    expect(cli('i18n:check').code).toBe(0);
    expect(readJson<Record<string, { en: string }>>(join(dir, 'examples/sample-backend/translations/all/apiErrors.json')).transferSent?.en).toBe('Transfer is sent');
  });

  it('refuses unknown locales (only en and ru are enabled)', () => {
    const r = cli('i18n:set', 'x', '--en', 'X', '--ru', 'Х', '--ns', 'apiErrors');

    expect(r.code).toBe(0);
    expect(spawnSync(process.execPath, [CLI, 'i18n:set', 'x', '--zh', '叉', '--root', dir]).status).toBe(1);
  });
});
