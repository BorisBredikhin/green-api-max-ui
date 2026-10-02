import type { GreenApiCredentials } from "./client";
import { getChatHistory, type ChatHistoryMessage } from "./max";

/**
 * Session cache for chat history.
 *
 * `getChatHistory` is limited to 1 request/second per instance, while opening a
 * chat is a synchronous user action — sweeping ten chats in a row would 429. The
 * cache absorbs the repeat visits and a min-gap scheduler serialises whatever
 * still misses, so the instance never sees a second request inside its window.
 *
 * Entries live in module scope on purpose: they should outlive a ChatPanel
 * remount (a chat switch unmounts and remounts it) without threading state
 * through the route. This is deliberately session-scoped rather than persisted,
 * so nothing is written to disk.
 */

/** Oldest-first, as rendered — `getChatHistory` answers newest-first. */
export type HistoryEntry = {
  messages: ChatHistoryMessage[];
  fetchedAt: number;
};

export const HISTORY_TTL_MS = 30_000;

/** Comfortably past the documented 1/second limit. */
const HISTORY_MIN_GAP_MS = 1_050;

/** How many chats are retained, independent of how many messages each holds. */
const CHAT_CACHE_LIMIT = 50;

/** Matches the `count` the UI requests, so a cache hit covers the whole view. */
const MESSAGE_CACHE_LIMIT = 100;

/** Keys on the instance id too, so two accounts in one tab never share cache. */
const cacheKey = (credentials: GreenApiCredentials, chatId: string): string =>
  `${credentials.idInstance}:${chatId}`;

const cache = new Map<string, HistoryEntry>();

const isStoredEntry = (value: unknown): value is HistoryEntry => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Partial<HistoryEntry>;
  return Array.isArray(entry.messages) && typeof entry.fetchedAt === "number";
};

const writeEntry = (key: string, entry: HistoryEntry): void => {
  // Re-inserting moves the key to the end, so the Map doubles as an LRU and the
  // trim below drops the least recently used chat.
  cache.delete(key);
  cache.set(key, entry);
  while (cache.size > CHAT_CACHE_LIMIT) {
    const oldest = cache.keys().next();
    if (oldest.done) break;
    cache.delete(oldest.value);
  }
};

/** Synchronous read for the first paint when a chat is opened. */
export const getCachedHistory = (
  credentials: GreenApiCredentials,
  chatId: string
): ChatHistoryMessage[] | null => {
  const entry = cache.get(cacheKey(credentials, chatId));
  if (!isStoredEntry(entry)) return null;
  return entry.messages;
};

export const isHistoryCacheStale = (
  credentials: GreenApiCredentials,
  chatId: string,
  ttlMs = HISTORY_TTL_MS
): boolean => {
  const entry = cache.get(cacheKey(credentials, chatId));
  if (!isStoredEntry(entry)) return true;
  return Date.now() - entry.fetchedAt > ttlMs;
};

export const putHistory = (
  credentials: GreenApiCredentials,
  chatId: string,
  messages: ChatHistoryMessage[],
  fetchedAt = Date.now()
): void => {
  writeEntry(cacheKey(credentials, chatId), { messages, fetchedAt });
};

/**
 * Keeps an optimistically rendered message visible across a chat switch. It
 * already carries the real `idMessage` from the sendMessage response, so the
 * next history fetch merges over it instead of duplicating it.
 */
export const appendToHistoryCache = (
  credentials: GreenApiCredentials,
  chatId: string,
  message: ChatHistoryMessage
): void => {
  const key = cacheKey(credentials, chatId);
  const entry = cache.get(key);
  if (!isStoredEntry(entry)) return;
  if (entry.messages.some((item) => item.idMessage === message.idMessage)) return;

  writeEntry(key, {
    messages: [...entry.messages, message].slice(-MESSAGE_CACHE_LIMIT),
    fetchedAt: entry.fetchedAt,
  });
};

let chain: Promise<unknown> = Promise.resolve();
let lastStartedAt = 0;

/**
 * Runs tasks one at a time with a minimum gap between their start times. A
 * rejected task must not poison the chain, so the tail swallows errors and only
 * the caller sees them.
 */
const schedule = <T>(task: () => Promise<T>): Promise<T> => {
  const run = chain.then(async () => {
    const wait = HISTORY_MIN_GAP_MS - (Date.now() - lastStartedAt);
    if (wait > 0) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, wait);
      });
    }
    lastStartedAt = Date.now();
    return task();
  });

  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

/**
 * Rate-limited history fetch. Resolves oldest-first and refreshes the cache.
 * Rejects with the underlying `GreenApiError`, so callers can still surface 429
 * or an auth failure.
 */
export const requestHistory = (
  credentials: GreenApiCredentials,
  chatId: string,
  count: number
): Promise<ChatHistoryMessage[]> =>
  schedule(async () => {
    const history = await getChatHistory(credentials, chatId, count);
    const messages = [...history].reverse();
    putHistory(credentials, chatId, messages);
    return messages;
  });