import { useCallback, useEffect, useRef, useState } from "react";

import { GreenApiError, type GreenApiCredentials } from "~/api/client";
import {
  INCOMING_MESSAGE_WEBHOOK,
  deleteNotification,
  isWebhookUrlConflict,
  receiveNotification,
  toChatMessage,
  type NotificationBody,
} from "~/api/notifications";
import type { ChatHistoryMessage } from "~/api/max";

/**
 * Drains the instance notification queue by long poll.
 *
 * There is no interval here on purpose. `receiveNotification` blocks for its
 * server-side `receiveTimeout` (5s by default) and answers empty when nothing
 * arrived, so re-issuing immediately gives near-zero delivery latency and
 * empties a backlog as fast as the API allows — a fixed interval would both add
 * latency and drain at only one notification per tick.
 *
 * The loop must not be abandoned mid-queue: an unacknowledged notification
 * stays at the head of the FIFO and would block everything behind it. So every
 * notification is acknowledged, including the kinds this hook does not render.
 */

export type PollerStatus = "idle" | "polling" | "error";

export type NotificationPoller = {
  /** Live messages, newest last, each carrying its own `chatId`. */
  messages: ChatHistoryMessage[];
  unreadByChatId: Record<string, number>;
  status: PollerStatus;
  error: string | null;
  /** True while the instance still has a `webhookUrl` blocking the queue. */
  settingsConflict: boolean;
};

/** Generous enough for a busy instance, bounded so a long session cannot grow it. */
const MESSAGE_BUFFER = 500;

const ERROR_BACKOFF_MS = 10_000;

/**
 * Clearing `webhookUrl` leaves the instance unable to serve notifications for
 * about a minute, so a conflict is retried patiently instead of hot-looping.
 */
const SETTINGS_BACKOFF_MS = 10_000;

/** DeleteNotification is idempotent in practice; a few tries covers a blip. */
const ACK_ATTEMPTS = 3;
const ACK_RETRY_MS = 1_000;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const useNotificationPoller = (
  credentials: GreenApiCredentials | null,
  activeChatId: string | null
): NotificationPoller => {
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [unreadByChatId, setUnreadByChatId] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<PollerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [settingsConflict, setSettingsConflict] = useState(false);

  /**
   * Survives loop restarts, so a StrictMode double-mount or a credential
   * change cannot deliver the same message twice.
   */
  const seenRef = useRef<Set<string>>(new Set());
  const loopRunningRef = useRef(false);
  const activeChatIdRef = useRef<string | null>(activeChatId);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Opening a chat clears its badge.
  useEffect(() => {
    if (!activeChatId) return;
    setUnreadByChatId((previous) => {
      if (!previous[activeChatId]) return previous;
      const next = { ...previous };
      delete next[activeChatId];
      return next;
    });
  }, [activeChatId]);

  const applyMessage = useCallback((message: ChatHistoryMessage) => {
    if (seenRef.current.has(message.idMessage)) return;
    seenRef.current.add(message.idMessage);

    setMessages((previous) => {
      const next = [...previous, message];
      return next.length > MESSAGE_BUFFER ? next.slice(-MESSAGE_BUFFER) : next;
    });

    setUnreadByChatId((previous) => {
      // The open chat is read by definition, so it never earns a badge.
      if (message.chatId === activeChatIdRef.current) return previous;
      return {
        ...previous,
        [message.chatId]: (previous[message.chatId] ?? 0) + 1,
      };
    });
  }, []);

  useEffect(() => {
    if (!credentials) {
      setStatus("idle");
      return;
    }

    // A second concurrent loop would race the FIFO and make each notification
    // land in a different consumer's hands.
    if (loopRunningRef.current) return;
    loopRunningRef.current = true;

    let cancelled = false;

    const acknowledge = async (receiptId: number) => {
      for (let attempt = 1; attempt <= ACK_ATTEMPTS; attempt += 1) {
        try {
          await deleteNotification(credentials, receiptId);
          return;
        } catch {
          if (attempt === ACK_ATTEMPTS) return;
          await sleep(ACK_RETRY_MS);
        }
      }
    };

    const run = async () => {
      while (!cancelled) {
        let pending: number | null = null;

        try {
          setStatus("polling");
          const notification = await receiveNotification(credentials);

          if (notification) {
            // Recorded before anything is inspected so the acknowledgement
            // happens even if the body turns out to be unusable.
            pending = notification.receiptId;
            const body: NotificationBody | undefined = notification.body;
            if (body?.typeWebhook === INCOMING_MESSAGE_WEBHOOK) {
              const message = toChatMessage(body);
              // A failure here must not cost the acknowledgement.
              if (message) applyMessage(message);
            }
          }

          setError(null);
          setSettingsConflict(false);
        } catch (caught) {
          if (isWebhookUrlConflict(caught)) {
            setSettingsConflict(true);
            await sleep(SETTINGS_BACKOFF_MS);
            continue;
          }

          setError(
            caught instanceof GreenApiError
              ? caught.message
              : "Не удалось получить уведомления"
          );
          setStatus("error");
          await sleep(ERROR_BACKOFF_MS);
          continue;
        } finally {
          // Skipped when cancelled: an unacknowledged notification is
          // redelivered later rather than lost, and the queue survives 24h.
          if (pending !== null && !cancelled) {
            await acknowledge(pending);
          }
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      loopRunningRef.current = false;
    };
  }, [credentials, applyMessage]);

  return { messages, unreadByChatId, status, error, settingsConflict };
};