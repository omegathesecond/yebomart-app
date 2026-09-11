/// <reference types="vite/client" />

/**
 * Declaring the build env explicitly turns a typo in an env var name into a
 * compile error instead of an `undefined` that only surfaces at runtime. The
 * YeboID endpoints are non-optional on purpose — lib/yeboid.ts throws at module
 * load when one is missing rather than falling back to another environment.
 */
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_YEBOID_CLIENT_ID: string;
  readonly VITE_YEBOID_AUTH_URL: string;
  readonly VITE_YEBOID_TOKEN_URL: string;
  readonly VITE_YEBOID_USERINFO_URL: string;
  /** Optional — defaults to `${window.location.origin}/auth/callback`. */
  readonly VITE_YEBOID_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
