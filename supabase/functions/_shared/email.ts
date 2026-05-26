// Resend wrapper for transactional branded emails (payment receipts, etc.)
// Requires env vars: RESEND_API_KEY, RESEND_FROM_EMAIL

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface SendBrandedReceiptArgs {
  to: string;
  planName: string;
  amountBrl: number;
  invoicePdfUrl?: string | null;
  hostedInvoiceUrl?: string | null;
}

export async function sendBrandedReceipt(args: SendBrandedReceiptArgs): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("RESEND_FROM_EMAIL");
  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY or RESEND_FROM_EMAIL not set, skipping branded email");
    return;
  }

  const formattedAmount = args.amountBrl.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const html = renderReceiptHtml({
    planName: args.planName,
    formattedAmount,
    invoiceUrl: args.hostedInvoiceUrl ?? args.invoicePdfUrl ?? null,
  });

  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: `Pagamento confirmado — Plano ${args.planName}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[email] Resend send failed: ${res.status} ${text}`);
    throw new Error(`Resend send failed: ${res.status}`);
  }
}

function renderReceiptHtml(args: { planName: string; formattedAmount: string; invoiceUrl: string | null }): string {
  const invoiceBlock = args.invoiceUrl
    ? `<p style="margin:24px 0 0"><a href="${args.invoiceUrl}" style="display:inline-block;padding:12px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Baixar nota fiscal</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Pagamento confirmado</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f3f4f6">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:32px 24px;text-align:center">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700">YesLiv</h1>
    </div>
    <div style="padding:32px 24px">
      <h2 style="margin:0 0 16px;font-size:20px;color:#111827">Pagamento confirmado &#x2705;</h2>
      <p style="margin:0 0 16px;color:#374151;line-height:1.6">Recebemos seu pagamento. Seu acesso já está liberado!</p>
      <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Plano</p>
        <p style="margin:0 0 16px;color:#111827;font-size:18px;font-weight:600">${args.planName}</p>
        <p style="margin:0 0 8px;color:#6b7280;font-size:13px">Valor pago</p>
        <p style="margin:0;color:#111827;font-size:18px;font-weight:600">${args.formattedAmount}</p>
      </div>
      ${invoiceBlock}
      <p style="margin:32px 0 0;color:#6b7280;font-size:13px;line-height:1.6">
        Precisa de ajuda? Responda este e-mail ou escreva para
        <a href="mailto:suporte@yesliv.com" style="color:#3b82f6">suporte@yesliv.com</a>.
      </p>
    </div>
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;color:#9ca3af;font-size:12px">
      &copy; YesLiv &middot; Este e-mail foi enviado para confirmar seu pagamento
    </div>
  </div>
</body>
</html>`;
}
