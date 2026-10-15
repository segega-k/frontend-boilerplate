// Runtime and type-level contract of the error mapping (port of xRocket `errors/types.ts`).

export type ResponseDisplayType = 'toast' | 'modal' | 'custom' | 'silent';
export type ResponseSeverity = 'error' | 'warning' | 'info' | 'success';

export interface ResponseMappingEntry<V extends string> {
  variants: readonly V[];
  type: ResponseDisplayType;
  severity: ResponseSeverity;
  i18n?: { readonly title: string; readonly subtitle?: string };
  support?: boolean;
}

export interface EndpointResponseMapping<V extends string> {
  responses: readonly ResponseMappingEntry<V>[];
}

/** One service: schemaPath → responses. Runtime key is `service` + `schemaPath` (fixes the xRocket spread merge). */
export type ServiceMappings = Record<string, EndpointResponseMapping<string>>;

/** Result of the lookup before translation. */
export interface RawResolution {
  type: ResponseDisplayType;
  severity: ResponseSeverity;
  translationKey: string;
  subtitleTranslationKey?: string;
  support?: boolean;
  /** true when matched through the `METHOD_ERR` catch-all. */
  isErrorFallback?: boolean;
}

export interface ResolvedResponse {
  type: ResponseDisplayType;
  severity: ResponseSeverity;
  title: string;
  subtitle?: string;
  support?: boolean;
}

// ── Type level: variants derived from openapi-typescript `paths` ──
// Difference from xRocket: status comes from the response key (not from body.status) and any JSON-ish media type
// counts (`application/problem+json` is what our backends send). No `string` fallback: every backend speaks
// problem+json with a literal `type` (user decision 17), so an untyped response is covered only by `ERR`.

type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'patch';
type SuccessStatus = 200 | 201 | 202 | 204;
type BodyOf<R> = R extends { content: infer C } ? C[keyof C] : never;
type ProblemTypeOf<B> = B extends { type: infer U extends string } ? U : never;

type ErrorVariantsOfMethod<Op, M extends string> = Op extends { responses: infer R }
  ? {
      [K in Exclude<keyof R, SuccessStatus>]: K extends number
        ? `${Uppercase<M>}_${K}_${ProblemTypeOf<BodyOf<R[K]>>}`
        : never;
    }[Exclude<keyof R, SuccessStatus>]
  : never;

type SuccessVariantsOfMethod<Op, M extends string> = Op extends { responses: infer R }
  ? `${Uppercase<M>}_${SuccessStatus & keyof R}`
  : never;

export type VariantsOf<Paths, Path extends keyof Paths> = {
  [M in HttpMethod & keyof Paths[Path]]: Paths[Path][M] extends infer Op
    ? [Op] extends [undefined | never]
      ? never
      :
          | ErrorVariantsOfMethod<NonNullable<Op>, M>
          | SuccessVariantsOfMethod<NonNullable<Op>, M>
          | `${Uppercase<M>}_ERR`
          | `${Uppercase<M>}_NET`
    : never;
}[HttpMethod & keyof Paths[Path]];
