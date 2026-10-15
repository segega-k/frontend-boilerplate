import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Where a project keeps specs, mappings and catalogs. Defaults follow the plan layout ([18 §5.2]); a project (or the
 * spike, whose data are fixtures under examples/) overrides them in `devtools.config.json` at the root.
 */
export interface ProjectConfig {
  locales: string[];
  specsDir: string;
  generatedTypesDir: string;
  mappingsDir: string;
  translationsDir: string;
  schemaFile: string;
  /** Module the generated files import the runtime types and `callApi` from. */
  apiImport: string;
}

export const DEFAULT_CONFIG: ProjectConfig = {
  locales: ['en', 'ru'],
  specsDir: 'packages/api/specs',
  generatedTypesDir: 'packages/api/src/generated',
  mappingsDir: 'packages/api/src/errors/mappings',
  translationsDir: 'packages/i18n/translations',
  schemaFile: 'packages/api/src/errors/mapping.schema.json',
  apiImport: '@repo/api',
};

export interface Project {
  root: string;
  locales: readonly string[];
  specsDir: string;
  generatedTypesDir: string;
  mappingsDir: string;
  schemaFile: string;
  translationsDir: string;
  apiImport: string;
  /** Write allowlist (root-relative, forward slashes): the only files CLI and utils may write. */
  allow: readonly RegExp[];
}

const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function project(root: string, overrides: Partial<ProjectConfig> = {}): Project {
  const file = join(root, 'devtools.config.json');
  const fromFile = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Partial<ProjectConfig>) : {};
  const c: ProjectConfig = { ...DEFAULT_CONFIG, ...fromFile, ...overrides };
  const rel = (dir: string) => relative(root, join(root, dir)).split(sep).join('/');
  const locales = c.locales.map(esc).join('|');

  return {
    root,
    locales: c.locales,
    specsDir: join(root, c.specsDir),
    generatedTypesDir: join(root, c.generatedTypesDir),
    mappingsDir: join(root, c.mappingsDir),
    translationsDir: join(root, c.translationsDir),
    schemaFile: join(root, c.schemaFile),
    apiImport: c.apiImport,
    allow: [
      new RegExp(`^${esc(rel(c.mappingsDir))}/[a-z][a-zA-Z0-9]*\\.json$`),
      new RegExp(`^${esc(rel(c.mappingsDir))}/[a-z][a-zA-Z0-9.]*\\.generated\\.ts$`),
      new RegExp(`^${esc(rel(c.generatedTypesDir))}/[a-z][a-zA-Z0-9]*\\.ts$`),
      new RegExp(`^${esc(rel(c.translationsDir))}/(all|${locales})/[a-zA-Z0-9]+\\.json$`),
    ],
  };
}

export function listServices(p: Project): string[] {
  if (!existsSync(p.specsDir)) {
    return [];
  }

  return readdirSync(p.specsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -'.json'.length))
    .sort();
}

export const specFile = (p: Project, svc: string): string => join(p.specsDir, `${svc}.json`);
export const mappingFile = (p: Project, svc: string): string => join(p.mappingsDir, `${svc}.json`);
export const generatedMappingFile = (p: Project, svc: string): string => join(p.mappingsDir, `${svc}.generated.ts`);
export const generatedTypesFile = (p: Project, svc: string): string => join(p.generatedTypesDir, `${svc}.ts`);
export const API_ERRORS_NS = 'apiErrors';
