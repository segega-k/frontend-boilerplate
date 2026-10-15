import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, relative, sep } from 'node:path';
import { readJson, stableJson, writeFileAtomic } from './fsx.ts';
import { flattenAll, readAll, setText, varsOf, type Issue } from './i18n.ts';
import { API_ERRORS_NS, listServices, mappingFile, specFile, type Project } from './project.ts';
import { listSpecOperations, type HttpMethod, type SpecOperation } from './spec.ts';

// ajv ships CommonJS; the 2020-12 build is needed for `$defs`/`if-then`.
const require = createRequire(import.meta.url);
const Ajv2020 = require('ajv/dist/2020').default as new (opts: object) => {
  compile: (schema: object) => ((data: unknown) => boolean) & { errors?: { instancePath: string; message?: string }[] | null };
};

export type DisplayType = 'toast' | 'modal' | 'custom' | 'silent';
export type Severity = 'error' | 'warning' | 'info' | 'success';

export interface MappingResponse {
  variants: string[];
  type: DisplayType;
  severity: Severity;
  support?: boolean;
  i18n?: { title: string; subtitle?: string };
  params?: string[];
  draft?: boolean;
  comment?: string;
}

export interface MappingOperation {
  path: string;
  method: HttpMethod;
  responses: MappingResponse[];
}

export interface MappingFile {
  $schema?: string;
  service: string;
  spec: string;
  operations: Record<string, MappingOperation>;
}

export function loadMapping(p: Project, svc: string): MappingFile | null {
  const file = mappingFile(p, svc);

  return existsSync(file) ? readJson<MappingFile>(file) : null;
}

export function saveMapping(p: Project, mapping: MappingFile): void {
  writeFileAtomic(p.root, mappingFile(p, mapping.service), stableJson(mapping), p.allow);
}

export function loadSpecOperations(p: Project, svc: string): SpecOperation[] {
  return listSpecOperations(readJson(specFile(p, svc)));
}

export function emptyMapping(p: Project, svc: string): MappingFile {
  const rel = (to: string) => relative(dirname(mappingFile(p, svc)), to).split(sep).join('/');

  return { $schema: rel(p.schemaFile), service: svc, spec: rel(specFile(p, svc)), operations: {} };
}

let validator: ReturnType<InstanceType<typeof Ajv2020>['compile']> | null = null;

export function validateSchema(p: Project, mapping: unknown): Issue[] {
  validator ??= new Ajv2020({ allErrors: true, strict: false }).compile(readJson(p.schemaFile));

  if (validator(mapping)) return [];

  return (validator.errors ?? []).map((e) => ({
    level: 'error' as const,
    code: 'SCHEMA',
    message: `${e.instancePath || '/'} ${e.message ?? 'is invalid'}`,
  }));
}

const isSuccess = (v: string): boolean => /^2\d\d$/.test(v);
const FATAL_MARKERS = [/blocked|banned/i, /maintenance/i];

/**
 * errors:check — the gate. Errors fail CI:
 * schema; every spec operation mapped; each has ERR, NET and a 2xx variant; variants ⊆ spec; no variant twice;
 * every text key exists in every locale; `params` equal the `{{vars}}` of the texts.
 */
export function checkMappings(p: Project, services = listServices(p)): Issue[] {
  const issues: Issue[] = [];
  const texts = flattenAll(readAll(p, API_ERRORS_NS), p.locales);

  for (const svc of services) {
    const mapping = loadMapping(p, svc);
    const specOps = loadSpecOperations(p, svc);

    if (!mapping) {
      issues.push({ level: 'error', code: 'NO_MAPPING_FILE', service: svc, message: `${svc}: mapping file is missing` });
      continue;
    }

    const schemaIssues = validateSchema(p, mapping).map((i) => ({ ...i, service: svc }));

    issues.push(...schemaIssues);
    if (schemaIssues.length > 0) continue;

    const byId = new Map(specOps.map((o) => [o.operationId, o]));

    for (const op of specOps) {
      const m = mapping.operations[op.operationId];
      const where = { service: svc, operationId: op.operationId };

      if (!m) {
        issues.push({ level: 'error', code: 'NO_MAPPING', ...where, message: `${svc}.${op.operationId} (${op.method.toUpperCase()} ${op.path}) has no mapping` });
        continue;
      }

      const variants = m.responses.flatMap((r) => r.variants);

      if (!variants.includes('ERR')) issues.push({ level: 'error', code: 'MISSING_ERR', ...where, message: `${svc}.${op.operationId} lacks an ERR variant` });
      if (!variants.includes('NET')) issues.push({ level: 'error', code: 'MISSING_NET', ...where, message: `${svc}.${op.operationId} lacks a NET variant` });
      if (!variants.some(isSuccess)) issues.push({ level: 'error', code: 'MISSING_2XX', ...where, message: `${svc}.${op.operationId} lacks a 2xx variant (explicit silent counts)` });

      const seen = new Set<string>();

      for (const v of variants) {
        if (seen.has(v)) issues.push({ level: 'error', code: 'DUPLICATE_VARIANT', ...where, message: `${svc}.${op.operationId}: variant ${v} is mapped twice` });
        seen.add(v);
        if (v !== 'ERR' && v !== 'NET' && !op.variants.includes(v)) {
          issues.push({ level: 'error', code: 'UNKNOWN_VARIANT', ...where, message: `${svc}.${op.operationId}: variant ${v} is not in the spec` });
        }
      }

      if (m.path !== op.path || m.method !== op.method) {
        issues.push({ level: 'error', code: 'OPERATION_MOVED', ...where, message: `${svc}.${op.operationId}: mapping says ${m.method.toUpperCase()} ${m.path}, spec says ${op.method.toUpperCase()} ${op.path}` });
      }

      for (const v of op.variants) {
        if (!isSuccess(v) && !seen.has(v)) {
          issues.push({ level: 'info', code: 'FALLS_TO_ERR', ...where, message: `${svc}.${op.operationId}: ${v} is handled by ERR` });
        }
      }

      for (const r of m.responses) {
        const keys = [r.i18n?.title, r.i18n?.subtitle].filter((k): k is string => Boolean(k));
        const vars = new Set<string>();

        for (const key of keys) {
          const leaf = texts.get(key);

          for (const l of p.locales) {
            const text = leaf?.[l];

            if (typeof text !== 'string' || text === '') {
              issues.push({ level: 'error', code: 'MISSING_TEXT', ...where, key, locale: l, message: `${svc}.${op.operationId}: ${API_ERRORS_NS}:${key} is missing in ${l}` });
            } else for (const v of varsOf(text)) vars.add(v);
          }
        }

        const declared = [...(r.params ?? [])].sort();
        const used = [...vars].sort();

        if (keys.length > 0 && declared.join(',') !== used.join(',')) {
          issues.push({ level: 'error', code: 'PARAMS_MISMATCH', ...where, message: `${svc}.${op.operationId}: params ${JSON.stringify(declared)} ≠ {{vars}} ${JSON.stringify(used)}` });
        }
        if (r.type !== 'silent' && r.variants.some((v) => FATAL_MARKERS.some((re) => re.test(v)))) {
          issues.push({ level: 'warning', code: 'FATAL_NOT_SILENT', ...where, message: `${svc}.${op.operationId}: banned/maintenance variants should be silent (the fatal screen covers them)` });
        }
        if (r.draft) issues.push({ level: 'info', code: 'DRAFT', ...where, message: `${svc}.${op.operationId}: ${r.variants.join(', ')} is a draft` });
      }
    }

    for (const id of Object.keys(mapping.operations)) {
      if (!byId.has(id)) issues.push({ level: 'error', code: 'STALE_OPERATION', service: svc, operationId: id, message: `${svc}.${id} is mapped but not in the spec` });
    }
  }

  return issues;
}

// ── edits (errors:add / errors:set / errors:sync) ──

export function camelKey(text: string): string {
  const words = text.replace(/\{\{\s*\w+\s*\}\}/g, ' ').normalize('NFKD').replace(/[^\w\s]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 10);

  return words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0]!.toUpperCase() + w.slice(1).toLowerCase())).join('');
}

/**
 * Text key for a new English text: reuse a key with the same English text, else camelCase of the text (xRocket
 * convention) — without numeric suffixes: an equal key with another text is an error, pass an explicit key.
 */
export function suggestKey(p: Project, en: string): { key: string; reused: boolean } {
  const texts = flattenAll(readAll(p, API_ERRORS_NS), p.locales);

  for (const [key, leaf] of texts) if (leaf.en === en) return { key, reused: true };

  const key = camelKey(en);
  const clash = texts.get(key);

  if (clash) throw new Error(`Key "${key}" already holds another text ("${String(clash.en)}"); pass --title <key>`);

  return { key, reused: false };
}

export interface TextInput {
  key?: string;
  values?: Record<string, string>;
}

function resolveText(p: Project, input: TextInput | undefined, draft: boolean): string | undefined {
  if (!input || (!input.key && !input.values)) return undefined;

  const en = input.values?.en;
  const key = input.key ?? (en ? suggestKey(p, en).key : undefined);

  if (!key) throw new Error('A text needs --title <key> or --title-en <text>');
  if (input.values && Object.keys(input.values).length > 0) setText(p, API_ERRORS_NS, key, input.values, draft);

  return key;
}

export interface AddInput {
  service: string;
  operationId: string;
  variants: string[];
  type: DisplayType;
  severity: Severity;
  support?: boolean;
  title?: TextInput;
  subtitle?: TextInput;
  params?: string[];
  draft?: boolean;
  comment?: string;
}

export function addResponse(p: Project, input: AddInput): MappingResponse {
  const mapping = loadMapping(p, input.service) ?? emptyMapping(p, input.service);
  const specOp = loadSpecOperations(p, input.service).find((o) => o.operationId === input.operationId);

  if (!specOp) throw new Error(`${input.service}.${input.operationId} is not in the spec`);

  for (const v of input.variants) {
    if (v !== 'ERR' && v !== 'NET' && !specOp.variants.includes(v)) throw new Error(`Variant ${v} is not in the spec of ${input.operationId}`);
  }

  const op = (mapping.operations[input.operationId] ??= { path: specOp.path, method: specOp.method, responses: [] });
  const taken = op.responses.flatMap((r) => r.variants).filter((v) => input.variants.includes(v));

  if (taken.length > 0) throw new Error(`Already mapped: ${taken.join(', ')} (use errors:set)`);

  const draft = Boolean(input.draft);
  const title = resolveText(p, input.title, draft);
  const subtitle = resolveText(p, input.subtitle, draft);
  const response: MappingResponse = {
    variants: input.variants,
    type: input.type,
    severity: input.severity,
    ...(input.support && { support: true }),
    ...(title && { i18n: { title, ...(subtitle && { subtitle }) } }),
    ...(input.params?.length && { params: input.params }),
    ...(draft && { draft: true }),
    ...(input.comment && { comment: input.comment }),
  };

  op.responses.push(response);
  saveMapping(p, mapping);

  return response;
}

export interface SetInput {
  service: string;
  operationId: string;
  variant: string;
  type?: DisplayType;
  severity?: Severity;
  support?: boolean;
  title?: TextInput;
  subtitle?: TextInput;
  params?: string[];
  draft?: boolean;
}

/** Changes the response entry that holds `variant`. A human edit without --draft clears the draft flag. */
export function setResponse(p: Project, input: SetInput): MappingResponse {
  const mapping = loadMapping(p, input.service);
  const r = mapping?.operations[input.operationId]?.responses.find((x) => x.variants.includes(input.variant));

  if (!mapping || !r) throw new Error(`${input.service}.${input.operationId}: no entry holds ${input.variant}`);

  const draft = Boolean(input.draft);

  if (input.type) r.type = input.type;
  if (input.type === 'silent' && !input.title) {
    delete r.i18n; // a silent entry shows nothing: drop texts so they do not count as used
    delete r.params;
  }
  if (input.severity) r.severity = input.severity;
  if (input.support !== undefined) {
    if (input.support) r.support = true;
    else delete r.support;
  }

  const title = resolveText(p, input.title, draft);
  const subtitle = resolveText(p, input.subtitle, draft);

  if (title) r.i18n = { ...r.i18n, title };
  if (subtitle && r.i18n) r.i18n.subtitle = subtitle;
  if (input.params) r.params = input.params;
  if (draft) r.draft = true;
  else delete r.draft;

  saveMapping(p, mapping);

  return r;
}

/**
 * errors:sync — scaffold for spec operations without a mapping (draft): 2xx silent, ERR toast (GET: modal),
 * NET toast (GET: modal), with the shared generic texts. Existing entries are never touched.
 */
export function syncMappings(p: Project, svc: string): string[] {
  const mapping = loadMapping(p, svc) ?? emptyMapping(p, svc);
  const added: string[] = [];

  for (const op of loadSpecOperations(p, svc)) {
    if (mapping.operations[op.operationId]) continue;

    const isGet = op.method === 'get';
    const success = op.variants.filter(isSuccess);

    mapping.operations[op.operationId] = {
      path: op.path,
      method: op.method,
      responses: [
        { variants: success.length ? success : ['200'], type: 'silent', severity: 'success', draft: true },
        { variants: ['ERR'], type: isGet ? 'modal' : 'toast', severity: 'error', support: true, i18n: { title: 'somethingWentWrong', subtitle: 'pleaseTryAgainLater' }, draft: true },
        { variants: ['NET'], type: isGet ? 'modal' : 'toast', severity: 'error', i18n: { title: 'noInternetConnection' }, draft: true },
      ],
    };
    added.push(op.operationId);
  }

  if (added.length > 0) saveMapping(p, mapping);

  return added;
}

export interface ListedEntry {
  service: string;
  operationId: string;
  method: string;
  path: string;
  variants: string[];
  type: DisplayType;
  severity: Severity;
  draft: boolean;
  textDraft: boolean;
  title?: string;
}

export function listMappings(p: Project, opts: { service?: string; draftOnly?: boolean } = {}): ListedEntry[] {
  const texts = flattenAll(readAll(p, API_ERRORS_NS), p.locales);
  const out: ListedEntry[] = [];

  for (const svc of opts.service ? [opts.service] : listServices(p)) {
    const mapping = loadMapping(p, svc);

    for (const [operationId, op] of Object.entries(mapping?.operations ?? {})) {
      for (const r of op.responses) {
        const textDraft = [r.i18n?.title, r.i18n?.subtitle].some((k) => k !== undefined && texts.get(k)?.draft === true);
        const entry: ListedEntry = {
          service: svc, operationId, method: op.method.toUpperCase(), path: op.path, variants: r.variants,
          type: r.type, severity: r.severity, draft: Boolean(r.draft), textDraft,
          ...(r.i18n?.title && { title: r.i18n.title }),
        };

        if (!opts.draftOnly || entry.draft || entry.textDraft) out.push(entry);
      }
    }
  }

  return out;
}
