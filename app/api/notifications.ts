import {
  GreenApiError,
  greenApiRequest,
  type GreenApiCredentials,
} from "./client";
import type { ChatHistoryMessage, ChatType } from "./max";

/**
 * HTTP API notification polling.
 *
 * The instance queues every notification for 24h and hands them out FIFO, so
 * the contract is strictly receive-then-acknowledge: pulling a notification
 * does not remove it, and an unacknowledged one blocks everything queued behind
 * it. Acknowledging types we do not render is therefore not optional.
 */

/** Only this one is rendered; the rest are acknowledged and discarded. */
export const INCOMING_MESSAGE_WEBHOOK = "incomingMessageReceived";

/**
 * The long poll blocks server-side for its `receiveTimeout` (default 5s) and
 * then answers with an empty body. This budget is deliberately above that
 * window: it only exists so a half-open socket cannot wedge the loop forever.
 */
const RECEIVE_TIMEOUT_MS = 15_000;

/** The instance's 500 body for a receipt that is already out of the queue. */
const ALREADY_ACKNOWLEDGED_MARKER = "findUnAckedMessage";

/** The 400 body returned while `webhookUrl` is still set on the instance. */
const WEBHOOK_URL_CONFLICT_MARKER = "custom webhook url is set";

export const WEBHOOK_URL_CONFLICT_HINT =
  "У инстанса задан webhookUrl, поэтому HTTP API не отдаёт уведомления. Настройка сброшена автоматически — первые уведомления придут примерно через минуту.";

export type NotificationType =
  | "incomingMessageReceived"
  | "outgoingMessageReceived"
  | "outgoingAPIMessageReceived"
  | "outgoingMessageStatus"
  | "stateInstanceChanged"
  | "quotaExceeded";

export type NotificationBody = {
  typeWebhook: NotificationType | (string & {});
  timestamp?: number;
  idMessage?: string;
  senderData?: {
    chatId?: string;
    chatName?: string;
    chatType?: ChatType;
    sender?: string;
    senderName?: string;
    senderType?: ChatType;
    senderContactName?: string;
    senderPhoneNumber?: number;
  };
  messageData?: {
    typeMessage?: string;
    textMessageData?: { textMessage?: string };
    extendedTextMessage?: {
      text?: string;
      title?: string;
      description?: string;
      jpegThumbnail?: string;
    };
    extendedTextMessageData?: { text?: string };
    pollMessageData?: {
      name?: string;
      options?: { optionName?: string }[];
    };
    quotedMessage?: { stanzaId?: string };
    downloadUrl?: string;
    downloadUrlJpeg?: string;
    caption?: string;
    fileName?: string;
    mimeType?: string;
    isEdited?: boolean;
    isDeleted?: boolean;
  };
};

export type ReceivedNotification = {
  receiptId: number;
  /**
   * Absent for notification kinds the API sends without a payload. That is not a
   * reason to drop the envelope — see `receiveNotification`.
   */
  body?: NotificationBody;
};

export const receiveNotification = async (
  credentials: GreenApiCredentials
): Promise<ReceivedNotification | null> => {
  const response = await greenApiRequest<unknown>("receiveNotification", {
    credentials,
    method: "GET",
    timeout: RECEIVE_TIMEOUT_MS,
  });

  // An empty answer is the long poll timing out, not a notification.
  if (typeof response !== "object" || response === null) return null;

  const { receiptId, body } = response as {
    receiptId?: unknown;
    body?: unknown;
  };

  // Keyed on `receiptId` alone, deliberately. An envelope whose `body` is
  // missing or malformed still occupies the head of the FIFO, so discarding it
  // here would leave it unacknowledged and wedge every later poll behind it.
  // Whether it is renderable is `toChatMessage`'s decision.
  if (typeof receiptId !== "number") return null;

  return {
    receiptId,
    body:
      typeof body === "object" && body !== null
        ? (body as NotificationBody)
        : undefined,
  };
};

/** Resolves true once the notification is out of the queue. */
export const deleteNotification = async (
  credentials: GreenApiCredentials,
  receiptId: number
): Promise<boolean> => {
  try {
    const response = await greenApiRequest<{ result?: boolean }>(
      "deleteNotification",
      {
        credentials,
        method: "DELETE",
        afterToken: String(receiptId),
      }
    );
    return response?.result !== false;
  } catch (error) {
    // A receipt that is no longer queued is exactly the state we wanted, so
    // this specific 500 is a success rather than a failure.
    if (
      error instanceof GreenApiError &&
      error.message.includes(ALREADY_ACKNOWLEDGED_MARKER)
    ) {
      return true;
    }
    throw error;
  }
};

/**
 * Points the instance at HTTP API polling: an empty `webhookUrl` is what makes
 * receiveNotification legal, and the `yes` flags switch the notification kinds
 * on. Mutates the instance, so callers must gate it (see the session flag on
 * the messenger route).
 */
export const setHttpApiSettings = (
  credentials: GreenApiCredentials
): Promise<unknown> =>
  greenApiRequest<unknown>("setSettings", {
    credentials,
    method: "POST",
    data: {
      webhookUrl: "",
      incomingWebhook: "yes",
      outgoingWebhook: "yes",
      outgoingMessageWebhook: "yes",
      stateWebhook: "yes",
    },
  });

export const isWebhookUrlConflict = (error: unknown): boolean =>
  error instanceof GreenApiError &&
  error.message.includes(WEBHOOK_URL_CONFLICT_MARKER);

/**
 * Projects a notification onto the same shape `getChatHistory` returns, so a
 * live message and a history entry render through one component. Returns null
 * for notifications that carry no renderable message.
 */
export const toChatMessage = (
  body: NotificationBody
): ChatHistoryMessage | null => {
  const chatId = body.senderData?.chatId;
  const idMessage = body.idMessage;
  const typeMessage = body.messageData?.typeMessage;
  if (!chatId || !idMessage || !typeMessage) return null;

  const data = body.messageData;
  const poll = data?.pollMessageData;
  const sender = body.senderData;

  return {
    type: "incoming",
    idMessage,
    timestamp: body.timestamp ?? 0,
    typeMessage,
    chatId,
    chatType: sender?.chatType ?? "user",
    textMessage: data?.textMessageData?.textMessage,
    chatName: sender?.chatName,
    senderId: sender?.sender,
    senderName: sender?.senderName,
    senderType: sender?.senderType,
    senderContactName: sender?.senderContactName,
    senderPhoneNumber: sender?.senderPhoneNumber,
    isEdited: data?.isEdited,
    isDeleted: data?.isDeleted,
    downloadUrl: data?.downloadUrl,
    downloadUrlJpeg: data?.downloadUrlJpeg,
    caption: data?.caption,
    fileName: data?.fileName,
    mimeType: data?.mimeType,
    extendedTextMessage: data?.extendedTextMessage?.text
      ? {
          text: data.extendedTextMessage.text,
          title: data.extendedTextMessage.title,
          description: data.extendedTextMessage.description,
          jpegThumbnail: data.extendedTextMessage.jpegThumbnail,
        }
      : undefined,
    extendedTextMessageData: data?.extendedTextMessageData?.text
      ? { text: data.extendedTextMessageData.text }
      : undefined,
    pollMessageData: poll?.name
      ? {
          name: poll.name,
          options: (poll.options ?? [])
            .map((option) => option.optionName)
            .filter((name): name is string => Boolean(name))
            .map((optionName) => ({ optionName })),
        }
      : undefined,
  };
};