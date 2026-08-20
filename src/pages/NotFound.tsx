import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ExclamationTriangleIcon, ArrowLeftIcon, HomeIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';

/**
 * 404 page for unknown in-app routes. Renders inside the protected Layout so an
 * authenticated user keeps the nav and can recover. This deliberately replaces
 * the old catch-all redirect to /onboarding, which silently masked dead links
 * by dumping authenticated users back on onboarding.
 */
export function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
          <ExclamationTriangleIcon className="w-8 h-8 text-amber-400" />
        </div>
        <p className="text-5xl font-bold text-white">404</p>
        <h1 className="text-xl font-semibold text-white mt-3">Page not found</h1>
        <p className="text-slate-400 mt-2">
          We couldn't find{' '}
          <span className="text-slate-300 font-mono break-all">{location.pathname}</span>.
          It may have been moved or never existed.
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            variant="secondary"
            leftIcon={<ArrowLeftIcon className="w-4 h-4" />}
            onClick={() => navigate(-1)}
          >
            Go back
          </Button>
          <Link to="/">
            <Button variant="primary" leftIcon={<HomeIcon className="w-4 h-4" />}>
              Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
