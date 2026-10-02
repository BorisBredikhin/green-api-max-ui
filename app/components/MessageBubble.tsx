import { Flex, Typography, theme } from "antd";

import type { ChatHistoryMessage } from "~/api/max";

const MEDIA_LABELS: Record<string, string> = {
  imageMessage: "Изображение",
  videoMessage: "Видео",
  audioMessage: "Аудио",
  documentMessage: "Документ",
  stickerMessage: "Стикер",
};

const formatTime = (timestamp: number): string =>
  new Date(timestamp * 1000).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });

type MessageBubbleProps = {
  message: ChatHistoryMessage;
};

export function MessageBubble({ message }: MessageBubbleProps) {
  const { token } = theme.useToken();
  const outgoing = message.type === "outgoing";
  const mediaLabel = MEDIA_LABELS[message.typeMessage];

  const text =
    message.typeMessage === "extendedTextMessage"
      ? (message.extendedTextMessage?.text ?? message.textMessage)
      : message.textMessage;

  const reaction =
    message.typeMessage === "reactionMessage"
      ? message.extendedTextMessageData?.text
      : undefined;

  const poll = message.typeMessage === "pollMessage"
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
            {message.typeMessage === "imageMessage" &&
              (message.downloadUrlJpeg || message.downloadUrl) && (
                <img
                  src={message.downloadUrlJpeg ?? message.downloadUrl}
                  alt={message.caption || "Изображение"}
                  style={{
                    maxWidth: "100%",
                    borderRadius: 8,
                    marginBottom: 6,
                    display: "block",
                  }}
                />
              )}

            {mediaLabel && message.typeMessage !== "imageMessage" && (
              <Typography.Text type="secondary">
                {mediaLabel}
                {message.fileName ? ` · ${message.fileName}` : ""}
              </Typography.Text>
            )}

            {mediaLabel && message.downloadUrl && (
              <Typography.Link href={message.downloadUrl} target="_blank">
                Скачать
              </Typography.Link>
            )}

            {poll && (
              <div style={{ marginBottom: 4 }}>
                <Typography.Text strong>{poll.name}</Typography.Text>
                <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                  {poll.options.map((option) => (
                    <li key={option.optionName}>{option.optionName}</li>
                  ))}
                </ul>
              </div>
            )}

            {text && (
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {text}
              </div>
            )}

            {reaction && (
              <Typography.Text style={{ fontSize: 18 }}>{reaction}</Typography.Text>
            )}

            {!text && !reaction && !mediaLabel && !poll && (
              <Typography.Text type="secondary">
                Неизвестный тип сообщения: {message.typeMessage}
              </Typography.Text>
            )}

            {message.caption && mediaLabel && (
              <div style={{ marginTop: 4 }}>{message.caption}</div>
            )}
          </>
        )}

        <Flex
          justify="flex-end"
          align="center"
          gap={6}
          style={{ marginTop: 2, fontSize: 11, color: token.colorTextSecondary }}
        >
          {message.isEdited && <span>изменено</span>}
          <span>{formatTime(message.timestamp)}</span>
          {outgoing && (
            <span>
              {message.statusMessage === "read"
                ? "прочитано"
                : message.statusMessage === "delivered"
                  ? "доставлено"
                  : "отправлено"}
            </span>
          )}
        </Flex>
      </div>
    </Flex>
  );
}