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

export async function confirmarVentaSigo(input: {
  empresaId: string;
  items: VentaItemSigoInput[];
  medioPago: MedioPagoSigo;
  idempotencyKey?: string;
}): Promise<{ ventaId: string; idempotencyKey: string }> {
  if (!input.empresaId) throw new Error("EMPRESA_REQUIRED");
  if (input.items.length === 0) throw new Error("SALE_ITEMS_REQUIRED");
  if (input.items.some((item) => !item.productoId || !Number.isFinite(item.cantidad) || item.cantidad <= 0)) {
    throw new Error("SALE_ITEM_INVALID");
  }

  const idempotencyKey = input.idempotencyKey ?? crearIdempotencyKey();
  const { data, error } = await supabase.rpc("confirmar_venta_sigo", {
    p_empresa_id: input.empresaId,
    p_items: input.items.map((item) => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
    })),
    p_medio_pago: input.medioPago,
    p_idempotency_key: idempotencyKey,
  });

  if (error) throw error;
  if (!data) throw new Error("SALE_CONFIRM_FAILED");

  return { ventaId: data as string, idempotencyKey };
}
