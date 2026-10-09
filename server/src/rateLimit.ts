// Tiny per-socket rate limiter: max N events per window.
export class RateLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private maxEvents = 20,
    private windowMs = 1000,
  ) {}

  check(key: string): boolean {
    const now = Date.now();
    const arr = this.hits.get(key) ?? [];
    const fresh = arr.filter((t) => now - t < this.windowMs);
    fresh.push(now);
    this.hits.set(key, fresh);
    return fresh.length <= this.maxEvents;
  }
}
