import { supabase } from "./supabase";
import { listarProductosSigo } from "./productos";

export type MedioPagoSigo =
  | "efectivo"
  | "debito"
  | "credito"
  | "transferencia"
  | "mercado_pago"
  | "cuenta_corriente"
  | "otro";

export type VentaItemSigoInput = {
  productoId: string;
  cantidad: number;
};

export type IntegridadVentaSigo = "ok" | "revisar" | "no_verificada";

type EstadoReintentoVenta = "nueva" | "reintento" | "desconocido";

type SnapshotStockVenta = Map<string, number>;

export type VentaRecienteSigo = {
  id: string;
  numero: number | null;
  total: number;
  medioPago: MedioPagoSigo;
  clienteId: string | null;
  createdAt: string;
  integridad: IntegridadVentaSigo;
};

const MEDIOS_PAGO_VALIDOS: MedioPagoSigo[] = [
  "efectivo",
  "debito",
  "credito",
  "transferencia",
  "mercado_pago",
  "cuenta_corriente",
  "otro",
];

const STOCK_TOLERANCIA = 0.0005;

function crearIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizarIdentificador(valor: string | null | undefined) {
  return String(valor ?? "").trim();
}

function consolidarItemsVenta(items: VentaItemSigoInput[]): VentaItemSigoInput[] {
  const cantidades = new Map<string, number>();
  for (const item of items) {
    const productoId = normalizarIdentificador(item.productoId);
    if (!productoId || !Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      throw new Error("Hay un producto con cantidad inválida en el carrito.");
    }
    const cantidadAcumulada = (cantidades.get(productoId) ?? 0) + item.cantidad;
    if (!Number.isFinite(cantidadAcumulada) || cantidadAcumulada <= 0) {
      throw new Error("La cantidad consolidada de un producto es inválida.");
    }
    cantidades.set(productoId, cantidadAcumulada);
  }

  return Array.from(cantidades, ([productoId, cantidad]) => ({ productoId, cantidad }));
}

function combinarIntegridad(...estados: IntegridadVentaSigo[]): IntegridadVentaSigo {
  if (estados.some((estado) => estado === "revisar")) return "revisar";
  if (estados.length > 0 && estados.every((estado) => estado === "ok")) return "ok";
  return "no_verificada";
}

function mensajeVenta(error: unknown): string {
  const raw = error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");

  if (raw.includes("IDEMPOTENCY_CONFLICT")) return "La misma operación ya fue usada con datos distintos. Actualizá las ventas recientes antes de intentar otra confirmación.";
  if (raw.includes("IDEMPOTENCY_KEY_INVALID")) return "No se pudo generar una clave segura para confirmar la venta. Volvé a iniciar el carrito.";
  if (raw.includes("SALE_TOO_MANY_ITEMS")) return "La venta tiene demasiados renglones para una sola operación. Dividila en más de una venta.";
  if (raw.includes("SALE_ITEM_INVALID") || raw.includes("SALE_QUANTITY_INVALID")) return "Hay un producto o una cantidad inválida en el carrito. Revisá la venta antes de confirmar.";
  if (raw.includes("PAYMENT_METHOD_INVALID")) return "Seleccioná un medio de pago válido.";
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

async function verificarIntegridadVentas(
  empresaId: string,
  ventas: Array<{ id: string; medio_pago: string }>,
): Promise<Map<string, IntegridadVentaSigo>> {
  const resultado = new Map<string, IntegridadVentaSigo>();
  ventas.forEach((venta) => resultado.set(venta.id, "no_verificada"));
  if (ventas.length === 0) return resultado;

  const idsCaja = ventas.filter((venta) => venta.medio_pago !== "cuenta_corriente").map((venta) => venta.id);
  const idsCuenta = ventas.filter((venta) => venta.medio_pago === "cuenta_corriente").map((venta) => venta.id);

  try {
    const [caja, cuenta] = await Promise.all([
      idsCaja.length
        ? supabase.from("caja_movimientos_sigo").select("venta_id").eq("empresa_id", empresaId).eq("tipo", "ingreso").in("venta_id", idsCaja)
        : Promise.resolve({ data: [], error: null }),
      idsCuenta.length
        ? supabase.from("cliente_movimientos_sigo").select("venta_id").eq("empresa_id", empresaId).eq("tipo", "debe").in("venta_id", idsCuenta)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (caja.error || cuenta.error) return resultado;

    const cajaOk = new Set((caja.data ?? []).map((mov) => String(mov.venta_id)));
    const cuentaOk = new Set((cuenta.data ?? []).map((mov) => String(mov.venta_id)));

    ventas.forEach((venta) => {
      const ok = venta.medio_pago === "cuenta_corriente" ? cuentaOk.has(venta.id) : cajaOk.has(venta.id);
      resultado.set(venta.id, ok ? "ok" : "revisar");
    });
  } catch {
    // La venta no debe reportarse como fallida sólo porque el chequeo posterior no pudo leerse.
  }

  return resultado;
}

async function detectarEstadoReintento(
  empresaId: string,
  idempotencyKey: string,
): Promise<EstadoReintentoVenta> {
  try {
    const { data, error } = await supabase
      .from("ventas_sigo")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("idempotency_key", idempotencyKey)
      .limit(1);
    if (error) return "desconocido";
    return Array.isArray(data) && data.length > 0 ? "reintento" : "nueva";
  } catch {
    return "desconocido";
  }
}

async function capturarStockAntes(
  empresaId: string,
  items: VentaItemSigoInput[],
  estadoReintento: EstadoReintentoVenta,
): Promise<SnapshotStockVenta | null> {
  if (estadoReintento !== "nueva") return null;
  try {
    const productos = await listarProductosSigo(empresaId);
    const porId = new Map(productos.map((producto) => [producto.id, producto]));
    const snapshot: SnapshotStockVenta = new Map();
    for (const item of items) {
      const stock = Number(porId.get(item.productoId)?.stock_actual);
      if (!Number.isFinite(stock)) return null;
      snapshot.set(item.productoId, stock);
    }
    return snapshot;
  } catch {
    return null;
  }
}

async function verificarIntegridadStockVenta(
  empresaId: string,
  ventaId: string,
  items: VentaItemSigoInput[],
  stockAntes: SnapshotStockVenta | null,
  estadoReintento: EstadoReintentoVenta,
): Promise<IntegridadVentaSigo> {
  try {
    const { data: detalle, error: detalleError } = await supabase
      .from("venta_items_sigo")
      .select("producto_id,cantidad")
      .eq("empresa_id", empresaId)
      .eq("venta_id", ventaId);

    if (detalleError) return "no_verificada";

    const esperado = new Map(items.map((item) => [item.productoId, Number(item.cantidad)]));
    const registrado = new Map<string, number>();
    for (const fila of detalle ?? []) {
      const productoId = normalizarIdentificador(fila.producto_id);
      const cantidad = Number(fila.cantidad);
      if (!productoId || !Number.isFinite(cantidad) || cantidad <= 0) return "revisar";
      registrado.set(productoId, (registrado.get(productoId) ?? 0) + cantidad);
    }

    if (registrado.size !== esperado.size) return "revisar";
    for (const [productoId, cantidad] of esperado) {
      if (Math.abs((registrado.get(productoId) ?? Number.NaN) - cantidad) > STOCK_TOLERANCIA) return "revisar";
    }

    // Un retry idempotente devuelve la venta existente sin volver a descontar stock.
    // Si no podemos demostrar que la llamada era nueva, validamos el detalle pero no
    // atribuimos el stock actual exclusivamente a esta confirmación.
    if (estadoReintento !== "nueva" || !stockAntes) return "no_verificada";

    const productosDespues = await listarProductosSigo(empresaId);
    const despuesPorId = new Map(productosDespues.map((producto) => [producto.id, producto]));
    let huboMovimientoConcurrente = false;

    for (const item of items) {
      const antes = stockAntes.get(item.productoId);
      const despues = Number(despuesPorId.get(item.productoId)?.stock_actual);
      if (antes == null || !Number.isFinite(despues)) return "no_verificada";
      const esperadoDespues = antes - item.cantidad;

      if (despues > esperadoDespues + STOCK_TOLERANCIA) {
        // El stock no refleja el descuento esperado (o hubo una entrada concurrente): requiere revisión.
        return "revisar";
      }
      if (despues < esperadoDespues - STOCK_TOLERANCIA) {
        // Otra salida concurrente puede haber ocurrido. La venta existe, pero no atribuimos el delta completo.
        huboMovimientoConcurrente = true;
      }
    }

    return huboMovimientoConcurrente ? "no_verificada" : "ok";
  } catch {
    return "no_verificada";
  }
}

export async function listarVentasRecientesSigo(empresaId: string, limite = 10): Promise<VentaRecienteSigo[]> {
  const empresaNormalizada = normalizarIdentificador(empresaId);
  if (!empresaNormalizada) return [];
  const safeLimit = Math.min(Math.max(Math.trunc(limite), 1), 25);
  const { data, error } = await supabase
    .from("ventas_sigo")
    .select("id,numero,total,medio_pago,cliente_id,created_at")
    .eq("empresa_id", empresaNormalizada)
    .eq("estado", "confirmada")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(mensajeVenta(error));
  const rows = (data ?? []) as Array<{
    id: string;
    numero: number | null;
    total: number | string;
    medio_pago: MedioPagoSigo;
    cliente_id: string | null;
    created_at: string;
  }>;
  const integridad = await verificarIntegridadVentas(empresaNormalizada, rows);

  return rows.map((venta) => {
    const total = Number(venta.total);
    return {
      id: venta.id,
      numero: venta.numero,
      total: Number.isFinite(total) ? total : 0,
      medioPago: MEDIOS_PAGO_VALIDOS.includes(venta.medio_pago) ? venta.medio_pago : "otro",
      clienteId: venta.cliente_id,
      createdAt: venta.created_at,
      integridad: integridad.get(venta.id) ?? "no_verificada",
    };
  });
}

export async function confirmarVentaSigo(input: {
  empresaId: string;
  items: VentaItemSigoInput[];
  medioPago: MedioPagoSigo;
  clienteId?: string | null;
  idempotencyKey?: string;
}): Promise<{ ventaId: string; idempotencyKey: string; integridad: IntegridadVentaSigo }> {
  const empresaId = normalizarIdentificador(input.empresaId);
  const clienteId = normalizarIdentificador(input.clienteId) || null;
  if (!empresaId) throw new Error("Seleccioná una empresa activa antes de vender.");
  if (input.items.length === 0) throw new Error("Agregá al menos un producto antes de confirmar.");
  if (!MEDIOS_PAGO_VALIDOS.includes(input.medioPago)) throw new Error("Seleccioná un medio de pago válido.");
  if (input.medioPago === "cuenta_corriente" && !clienteId) {
    throw new Error("Cuenta corriente requiere seleccionar un cliente.");
  }

  const itemsConsolidados = consolidarItemsVenta(input.items);
  const idempotencyKey = normalizarIdentificador(input.idempotencyKey ?? crearIdempotencyKey());
  if (!idempotencyKey) throw new Error("No se pudo generar una clave segura para confirmar la venta.");

  const estadoReintento = await detectarEstadoReintento(empresaId, idempotencyKey);
  const stockAntes = await capturarStockAntes(empresaId, itemsConsolidados, estadoReintento);

  const { data, error } = await supabase.rpc("confirmar_venta_sigo_v2", {
    p_empresa_id: empresaId,
    p_items: itemsConsolidados.map((item) => ({
      producto_id: item.productoId,
      cantidad: item.cantidad,
    })),
    p_medio_pago: input.medioPago,
    p_idempotency_key: idempotencyKey,
    p_cliente_id: clienteId,
  });

  if (error) throw new Error(mensajeVenta(error));
  const ventaId = normalizarIdentificador(typeof data === "string" ? data : String(data ?? ""));
  if (!ventaId) throw new Error("La venta no devolvió comprobante. No la repitas hasta verificar su estado.");

  // Ningún fallo de conciliación posterior vuelve a ejecutar la venta: si la RPC confirmó,
  // reportamos integridad y dejamos al operador revisar, evitando dobles descuentos/cobros.
  const [integridadCaja, integridadStock] = await Promise.all([
    verificarIntegridadVentas(empresaId, [{ id: ventaId, medio_pago: input.medioPago }])
      .then((mapa) => mapa.get(ventaId) ?? "no_verificada")
      .catch(() => "no_verificada" as const),
    verificarIntegridadStockVenta(empresaId, ventaId, itemsConsolidados, stockAntes, estadoReintento),
  ]);

  return {
    ventaId,
    idempotencyKey,
    integridad: combinarIntegridad(integridadCaja, integridadStock),
  };
}
