import { Button, Space, Typography } from "antd";

import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "green-api-max-ui" },
    { name: "description", content: "Ant Design v6 + React Router" },
  ];
}

export default function Home() {
  return (
    <div style={{ padding: 48 }}>
      <Typography.Title>green-api-max-ui</Typography.Title>
      <Typography.Paragraph type="secondary">
        React Router framework mode with Ant Design v6. Theming goes through
        ConfigProvider, not utility classes.
      </Typography.Paragraph>
      <Space>
        <Button color="primary" variant="solid">
          Primary
        </Button>
        <Button>Default</Button>
        <Button variant="dashed">Dashed</Button>
      </Space>
    </div>
  );
}