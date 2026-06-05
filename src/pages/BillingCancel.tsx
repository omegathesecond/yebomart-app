import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { XCircleIcon } from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PENDING_TOPUP_KEY } from './Billing';

/**
 * Landing for a cancelled / abandoned YeboPay checkout. Nothing was charged.
 * Clear the stashed pending top-up so a later visit to the success page doesn't
 * try to confirm a checkout the user backed out of.
 */
export function BillingCancel() {
  useEffect(() => {
    localStorage.removeItem(PENDING_TOPUP_KEY);
  }, []);

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card className="text-center py-10 px-6">
        <XCircleIcon className="w-16 h-16 mx-auto text-slate-400 mb-4" />
        <h1 className="text-2xl font-bold text-white">Top-up cancelled</h1>
        <p className="text-slate-400 mt-2">
          No payment was taken. You can pick a credit pack and try again whenever you’re ready.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
          <Link to="/">
            <Button variant="secondary" className="w-full sm:w-auto">
              Back to Dashboard
            </Button>
          </Link>
          <Link to="/billing">
            <Button variant="primary" className="w-full sm:w-auto">
              Back to Billing
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
