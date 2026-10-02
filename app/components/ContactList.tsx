import { PlusOutlined, UserOutlined } from "@ant-design/icons";
import { Avatar, Badge, Button, Empty, Flex, Listy, Typography, theme } from "antd";

import type { StoredContact } from "~/api/contacts";
import { formatPhone } from "~/api/phone";

type ContactListProps = {
  contacts: StoredContact[];
  selectedChatId: string | null;
  /** Unread counts per chat, from the notification poller. */
  unreadByChatId: Record<string, number>;
  onSelect: (chatId: string) => void;
  onAdd: () => void;
};

export function ContactList({
  contacts,
  selectedChatId,
  unreadByChatId,
  onSelect,
  onAdd,
}: ContactListProps) {
  const { token } = theme.useToken();

  return (
    <div
      className="messenger__pane messenger__contacts"
      style={{ borderRight: `1px solid ${token.colorBorderSecondary}` }}
    >
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: "12px 16px",
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text strong>Контакты</Typography.Text>
        <Button
          color="primary"
          variant="solid"
          size="small"
          icon={<PlusOutlined />}
          onClick={onAdd}
          aria-label="Добавить контакт"
        />
      </Flex>

      <div className="messenger__scroll">
        {contacts.length === 0 ? (
          <Flex align="center" justify="center" style={{ height: "100%" }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Список контактов пуст"
            />
          </Flex>
        ) : (
          <Listy<StoredContact>
            items={contacts}
            rowKey="chatId"
            itemRender={(contact) => {
              const selected = contact.chatId === selectedChatId;
              const unread = unreadByChatId[contact.chatId] ?? 0;
              return (
                <Button
                  type="text"
                  block
                  onClick={() => onSelect(contact.chatId)}
                  style={{
                    height: "auto",
                    padding: "8px 16px",
                    justifyContent: "flex-start",
                    textAlign: "left",
                    background: selected
                      ? token.colorPrimaryBg
                      : undefined,
                    boxShadow: selected
                      ? `inset 3px 0 0 ${token.colorPrimary}`
                      : undefined,
                  }}
                >
                  <Flex align="center" gap={12} style={{ width: "100%" }}>
                    <Badge
                      count={unread}
                      size="small"
                      // A zero-count badge would still occupy the dot.
                      dot={unread > 0}
                    >
                      <Avatar
                        size={40}
                        src={contact.avatar || undefined}
                        icon={<UserOutlined />}
                      />
                    </Badge>
                    <Flex vertical style={{ minWidth: 0, flex: 1 }}>
                      <Typography.Text
                        strong={selected || unread > 0}
                        ellipsis
                        style={{ display: "block" }}
                      >
                        {contact.name}
                      </Typography.Text>
                      {/* A chat discovered through a notification may carry no number. */}
                      {contact.phoneNumber !== 0 && (
                        <Typography.Text
                          type="secondary"
                          style={{ fontSize: 12 }}
                        >
                          {formatPhone(String(contact.phoneNumber))}
                        </Typography.Text>
                      )}
                    </Flex>
                  </Flex>
                </Button>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}