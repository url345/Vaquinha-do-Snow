import { randomUUID } from "node:crypto";

const PROVIDER_URL =
  process.env.PROVIDER_URL || "https://api.woovi.com/api/v1/charge";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const apiKey = process.env.PROVIDER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Chave da API não configurada" });
  }

  const reais = Number(req.body?.valor);
  if (!Number.isFinite(reais) || reais < 5 || reais > 10000) {
    return res.status(400).json({ error: "Valor inválido (mínimo R$ 5,00)" });
  }
  const value = Math.round(reais * 100);

  try {
    const r = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correlationID: randomUUID(),
        value,
        comment: "Vaquinha do Snow",
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      return res.status(502).json({ error: "Falha ao criar cobrança" });
    }

    const c = data.charge || data;
    return res.status(200).json({
      brCode: c.brCode,
      qrCodeImage: c.qrCodeImage,
      paymentLinkUrl: c.paymentLinkUrl,
    });
  } catch {
    return res.status(500).json({ error: "Erro interno" });
  }
}
