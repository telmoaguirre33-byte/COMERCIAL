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

  const { data, error } = await supabase
    .from("proveedores_sigo")
    .insert({
      empresa_id: input.empresaId,
      razon_social: razonSocial,
      cuit: input.cuit?.trim() || null,
      telefono: input.telefono?.trim() || null,
      email: input.email?.trim() || null,
      activo: true,
    })
    .select("id,empresa_id,razon_social,nombre_fantasia,cuit,telefono,email,direccion,activo")
    .single();
  if (error) throw error;
  return data as ProveedorSigo;
}

export async function listarComprasSigo(empresaId: string): Promise<CompraSigo[]> {
  const { data, error } = await supabase
    .from("compras_sigo")
    .select("id,empresa_id,proveedor_id,fecha_compra,tipo_comprobante,numero_comprobante,subtotal,total,estado,origen,created_at")
    .eq("empresa_id", empresaId)
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
  const items = input.items.filter((item) => item.producto_id && item.cantidad > 0 && item.costo_unitario >= 0);
  if (!input.proveedorId) throw new Error("Seleccioná un proveedor.");
  if (items.length === 0) throw new Error("Agregá al menos un producto válido.");

  const { data, error } = await supabase.rpc("confirmar_compra_sigo", {
    p_empresa_id: input.empresaId,
    p_proveedor_id: input.proveedorId,
    p_items: items,
    p_fecha: input.fecha || null,
    p_tipo_comprobante: input.tipoComprobante?.trim() || null,
    p_numero_comprobante: input.numeroComprobante?.trim() || null,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) {
    const msg = error.message || "No se pudo confirmar la compra";
    if (msg.includes("FORBIDDEN")) throw new Error("No tenés permiso para registrar compras.");
    if (msg.includes("STOCK_WRITE_REQUIRED")) throw new Error("Tu usuario puede cargar compras pero no modificar stock.");
    if (msg.includes("SUPPLIER_NOT_FOUND")) throw new Error("El proveedor no pertenece a la empresa activa.");
    if (msg.includes("PRODUCT_NOT_FOUND")) throw new Error("Uno de los productos no pertenece a la empresa activa.");
    throw error;
  }
  return String(data);
}

export async function verificarCompraSigo(input: {
  empresaId: string;
  compraId: string;
  items: CompraItemInput[];
  stockAntes: Record<string, number>;
}): Promise<VerificacionCompraSigo> {
  try {
    const productoIds = [...new Set(input.items.map((item) => item.producto_id))];
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

    for (const item of input.items) {
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
