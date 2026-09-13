import { supabase } from "./supabase";

export type ProveedorSigo = {
  id: string;
  empresa_id: string;
  razon_social: string;
  nombre_fantasia: string | null;
  cuit: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  activo: boolean;
};

export type CompraSigo = {
  id: string;
  empresa_id: string;
  proveedor_id: string;
  fecha_compra: string;
  tipo_comprobante: string | null;
  numero_comprobante: string | null;
  subtotal: number;
  total: number;
  estado: string;
  origen: string;
  created_at: string;
};

export type CompraItemInput = {
  producto_id: string;
  cantidad: number;
  costo_unitario: number;
};

export type VerificacionCompraSigo = {
  estado: "OK" | "REVISAR" | "NO_VERIFICADO";
  detalle: string;
};

function validarEmailOpcional(email?: string): string | null {
  const limpio = email?.trim() ?? "";
  if (!limpio) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
    throw new Error("El email del proveedor no es válido.");
  }
  return limpio;
}

function validarCuitOpcional(cuit?: string): string | null {
  const limpio = cuit?.replace(/\D/g, "") ?? "";
  if (!limpio) return null;
  if (limpio.length !== 11) throw new Error("El CUIT del proveedor debe tener 11 dígitos.");
  return limpio;
}

function mensajeCompra(raw: string): string {
  if (raw.includes("PURCHASE_DOCUMENT_DUPLICATE")) return "Ese comprobante ya fue ingresado para este proveedor. SIGO bloqueó la carga para evitar duplicar stock y costos.";
  if (raw.includes("IDEMPOTENCY_CONFLICT")) return "Esta compra ya fue confirmada con la misma clave pero datos distintos. Actualizá Compras antes de volver a intentar.";
  if (raw.includes("IDEMPOTENCY_KEY_REQUIRED") || raw.includes("IDEMPOTENCY_KEY_INVALID")) return "No se pudo generar una clave segura para confirmar la compra. Reiniciá la carga antes de volver a intentar.";
  if (raw.includes("DUPLICATE_PRODUCT_ITEM")) return "El mismo producto aparece más de una vez. Unificá la cantidad en una sola línea.";
  if (raw.includes("INVALID_ITEM") || raw.includes("INVALID_QUANTITY") || raw.includes("INVALID_COST")) return "Hay una línea de compra con producto, cantidad o costo inválido.";
  if (raw.includes("TOO_MANY_ITEMS")) return "La compra tiene demasiadas líneas para una sola operación. Dividila en más de una compra.";
  if (raw.includes("FORBIDDEN")) return "No tenés permiso para registrar compras.";
  if (raw.includes("STOCK_WRITE_REQUIRED")) return "Tu usuario puede cargar compras pero no modificar stock.";
  if (raw.includes("SUPPLIER_NOT_FOUND")) return "El proveedor no pertenece a la empresa activa.";
  if (raw.includes("PRODUCT_NOT_FOUND")) return "Uno de los productos no pertenece a la empresa activa.";
  if (raw.includes("AUTH_REQUIRED")) return "La sesión venció. Volvé a ingresar a SIGO.";
  return raw || "No se pudo confirmar la compra.";
}

export function consolidarItemsCompra(items: CompraItemInput[]): CompraItemInput[] {
  const agrupados = new Map<string, { cantidad: number; costoPonderado: number }>();

  for (const item of items) {
    const productoId = item.producto_id?.trim();
    const cantidad = Number(item.cantidad);
    const costo = Number(item.costo_unitario);
    if (!productoId) throw new Error("Hay una línea de compra sin producto seleccionado.");
    if (!Number.isFinite(cantidad) || cantidad <= 0) throw new Error("Hay una línea de compra con cantidad inválida.");
    if (!Number.isFinite(costo) || costo < 0) throw new Error("Hay una línea de compra con costo inválido.");

    const previo = agrupados.get(productoId) ?? { cantidad: 0, costoPonderado: 0 };
    const cantidadAcumulada = previo.cantidad + cantidad;
    const costoPonderado = previo.costoPonderado + cantidad * costo;
    if (!Number.isFinite(cantidadAcumulada) || !Number.isFinite(costoPonderado)) {
      throw new Error("La compra supera los valores numéricos permitidos.");
    }
    agrupados.set(productoId, { cantidad: cantidadAcumulada, costoPonderado });
  }

  return [...agrupados.entries()].map(([producto_id, valor]) => ({
    producto_id,
    cantidad: valor.cantidad,
    costo_unitario: valor.cantidad > 0 ? valor.costoPonderado / valor.cantidad : 0,
  }));
}

export async function listarProveedoresSigo(empresaId: string): Promise<ProveedorSigo[]> {
  const { data, error } = await supabase
    .from("proveedores_sigo")
    .select("id,empresa_id,razon_social,nombre_fantasia,cuit,telefono,email,direccion,activo")
    .eq("empresa_id", empresaId)
    .eq("activo", true)
    .order("razon_social", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProveedorSigo[];
}

export async function guardarProveedorSigo(input: {
  empresaId: string;
  razonSocial: string;
  cuit?: string;
  telefono?: string;
  email?: string;
}): Promise<ProveedorSigo> {
  const razonSocial = input.razonSocial.trim();
  if (!razonSocial) throw new Error("La razón social es obligatoria.");
  const empresaId = input.empresaId?.trim() ?? "";
  if (!empresaId) throw new Error("No hay una empresa activa válida.");
  const cuit = validarCuitOpcional(input.cuit);

  if (cuit) {
    const { data: existentes, error: existenteError } = await supabase
      .from("proveedores_sigo")
      .select("id,empresa_id,razon_social,nombre_fantasia,cuit,telefono,email,direccion,activo")
      .eq("empresa_id", empresaId)
      .eq("cuit", cuit)
      .eq("activo", true)
      .limit(1);
    if (existenteError) throw existenteError;
    const existente = (existentes ?? [])[0] as ProveedorSigo | undefined;
    if (existente) return existente;
  }

  const { data, error } = await supabase
    .from("proveedores_sigo")
    .insert({
      empresa_id: empresaId,
      razon_social: razonSocial,
      cuit,
      telefono: input.telefono?.trim() || null,
      email: validarEmailOpcional(input.email),
      activo: true,
    })
    .select("id,empresa_id,razon_social,nombre_fantasia,cuit,telefono,email,direccion,activo")
    .single();
  if (error) throw error;
  return data as ProveedorSigo;
}

export async function listarComprasSigo(empresaId: string): Promise<CompraSigo[]> {
  const empresaNormalizada = empresaId.trim();
  if (!empresaNormalizada) return [];
  const { data, error } = await supabase
    .from("compras_sigo")
    .select("id,empresa_id,proveedor_id,fecha_compra,tipo_comprobante,numero_comprobante,subtotal,total,estado,origen,created_at")
    .eq("empresa_id", empresaNormalizada)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as CompraSigo[];
}

export async function confirmarCompraSigo(input: {
  empresaId: string;
  proveedorId: string;
  items: CompraItemInput[];
  fecha?: string;
  tipoComprobante?: string;
  numeroComprobante?: string;
  idempotencyKey: string;
}): Promise<string> {
  const empresaId = input.empresaId?.trim() ?? "";
  const proveedorId = input.proveedorId?.trim() ?? "";
  const idempotencyKey = input.idempotencyKey?.trim() ?? "";
  const tipoComprobante = input.tipoComprobante?.trim() || null;
  const numeroComprobante = input.numeroComprobante?.trim() || null;
  if (!empresaId) throw new Error("No hay una empresa activa válida.");
  if (!proveedorId) throw new Error("Seleccioná un proveedor.");
  if (!idempotencyKey) throw new Error("No se pudo generar una clave segura para confirmar la compra.");

  const items = consolidarItemsCompra(input.items);
  if (items.length === 0) throw new Error("Agregá al menos un producto válido.");

  // Preflight UX: evita que el usuario espere toda la transacción cuando el mismo
  // comprobante ya está confirmado. El backend vuelve a validarlo de forma atómica.
  if (numeroComprobante) {
    let consulta = supabase
      .from("compras_sigo")
      .select("id")
      .eq("empresa_id", empresaId)
      .eq("proveedor_id", proveedorId)
      .eq("numero_comprobante", numeroComprobante)
      .eq("estado", "confirmada")
      .limit(1);
    if (tipoComprobante) consulta = consulta.eq("tipo_comprobante", tipoComprobante);
    const { data: duplicadas, error: duplicadaError } = await consulta;
    if (duplicadaError) throw duplicadaError;
    if ((duplicadas ?? []).length > 0) {
      throw new Error("Ese comprobante ya fue ingresado para este proveedor. SIGO bloqueó la carga para evitar duplicar stock y costos.");
    }
  }

  const { data, error } = await supabase.rpc("confirmar_compra_sigo", {
    p_empresa_id: empresaId,
    p_proveedor_id: proveedorId,
    p_items: items,
    p_fecha: input.fecha || null,
    p_tipo_comprobante: tipoComprobante,
    p_numero_comprobante: numeroComprobante,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw new Error(mensajeCompra(error.message || "No se pudo confirmar la compra."));
  const compraId = String(data ?? "").trim();
  if (!compraId) throw new Error("La compra no devolvió comprobante. No la repitas hasta verificar su estado.");
  return compraId;
}

export async function verificarCompraSigo(input: {
  empresaId: string;
  compraId: string;
  items: CompraItemInput[];
  stockAntes: Record<string, number>;
}): Promise<VerificacionCompraSigo> {
  try {
    const items = consolidarItemsCompra(input.items);
    if (items.length === 0) return { estado: "REVISAR", detalle: "No hay ítems válidos para conciliar la compra." };

    const productoIds = [...new Set(items.map((item) => item.producto_id))];
    const [{ data: compra, error: compraError }, { data: detalles, error: detalleError }, { data: productos, error: productoError }] = await Promise.all([
      supabase
        .from("compras_sigo")
        .select("id,empresa_id,estado")
        .eq("id", input.compraId)
        .eq("empresa_id", input.empresaId)
        .maybeSingle(),
      supabase
        .from("compra_items_sigo")
        .select("producto_id,cantidad,costo_unitario")
        .eq("compra_id", input.compraId)
        .eq("empresa_id", input.empresaId),
      supabase
        .from("productos")
        .select("id,empresa_id,stock_actual,costo_actual,costo_ultima_compra")
        .eq("empresa_id", input.empresaId)
        .in("id", productoIds),
    ]);

    if (compraError || detalleError || productoError) {
      return { estado: "NO_VERIFICADO", detalle: "La compra fue confirmada, pero no se pudo completar la conciliación de stock." };
    }
    if (!compra || compra.estado !== "confirmada") {
      return { estado: "REVISAR", detalle: "No aparece la cabecera confirmada de la compra en la empresa activa." };
    }

    const detalleMap = new Map((detalles ?? []).map((d) => [String(d.producto_id), d]));
    const productoMap = new Map((productos ?? []).map((p) => [String(p.id), p]));

    for (const item of items) {
      const detalle = detalleMap.get(item.producto_id);
      const producto = productoMap.get(item.producto_id);
      if (!detalle || !producto) {
        return { estado: "REVISAR", detalle: "Falta el detalle de compra o el producto conciliado." };
      }

      const cantidadDetalle = Number(detalle.cantidad ?? 0);
      const costoDetalle = Number(detalle.costo_unitario ?? 0);
      const stockEsperado = Number(input.stockAntes[item.producto_id] ?? 0) + Number(item.cantidad);
      const stockActual = Number(producto.stock_actual ?? 0);
      const costoActual = Number(producto.costo_actual ?? producto.costo_ultima_compra ?? 0);

      if (Math.abs(cantidadDetalle - Number(item.cantidad)) > 0.0001 || Math.abs(costoDetalle - Number(item.costo_unitario)) > 0.0001) {
        return { estado: "REVISAR", detalle: "El detalle grabado no coincide con cantidades/costos enviados." };
      }
      if (Math.abs(stockActual - stockEsperado) > 0.0001) {
        return { estado: "REVISAR", detalle: `Stock inconsistente: esperado ${stockEsperado}, actual ${stockActual}.` };
      }
      if (Math.abs(costoActual - Number(item.costo_unitario)) > 0.0001) {
        return { estado: "REVISAR", detalle: "El último costo del producto no coincide con la compra confirmada." };
      }
    }

    return { estado: "OK", detalle: "Compra, detalle, stock y último costo conciliados correctamente." };
  } catch {
    return { estado: "NO_VERIFICADO", detalle: "La compra fue confirmada, pero la verificación posterior no pudo ejecutarse." };
  }
}
