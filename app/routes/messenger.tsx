import { useEffect } from "react";
import { Button, Empty, Flex, Layout, Typography } from "antd";
import { useNavigate } from "react-router";

import type { Route } from "./+types/messenger";
import { clearCredentials, isAuthenticated } from "~/api/auth";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Чат" },
    { name: "description", content: "GREEN API мессенджер" },
  ];
}

export default function Messenger() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const handleLogout = () => {
    clearCredentials();
    navigate("/login", { replace: true });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Layout.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 24,
          background: "#fff",
        }}
      >
        <Typography.Title level={3} style={{ margin: 0 }}>
          Чат
        </Typography.Title>
        <Button onClick={handleLogout}>Выйти</Button>
      </Layout.Header>
      <Layout.Content style={{ padding: 24 }}>
        <Flex
          align="center"
          justify="center"
          style={{ minHeight: "calc(100vh - 64px - 48px)" }}
        >
          <Empty description="Вы авторизованы. Здесь будет интерфейс мессенджера" />
        </Flex>
      </Layout.Content>
    </Layout>
  );
}
