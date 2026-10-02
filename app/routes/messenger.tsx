import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LogoutOutlined } from "@ant-design/icons";
import { Alert, Badge, Button, Flex, Layout, Spin, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router";

import type { Route } from "./+types/messenger";
import { clearCredentials, loadCredentials } from "~/api/auth";
import {
  addContact,
  loadContacts,
  saveContacts,
  type StoredContact,
} from "~/api/contacts";
import type { GreenApiCredentials } from "~/api/client";
import {
  WEBHOOK_URL_CONFLICT_HINT,
  setHttpApiSettings,
} from "~/api/notifications";
import type { ChatHistoryMessage } from "~/api/max";
import { useIsAuthenticated } from "~/hooks/useIsAuthenticated";
import { useNotificationPoller } from "~/hooks/useNotificationPoller";
import { AddContactModal } from "~/components/AddContactModal";
import { ChatPanel } from "~/components/ChatPanel";
import { ContactList } from "~/components/ContactList";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Чат" },
    { name: "description", content: "GREEN API мессенджер" },
  ];
}

/**
 * SetSettings is limited to 1 request/second and mutates the instance, so the
 * session flag keeps a route remount from repeating it while the cooldown keeps
 * a conflict from retrying faster than the instance can apply the change.
 */
const SETTINGS_SESSION_KEY = "greenApi.httpApiSettingsReady";
const SETTINGS_COOLDOWN_MS = 60_000;

const readSessionFlag = (key: string): boolean => {
  try {
    return window.sessionStorage.getItem(key) === "1";
  } catch {
    // A blocked storage partition should not stop polling.
    return false;
  }
};

const writeSessionFlag = (key: string): void => {
  try {
    window.sessionStorage.setItem(key, "1");
  } catch {
    // Same as above: the fix is simply re-applied next session.
  }
};

/**
 * A notification can arrive for a chat that was never added by hand. MAX does
 * not always know a phone number for that peer, so `phoneNumber: 0` is the
 * marker the contact list reads as "no number".
 */
const toStoredContact = (message: ChatHistoryMessage): StoredContact => ({
  chatId: message.chatId,
  phoneNumber: message.senderPhoneNumber ?? 0,
  name:
    message.chatName ||
    message.senderContactName ||
    message.senderName ||
    message.chatId,
  avatar: "",
  addedAt: Date.now(),
});

export default function Messenger() {
  const navigate = useNavigate();
  const { ready, authenticated } = useIsAuthenticated();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<StoredContact[]>([]);
  const [credentials, setCredentials] = useState<GreenApiCredentials | null>(
    null
  );
  const [isAddOpen, setIsAddOpen] = useState(false);

  const selectedChatId = searchParams.get("chatId");

  useEffect(() => {
    if (ready && !authenticated) {
      navigate("/login", { replace: true });
    }
  }, [ready, authenticated, navigate]);

  // Both reads must wait for mount: `react-router build` prerenders this route
  // for SPA mode, where localStorage does not exist.
  useEffect(() => {
    if (!authenticated) return;
    setContacts(loadContacts());
    setCredentials(loadCredentials());
  }, [authenticated]);

  const poller = useNotificationPoller(credentials, selectedChatId);
  const lastSettingsAttemptRef = useRef(0);
  const knownChatIdsRef = useRef<Set<string>>(new Set());

  const applyHttpApiSettings = useCallback(
    async (force = false) => {
      if (!credentials) return;
      if (!force && readSessionFlag(SETTINGS_SESSION_KEY)) return;

      const now = Date.now();
      if (now - lastSettingsAttemptRef.current < SETTINGS_COOLDOWN_MS) return;
      lastSettingsAttemptRef.current = now;

      try {
        await setHttpApiSettings(credentials);
        writeSessionFlag(SETTINGS_SESSION_KEY);
      } catch {
        // Leaving the flag unset lets a later conflict retry.
      }
    },
    [credentials]
  );

  // HTTP API polling is only legal with an empty `webhookUrl`, so the instance
  // is pointed at it as soon as credentials are available.
  useEffect(() => {
    void applyHttpApiSettings();
  }, [applyHttpApiSettings]);

  // Someone may have set a webhook in the cabinet mid-session; the poller
  // surfaces it as a conflict and the instance is re-pointed here.
  useEffect(() => {
    if (!poller.settingsConflict) return;
    void applyHttpApiSettings(true);
  }, [poller.settingsConflict, applyHttpApiSettings]);

  // Surface a chat the user never added by hand as soon as it talks.
  useEffect(() => {
    if (!credentials || poller.messages.length === 0) return;

    const known = new Set(contacts.map((contact) => contact.chatId));
    const additions: StoredContact[] = [];

    for (const message of poller.messages) {
      if (known.has(message.chatId) || knownChatIdsRef.current.has(message.chatId)) {
        continue;
      }
      known.add(message.chatId);
      knownChatIdsRef.current.add(message.chatId);
      additions.push(toStoredContact(message));
    }

    if (additions.length === 0) return;

    const merged = [...additions, ...contacts];
    saveContacts(merged);
    setContacts(merged);
  }, [credentials, poller.messages, contacts]);

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.chatId === selectedChatId) ?? null,
    [contacts, selectedChatId]
  );

  const liveMessages = useMemo(
    () =>
      selectedChatId
        ? poller.messages.filter((message) => message.chatId === selectedChatId)
        : [],
    [poller.messages, selectedChatId]
  );

  const handleSelect = (chatId: string) => {
    setSearchParams({ chatId }, { replace: true });
  };

  const handleAdded = (contact: StoredContact) => {
    setContacts(addContact(contact));
    knownChatIdsRef.current.add(contact.chatId);
    setSearchParams({ chatId: contact.chatId }, { replace: true });
  };

  const handleLogout = () => {
    clearCredentials();
    navigate("/login", { replace: true });
  };

  if (!ready || !authenticated || credentials === null) {
    return (
      <Flex align="center" justify="center" style={{ minHeight: "100vh" }}>
        <Spin size="large" />
      </Flex>
    );
  }

  return (
    <Layout style={{ height: "100vh" }}>
      <Layout.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 24,
        }}
      >
        <Flex align="center" gap={12}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Чат
          </Typography.Title>
          <Badge
            status={poller.status === "error" ? "error" : "processing"}
            text={
              poller.status === "error"
                ? "Нет связи с GREEN API"
                : "Приём включён"
            }
          />
        </Flex>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          Выйти
        </Button>
      </Layout.Header>

      <Layout.Content style={{ padding: 0 }}>
        {poller.settingsConflict && (
          <Alert
            type="warning"
            title={WEBHOOK_URL_CONFLICT_HINT}
            showIcon
            banner
          />
        )}
        {poller.error && !poller.settingsConflict && (
          <Alert type="error" title={poller.error} showIcon banner />
        )}
        <Flex className="messenger" gap={0}>
          <ContactList
            contacts={contacts}
            selectedChatId={selectedChatId}
            unreadByChatId={poller.unreadByChatId}
            onSelect={handleSelect}
            onAdd={() => setIsAddOpen(true)}
          />
          <ChatPanel
            contact={selectedContact}
            credentials={credentials}
            liveMessages={liveMessages}
          />
        </Flex>
      </Layout.Content>

      <AddContactModal
        open={isAddOpen}
        credentials={credentials}
        existingContacts={contacts}
        onClose={() => setIsAddOpen(false)}
        onAdded={handleAdded}
      />
    </Layout>
  );
}