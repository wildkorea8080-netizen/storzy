export class AdminLoginRateLimiter {
  readonly #attempts = new Map<string, number[]>();
  readonly #maxAttempts: number;
  readonly #windowMs: number;

  constructor(options: Readonly<{ maxAttempts?: number; windowMs?: number }> = {}) {
    this.#maxAttempts=options.maxAttempts??5;this.#windowMs=options.windowMs??15*60*1000;
    if(!Number.isInteger(this.#maxAttempts)||this.#maxAttempts<1||this.#maxAttempts>100)throw new Error("ADMIN_LOGIN_MAX_ATTEMPTS must be an integer between 1 and 100");
    if(!Number.isInteger(this.#windowMs)||this.#windowMs<1000||this.#windowMs>24*60*60*1000)throw new Error("ADMIN_LOGIN_WINDOW_SECONDS must be between 1 and 86400 seconds");
  }

  check(key: string, now = Date.now()): Readonly<{ allowed: boolean; retryAfterSeconds: number }> {
    const recent = (this.#attempts.get(key) ?? []).filter(item => item > now - this.#windowMs);
    if (recent.length === 0) this.#attempts.delete(key); else this.#attempts.set(key, recent);
    const oldest = recent[0];
    return recent.length < this.#maxAttempts
      ? { allowed: true, retryAfterSeconds: 0 }
      : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(((oldest ?? now) + this.#windowMs - now) / 1000)) };
  }

  fail(key: string, now = Date.now()): void {
    const current = this.check(key, now);
    if (current.allowed) this.#attempts.set(key, [...(this.#attempts.get(key) ?? []), now]);
  }

  success(key: string): void {
    this.#attempts.delete(key);
  }
}
