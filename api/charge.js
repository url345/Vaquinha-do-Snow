const URL_API = "https://api.anovapay.com.br/charges";

function varrer(obj, out = [], nivel = 0) {
  if (!obj || typeof obj !== "object" || nivel > 5) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out.push([k.toLowerCase(), v]);
    else varrer(v, out, nivel + 1);
  }
  return out;
}

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

  const reais = Number(req.body?.valor);
  if (!Number.isFinite(reais) || reais < 5 || reais > 10000) {
    return res.status(400).json({ error: "Valor inválido (mínimo R$ 5,00)" });
  }

  try {
    const r = await fetch(URL_API, {
      method: "POST",
      headers: {
        ci: id,
        cs: secret,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: reais,
        description: "Vaquinha do Snow",
      }),
    });

    const texto = await r.text();
    let data;
    try {
      data = JSON.parse(texto);
    } catch {
      data = {};
    }

    if (!r.ok) {
      console.error("Provedor:", r.status, texto);
      return res.status(502).json({
        error: `Falha ao criar cobrança (${r.status}): ${texto.slice(0, 200)}`,
      });
    }

    const pares = varrer(data);
    const brCode = pares.find(([, v]) => v.startsWith("000201"))?.[1] || null;

    let qr =
      pares.find(
        ([k, v]) =>
          v.startsWith("data:image") ||
          (/qr|image|imagem/.test(k) && /^https?:\/\//.test(v))
      )?.[1] || null;

    if (!qr) {
      const b64 = pares.find(
        ([k, v]) =>
          /qr|image|imagem|base64/.test(k) &&
          !v.startsWith("000201") &&
          /^[A-Za-z0-9+/=]{200,}$/.test(v)
      );
      if (b64) qr = `data:image/png;base64,${b64[1]}`;
    }

    if (!brCode && !qr) {
      console.error("Resposta sem Pix:", texto);
      return res.status(502).json({
        error: `Resposta inesperada: ${texto.slice(0, 300)}`,
      });
    }

    return res.status(200).json({ brCode, qrCodeImage: qr });
  } catch (e) {
    console.error("Erro interno:", e);
    return res.status(500).json({ error: "Erro interno" });
  }
}
