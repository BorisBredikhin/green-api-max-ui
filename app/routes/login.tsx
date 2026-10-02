import { useEffect } from "react";
import { Button, Card, Form, Input, Space, Typography } from "antd";
import { useNavigate } from "react-router";

import type { Route } from "./+types/login";
import { getBaseUrl } from "~/api/client";
import { isAuthenticated, saveCredentials } from "~/api/auth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Вход" },
    { name: "description", content: "Авторизация в GREEN API" },
  ];
}

type LoginForm = {
  idInstance: string;
  apiTokenInstance: string;
};

export default function Login() {
  const navigate = useNavigate();
  const [form] = Form.useForm<LoginForm>();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const onFinish = (values: LoginForm) => {
    saveCredentials({
      idInstance: values.idInstance.trim(),
      apiTokenInstance: values.apiTokenInstance.trim(),
      baseUrl: getBaseUrl(),
    });
    navigate("/", { replace: true });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <Space orientation="vertical" style={{ width: "100%", maxWidth: 420 }}>
        <Typography.Title level={2} style={{ textAlign: "center", marginBottom: 0 }}>
          Вход
        </Typography.Title>
        <Card title="Авторизация GREEN API" variant="outlined">
          <Form
            form={form}
            name="login"
            layout="vertical"
            autoComplete="off"
            onFinish={onFinish}
          >
            <Form.Item
              label="idInstance"
              name="idInstance"
              rules={[{ required: true, message: "Введите idInstance" }]}
            >
              <Input allowClear />
            </Form.Item>
            <Form.Item
              label="apiTokenInstance"
              name="apiTokenInstance"
              rules={[{ required: true, message: "Введите apiTokenInstance" }]}
            >
              <Input.Password allowClear />
            </Form.Item>
            <Form.Item label={null}>
              <Button type="primary" htmlType="submit" block>
                Войти
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </Space>
    </div>
  );
}
