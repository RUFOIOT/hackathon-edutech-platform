import "server-only";
import QRCode from "qrcode";
import { tokenQr } from "@/lib/checkin/qr";

/** SVG del QR personal de check-in, generado en el servidor (no expone el secreto al cliente). */
export async function qrCheckinSvg(uid: string): Promise<string> {
  const secreto = process.env.CHECKIN_QR_SECRET;
  if (!secreto) throw new Error("Falta CHECKIN_QR_SECRET (ver .env.example)");
  return QRCode.toString(tokenQr(secreto, uid), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#0E1B3D", light: "#FFFFFF" },
  });
}
