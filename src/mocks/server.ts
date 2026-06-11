import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/**
 * MSW Node.js server for integration tests.
 *
 * Usage in test files:
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 */
export const server = setupServer(...handlers);
