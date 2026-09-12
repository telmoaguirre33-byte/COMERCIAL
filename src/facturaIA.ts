import { supabase } from "./supabase";

export type FacturaItemIA = {
  descripcion: string;
  codigo: string | null;
  codigo_barras: string | null;
  cantidad: number;
  costo_unitario: number;
  total_linea: number | null;
  confianza: number;
};

export type FacturaCompraIA = {
  proveedor: {
    razon_social: string | null;
    cuit: string | null;
  };
  fecha: string | null;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  moneda: string | null;
  total: number | null;
  confianza_general: number;
  items: FacturaItemIA[];
};

function leerComoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer la imagen de la factura."));
    reader.readAsDataURL(blob);
  });
}

async function comprimirImagen(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Usá una foto o imagen JPG, PNG o WebP de la factura.");
  if (file.size > 15 * 1024 * 1024) throw new Error("La imagen supera 15 MB. Tomá una foto más liviana.");

  const original = await leerComoDataUrl(file);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("No se pudo abrir la imagen de la factura."));
    img.src = original;
  });

  const max = 1800;
  const escala = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * escala));
  const height = Math.max(1, Math.round(img.naturalHeight * escala));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return original;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function validarFactura(data: unknown): FacturaCompraIA {
  if (!data || typeof data !== "object") throw new Error("La IA no devolvió una factura válida.");
  const factura = data as Partial<FacturaCompraIA>;
  const items = Array.isArray(factura.items) ? factura.items : [];
  const validos = items
    .map((item) => item as Partial<FacturaItemIA>)
    .filter((item) => typeof item.descripcion === "string" && item.descripcion.trim())
    .map((item) => ({
      descripcion: String(item.descripcion).trim(),
      codigo: item.codigo ? String(item.codigo).trim() : null,
      codigo_barras: item.codigo_barras ? String(item.codigo_barras).trim() : null,
      cantidad: Number(item.cantidad ?? 0),
      costo_unitario: Number(item.costo_unitario ?? 0),
      total_linea: item.total_linea == null ? null : Number(item.total_linea),
      confianza: Math.max(0, Math.min(1, Number(item.confianza ?? 0))),
    }))
    .filter((item) => Number.isFinite(item.cantidad) && item.cantidad > 0 && Number.isFinite(item.costo_unitario) && item.costo_unitario >= 0);

  if (validos.length === 0) throw new Error("No pude reconocer productos con cantidad y costo válidos. Probá con otra foto más nítida.");

  const proveedor = factura.proveedor && typeof factura.proveedor === "object" ? factura.proveedor : {};
  return {
    proveedor: {
      razon_social: proveedor.razon_social ? String(proveedor.razon_social).trim() : null,
      cuit: proveedor.cuit ? String(proveedor.cuit).replace(/\D/g, "") : null,
    },
    fecha: factura.fecha ? String(factura.fecha) : null,
    tipo_comprobante: factura.tipo_comprobante ? String(factura.tipo_comprobante).trim() : null,
    numero_comprobante: factura.numero_comprobante ? String(factura.numero_comprobante).trim() : null,
    moneda: factura.moneda ? String(factura.moneda).trim() : null,
    total: factura.total == null ? null : Number(factura.total),
    confianza_general: Math.max(0, Math.min(1, Number(factura.confianza_general ?? 0))),
    items: validos,
  };
}

export async function analizarFacturaCompraSigo(empresaId: string, file: File): Promise<FacturaCompraIA> {
  if (!empresaId) throw new Error("No hay empresa activa para analizar la factura.");
  const imageDataUrl = await comprimirImagen(file);
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("La sesión venció. Volvé a ingresar a SIGO.");

  const response = await fetch("/api/compras/analizar-factura", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ empresaId, imageDataUrl }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const code = String(payload?.error ?? "");
    if (code === "AI_NOT_CONFIGURED") throw new Error("La IA de facturas todavía no tiene configurada su clave en producción.");
    if (code === "FORBIDDEN") throw new Error("Tu usuario no tiene permiso para ingresar compras en esta empresa.");
    if (code === "INVALID_IMAGE") throw new Error("La foto no tiene un formato válido o es demasiado pesada.");
    throw new Error(String(payload?.message ?? payload?.error ?? "No se pudo analizar la factura con IA."));
  }

  return validarFactura(payload?.factura);
}
