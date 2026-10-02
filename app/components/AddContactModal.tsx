import { useEffect, useState } from "react";
import { Alert, Flex, Form, Input, Modal, Typography } from "antd";

import type { StoredContact } from "~/api/contacts";
import { GreenApiError, getErrorMessage, type GreenApiCredentials } from "~/api/client";
import {
  checkAccount,
  getContactInfo,
  isCheckAccountStatusError,
} from "~/api/max";
import {
  PHONE_HINT,
  formatPhone,
  isValidMaxPhone,
  normalizePhone,
} from "~/api/phone";

/** MAX asks clients to back off for hours after a 469, so block rapid retries. */
const RATE_LIMIT_COOLDOWN_SECONDS = 60;

type AddContactForm = {
  phoneNumber: string;
};

type Feedback = {
  type: "error" | "warning";
  title: string;
} | null;

type AddContactModalProps = {
  open: boolean;
  credentials: GreenApiCredentials;
  existingContacts: StoredContact[];
  onClose: () => void;
  onAdded: (contact: StoredContact) => void;
};

export function AddContactModal({
  open,
  credentials,
  existingContacts,
  onClose,
  onAdded,
}: AddContactModalProps) {
  const [form] = Form.useForm<AddContactForm>();
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  const coolingDown = now < cooldownUntil;

  useEffect(() => {
    if (!coolingDown) return;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [coolingDown]);

  const handleClose = () => {
    form.resetFields();
    setFeedback(null);
    setCooldownUntil(0);
    onClose();
  };

  const handleFinish = async (values: AddContactForm) => {
    const digits = normalizePhone(values.phoneNumber ?? "");
    if (!isValidMaxPhone(digits)) return;

    const duplicate = existingContacts.find(
      (contact) => contact.phoneNumber === Number(digits)
    );
    if (duplicate) {
      setFeedback({
        type: "error",
        title: "Этот номер уже есть в списке контактов",
      });
      return;
    }

    setSubmitting(true);
    setFeedback(null);

    try {
      const response = await checkAccount(credentials, Number(digits));

      if (isCheckAccountStatusError(response)) {
        setFeedback({ type: "error", title: response.reason });
        return;
      }

      if (!response.exist || response.chatId === "") {
        setFeedback({
          type: "error",
          title: "Аккаунт MAX на этом номере не найден",
        });
        return;
      }

      const { chatId } = response;
      const alreadyAdded = existingContacts.find(
        (contact) => contact.chatId === chatId
      );
      if (alreadyAdded) {
        onAdded(alreadyAdded);
        handleClose();
        return;
      }

      // A missing name or avatar must not block adding the contact, so this
      // lookup is best-effort and falls back to the formatted number.
      let name = formatPhone(digits);
      let avatar = "";
      try {
        const info = await getContactInfo(credentials, chatId);
        name = info.name || info.contactName || name;
        avatar = info.avatar ?? "";
      } catch {
        // Keep the fallback name.
      }

      onAdded({
        chatId,
        phoneNumber: Number(digits),
        name,
        avatar,
        addedAt: Date.now(),
      });
      handleClose();
    } catch (error) {
      if (error instanceof GreenApiError && error.status === 469) {
        setCooldownUntil(Date.now() + RATE_LIMIT_COOLDOWN_SECONDS * 1000);
        setFeedback({
          type: "warning",
          title:
            "Превышен лимит проверок номеров. Повторите попытку позже — проверки на этом инстансе временно ограничены.",
        });
      } else {
        setFeedback({
          type: "error",
          title: getErrorMessage(error, "Не удалось связаться с GREEN API"),
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title="Добавить контакт"
      open={open}
      onOk={() => form.submit()}
      onCancel={handleClose}
      okText="Проверить и добавить"
      cancelText="Отмена"
      confirmLoading={submitting}
      destroyOnHidden
      mask={{ closable: false }}
      okButtonProps={{ disabled: coolingDown }}
    >
      <Form<AddContactForm>
        form={form}
        layout="vertical"
        name="add-contact"
        autoComplete="off"
        preserve={false}
        onFinish={handleFinish}
      >
        <Form.Item
          label="Номер телефона"
          name="phoneNumber"
          extra={PHONE_HINT}
          rules={[
            { required: true, message: "Введите номер телефона" },
            {
              validator: (_, value: string | undefined) =>
                value && !isValidMaxPhone(normalizePhone(value))
                  ? Promise.reject(new Error(PHONE_HINT))
                  : Promise.resolve(),
            },
          ]}
        >
          <Input
            allowClear
            inputMode="numeric"
            placeholder="7 999 123-45-67"
            disabled={submitting}
          />
        </Form.Item>
      </Form>

      {feedback && (
        <Flex style={{ marginBottom: 16 }}>
          <Alert
            type={feedback.type}
            title={feedback.title}
            showIcon
            style={{ width: "100%" }}
          />
        </Flex>
      )}

      {coolingDown && (
        <Typography.Text type="secondary">
          Повторная проверка доступна через{" "}
          {Math.ceil((cooldownUntil - now) / 1000)} с.
        </Typography.Text>
      )}
    </Modal>
  );
}