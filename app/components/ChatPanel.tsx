import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SendOutlined, UserOutlined } from "@ant-design/icons";
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Flex,
  Input,
  Skeleton,
  Typography,
  theme,
} from "antd";

import type { StoredContact } from "~/api/contacts";
import { GreenApiError, type GreenApiCredentials } from "~/api/client";
import {
  appendToHistoryCache,
  getCachedHistory,
  isHistoryCacheStale,
  requestHistory,
} from "~/api/history";
import { readChat, sendMessage, type ChatHistoryMessage } from "~/api/max";
import { formatPhone } from "~/api/phone";
import { MessageBubble } from "./MessageBubble";

const HISTORY_LIMIT = 100;

/** readChat is limited to 1 request/second per instance. */
const READ_THROTTLE_MS = 1_000;

type ChatPanelProps = {
  contact: StoredContact | null;
  credentials: GreenApiCredentials;
  /** Incoming notifications for this chat, straight from the long poll. */
  liveMessages: ChatHistoryMessage[];
};

export function ChatPanel({ contact, credentials, liveMessages }: ChatPanelProps) {
  const { token } = theme.useToken();
  const [history, setHistory] = useState<ChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastReadAtRef = useRef(0);

  /**
   * Optimistic sends live here rather than in `history` so that a background
   * refresh can replace the history without discarding a message the user just
   * wrote. Keyed by chat because the panel survives a chat switch.
   */
  const [sent, setSent] = useState<{
    chatId: string;
    messages: ChatHistoryMessage[];
  }>({ chatId: "", messages: [] });

  const chatId = contact?.chatId;

  /**
   * History, live notifications and optimistic sends are three independent
   * sources, so they are merged on read rather than folded into one state that
   * a background refresh could clobber. `idMessage` is the join key — a message
   * can legitimately arrive from more than one of them.
   */
  const messages = useMemo(() => {
    const seen = new Set<string>();
    const merged: ChatHistoryMessage[] = [];

    for (const message of [
      ...history,
      ...liveMessages,
      ...(sent.chatId === chatId ? sent.messages : []),
    ]) {
      if (seen.has(message.idMessage)) continue;
      seen.add(message.idMessage);
      merged.push(message);
    }

    // Notifications and history can interleave, so order by time rather than
    // trusting arrival. Array#sort is stable, keeping ties in source order.
    merged.sort((a, b) => a.timestamp - b.timestamp);
    return merged;
  }, [history, liveMessages, sent, chatId]);

  const markRead = useCallback(() => {
    if (!chatId) return;
    const now = Date.now();
    if (now - lastReadAtRef.current < READ_THROTTLE_MS) return;
    lastReadAtRef.current = now;
    void readChat(credentials, chatId).catch(() => undefined);
  }, [chatId, credentials]);

  /**
   * Stale-while-revalidate against the session history cache. A cached chat
   * paints immediately and refreshes in the background; only a cold chat shows
   * skeletons. A failed refresh leaves what is on screen alone.
   */
  useEffect(() => {
    if (!chatId) {
      setHistory([]);
      setHistoryError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const cached = getCachedHistory(credentials, chatId);

    setHistory(cached ?? []);
    setLoading(cached === null);
    setHistoryError(null);

    if (cached !== null && !isHistoryCacheStale(credentials, chatId)) {
      markRead();
      return;
    }

    const load = async () => {
      try {
        const fresh = await requestHistory(credentials, chatId, HISTORY_LIMIT);
        if (cancelled) return;
        setHistory(fresh);
        setLoading(false);
        markRead();
      } catch (error) {
        if (cancelled) return;
        setLoading(false);
        // Only a chat that never rendered has nothing better to show.
        if (cached !== null) return;
        setHistoryError(
          error instanceof GreenApiError
            ? error.message
            : "Не удалось загрузить историю сообщений"
        );
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [chatId, credentials, markRead]);

  // A notification for the open chat means the sender has seen it replied to.
  useEffect(() => {
    if (liveMessages.length === 0) return;
    markRead();
  }, [liveMessages.length, markRead]);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !chatId || sending) return;

    setSending(true);
    setSendError(null);
    try {
      const { idMessage } = await sendMessage(credentials, chatId, text);
      const outgoing: ChatHistoryMessage = {
        type: "outgoing",
        idMessage,
        timestamp: Math.floor(Date.now() / 1000),
        typeMessage: "textMessage",
        chatId,
        chatType: "user",
        textMessage: text,
        statusMessage: "sent",
      };

      setSent((previous) =>
        previous.chatId === chatId
          ? { ...previous, messages: [...previous.messages, outgoing] }
          : { chatId, messages: [outgoing] }
      );

      // Keeping it in the cache means a chat switch does not make the message
      // vanish until the next history fetch. It already carries the real
      // idMessage, so the next history fetch merges over it.
      appendToHistoryCache(credentials, chatId, outgoing);

      setDraft("");
    } catch (error) {
      setSendError(
        error instanceof GreenApiError
          ? error.message
          : "Не удалось отправить сообщение"
      );
    } finally {
      setSending(false);
    }
  };

  if (!contact) {
    return (
      <div className="messenger__pane messenger__chat">
        <Flex align="center" justify="center" style={{ height: "100%" }}>
          <Empty description="Выберите контакт, чтобы открыть чат" />
        </Flex>
      </div>
    );
  }

  return (
    <div className="messenger__pane messenger__chat">
      <Flex
        align="center"
        gap={12}
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Avatar
          size={36}
          src={contact.avatar || undefined}
          icon={<UserOutlined />}
        />
        <Flex vertical>
          <Typography.Text strong>{contact.name}</Typography.Text>
          {contact.phoneNumber !== 0 && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatPhone(String(contact.phoneNumber))}
            </Typography.Text>
          )}
        </Flex>
      </Flex>

      <div className="messenger__scroll messenger__messages" ref={scrollRef}>
        {loading ? (
          <Flex vertical gap={12} style={{ padding: 16 }}>
            <Skeleton active paragraph={{ rows: 1 }} />
            <Skeleton active paragraph={{ rows: 1 }} />
            <Skeleton active paragraph={{ rows: 1 }} />
          </Flex>
        ) : historyError ? (
          <Flex style={{ padding: 16 }}>
            <Alert type="error" title={historyError} showIcon style={{ width: "100%" }} />
          </Flex>
        ) : messages.length === 0 ? (
          <Flex align="center" justify="center" style={{ height: "100%" }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Сообщений пока нет"
            />
          </Flex>
        ) : (
          <div style={{ padding: 16 }}>
            {messages.map((message) => (
              <MessageBubble key={message.idMessage} message={message} />
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          padding: 12,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        {sendError && (
          <div style={{ marginBottom: 8 }}>
            <Alert type="error" title={sendError} showIcon />
          </div>
        )}
        <Flex gap={8} align="flex-end">
          <Input.TextArea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void handleSend();
              }
            }}
            placeholder="Введите сообщение"
            autoSize={{ minRows: 1, maxRows: 5 }}
          />
          <Button
            color="primary"
            variant="solid"
            icon={<SendOutlined />}
            loading={sending}
            disabled={draft.trim() === ""}
            onClick={() => void handleSend()}
            aria-label="Отправить сообщение"
          />
        </Flex>
      </div>
    </div>
  );
}