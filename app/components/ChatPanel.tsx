import { useEffect, useRef, useState } from "react";
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
  getChatHistory,
  readChat,
  sendMessage,
  type ChatHistoryMessage,
} from "~/api/max";
import { formatPhone } from "~/api/phone";
import { MessageBubble } from "./MessageBubble";

const HISTORY_LIMIT = 100;

type ChatPanelProps = {
  contact: StoredContact | null;
  credentials: GreenApiCredentials;
};

export function ChatPanel({ contact, credentials }: ChatPanelProps) {
  const { token } = theme.useToken();
  const [messages, setMessages] = useState<ChatHistoryMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatId = contact?.chatId;

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setHistoryError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setHistoryError(null);

    const load = async () => {
      try {
        // MAX returns history newest-first; the UI reads oldest-first.
        const history = await getChatHistory(credentials, chatId, HISTORY_LIMIT);
        if (cancelled) return;
        setMessages([...history].reverse());

        // Marking as read is best-effort and must not block the history render.
        void readChat(credentials, chatId).catch(() => undefined);
      } catch (error) {
        if (cancelled) return;
        setMessages([]);
        setHistoryError(
          error instanceof GreenApiError
            ? error.message
            : "Не удалось загрузить историю сообщений"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [chatId, credentials]);

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
      setMessages((previous) => [
        ...previous,
        {
          type: "outgoing",
          idMessage,
          timestamp: Math.floor(Date.now() / 1000),
          typeMessage: "textMessage",
          chatId,
          chatType: "user",
          textMessage: text,
          statusMessage: "sent",
        },
      ]);
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
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatPhone(String(contact.phoneNumber))}
          </Typography.Text>
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