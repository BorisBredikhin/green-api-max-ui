import { UserOutlined } from "@ant-design/icons";
import { Avatar, Typography } from "antd";

import { NO_PHONE_NUMBER, type StoredContact } from "~/api/contacts";
import { formatPhone } from "~/api/phone";

type ContactAvatarProps = {
  contact: StoredContact;
  size?: number;
};

/** MAX does not always expose an avatar, so the person icon is the floor. */
export function ContactAvatar({ contact, size = 40 }: ContactAvatarProps) {
  return (
    <Avatar
      size={size}
      src={contact.avatar || undefined}
      icon={<UserOutlined />}
    />
  );
}

type ContactPhoneProps = {
  phoneNumber: number;
};

/**
 * Renders nothing for a chat discovered through a notification: MAX may not know
 * a number for a peer that reached the instance on its own.
 */
export function ContactPhone({ phoneNumber }: ContactPhoneProps) {
  if (phoneNumber === NO_PHONE_NUMBER) return null;

  return (
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {formatPhone(String(phoneNumber))}
    </Typography.Text>
  );
}
