// Port of xRocket `errors/loadError.ts` plus the maintenance marker (new, plan §4).

interface ApiProblemBody {
  type?: string;
  status?: number;
  instance?: string;
  kind?: string;
  name?: string;
  message?: string;
  _httpStatus?: number;
}

const BANNED_MARKERS = ['blocked', 'banned'];

/** 403 + blocked/banned marker in type|name|instance|kind. Shape-agnostic (RFC 7807 or NestJS). */
export function isBannedResponse(httpStatus: number, body: unknown): boolean {
  if (httpStatus !== 403) {
    return false;
  }

  const { type, name, instance, kind } = (body ?? {}) as ApiProblemBody;
  const haystack = [type, name, instance, kind]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();

  return BANNED_MARKERS.some((marker) => haystack.includes(marker));
}

export interface MaintenanceMarker {
  /** problem+json `type` sent with 503. */
  problemType: string;
  /** legacy xRocket axios marker (`data.message`). */
  legacyMessage: string;
}

export const DEFAULT_MAINTENANCE_MARKER: MaintenanceMarker = {
  problemType: '/api/problems/maintenance',
  legacyMessage: 'PLATFORM_MAINTENANCE',
};

export function isMaintenanceResponse(
  httpStatus: number,
  body: unknown,
  marker: MaintenanceMarker = DEFAULT_MAINTENANCE_MARKER,
): boolean {
  const { type, message } = (body ?? {}) as ApiProblemBody;

  if (message === marker.legacyMessage) {
    return true;
  }

  return httpStatus === 503 && type === marker.problemType;
}

export function extractErrorContext(errorBody: unknown): { httpStatus?: number; errorCode?: string } {
  const body = (errorBody ?? {}) as ApiProblemBody;
  const lastSegment = (value: string | undefined): string | undefined => value?.split('/').filter(Boolean).pop();
  const httpStatus =
    typeof body.status === 'number' ? body.status : typeof body._httpStatus === 'number' ? body._httpStatus : undefined;
  const errorCode = lastSegment(body.instance) ?? body.kind ?? lastSegment(body.type);

  return {
    ...(httpStatus !== undefined && { httpStatus }),
    ...(errorCode !== undefined && { errorCode }),
  };
}

export function formatErrorContextMessage({ httpStatus, errorCode }: { httpStatus?: number; errorCode?: string }): string {
  const lines: string[] = [];

  if (errorCode) {
    lines.push(`Error code: ${errorCode}`);
  }
  if (httpStatus != null) {
    lines.push(`Status: ${httpStatus}`);
  }

  return lines.join('\n');
}

/** Body of a JSON response without touching the original stream. */
export async function readJsonBody(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('json')) {
    return null;
  }

  try {
    return (await response.clone().json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
