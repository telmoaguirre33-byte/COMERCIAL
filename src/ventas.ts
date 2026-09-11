import { supabase } from "./supabase";

export type MedioPagoSigo =
  | "efectivo"
  | "debito"
  | "credito"
  | "transferencia"
  | "cuenta_corriente"
  | "otro";

export type VentaItemSigoInput = {
  productoId: string;
  cantidad: number;
};

function crearIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function mensajeVenta(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  if (raw.includes("ACCOUNT_CURRENT_REQUIRES_CLIENT")) return "Cuenta corriente requiere seleccionar un cliente.";
  if (raw.includes("CLIENT_NOT_FOUND")) return "El cliente seleccionado ya no está disponible en esta empresa.";
  if (raw.includes("CREDIT_LIMIT_EXCEEDED")) return "La venta supera el límite de crédito disponible del cliente.";
  if (raw.includes("CLIENTS_READ_FORBIDDEN")) return "Tu usuario no tiene permiso para usar clientes en ventas.";
  if (raw.includes("SALES_WRITE_FORBIDDEN")) return "Tu usuario no tiene permiso para confirmar ventas en esta empresa.";
  if (raw.includes("INSUFFICIENT_STOCK")) return "El stock cambió y ya no alcanza para completar la venta. Revisá el carrito.";
  if (raw.includes("PRODUCT_PRICE_REQUIRED")) return "Hay un producto sin precio de venta configurado.";
  if (raw.includes("PRODUCT_STOCK_REQUIRED")) return "Hay un producto sin stock operativo configurado.";
  if (raw.includes("PRODUCT_NOT_FOUND")) return "Uno de los productos ya no está disponible en esta empresa.";
  if (raw.includes("SALE_ITEMS_REQUIRED")) return "Agregá al menos un producto antes de confirmar.";
  if (raw.includes("AUTH_REQUIRED")) return "La sesión venció. Volvé a ingresar a SIGO.";
  return raw || "No se pudo confirmar la venta.";
}

export async function confirmarVentaSigo(input: {
  empresaId: string;
  items: VentaItemSigoInput[];
  medioPago: MedioPagoSigo;
  clienteId?: string | null;
  idempotencyKey?: string;
}): Promise<{ ventaId: string; idempotencyKey: string }> {
  if (!input.empresaId) throw new Error("Seleccioná una empresa activa antes de vender.");
  if (input.items.length === 0) throw new Error("Agregá al menos un producto antes de confirmar.");
  if (input.medioPago === "cuenta_corriente" && !input.clienteId) {
    throw new Error("Cuenta corriente requiere seleccionar un cliente.");
  }
  if (input.items.some((item) => !item.productoId || !Number.isFinite(item.cantidad) || item.cantidad <= 0)) {
    throw new Error("Hay un producto con cantidad inválida en el carrito.");
  }

  const idempotencyKey = input.idempotencyKey ?? crearIdempotencyKey();
  const { data, error } = await supabase.rpc("confirmar_venta_sigo_v2", {
    p_empresa_id: input.empresaId,
    p_items: input.items.map((item) => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
    })),
    p_medio_pago: input.medioPago,
    p_idempotency_key: idempotencyKey,
    p_cliente_id: input.clienteId ?? null,
  });

  if (error) throw new Error(mensajeVenta(error));
  if (!data) throw new Error("La venta no devolvió comprobante. No la repitas hasta verificar su estado.");

  return { ventaId: data as string, idempotencyKey };
}
