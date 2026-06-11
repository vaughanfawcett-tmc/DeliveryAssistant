import { z } from 'zod';

const envSchema = z
  .object({
    PALLEX_MOCK: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    PALLEX_BASE_URL: z.string().url(),
    PALLEX_USERNAME: z.string().min(1).optional(),
    PALLEX_PASSWORD: z.string().min(1).optional(),
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    UPSTASH_REDIS_REST_URL: z.string().url(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1),
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
