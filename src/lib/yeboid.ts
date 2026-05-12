/**
 * YeboID OAuth2 (PKCE) — browser-side implementation for the YeboMart PWA.
 *
 * Owners sign in via YeboID's hosted phone+OTP+PIN flow. Staff use the
 * existing yebomart-internal PIN flow on /api/auth/login/user — that path is
 * NOT this module's concern.
 *
 * Pattern cloned from yeboland/frontend/src/lib/yeboid.ts (the canonical
 * Omevision web-OAuth pattern), with PWA-specific extras:
 *   - bootstrap stash: first-time-signup shop fields (shopName, businessType,
 *     assistantName, countryCode, phoneCountryCode) survive the OAuth round
 *     trip via sessionStorage so the callback page can pass them to
 *     yebomart-api /api/auth/yeboid/exchange.
 */

const CLIENT_ID =
  (import.meta.env.VITE_YEBOID_CLIENT_ID as string | undefined) ?? 'yebomart';
const REDIRECT_URI =
  (import.meta.env.VITE_YEBOID_REDIRECT_URI as string | undefined) ??
  (typeof window !== 'undefined'
    ? `${window.location.origin}/auth/callback`
    : '');
const AUTH_URL = 'https://yeboid.com/oauth/authorize';
const TOKEN_URL = 'https://api.yeboid.com/oauth/token';
const USERINFO_URL = 'https://api.yeboid.com/oauth/userinfo';

const SCOPES = 'openid profile phone email offline_access kyc';

const STORAGE = {
  accessToken: 'yebomart.accessToken',
  refreshToken: 'yebomart.refreshToken',
  expiresAt: 'yebomart.expiresAt',
  codeVerifier: 'yebomart.codeVerifier',
  oauthState: 'yebomart.oauthState',
  returnTo: 'yebomart.returnTo',
  bootstrap: 'yebomart.bootstrap',
} as const;

export interface ShopBootstrap {
  shopName?: string;
  businessType?: string;
  assistantName?: string;
  countryCode?: string;
  phoneCountryCode?: string;
}

// ---------- PKCE helpers ----------
function randomString(length: number): string {
  const chars =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

async function sha256(value: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function codeChallenge(verifier: string): Promise<string> {
  return base64UrlEncode(await sha256(verifier));
}

// ---------- Public API ----------
export interface YeboidTokens {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
}

/**
 * Full-page redirect to YeboID. Pass `bootstrap` on first-time signup so the
 * callback page can hand the shop fields to /api/auth/yeboid/exchange.
 */
export async function initiateLogin(
  options: { bootstrap?: ShopBootstrap; returnTo?: string } = {},
): Promise<void> {
  const verifier = randomString(64);
  const challenge = await codeChallenge(verifier);
  const state = randomString(32);

  localStorage.setItem(STORAGE.codeVerifier, verifier);
  localStorage.setItem(STORAGE.oauthState, state);
  if (options.returnTo) {
    sessionStorage.setItem(STORAGE.returnTo, options.returnTo);
  }
  if (options.bootstrap) {
    sessionStorage.setItem(STORAGE.bootstrap, JSON.stringify(options.bootstrap));
  } else {
    sessionStorage.removeItem(STORAGE.bootstrap);
  }

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
  });
  window.location.href = `${AUTH_URL}?${params}`;
}

/** Exchanges the auth code for tokens. Throws on failure. */
export async function handleCallback(
  code: string,
  state: string,
): Promise<YeboidTokens> {
  const savedState = localStorage.getItem(STORAGE.oauthState);
  if (!savedState || state !== savedState) {
    throw new Error('Security check failed — please try signing in again.');
  }
  const verifier = localStorage.getItem(STORAGE.codeVerifier);
  if (!verifier) {
    throw new Error('Sign-in session expired — please try again.');
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error_description?: string;
      error?: string;
    };
    throw new Error(
      err.error_description ||
        err.error ||
        `Authentication failed (${response.status})`,
    );
  }

  const tokens = (await response.json()) as YeboidTokens;
  storeTokens(tokens);

  localStorage.removeItem(STORAGE.codeVerifier);
  localStorage.removeItem(STORAGE.oauthState);

  return tokens;
}

export function consumeReturnTo(): string {
  const to = sessionStorage.getItem(STORAGE.returnTo);
  sessionStorage.removeItem(STORAGE.returnTo);
  return to || '/';
}

export function consumeBootstrap(): ShopBootstrap | undefined {
  const raw = sessionStorage.getItem(STORAGE.bootstrap);
  sessionStorage.removeItem(STORAGE.bootstrap);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as ShopBootstrap;
  } catch {
    return undefined;
  }
}

export async function fetchUserInfo(
  accessToken?: string,
): Promise<Record<string, unknown>> {
  const token = accessToken ?? localStorage.getItem(STORAGE.accessToken);
  if (!token) throw new Error('No access token — sign in first');
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`YeboID userinfo failed: ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem(STORAGE.accessToken) && !isTokenExpired();
}

export async function getAccessToken(): Promise<string | null> {
  const token = localStorage.getItem(STORAGE.accessToken);
  if (!token) return null;
  if (isTokenExpired()) return refreshAccessToken();
  return token;
}

export function getAccessTokenSync(): string | null {
  return localStorage.getItem(STORAGE.accessToken);
}

export function clearTokens(): void {
  Object.values(STORAGE).forEach((k) => localStorage.removeItem(k));
  sessionStorage.removeItem(STORAGE.returnTo);
  sessionStorage.removeItem(STORAGE.bootstrap);
}

// ---------- Internals ----------
function storeTokens(t: YeboidTokens): void {
  localStorage.setItem(STORAGE.accessToken, t.access_token);
  if (t.refresh_token) {
    localStorage.setItem(STORAGE.refreshToken, t.refresh_token);
  }
  const expiresAt = Date.now() + (t.expires_in - 60) * 1000;
  localStorage.setItem(STORAGE.expiresAt, String(expiresAt));
}

function isTokenExpired(): boolean {
  const exp = localStorage.getItem(STORAGE.expiresAt);
  if (!exp) return true;
  return Date.now() >= Number(exp);
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = localStorage.getItem(STORAGE.refreshToken);
  if (!refresh) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: CLIENT_ID,
          refresh_token: refresh,
        }),
      });
      if (!res.ok) {
        clearTokens();
        return null;
      }
      const tokens = (await res.json()) as YeboidTokens;
      storeTokens(tokens);
      return tokens.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}
