import { z } from 'zod';

// Treat an empty string as "absent" for optional fields. .env files routinely ship
// blank placeholders (e.g. `PALLEX_USERNAME=`), which set the value to "" rather than
// leaving it undefined. Without this, "" is "present" and fails `.min(1)` even in mock
// mode — which broke static prerendering of any page that reads env at build time.
const optionalCredential = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().min(1).optional()
);

const envSchema = z
  .object({
    PALLEX_MOCK: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    PALLEX_BASE_URL: z.string().url(),
    PALLEX_USERNAME: optionalCredential,
    PALLEX_PASSWORD: optionalCredential,
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
    CONTACT_PHONE: z.string().min(1).default('+44 000 000 0000'),
    SHARE_TOKEN_SECRET: z.string().min(32).default('dev-only-insecure-share-secret-change-me'),
    // Admin dashboard auth — NO defaults: app must fail to boot if absent (Pitfall 3)
    DASHBOARD_PASSWORD: z.string().min(8),
    DASHBOARD_SESSION_SECRET: z.string().min(32),
    // Voice / telephony — optional credentials (required when PALLEX_MOCK=false)
    ELEVENLABS_API_KEY: optionalCredential,
    ELEVENLABS_AGENT_ID: optionalCredential,
    ELEVENLABS_WEBHOOK_SECRET: optionalCredential,
    TWILIO_ACCOUNT_SID: optionalCredential,
    TWILIO_AUTH_TOKEN: optionalCredential,
    TWILIO_PHONE_NUMBER: optionalCredential,
    // VOICE_WEBHOOK_SECRET: no default — app must fail to boot if absent (WR-05),
    // matching the DASHBOARD_PASSWORD pattern. This prevents webhook HMAC from
    // silently passing with a well-known dev secret when the variable is not set.
    VOICE_WEBHOOK_SECRET: z.string().min(32),
    // Driver escalation hard limits (DRIV-02 / DRIV-04)
    DRIVER_CALL_MAX_DURATION_S: z.coerce.number().int().positive().default(180),
    DRIVER_CALL_MAX_RETRIES: z.coerce.number().int().nonnegative().default(2),
  })
  .refine(
    (data) => {
      if (!data.PALLEX_MOCK) {
        return (
          typeof data.PALLEX_USERNAME === 'string' &&
          data.PALLEX_USERNAME.length > 0 &&
          typeof data.PALLEX_PASSWORD === 'string' &&
          data.PALLEX_PASSWORD.length > 0
        );
      }
      return true;
    },
    {
      message:
        'PALLEX_USERNAME and PALLEX_PASSWORD are required when PALLEX_MOCK=false',
      path: ['PALLEX_USERNAME'],
    }
  )
  .refine(
    (data) => {
      if (!data.PALLEX_MOCK) {
        const isPresent = (v: string | undefined): boolean =>
          typeof v === 'string' && v.length > 0;
        return (
          isPresent(data.ELEVENLABS_API_KEY) &&
          isPresent(data.ELEVENLABS_AGENT_ID) &&
          isPresent(data.ELEVENLABS_WEBHOOK_SECRET) &&
          isPresent(data.TWILIO_ACCOUNT_SID) &&
          isPresent(data.TWILIO_AUTH_TOKEN) &&
          isPresent(data.TWILIO_PHONE_NUMBER)
        );
      }
      return true;
    },
    {
      message:
        'ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_WEBHOOK_SECRET, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER are required when PALLEX_MOCK=false',
      path: ['ELEVENLABS_API_KEY'],
    }
  );

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables from an arbitrary source object.
 * Use this directly in tests to avoid module-cache issues.
 */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
}

/**
 * Validated environment accessor — lazily parsed on first access.
 * In production and Next.js API routes, import `env` directly.
 * In tests, import and call `parseEnv` with an explicit object instead.
 */
let _env: Env | undefined;

export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    if (!_env) {
      _env = parseEnv(process.env as Record<string, string | undefined>);
    }
    return (_env as Record<string, unknown>)[prop];
  },
});
