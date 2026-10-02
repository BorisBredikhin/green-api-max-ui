import {
  greenApiRequest,
  type GreenApiCredentials,
} from "./client";

export type ChatType = "user" | "group" | "channel" | "bot";

export type MessageDirection = "incoming" | "outgoing";

export type OutgoingStatus = "sent" | "delivered" | "read";

/**
 * CheckAccount answers with one of two HTTP 200 bodies, so callers must
 * discriminate on `"exist" in result` rather than on `status`.
 */
export type CheckAccountResult = {
  exist: boolean;
  chatId: string;
  fromCache: boolean;
};

export type CheckAccountStatusError = {
  status: false;
  reason: string;
};

export type CheckAccountResponse = CheckAccountResult | CheckAccountStatusError;

export const isCheckAccountStatusError = (
  response: CheckAccountResponse
): response is CheckAccountStatusError => "status" in response;

export type ContactInfo = {
  avatar: string;
  name: string;
  contactName: string;
  chatId: string;
  chatType: ChatType;
  lastSeen: string | number | null;
  phoneNumber: number;
  phoneNumberTimestamp?: number;
};

export type ChatHistoryMessage = {
  type: MessageDirection;
  idMessage: string;
  timestamp: number;
  typeMessage: string;
  chatId: string;
  chatType: ChatType;
  textMessage?: string;
  /** Chat title, which for a group differs from the sender's name. */
  chatName?: string;
  senderId?: string;
  senderName?: string;
  senderPhoneNumber?: number;
  senderType?: ChatType;
  senderContactName?: string;
  statusMessage?: OutgoingStatus;
  sendByApi?: boolean;
  isForwarded?: boolean;
  forwardingScore?: number;
  isEdited?: boolean;
  isDeleted?: boolean;
  deletedMessageId?: string;
  editedMessageId?: string;
  downloadUrl?: string;
  downloadUrlJpeg?: string;
  caption?: string;
  fileName?: string;
  mimeType?: string;
  jpegThumbnail?: string;
  isAnimated?: boolean;
  extendedTextMessage?: {
    text: string;
    description?: string;
    title?: string;
    jpegThumbnail?: string;
    isForwarded?: boolean;
    forwardingScore?: number;
  };
  extendedTextMessageData?: {
    text: string;
  };
  pollMessageData?: {
    name: string;
    options: { optionName: string }[];
    allowToChangeAnswer?: boolean;
  };
  quotedMessage?: {
    stanzaId: string;
    participant: string;
    typeMessage: string;
  };
};

export type SendMessageResponse = {
  idMessage: string;
};

export const checkAccount = (
  credentials: GreenApiCredentials,
  phoneNumber: number,
  options: { force?: boolean } = {}
): Promise<CheckAccountResponse> =>
  greenApiRequest<CheckAccountResponse>("checkAccount", {
    credentials,
    method: "POST",
    data: options.force ? { phoneNumber, force: true } : { phoneNumber },
  });

export const getContactInfo = (
  credentials: GreenApiCredentials,
  chatId: string
): Promise<ContactInfo> =>
  greenApiRequest<ContactInfo>("getContactInfo", {
    credentials,
    method: "POST",
    data: { chatId },
  });

/** Returned newest-first, so the UI reverses it before rendering. */
export const getChatHistory = (
  credentials: GreenApiCredentials,
  chatId: string,
  count = 100
): Promise<ChatHistoryMessage[]> =>
  greenApiRequest<ChatHistoryMessage[]>("getChatHistory", {
    credentials,
    method: "POST",
    data: { chatId, count },
  });

export const sendMessage = (
  credentials: GreenApiCredentials,
  chatId: string,
  message: string
): Promise<SendMessageResponse> =>
  greenApiRequest<SendMessageResponse>("sendMessage", {
    credentials,
    method: "POST",
    data: { chatId, message },
  });

export const readChat = (
  credentials: GreenApiCredentials,
  chatId: string
): Promise<{ setRead: boolean }> =>
  greenApiRequest<{ setRead: boolean }>("readChat", {
    credentials,
    method: "POST",
    data: { chatId },
  });