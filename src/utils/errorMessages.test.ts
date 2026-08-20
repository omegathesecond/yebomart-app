import { describe, it, expect } from 'vitest';
import { getSmartErrorResponse, isUpgradeError } from './errorMessages';

describe('getSmartErrorResponse', () => {
  it('frames a server 500 as a failure, not a cheerful reply', () => {
    const out = getSmartErrorResponse('Internal Server Error (500)');
    expect(out.toLowerCase()).toContain('server error');
    expect(out.toLowerCase()).toContain("couldn't answer");
    // Must not read as a successful, in-character answer.
    expect(out).not.toContain('🔧');
  });

  it('does NOT disguise a "not available" backend error as "coming soon"', () => {
    const out = getSmartErrorResponse('This feature is not available');
    expect(out.toLowerCase()).toContain("isn't available");
    expect(out.toLowerCase()).not.toContain('coming soon');
    expect(out).not.toContain('🚧');
  });

  it('surfaces the raw error verbatim for unrecognised failures', () => {
    const out = getSmartErrorResponse('Weird unexpected backend boom');
    expect(out).toContain('Weird unexpected backend boom');
    expect(out.toLowerCase()).toContain('failed');
  });

  it('gives actionable, honest guidance for session expiry', () => {
    const out = getSmartErrorResponse('Session expired. Please sign in again.');
    expect(out.toLowerCase()).toContain('session expired');
    expect(out.toLowerCase()).toContain('log');
  });

  it('reports the current tier for upgrade-required errors', () => {
    const out = getSmartErrorResponse('This requires an upgraded plan. Current: FREE');
    expect(out).toContain('FREE');
    expect(out.toLowerCase()).toContain('upgrade');
  });
});

describe('isUpgradeError', () => {
  it('flags upgrade and quota errors', () => {
    expect(isUpgradeError('Please upgrade your plan')).toBe(true);
    expect(isUpgradeError('Monthly quota exceeded')).toBe(true);
  });

  it('does not flag unrelated errors', () => {
    expect(isUpgradeError('Internal server error')).toBe(false);
  });
});
