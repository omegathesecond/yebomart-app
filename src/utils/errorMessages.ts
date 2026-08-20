/**
 * AI assistant error formatter.
 *
 * Maps an API/network error from the AI chat endpoint to a SHORT, HONEST,
 * user-facing explanation of the failure. The returned text is ALWAYS rendered
 * as a visible error state (red error bubble) in the chat — never as a normal
 * assistant reply (see AIChat.tsx). The wording must therefore read as a
 * *failure*, not as in-character chat: genuine outages (500s, "not available",
 * network drops) must NOT be disguised as cheerful answers, or users will think
 * the system is working when it is broken.
 */

interface ErrorPattern {
  match: (message: string) => boolean;
  response: (message: string, context?: { shopName?: string; assistantName?: string }) => string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Upgrade required — the feature exists but the plan doesn't include it.
  {
    match: (msg) => msg.includes('requires an upgraded plan') || msg.includes('upgrade'),
    response: (msg) => {
      const tier = msg.match(/Current:\s*(\w+)/i)?.[1] || 'FREE';
      return `This feature isn't included in your current plan (${tier}). Upgrade in Settings to unlock AI stock predictions, advanced analytics and more.`;
    }
  },

  // Rate limiting
  {
    match: (msg) => msg.includes('rate limit') || msg.includes('too many requests'),
    response: () => `Too many requests in a short time. Please wait a few seconds and try again.`
  },

  // Quota exceeded
  {
    match: (msg) => msg.includes('quota') || msg.includes('limit reached'),
    response: () => `You've used up your AI chat quota for this billing period. Upgrade in Settings > Subscription to keep going.`
  },

  // Authentication errors
  {
    match: (msg) => msg.includes('unauthorized') || msg.includes('authentication') || msg.includes('session expired'),
    response: () => `Your session expired. Please log out and log back in, then try again.`
  },

  // Network errors
  {
    match: (msg) => msg.includes('network') || msg.includes('connection') || msg.includes('offline'),
    response: () => `Couldn't reach the AI service. Check your internet connection and try again.`
  },

  // Server errors
  {
    match: (msg) => msg.includes('server error') || msg.includes('500') || msg.includes('internal error'),
    response: () => `The AI service hit a server error and couldn't answer. Please try again in a moment.`
  },

  // Feature not available — surface honestly, do NOT pretend it's "coming soon".
  {
    match: (msg) => msg.includes('not available') || msg.includes('coming soon'),
    response: () => `The AI assistant isn't available right now. Please try again later.`
  },

  // Maintenance
  {
    match: (msg) => msg.includes('maintenance') || msg.includes('temporarily unavailable'),
    response: () => `The AI service is temporarily down for maintenance. Please try again in a few minutes.`
  },
];

/**
 * Turn a raw API/network error string into an honest, user-facing failure
 * message. Always framed as an error — never as a successful answer.
 */
export function getSmartErrorResponse(
  error: string,
  context?: { shopName?: string; assistantName?: string }
): string {
  const lowerError = error.toLowerCase();

  for (const pattern of ERROR_PATTERNS) {
    if (pattern.match(lowerError)) {
      return pattern.response(error, context);
    }
  }

  // Default — surface the real error verbatim rather than inventing a reply.
  return `That request failed: ${error}. Please try again, and contact support if it keeps happening.`;
}

/**
 * Check if an error should show an upgrade prompt
 */
export function isUpgradeError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return lowerError.includes('upgrade') ||
         lowerError.includes('requires') && lowerError.includes('plan') ||
         lowerError.includes('quota') ||
         lowerError.includes('limit reached');
}
