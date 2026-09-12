const MAX_DATA_URL_LENGTH = 8_000_000;
const MAX_INVOICE_ITEMS = 300;
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

function textoSeguro(value, max = 180) {
  if (value == null) return null;
  const texto = String(value).trim().replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ");
  return texto ? texto.slice(0, max) : null;
}

function numeroSeguro(value, { min = 0, max = 1_000_000_000_000, nullable = false } = {}) {
  if (value == null || value === "") return nullable ? null : NaN;
  const numero = Number(value);
  if (!Number.isFinite(numero) || numero < min || numero > max) return nullable ? null : NaN;
  return numero;
}

function confianza(value) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return 0;
  return Math.max(0, Math.min(1, numero));
}

function normalizarFacturaIA(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("INVALID_INVOICE_OBJECT");

  const proveedorRaw = raw.proveedor && typeof raw.proveedor === "object" && !Array.isArray(raw.proveedor)
    ? raw.proveedor
    : {};
  const cuitLeido = String(proveedorRaw.cuit ?? "").replace(/\D/g, "");
  const itemsRaw = Array.isArray(raw.items) ? raw.items.slice(0, MAX_INVOICE_ITEMS) : [];
  const items = [];

  for (const item of itemsRaw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const descripcion = textoSeguro(item.descripcion, 240);
    const cantidad = numeroSeguro(item.cantidad, { min: 0.000001, max: 1_000_000 });
    const costoUnitario = numeroSeguro(item.costo_unitario, { min: 0, max: 1_000_000_000_000 });
    if (!descripcion || !Number.isFinite(cantidad) || !Number.isFinite(costoUnitario)) continue;

    items.push({
      descripcion,
      codigo: textoSeguro(item.codigo, 80),
      codigo_barras: textoSeguro(item.codigo_barras, 80),
      cantidad,
      costo_unitario: costoUnitario,
      total_linea: numeroSeguro(item.total_linea, { min: 0, max: 1_000_000_000_000, nullable: true }),
      confianza: confianza(item.confianza),
    });
  }

  if (items.length === 0) throw new Error("NO_VALID_INVOICE_ITEMS");

  const fechaTexto = textoSeguro(raw.fecha, 16);
  const fecha = fechaTexto && /^\d{4}-\d{2}-\d{2}$/.test(fechaTexto) ? fechaTexto : null;

  return {
    proveedor: {
      razon_social: textoSeguro(proveedorRaw.razon_social, 180),
      cuit: cuitLeido.length === 11 ? cuitLeido : null,
    },
    fecha,
    tipo_comprobante: textoSeguro(raw.tipo_comprobante, 60),
    numero_comprobante: textoSeguro(raw.numero_comprobante, 80),
    moneda: textoSeguro(raw.moneda, 12),
    total: numeroSeguro(raw.total, { min: 0, max: 1_000_000_000_000, nullable: true }),
    confianza_general: confianza(raw.confianza_general),
    items,
  };
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
    const factura = normalizarFacturaIA(parseJsonText(text));
    return json(res, 200, { factura, model });
  } catch (error) {
    console.error("SIGO invoice parse error", error);
    return json(res, 502, { error: "AI_INVALID_OUTPUT", message: "La IA respondió, pero no devolvió una factura segura y utilizable." });
  }
}
