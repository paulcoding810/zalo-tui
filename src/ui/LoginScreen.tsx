import { Box, Text } from "ink";
import type { RenderedQR } from "../qr.ts";

type Props = {
  qr: RenderedQR | null;
  status: string;
  notice?: string;
};

export function LoginScreen({ qr, status, notice }: Props) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">
        Zalo TUI · log in
      </Text>
      {notice ? <Text color="yellow">{notice}</Text> : null}
      <Text>Open Zalo on your phone → QR scanner, and scan this code.</Text>
      {qr && "text" in qr ? <Text>{qr.text}</Text> : null}
      {qr && "path" in qr ? <Text>Could not draw the QR here. Open the image: {qr.path}</Text> : null}
      {!qr ? <Text dimColor>Requesting QR code…</Text> : null}
      <Text color="green">{status}</Text>
      <Text dimColor>Ctrl+C to quit</Text>
    </Box>
  );
}
