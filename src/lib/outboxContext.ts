import type { SyncContext, SyncQueueItem } from '@/types';

// Memory only: persisted auth UI state is never proof of a verified session.
let session: SyncContext | null = null;
let verifiedToken: string | null = null;
export const getSyncToken = () => verifiedToken;
export const getSyncContext = () => session;
export function setSyncContext(context: SyncContext | null, token?: string) {
  if (context && (!context.principalId || !context.shopId ||
    !['owner', 'staff'].includes(context.mode))) {
    throw new Error('Missing verified identity or shop for saved sales');
  }
  verifiedToken = context ? token ?? null : null;
  session = context ? Object.freeze(context) : null;
}
export function belongsToContext(item: SyncQueueItem, context: SyncContext | null) {
  return !!context && item.context?.principalId === context.principalId &&
    item.context?.mode === context.mode && item.context?.shopId === context.shopId;
}

// Call ONLY after the API has accepted this exact owner's token.
export function verifiedOwnerId(token: string): string {
  const payload = token.split('.')[1];
  const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('Missing verified owner identity');
  return claims.sub;
}
