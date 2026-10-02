import type { GreenApiCredentials } from "./client";
import { getChatHistory, type ChatHistoryMessage } from "./max";
import { createRateLimiter } from "~/lib/rate-limit";

/**
 * Session cache for chat history.
 *
 * `getChatHistory` is limited to 1 request/second per instance, while opening a
 * chat is a synchronous user action — sweeping ten chats in a row would 429. The
 * cache absorbs the repeat visits and a min-gap limiter serialises whatever
 * still misses, so the instance never sees a second request inside its window.
 *
 * Entries live in module scope on purpose: they should outlive a ChatPanel
 * remount (a chat switch unmounts and remounts it) without threading state
 * through the route. This is deliberately session-scoped rather than persisted,
 * so nothing is written to disk.
 */

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

/** Oldest-first, as rendered — `getChatHistory` answers newest-first. */
type HistoryEntry = {
  messages: ChatHistoryMessage[];
  fetchedAt: number;
};

const cache = new Map<string, HistoryEntry>();

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

/**
 * Everything the first paint needs, in one lookup: `messages` is null for a chat
 * this session has never fetched, and `stale` says whether to revalidate what
 * came back.
 */
export type HistorySnapshot = {
  messages: ChatHistoryMessage[] | null;
  stale: boolean;
};

export const readHistory = (
  credentials: GreenApiCredentials,
  chatId: string,
  ttlMs = HISTORY_TTL_MS
): HistorySnapshot => {
  const entry = cache.get(cacheKey(credentials, chatId));
  if (!entry) return { messages: null, stale: true };
  return { messages: entry.messages, stale: Date.now() - entry.fetchedAt > ttlMs };
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
  if (!entry) return;
  if (entry.messages.some((item) => item.idMessage === message.idMessage)) return;

  writeEntry(key, {
    messages: [...entry.messages, message].slice(-MESSAGE_CACHE_LIMIT),
    fetchedAt: entry.fetchedAt,
  });
};

const limitHistoryRequests = createRateLimiter(HISTORY_MIN_GAP_MS);

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
  limitHistoryRequests(async () => {
    const messages = (await getChatHistory(credentials, chatId, count)).reverse();
    writeEntry(cacheKey(credentials, chatId), {
      messages,
      fetchedAt: Date.now(),
    });
    return messages;
  });
