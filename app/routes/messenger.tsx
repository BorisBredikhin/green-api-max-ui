import { useEffect, useMemo, useRef, useState } from "react";
import { LogoutOutlined } from "@ant-design/icons";
import { Alert, Badge, Button, Flex, Layout, Spin, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router";

import type { Route } from "./+types/messenger";
import { clearCredentials } from "~/api/auth";
import {
  addContact,
  discoverContacts,
  loadContacts,
  type StoredContact,
} from "~/api/contacts";
import { WEBHOOK_URL_CONFLICT_HINT } from "~/api/notifications";
import { useCredentials } from "~/hooks/useCredentials";
import { useHttpApiSettings } from "~/hooks/useHttpApiSettings";
import { useNotificationPoller } from "~/hooks/useNotificationPoller";
import { AddContactModal } from "~/components/AddContactModal";
import { ChatPanel } from "~/components/ChatPanel";
import { ContactList } from "~/components/ContactList";

export const meta: Route.MetaFunction = () => [
  { title: "Чат" },
  { name: "description", content: "GREEN API мессенджер" },
];

export default function Messenger() {
  const navigate = useNavigate();
  const { ready, credentials } = useCredentials();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState<StoredContact[]>([]);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const selectedChatId = searchParams.get("chatId");

  useEffect(() => {
    if (ready && !credentials) {
      navigate("/login", { replace: true });
    }
  }, [ready, credentials, navigate]);

  // Contacts live in localStorage too, so they can only be read after mount.
  useEffect(() => {
    setContacts(loadContacts());
  }, []);

  const poller = useNotificationPoller(credentials, selectedChatId);
  const reportedChatIdsRef = useRef(new Set<string>());

  /**
   * HTTP API polling is only legal with an empty `webhookUrl`, so the instance
   * is pointed at it as soon as credentials arrive — and pointed there again
   * whenever the poller reports that a webhook was set on the instance
   * mid-session.
   */
  useHttpApiSettings(credentials, poller.settingsConflict);

  // Surface a chat the user never added by hand as soon as it talks.
  useEffect(() => {
    if (!credentials || poller.messages.length === 0) return;

    const merged = discoverContacts(
      contacts,
      poller.messages,
      reportedChatIdsRef.current
    );
    // An unchanged list means every chat in the buffer was already reported.
    if (merged !== contacts) setContacts(merged);
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

  const openChat = (chatId: string) => {
    setSearchParams({ chatId }, { replace: true });
  };

  const handleAdded = (contact: StoredContact) => {
    setContacts(addContact(contact));
    reportedChatIdsRef.current.add(contact.chatId);
    openChat(contact.chatId);
  };

  const handleLogout = () => {
    clearCredentials();
    navigate("/login", { replace: true });
  };

  if (!ready || !credentials) {
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
            onSelect={openChat}
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