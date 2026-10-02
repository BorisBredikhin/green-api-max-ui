/**
 * GREEN API rate limiting.
 *
 * Several endpoints are capped at 1 request/second per instance, so the two
 * shapes of limiter live here instead of being re-derived per call site: a
 * serialiser for requests that must all happen, and a throttle for work that is
 * safe to drop.
 */

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Runs tasks one at a time, starting each no sooner than `minGapMs` after the
 * previous one started. A rejected task must not poison the queue, so the tail
 * swallows the error and only the caller of the returned task sees it.
 */
export const createRateLimiter = (minGapMs: number) => {
  let tail: Promise<unknown> = Promise.resolve();
  let lastStartedAt = 0;

  return <T>(task: () => Promise<T>): Promise<T> => {
    const run = tail.then(async () => {
      const wait = minGapMs - (Date.now() - lastStartedAt);
      if (wait > 0) await sleep(wait);
      lastStartedAt = Date.now();
      return task();
    });

    tail = run.then(
      () => undefined,
      () => undefined
    );
    return run;
  };
};

/**
 * Drops calls made within `minGapMs` of the last accepted one. Meant for work
 * that is redundant rather than missed, such as re-marking a chat that is
 * already on screen as read.
 */
export const createThrottle = (minGapMs: number) => {
  let lastRunAt = 0;

  return (task: () => void): void => {
    const now = Date.now();
    if (now - lastRunAt < minGapMs) return;
    lastRunAt = now;
    task();
  };
};
