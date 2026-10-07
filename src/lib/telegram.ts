import "server-only";

export interface HandoffResult {
  sent: boolean;
  via: "telegram" | "logged";
}

// Telegram is the locked choice for designer handoff (see README). If the bot token isn't
// configured yet, we log instead of blocking the demo on it — swap-in is a one-line change
// once the token is available.
export async function sendHandoffNote(note: string): Promise<HandoffResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_DESIGNER_CHAT_ID;

  if (!token || !chatId) {
    console.log("[handoff:logged] Telegram not configured — would have sent:\n", note);
    return { sent: false, via: "logged" };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: note }),
  });

  if (!res.ok) {
    console.error("[handoff:telegram] send failed", await res.text());
    return { sent: false, via: "logged" };
  }

  return { sent: true, via: "telegram" };
}
