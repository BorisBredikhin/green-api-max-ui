const KEY_CONTACTS = "greenApi.contacts";

export type StoredContact = {
  chatId: string;
  phoneNumber: number;
  name: string;
  avatar: string;
  addedAt: number;
};

const isStoredContact = (value: unknown): value is StoredContact => {
  if (typeof value !== "object" || value === null) return false;
  const contact = value as Partial<StoredContact>;
  return (
    typeof contact.chatId === "string" &&
    contact.chatId !== "" &&
    typeof contact.phoneNumber === "number"
  );
};

export const loadContacts = (): StoredContact[] => {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(KEY_CONTACTS);
    if (raw === null) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isStoredContact)
      .map((contact) => ({
        chatId: contact.chatId,
        phoneNumber: contact.phoneNumber,
        name: contact.name,
        avatar: contact.avatar,
        addedAt: contact.addedAt ?? 0,
      }));
  } catch {
    // A corrupt entry should not lock the user out of the messenger.
    return [];
  }
};

export const saveContacts = (contacts: StoredContact[]): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY_CONTACTS, JSON.stringify(contacts));
};

/** Newest first, and an existing chatId is updated in place rather than duplicated. */
export const addContact = (contact: StoredContact): StoredContact[] => {
  const rest = loadContacts().filter((item) => item.chatId !== contact.chatId);
  const next = [contact, ...rest];
  saveContacts(next);
  return next;
};

export const removeContact = (chatId: string): StoredContact[] => {
  const next = loadContacts().filter((item) => item.chatId !== chatId);
  saveContacts(next);
  return next;
};