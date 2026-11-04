import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export function EmailShell({
  preview,
  title,
  children,
  actionUrl,
  actionLabel,
  footer,
}: {
  preview: string;
  title: string;
  children: React.ReactNode;
  actionUrl: string;
  actionLabel: string;
  footer: string;
}) {
  return (
    <Html lang="ru">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={brand}>СтройCRM</Heading>
          <Text style={muted}>Объекты и задачи для строительной компании</Text>
          <Hr style={hr} />
          <Heading as="h2" style={heading}>
            {title}
          </Heading>
          {children}
          <Section style={buttonWrap}>
            <Button href={actionUrl} style={button}>
              {actionLabel}
            </Button>
          </Section>
          <Text style={text}>Если кнопка не открывается, скопируйте ссылку в браузер:</Text>
          <Text style={link}>{actionUrl}</Text>
          <Hr style={hr} />
          <Text style={small}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f4f1ea",
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  margin: 0,
  padding: "24px 0",
};
const container = {
  backgroundColor: "#ffffff",
  borderRadius: "16px",
  margin: "0 auto",
  maxWidth: "520px",
  padding: "32px",
};
const brand = { color: "#1c1917", fontSize: "22px", margin: "0" };
const muted = { color: "#78716c", fontSize: "13px", margin: "4px 0 0" };
const heading = { color: "#1c1917", fontSize: "20px", margin: "0 0 12px" };
const text = { color: "#44403c", fontSize: "15px", lineHeight: "1.6" };
const buttonWrap = { textAlign: "center" as const, margin: "24px 0" };
const button = {
  backgroundColor: "#b45309",
  borderRadius: "10px",
  color: "#fff7ed",
  display: "inline-block",
  fontSize: "15px",
  fontWeight: 600,
  padding: "12px 22px",
  textDecoration: "none",
};
const link = { color: "#b45309", fontSize: "12px", lineHeight: "1.5", wordBreak: "break-all" as const };
const hr = { borderColor: "#e7e5e4", margin: "20px 0" };
const small = { color: "#a8a29e", fontSize: "12px", lineHeight: "1.5" };

export const emailText = text;
