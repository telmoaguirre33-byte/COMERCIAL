const MAX_DATA_URL_LENGTH = 8_000_000;
const ALLOWED_IMAGE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

function json(res, status, body) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8").send(JSON.stringify(body));
}

function getOutputText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) return data.output_text.trim();
  const parts = [];
  for (const output of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(output?.content) ? output.content : []) {
      if (typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonText(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}

async function validarUsuarioYPermiso(req, empresaId) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const auth = String(req.headers.authorization || "");
  if (!supabaseUrl || !anonKey || !auth.startsWith("Bearer ")) return false;

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: auth },
  });
  if (!userResponse.ok) return false;

  const permisoResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/tiene_permiso_empresa`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_empresa_id: empresaId, p_permiso: "purchases.write" }),
  });
  if (!permisoResponse.ok) return false;
  const permitido = await permisoResponse.json().catch(() => false);
  return permitido === true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "METHOD_NOT_ALLOWED" });

  const empresaId = String(req.body?.empresaId || "").trim();
  const imageDataUrl = String(req.body?.imageDataUrl || "");
  if (!empresaId) return json(res, 400, { error: "EMPRESA_REQUIRED" });
  if (!ALLOWED_IMAGE.test(imageDataUrl) || imageDataUrl.length > MAX_DATA_URL_LENGTH) {
    return json(res, 400, { error: "INVALID_IMAGE" });
  }

  try {
    if (!(await validarUsuarioYPermiso(req, empresaId))) return json(res, 403, { error: "FORBIDDEN" });
  } catch {
    return json(res, 403, { error: "FORBIDDEN" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json(res, 503, { error: "AI_NOT_CONFIGURED" });

  const model = process.env.OPENAI_INVOICE_MODEL || "gpt-5.6-luna";
  const prompt = `Analizá esta factura o ticket de compra argentino para cargar mercadería en un sistema comercial.
No inventes datos. Si algo no es legible, usá null y baja confianza.
Extraé únicamente productos/servicios efectivamente facturados; no conviertas IVA, descuentos globales, percepciones, subtotales ni totales en productos.
Para cada ítem, cantidad y costo_unitario deben ser números. costo_unitario es el precio unitario de compra antes de multiplicar por cantidad. Si sólo figura total de línea y cantidad, calculá costo unitario.
Si aparece un código de producto del proveedor, guardalo en codigo. Si aparece un EAN/UPC/código de barras, guardalo en codigo_barras.
fecha en formato YYYY-MM-DD cuando sea posible. CUIT sólo dígitos.
Respondé SOLAMENTE JSON válido con esta forma exacta:
{"proveedor":{"razon_social":string|null,"cuit":string|null},"fecha":string|null,"tipo_comprobante":string|null,"numero_comprobante":string|null,"moneda":string|null,"total":number|null,"confianza_general":number,"items":[{"descripcion":string,"codigo":string|null,"codigo_barras":string|null,"cantidad":number,"costo_unitario":number,"total_linea":number|null,"confianza":number}]}
confianza_general y confianza van de 0 a 1.`;

  let aiResponse;
  try {
    aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_output_tokens: 6000,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl, detail: "high" },
          ],
        }],
      }),
    });
  } catch {
    return json(res, 502, { error: "AI_UNAVAILABLE", message: "No se pudo conectar con el servicio de IA." });
  }

  if (!aiResponse.ok) {
    const detail = await aiResponse.text().catch(() => "");
    console.error("SIGO invoice AI error", aiResponse.status, detail.slice(0, 1200));
    return json(res, 502, { error: "AI_ERROR", message: "La IA no pudo procesar la factura." });
  }

  try {
    const aiData = await aiResponse.json();
    const text = getOutputText(aiData);
    if (!text) throw new Error("EMPTY_AI_OUTPUT");
    const factura = parseJsonText(text);
    return json(res, 200, { factura, model });
  } catch (error) {
    console.error("SIGO invoice parse error", error);
    return json(res, 502, { error: "AI_INVALID_OUTPUT", message: "La IA respondió, pero no se pudo interpretar la factura." });
  }
}
