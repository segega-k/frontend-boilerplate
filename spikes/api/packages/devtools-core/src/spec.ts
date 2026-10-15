// OpenAPI → list of operations with their response variants. Port of xrocket-tools `extractResponseEntries`
// (oneOf + discriminator, priority `type` then `name`, const → enum[0] → example).

export type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'patch';
export const HTTP_METHODS: readonly HttpMethod[] = ['get', 'put', 'post', 'delete', 'patch'];

export interface SpecOperation {
  operationId: string;
  path: string;
  method: HttpMethod;
  /** Variants without the method: "200", "400_/api/problems/x". Errors without a literal type are not listed. */
  variants: string[];
  /** Error statuses whose body has no literal `type`/`name` (only coverable by ERR). */
  untypedErrorStatuses: number[];
}

type Json = Record<string, unknown>;

function deref(spec: Json, node: unknown, seen = new Set<string>()): Json | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  const ref = (node as Json).$ref;

  if (typeof ref === 'string' && ref.startsWith('#/')) {
    if (seen.has(ref)) {
      return null;
    }
    seen.add(ref);

    let cur: unknown = spec;

    for (const part of ref.slice(2).split('/')) {
      cur = (cur as Json | undefined)?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    }

    return deref(spec, cur, seen);
  }

  return node as Json;
}

function literalOf(prop: Json | null): string | null {
  if (!prop) return null;
  if (typeof prop.const === 'string') return prop.const;
  if (Array.isArray(prop.enum) && typeof prop.enum[0] === 'string') return prop.enum[0];
  if (typeof prop.example === 'string') return prop.example;

  return null;
}

/** All literal problem types a schema can produce. */
export function problemTypesOf(spec: Json, schemaNode: unknown): string[] {
  const schema = deref(spec, schemaNode);

  if (!schema) {
    return [];
  }

  const out = new Set<string>();
  const discriminator = schema.discriminator as { propertyName?: string; mapping?: Record<string, string> } | undefined;

  if (discriminator?.mapping && (discriminator.propertyName === 'type' || discriminator.propertyName === 'name')) {
    for (const value of Object.keys(discriminator.mapping)) out.add(value);
  }

  for (const key of ['oneOf', 'anyOf', 'allOf'] as const) {
    const list = schema[key];

    if (Array.isArray(list)) {
      for (const item of list) for (const t of problemTypesOf(spec, item)) out.add(t);
    }
  }

  const props = schema.properties as Json | undefined;

  if (props) {
    const literal = literalOf(deref(spec, props.type)) ?? literalOf(deref(spec, props.name));

    if (literal) out.add(literal);
  }

  return [...out];
}

export function listSpecOperations(spec: Json): SpecOperation[] {
  const ops: SpecOperation[] = [];
  const paths = (spec.paths ?? {}) as Record<string, Json>;

  for (const [path, item] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const op = item[method] as Json | undefined;

      if (!op) continue;

      const variants: string[] = [];
      const untypedErrorStatuses: number[] = [];
      const responses = (op.responses ?? {}) as Record<string, unknown>;

      for (const [statusKey, rawResponse] of Object.entries(responses)) {
        const status = Number(statusKey);

        if (!Number.isInteger(status)) continue; // "default", "4XX"

        if (status >= 200 && status < 300) {
          variants.push(String(status));
          continue;
        }

        const response = deref(spec, rawResponse);
        const content = (response?.content ?? {}) as Record<string, Json>;
        const types = new Set<string>();

        for (const [media, body] of Object.entries(content)) {
          if (media.includes('json')) for (const t of problemTypesOf(spec, body.schema)) types.add(t);
        }

        if (types.size === 0) untypedErrorStatuses.push(status);
        for (const t of types) variants.push(`${status}_${t}`);
      }

      const operationId = typeof op.operationId === 'string' ? op.operationId : `${method}${path.replace(/\W+/g, '_')}`;

      ops.push({ operationId, path, method, variants, untypedErrorStatuses });
    }
  }

  return ops;
}
