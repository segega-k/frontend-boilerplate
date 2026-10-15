import type { RawResolution } from '../errors/types.ts';
import type { ErrorKind, LoadingStatus } from '../query/MobxQuery.ts';
import type { Translate } from '../runtime.ts';

export interface PageQueryRef {
  readonly status: LoadingStatus;
  readonly rawResolution: RawResolution | null;
  readonly errorKind: ErrorKind;
  refetch(): Promise<unknown>;
}

export interface GuardModal {
  kind: 'network' | 'server';
  title: string;
  subtitle: string;
  support: boolean;
  retry: () => Promise<unknown>;
}

/**
 * Headless core of xRocket `PageQueryGuard`: only queries with an error AND a `modal` resolution count; network wins
 * over server; server texts come from the mapping when it has a subtitle, otherwise generic texts. The React shell
 * (non-closable Modal, fade-out snapshot) is wave-1 kit work.
 */
export function pageQueryGuardState(queries: readonly PageQueryRef[], t: Translate): GuardModal | null {
  const failed = queries.filter((q) => q.errorKind !== null && q.rawResolution?.type === 'modal');

  if (failed.length === 0) {
    return null;
  }

  const retry = () => Promise.all(failed.map((q) => q.refetch()));
  const network = failed.find((q) => q.errorKind === 'network');

  if (network) {
    return {
      kind: 'network',
      title: t('guard.connection.title'),
      subtitle: t('guard.connection.subtitle'),
      support: false,
      retry,
    };
  }

  const raw = failed[0]?.rawResolution;
  const fromMapping = Boolean(raw?.subtitleTranslationKey);

  return {
    kind: 'server',
    title: fromMapping && raw ? t(raw.translationKey) : t('guard.server.title'),
    subtitle: fromMapping && raw?.subtitleTranslationKey ? t(raw.subtitleTranslationKey) : t('guard.server.subtitle'),
    support: Boolean(raw?.support),
    retry,
  };
}
