import type { ChatHistoryMessage } from "./max";
import {
  isNonEmptyString,
  isRecord,
  readJson,
  writeJson,
} from "~/lib/storage";

const KEY_CONTACTS = "greenApi.contacts";

export type StoredContact = {
  chatId: string;
  phoneNumber: number;
  name: string;
  avatar: string;
  addedAt: number;
};

/**
 * MAX does not always know a phone number for a peer that reached the instance
 * on its own, so `0` is the marker the UI reads as "no number".
 */
export const NO_PHONE_NUMBER = 0;

const isStoredContact = (value: unknown): value is StoredContact =>
  isRecord(value) &&
  isNonEmptyString(value.chatId) &&
  typeof value.phoneNumber === "number";

const writeContacts = (contacts: StoredContact[]): void =>
  writeJson(KEY_CONTACTS, contacts);

/** A corrupt entry reads as no contacts at all, rather than locking the user out. */
export const loadContacts = (): StoredContact[] =>
  readJson(KEY_CONTACTS, (value) => {
    if (!Array.isArray(value)) return [];

    return value.filter(isStoredContact).map((contact) => ({
      chatId: contact.chatId,
      phoneNumber: contact.phoneNumber,
      name: contact.name ?? "",
      avatar: contact.avatar ?? "",
      addedAt: contact.addedAt ?? 0,
    }));
  }) ?? [];

/** Newest first, and an existing chatId is updated in place rather than duplicated. */
export const addContact = (contact: StoredContact): StoredContact[] => {
  const next = [
    contact,
    ...loadContacts().filter((item) => item.chatId !== contact.chatId),
  ];
  writeContacts(next);
  return next;
};

/** Best display name available, falling back to the raw chat id. */
const toStoredContact = (message: ChatHistoryMessage): StoredContact => ({
  chatId: message.chatId,
  phoneNumber: message.senderPhoneNumber ?? NO_PHONE_NUMBER,
  name:
    message.chatName ||
    message.senderContactName ||
    message.senderName ||
    message.chatId,
  avatar: "",
  addedAt: Date.now(),
});

/**
 * Adds the chats that `messages` revealed but the list does not hold yet, and
 * returns the whole list newest first — unchanged when there was nothing to add.
 *
 * `reported` belongs to the caller: it remembers which chats this pass has
 * already emitted, so a re-render cannot add the same chat twice.
 */
export const discoverContacts = (
  contacts: StoredContact[],
  messages: ChatHistoryMessage[],
  reported: Set<string>
): StoredContact[] => {
  const known = new Set(contacts.map((contact) => contact.chatId));
  const additions: StoredContact[] = [];

  for (const message of messages) {
    if (known.has(message.chatId) || reported.has(message.chatId)) continue;
    known.add(message.chatId);
    reported.add(message.chatId);
    additions.push(toStoredContact(message));
  }

  if (additions.length === 0) return contacts;

  const next = [...additions, ...contacts];
  writeContacts(next);
  return next;
};
