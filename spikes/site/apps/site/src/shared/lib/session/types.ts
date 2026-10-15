// Backend-neutral session shape. The adapter decides what goes into `credentials`
// (tokens, a backend session id, nothing at all); pages never see it.
export type SessionData = {
  subject: string;
  displayName?: string;
  credentials: Record<string, string>;
  expiresAt?: number;
};

export type SessionUser = { subject: string; displayName?: string };
