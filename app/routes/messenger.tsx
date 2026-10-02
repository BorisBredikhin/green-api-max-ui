import { useEffect, useMemo, useState } from "react";
import { LogoutOutlined } from "@ant-design/icons";
import { Button, Flex, Layout, Spin, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router";

import type { Route } from "./+types/messenger";
import { clearCredentials, loadCredentials } from "~/api/auth";
import {
  addContact,
  loadContacts,
  type StoredContact,
} from "~/api/contacts";
import type { GreenApiCredentials } from "~/api/client";
import { useIsAuthenticated } from "~/hooks/useIsAuthenticated";
import { AddContactModal } from "~/components/AddContactModal";
import { ChatPanel } from "~/components/ChatPanel";
import { ContactList } from "~/components/ContactList";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Чат" },
    { name: "description", content: "GREEN API мессенджер" },
  ];
}

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

  const selectedContact = useMemo(
    () => contacts.find((contact) => contact.chatId === selectedChatId) ?? null,
    [contacts, selectedChatId]
  );

  const handleSelect = (chatId: string) => {
    setSearchParams({ chatId }, { replace: true });
  };

  const handleAdded = (contact: StoredContact) => {
    setContacts(addContact(contact));
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
        <Typography.Title level={3} style={{ margin: 0 }}>
          Чат
        </Typography.Title>
        <Button icon={<LogoutOutlined />} onClick={handleLogout}>
          Выйти
        </Button>
      </Layout.Header>

      <Layout.Content style={{ padding: 0 }}>
        <Flex className="messenger" gap={0}>
          <ContactList
            contacts={contacts}
            selectedChatId={selectedChatId}
            onSelect={handleSelect}
            onAdd={() => setIsAddOpen(true)}
          />
          <ChatPanel contact={selectedContact} credentials={credentials} />
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