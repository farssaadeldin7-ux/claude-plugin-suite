/**
 * What the service needs from its environment, checked before it serves.
 *
 * The service used to start with anything: no STRIPE_SECRET_KEY meant every
 * checkout failed at the first Stripe call rather than at boot, and a test key
 * in production meant real customers hit a sandbox that issues licences for
 * money nobody was charged. Both are cheap to catch here and expensive to
 * catch later.
 *
 * BILLING_ENV names the environment: "production" is strict, anything else
 * (or nothing) is treated as development and only warns. Nothing here reads a
 * secret's value beyond its prefix and length — the whole point is to fail
 * without printing what it found.
 */

/**
 * Hosts that mean "fill this in". Every one of these appeared in the
 * repository's own documentation, and `.env.example` shipped one of them as
 * the value of BILLING_PUBLIC_URL — so the file a person copies to build
 * their production config carried a host that would never resolve. Rejecting
 * only `example.com`, as the first version of this check did, left exactly
 * that path open.
 *
 * `.invalid` is reserved by RFC 2606 and can never be registered, which is
 * why `.env.example` uses it now: unmistakably a placeholder, and refused
 * here if anyone ships it.
 */
const PLACEHOLDER_HOST = /(^|\.)(example\.(com|net|org|invalid)|yourdomain\.[a-z]+|your-domain\.[a-z]+|invalid)$|^(replace-me|changeme|todo)/i;

export const isPlaceholderHost = (hostname) => PLACEHOLDER_HOST.test(hostname);

/** A Stripe secret key, live or test. */
const SECRET_KEY = /^(sk|rk)_(live|test)_[A-Za-z0-9]{10,}$/;
/** A webhook signing secret. */
const WEBHOOK_SECRET = /^whsec_[A-Za-z0-9+/=]{16,}$/;

export const REQUIRED = [
  {
    name: 'STRIPE_SECRET_KEY',
    check: (v) => SECRET_KEY.test(v),
    expected: 'sk_live_… or sk_test_… (a restricted rk_ key also works)',
  },
  {
    name: 'STRIPE_WEBHOOK_SECRET',
    check: (v) => WEBHOOK_SECRET.test(v),
    expected: 'whsec_… from the Stripe webhook endpoint, not the API key',
  },
  {
    name: 'BILLING_PUBLIC_URL',
    check: (v) => {
      let url;
      try { url = new URL(v); } catch { return false; }
      return (url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1')
        && !isPlaceholderHost(url.hostname);
    },
    expected: 'the https:// URL this service is reachable at — the one baked into the archives, not a placeholder',
  },
];

/**
 * @returns {{ errors: string[], warnings: string[], environment: string }}
 */
export function checkEnvironment(env = process.env) {
  const environment = (env.BILLING_ENV || 'development').toLowerCase();
  const production = environment === 'production';
  const errors = [];
  const warnings = [];

  for (const { name, check, expected } of REQUIRED) {
    const value = env[name];
    if (!value) {
      (production ? errors : warnings).push(`${name} is not set. Expected ${expected}.`);
      continue;
    }
    if (!check(value)) {
      // Never echo the value: this message goes to logs a host may ship
      // somewhere else.
      (production ? errors : warnings).push(
        `${name} is set but does not look like what it should be. Expected ${expected}.`
      );
    }
  }

  // The one combination that is always wrong, in any environment that calls
  // itself production: test keys issue licences against money nobody paid.
  if (production) {
    if (env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || env.STRIPE_SECRET_KEY?.startsWith('rk_test_')) {
      errors.push('STRIPE_SECRET_KEY is a test key and BILLING_ENV is production. A test key issues real licences against payments that never happened.');
    }
    if (env.STRIPE_API_BASE) {
      errors.push('STRIPE_API_BASE is set in production. It exists to point the test suite at a mock Stripe; in production it silently redirects real billing.');
    }
    if (!env.BILLING_STORE_FILE) {
      errors.push('BILLING_STORE_FILE is not set. The default path is inside the container and every licence is lost on the next deploy.');
    }
  } else if (env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    warnings.push('STRIPE_SECRET_KEY is a LIVE key outside production. Anything this process does will charge real customers.');
  }

  return { errors, warnings, environment };
}

/** Report, and in production refuse to serve. */
export function enforceEnvironment(env = process.env, { log = console.error, exit = process.exit } = {}) {
  const { errors, warnings, environment } = checkEnvironment(env);
  for (const warning of warnings) log(`[billing] warning: ${warning}`);
  if (errors.length === 0) return { environment, errors, warnings };
  log(`[billing] refusing to start in ${environment}: ${errors.length} environment problem(s).`);
  for (const error of errors) log(`[billing]   - ${error}`);
  log('[billing] see services/billing/.env.example, and docs/RUNBOOKS.md for key rotation.');
  exit(1);
  return { environment, errors, warnings };
}
