import { writeFileSync } from "node:fs";
import jsQR from "jsqr";
import { PNG } from "pngjs";
import QRCode from "qrcode";

export type RenderedQR = { text: string } | { path: string };

export async function renderQR(base64Png: string, fallbackPath: string): Promise<RenderedQR> {
  const buffer = Buffer.from(base64Png, "base64");
  try {
    const png = PNG.sync.read(buffer);
    const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
    if (decoded?.data) {
      const text = await QRCode.toString(decoded.data, { type: "utf8", margin: 2, errorCorrectionLevel: "L" });
      return { text: text.replace(/\n+$/, "") };
    }
  } catch {}
  writeFileSync(fallbackPath, buffer, { mode: 0o600 });
  return { path: fallbackPath };
}
