/**
 * Smart error message processor for AI assistant
 * Maps API errors to helpful, contextual responses
 */

interface ErrorPattern {
  match: (message: string) => boolean;
  response: (message: string, context?: { shopName?: string; assistantName?: string }) => string;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // Upgrade required errors
  {
    match: (msg) => msg.includes('requires an upgraded plan') || msg.includes('upgrade'),
    response: (msg, ctx) => {
      const tier = msg.match(/Current:\s*(\w+)/i)?.[1] || 'FREE';
      return `✨ Oops! This feature needs a plan upgrade.\n\nYou're currently on the **${tier}** plan. To unlock this and other premium features like:\n• AI-powered stock predictions\n• Advanced sales analytics\n• Priority support\n\nTap the **Settings** tab and check out our upgrade options! 🚀`;
    }
  },
  
  // Rate limiting
  {
    match: (msg) => msg.includes('rate limit') || msg.includes('too many requests'),
    response: () => `Whoa, slow down! 😅 You're asking questions faster than I can think!\n\nGive me a few seconds and try again.`
  },
  
  // Quota exceeded
  {
    match: (msg) => msg.includes('quota') || msg.includes('limit reached'),
    response: (msg, ctx) => `You've used up your AI chat quota for this period. 📊\n\nUpgrade your plan to get unlimited conversations with me! Check **Settings > Subscription** to see your options.`
  },
  
  // Authentication errors
  {
    match: (msg) => msg.includes('unauthorized') || msg.includes('authentication') || msg.includes('session expired'),
    response: () => `Hmm, looks like your session expired. 🔐\n\nPlease log out and log back in to continue chatting with me!`
  },
  
  // Network errors
  {
    match: (msg) => msg.includes('network') || msg.includes('connection') || msg.includes('offline'),
    response: () => `I can't reach my brain right now! 🌐\n\nCheck your internet connection and try again.`
  },
  
  // Server errors
  {
    match: (msg) => msg.includes('server error') || msg.includes('500') || msg.includes('internal error'),
    response: (_, ctx) => `Oops! Something went wrong on my end. 🔧\n\nDon't worry, our team has been notified. Try again in a moment!`
  },
  
  // Feature not available
  {
    match: (msg) => msg.includes('not available') || msg.includes('coming soon'),
    response: (msg) => `This feature is coming soon! 🚧\n\nWe're working hard to bring you more capabilities. Stay tuned!`
  },
  
  // No data/empty results
  {
    match: (msg) => msg.includes('no data') || msg.includes('no results') || msg.includes('not found'),
    response: () => `I couldn't find any data for that. 📭\n\nThis might be because:\n• No sales recorded yet for that period\n• No matching products found\n• The data hasn't been synced yet\n\nTry a different query or check back later!`
  },
  
  // Maintenance
  {
    match: (msg) => msg.includes('maintenance') || msg.includes('temporarily unavailable'),
    response: () => `I'm taking a quick nap for maintenance! 😴\n\nI'll be back shortly. Try again in a few minutes.`
  },
];

/**
 * Process an API error and return a user-friendly response
 */
export function getSmartErrorResponse(
  error: string,
  context?: { shopName?: string; assistantName?: string }
): string {
  const lowerError = error.toLowerCase();
  
  // Find matching pattern
  for (const pattern of ERROR_PATTERNS) {
    if (pattern.match(lowerError)) {
      return pattern.response(error, context);
    }
  }
  
  // Default fallback
  return `Sorry, I ran into an issue: "${error}"\n\nPlease try again or rephrase your question. If the problem persists, contact support.`;
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
