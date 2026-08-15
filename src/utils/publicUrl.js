const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

// Links we email out must open on the recipient's machine. FRONTEND_APP_URL and
// FRONTEND_RESET_PASSWORD_URL both fall back to localhost when unset, which silently
// produced invite emails pointing at http://localhost:3000/set-password. Treat an
// unparseable value as local too — it is never a usable public link.
export function isLocalUrl(value) {
  try {
    return LOCAL_HOSTNAMES.has(new URL(value).hostname);
  } catch {
    return true;
  }
}

// The env vars whose values end up inside emails, checked at boot.
export const EMAIL_LINK_SETTINGS = [
  ['FRONTEND_APP_URL', 'frontendAppUrl'],
  ['FRONTEND_RESET_PASSWORD_URL', 'frontendResetPasswordUrl'],
];
