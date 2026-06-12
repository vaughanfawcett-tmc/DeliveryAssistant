import '@testing-library/jest-dom/vitest';

// Provide test values for the admin-dashboard auth env vars (Phase 3) so any
// test whose module graph touches env.ts satisfies the schema. The schema
// intentionally has NO defaults (fail-loud in prod); these are test-only and
// can be overridden per-file by setting process.env before module import.
process.env.DASHBOARD_PASSWORD ||= 'test-dashboard-password';
process.env.DASHBOARD_SESSION_SECRET ||= 'test-dashboard-session-secret-32chars-minimum-len';
// Phase 4 voice env stub — schema enforces .min(32); mock-aware (PALLEX_MOCK=true by default in tests)
process.env.VOICE_WEBHOOK_SECRET ||= 'test-voice-webhook-secret-32chars-minimum-xx';
// Required infrastructure env stubs so any test touching env.ts validates cleanly.
// These mirror the .env.example placeholders; tests that need specific values override them.
process.env.PALLEX_MOCK ||= 'true';
process.env.PALLEX_BASE_URL ||= 'https://mock.pallex.test';
process.env.SUPABASE_URL ||= 'https://mock.supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'mock-supabase-service-role-key-test';
process.env.UPSTASH_REDIS_REST_URL ||= 'https://mock.upstash.test';
process.env.UPSTASH_REDIS_REST_TOKEN ||= 'mock-upstash-token';
