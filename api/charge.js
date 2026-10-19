import { randomUUID } from "node:crypto";

const PROVIDER_URL =
  process.env.PROVIDER_URL || "https://api.woovi.com/api/v1/charge";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não permitido" });
  }

  const id = process.env.PROVIDER_CLIENT_ID;
  const secret = process.env.PROVIDER_CLIENT_SECRET;
  if (!id || !secret) {
    return res.status(500).json({ error: "Credenciais não configuradas" });
  }
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");

  const reais = Number(req.body?.valor);
  if (!Number.isFinite(reais) || reais < 5 || reais > 10000) {
    return res.status(400).json({ error: "Valor inválido (mínimo R$ 5,00)" });
  }
  const value = Math.round(reais * 100);

  try {
    const r = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        correlationID: randomUUID(),
        value,
        comment: "Vaquinha do Snow",
      }),
    });

    const texto = await r.text();
    let data;
    try {
      data = JSON.parse(texto);
    } catch {
      data = { raw: texto };
    }

    if (!r.ok) {
      console.error("Provedor:", r.status, texto);
      return res.status(502).json({
        error: `Falha ao criar cobrança (${r.status}): ${texto.slice(0, 200)}`,
      });
    }

    const c = data.charge || data;
    return res.status(200).json({
      brCode: c.brCode,
      qrCodeImage: c.qrCodeImage,
      paymentLinkUrl: c.paymentLinkUrl,
    });
  } catch (e) {
    console.error("Erro interno:", e);
    return res.status(500).json({ error: "Erro interno" });
  }
}
