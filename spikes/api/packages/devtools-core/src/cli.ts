#!/usr/bin/env node
// One CLI for agents and CI on the same library the utils site uses. Every command accepts --json (machine output on
// stdout, exit code 1 on errors) and --root <dir> (defaults to the current directory).
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { generateMappings, generateTypes } from './generate.ts';
import { checkNamespace, draftKeys, listNamespaces, missingKeys, readAll, setText, split, sync, type Issue } from './i18n.ts';
import { addResponse, checkMappings, listMappings, setResponse, syncMappings, type DisplayType, type Severity, type TextInput } from './mapping.ts';
import { API_ERRORS_NS, listServices, project } from './project.ts';

const USAGE = `usage: cli <command> [args] [--json] [--root dir]
  api:gen [svc]                          openapi-typescript types from packages/api/specs
  api:mappings:gen                       mapping JSON -> <svc>.generated.ts + index
  errors:list [--service s] [--draft]
  errors:check
  errors:sync <svc>                      draft scaffold for unmapped operations
  errors:add <svc> <operationId> --variants v1,v2 --type t --severity s [--support] [--params a,b]
             [--title key | --title-en text --title-ru text] [--subtitle key | --subtitle-en .. --subtitle-ru ..] [--draft] [--comment c]
  errors:set <svc> <operationId> <variant> [--type t] [--severity s] [--support|--no-support] [--title ...] [--draft]
  i18n:set <key> --en text --ru text [--ns apiErrors] [--draft]
  i18n:missing [--ns ns]
  i18n:check | i18n:validate [--ns ns]
  i18n:sync | i18n:split [--ns ns]`;

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  strict: true,
  options: {
    json: { type: 'boolean', default: false },
    root: { type: 'string' },
    service: { type: 'string' },
    draft: { type: 'boolean', default: false },
    ns: { type: 'string' },
    variants: { type: 'string' },
    type: { type: 'string' },
    severity: { type: 'string' },
    support: { type: 'boolean' },
    'no-support': { type: 'boolean' },
    params: { type: 'string' },
    comment: { type: 'string' },
    title: { type: 'string' },
    'title-en': { type: 'string' },
    'title-ru': { type: 'string' },
    subtitle: { type: 'string' },
    'subtitle-en': { type: 'string' },
    'subtitle-ru': { type: 'string' },
    en: { type: 'string' },
    ru: { type: 'string' },
  },
});

const [command, ...args] = positionals;
const p = project(resolve(flags.root ?? process.cwd()));
const json = flags.json;

function emit(ok: boolean, data: unknown, human: () => string): never {
  if (json) process.stdout.write(`${JSON.stringify({ ok, ...((data && typeof data === 'object') ? data : { data }) }, null, 2)}\n`);
  else process.stdout.write(`${human()}\n`);
  process.exit(ok ? 0 : 1);
}

function issuesOut(issues: Issue[]): never {
  const errors = issues.filter((i) => i.level === 'error');
  const summary = { errors: errors.length, warnings: issues.filter((i) => i.level === 'warning').length, infos: issues.filter((i) => i.level === 'info').length };

  emit(errors.length === 0, { summary, issues }, () =>
    [...issues.filter((i) => i.level !== 'info').map((i) => `${i.level.toUpperCase()} ${i.code} ${i.message}`), `${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info`].join('\n'),
  );
}

function text(prefix: 'title' | 'subtitle'): TextInput | undefined {
  const key = flags[prefix];
  const en = flags[`${prefix}-en`];
  const ru = flags[`${prefix}-ru`];
  const values: Record<string, string> = { ...(en !== undefined && { en }), ...(ru !== undefined && { ru }) };

  if (!key && Object.keys(values).length === 0) return undefined;

  return { ...(key && { key }), ...(Object.keys(values).length > 0 && { values }) };
}

const need = (value: string | undefined, name: string): string => {
  if (!value) throw new Error(`Missing ${name}\n${USAGE}`);

  return value;
};

const namespaces = (): string[] => (flags.ns ? [flags.ns] : listNamespaces(p));

async function main(): Promise<void> {
  switch (command) {
    case 'api:gen': {
      const services = args[0] ? [args[0]] : listServices(p);

      for (const svc of services) await generateTypes(p, svc);
      emit(true, { services }, () => `generated types: ${services.join(', ')}`);
    }
    case 'api:mappings:gen': {
      const services = generateMappings(p);

      emit(true, { services }, () => `generated mappings: ${services.join(', ')}`);
    }
    case 'errors:check':
      issuesOut([...checkMappings(p), ...checkNamespace(p, API_ERRORS_NS)]);
    case 'errors:list': {
      const entries = listMappings(p, { ...(flags.service && { service: flags.service }), draftOnly: flags.draft });
      const draftTexts = flags.draft ? draftKeys(readAll(p, API_ERRORS_NS), p.locales) : [];

      emit(true, { entries, ...(flags.draft && { draftTexts }) }, () =>
        [
          ...entries.map((e) => `${e.service}.${e.operationId} ${e.method} ${e.path} [${e.variants.join(', ')}] ${e.type}/${e.severity}${e.title ? ` ${e.title}` : ''}${e.draft || e.textDraft ? ' (draft)' : ''}`),
          ...draftTexts.map((k) => `draft text: ${API_ERRORS_NS}:${k}`),
        ].join('\n'),
      );
    }
    case 'errors:sync': {
      const svc = need(args[0], '<svc>');
      const added = syncMappings(p, svc);

      emit(true, { service: svc, added }, () => (added.length ? `scaffolded (draft): ${added.join(', ')}` : 'nothing to add'));
    }
    case 'errors:add': {
      const response = addResponse(p, {
        service: need(args[0], '<svc>'),
        operationId: need(args[1], '<operationId>'),
        variants: need(flags.variants, '--variants').split(',').map((s) => s.trim()),
        type: need(flags.type, '--type') as DisplayType,
        severity: need(flags.severity, '--severity') as Severity,
        ...(flags.support && { support: true }),
        ...(flags.params && { params: flags.params.split(',').map((s) => s.trim()) }),
        ...(text('title') && { title: text('title') }),
        ...(text('subtitle') && { subtitle: text('subtitle') }),
        draft: flags.draft,
        ...(flags.comment && { comment: flags.comment }),
      });

      emit(true, { response }, () => `added ${response.variants.join(', ')} → ${response.type}`);
    }
    case 'errors:set': {
      const response = setResponse(p, {
        service: need(args[0], '<svc>'),
        operationId: need(args[1], '<operationId>'),
        variant: need(args[2], '<variant>'),
        ...(flags.type && { type: flags.type as DisplayType }),
        ...(flags.severity && { severity: flags.severity as Severity }),
        ...(flags.support && { support: true }),
        ...(flags['no-support'] && { support: false }),
        ...(flags.params && { params: flags.params.split(',').map((s) => s.trim()) }),
        ...(text('title') && { title: text('title') }),
        ...(text('subtitle') && { subtitle: text('subtitle') }),
        draft: flags.draft,
      });

      emit(true, { response }, () => `updated ${response.variants.join(', ')} → ${response.type}`);
    }
    case 'i18n:set': {
      const ns = flags.ns ?? API_ERRORS_NS;
      const key = need(args[0], '<key>');
      const leaf = setText(p, ns, key, { ...(flags.en !== undefined && { en: flags.en }), ...(flags.ru !== undefined && { ru: flags.ru }) }, flags.draft);

      emit(true, { ns, key, leaf }, () => `${ns}:${key} saved`);
    }
    case 'i18n:missing': {
      const missing = namespaces().flatMap((ns) => missingKeys(readAll(p, ns), p.locales).map((m) => ({ ns, ...m })));

      emit(missing.length === 0, { missing }, () => missing.map((m) => `${m.ns}:${m.key} [${m.locale}]`).join('\n') || 'nothing missing');
    }
    case 'i18n:check':
    case 'i18n:validate':
      issuesOut(namespaces().flatMap((ns) => checkNamespace(p, ns)));
    case 'i18n:sync': {
      const fixed = namespaces().flatMap((ns) => sync(p, ns).fixed);

      emit(true, { fixed }, () => `synced ${namespaces().join(', ')}${fixed.length ? `; ${fixed.length} homoglyph fix(es)` : ''}`);
    }
    case 'i18n:split': {
      for (const ns of namespaces()) split(p, ns);
      emit(true, { namespaces: namespaces() }, () => `split ${namespaces().join(', ')}`);
    }
    default:
      emit(false, { error: `unknown command: ${command ?? '(none)'}` }, () => USAGE);
  }
}

main().catch((error: unknown) => {
  emit(false, { error: error instanceof Error ? error.message : String(error) }, () => `error: ${error instanceof Error ? error.message : String(error)}`);
});
