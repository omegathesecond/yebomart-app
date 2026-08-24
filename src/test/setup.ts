// Global test setup, loaded by vitest before every test file.
//
//  1. `fake-indexeddb/auto` installs an in-memory IndexedDB so Dexie (lib/db.ts)
//     works without a browser. Each test file runs in its own isolated module
//     context, so the fake DB starts empty per file; tests clear tables they use.
//  2. A `crypto.randomUUID` guard — the POS uses it for offline `localId`s. jsdom
//     does not always expose WebCrypto, so fall back to Node's implementation.
//  3. `@testing-library/jest-dom` adds DOM matchers (toBeInTheDocument, etc.)
//     for component tests.
import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}
