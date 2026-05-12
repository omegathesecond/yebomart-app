import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { handleCallback, consumeReturnTo, consumeBootstrap } from '@/lib/yeboid';

/**
 * /auth/callback — finishes the YeboID PKCE flow for the PWA.
 *
 * The browser handles the code → token exchange directly with api.yeboid.com
 * (no backend involvement). Then we hand the access_token to yebomart-api
 * /api/auth/yeboid/exchange along with any onboarding bootstrap fields that
 * were stashed before redirect.
 *
 * `ranRef` guards against React StrictMode's double-mount in dev — we MUST
 * consume the code_verifier exactly once.
 */
export function AuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { exchangeYeboidToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const oauthError = params.get('error');
    if (oauthError) {
      setError(params.get('error_description') || oauthError);
      return;
    }

    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) {
      setError('Missing code or state in the callback URL.');
      return;
    }

    (async () => {
      try {
        const tokens = await handleCallback(code, state);
        const bootstrap = consumeBootstrap();
        const result = await exchangeYeboidToken(tokens.access_token, bootstrap);
        if (!result.success) {
          setError(result.error ?? 'Sign-in failed');
          return;
        }
        navigate(consumeReturnTo(), { replace: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed');
      }
    })();
  }, [params, navigate, exchangeYeboidToken]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/25 mb-4">
          <ShoppingCartIcon className="w-10 h-10 text-white" />
        </div>

        {error ? (
          <>
            <h1 className="text-xl font-semibold text-white">Sign-in failed</h1>
            <p className="text-sm text-red-400 mt-2 max-w-sm mx-auto">
              {error}
            </p>
            <button
              onClick={() => navigate('/login', { replace: true })}
              className="mt-6 text-amber-400 hover:text-amber-300 text-sm"
            >
              ← Back to sign in
            </button>
          </>
        ) : (
          <>
            <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-300">Signing you in…</p>
          </>
        )}
      </div>
    </div>
  );
}
