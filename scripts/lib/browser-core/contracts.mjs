export const AUTH_STATES = Object.freeze([
  "unknown",
  "checking",
  "login-required",
  "user-action-required",
  "authenticated",
  "expired",
  "unhealthy",
]);

export const STEP_STATES = Object.freeze([
  "planned",
  "started",
  "success-confirmed",
  "ambiguous",
  "failed-before-write",
  "failed-after-write",
]);

export function assertKnownState(value, allowed, label) {
  if (!allowed.includes(value)) {
    throw new Error(`invalid-${label}: ${value}`);
  }
  return value;
}

export function redactUrl(value) {
  if (!value) return value;
  try {
    const url = new URL(value);
    for (const key of ["token", "access_token", "id_token", "code", "state", "session", "auth"]) {
      url.searchParams.delete(key);
    }
    url.hash = "";
    return url.toString();
  } catch {
    return String(value).replace(/([?&](?:token|code|state|auth|session)=[^&\s]+)/gi, "$1=[REDACTED]");
  }
}

export function normalizeError(error) {
  if (error?.code) return String(error.code);
  const message = String(error?.message ?? error ?? "unknown-error");
  const name = String(error?.name ?? "Error");
  if (/profile.*(lock|in use)/i.test(message)) return "profile-in-use";
  if (/timeout.*(url|navigation)/i.test(message)) return "navigation-timeout";
  if (/timeout/i.test(message)) return "timeout";
  if (/ambiguous/i.test(message)) return "selector-ambiguous";
  if (/selector/i.test(message)) return "selector-failure";
  if (/target closed|browser has been closed/i.test(message)) return "browser-closed";
  return name === "Error" ? "automation-error" : name;
}
