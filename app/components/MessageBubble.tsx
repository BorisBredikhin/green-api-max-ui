import { Flex, Typography, theme } from "antd";

import type { ChatHistoryMessage, OutgoingStatus } from "~/api/max";

const MEDIA_LABELS: Record<string, string> = {
  imageMessage: "Изображение",
  videoMessage: "Видео",
  audioMessage: "Аудио",
  documentMessage: "Документ",
  stickerMessage: "Стикер",
};

const OUTGOING_STATUS_LABELS: Record<OutgoingStatus, string> = {
  sent: "отправлено",
  delivered: "доставлено",
  read: "прочитано",
};

const formatTime = (timestamp: number): string =>
  new Date(timestamp * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

/** An image thumbnail, a file label with a download link, or nothing. */
function MessageAttachment({
  message,
  label,
}: {
  message: ChatHistoryMessage;
  label: string | undefined;
}) {
  const isImage = message.typeMessage === "imageMessage";
  const thumbnail = message.downloadUrlJpeg ?? message.downloadUrl;

  return (
    <>
      {isImage && thumbnail && (
        <img
          src={thumbnail}
          alt={message.caption || "Изображение"}
          style={{
            maxWidth: "100%",
            borderRadius: 8,
            marginBottom: 6,
            display: "block",
          }}
        />
      )}

      {label && !isImage && (
        <Typography.Text type="secondary">
          {label}
          {message.fileName ? ` · ${message.fileName}` : ""}
        </Typography.Text>
      )}

      {label && message.downloadUrl && (
        <Typography.Link href={message.downloadUrl} target="_blank">
          Скачать
        </Typography.Link>
      )}

      {label && message.caption && <div style={{ marginTop: 4 }}>{message.caption}</div>}
    </>
  );
}

function MessagePoll({
  poll,
}: {
  poll: NonNullable<ChatHistoryMessage["pollMessageData"]>;
}) {
  return (
    <div style={{ marginBottom: 4 }}>
      <Typography.Text strong>{poll.name}</Typography.Text>
      <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
        {poll.options.map((option) => (
          <li key={option.optionName}>{option.optionName}</li>
        ))}
      </ul>
    </div>
  );
}

function MessageMeta({ message }: { message: ChatHistoryMessage }) {
  const { token } = theme.useToken();
  const outgoing = message.type === "outgoing";

  return (
    <Flex
      justify="flex-end"
      align="center"
      gap={6}
      style={{ marginTop: 2, fontSize: 11, color: token.colorTextSecondary }}
    >
      {message.isEdited && <span>изменено</span>}
      <span>{formatTime(message.timestamp)}</span>
      {outgoing && message.statusMessage && (
        <span>{OUTGOING_STATUS_LABELS[message.statusMessage]}</span>
      )}
    </Flex>
  );
}

type MessageBubbleProps = {
  message: ChatHistoryMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const { token } = theme.useToken();
  const outgoing = message.type === "outgoing";
  const label = MEDIA_LABELS[message.typeMessage];

  const text =
    message.typeMessage === "extendedTextMessage"
      ? (message.extendedTextMessage?.text ?? message.textMessage)
      : message.textMessage;

  const reaction =
    message.typeMessage === "reactionMessage"
      ? message.extendedTextMessageData?.text
      : undefined;

  const poll =
    message.typeMessage === "pollMessage"
      ? message.pollMessageData
      : undefined;

  return (
    <Flex
      justify={outgoing ? "flex-end" : "flex-start"}
      style={{ marginBottom: 8 }}
    >
      <div
        style={{
          maxWidth: "75%",
          padding: "8px 12px",
          borderRadius: 12,
          background: outgoing ? token.colorPrimaryBg : token.colorFillTertiary,
          color: token.colorText,
        }}
      >
        {message.isDeleted ? (
          <Typography.Text type="secondary" italic>
            Сообщение удалено
          </Typography.Text>
        ) : (
          <>
            <MessageAttachment message={message} label={label} />

            {poll && <MessagePoll poll={poll} />}

            {text && (
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {text}
              </div>
            )}

            {reaction && (
              <Typography.Text style={{ fontSize: 18 }}>{reaction}</Typography.Text>
            )}

            {!text && !reaction && !label && !poll && (
              <Typography.Text type="secondary">
                Неизвестный тип сообщения: {message.typeMessage}
              </Typography.Text>
            )}
          </>
        )}

        <MessageMeta message={message} />
      </div>
    </Flex>
  );
}
