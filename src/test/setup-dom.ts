import '@testing-library/jest-dom/vitest';

// Provide test values for the admin-dashboard auth env vars (Phase 3) so any
// test whose module graph touches env.ts satisfies the schema. The schema
// intentionally has NO defaults (fail-loud in prod); these are test-only and
// can be overridden per-file by setting process.env before module import.
process.env.DASHBOARD_PASSWORD ||= 'test-dashboard-password';
process.env.DASHBOARD_SESSION_SECRET ||= 'test-dashboard-session-secret-32chars-minimum-len';
