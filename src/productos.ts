import { supabase } from "./supabase";

export type ProductoSigo = {
  id: string;
  empresa_id: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  marca: string | null;
  proveedor: string | null;
  costo_actual: number | null;
  costo_ultima_compra: number | null;
  precio_venta: number | null;
  margen_ganancia: number | null;
  margen_porcentaje: number | null;
  stock_actual: number | null;
  stock_minimo: number | null;
  stock_maximo: number | null;
};

export type GuardarProductoSigoInput = {
  empresaId: string;
  productoId?: string | null;
  codigoInterno?: string | null;
  codigoBarras?: string | null;
  nombre: string;
  descripcion?: string | null;
  categoria?: string | null;
  marca?: string | null;
  proveedor?: string | null;
  costoActual?: number | null;
  costoUltimaCompra?: number | null;
  precioVenta?: number | null;
  margenGanancia?: number | null;
  margenPorcentaje?: number | null;
  stockActual?: number | null;
  stockMinimo?: number | null;
  stockMaximo?: number | null;
};

function normalizarTexto(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function validarNumeroNoNegativo(nombre: string, valor?: number | null) {
  if (valor == null) return;
  if (!Number.isFinite(valor) || valor < 0) throw new Error(`${nombre}_INVALID`);
}

function validarProducto(input: GuardarProductoSigoInput) {
  validarNumeroNoNegativo("COSTO_ACTUAL", input.costoActual);
  validarNumeroNoNegativo("COSTO_ULTIMA_COMPRA", input.costoUltimaCompra);
  validarNumeroNoNegativo("PRECIO_VENTA", input.precioVenta);
  validarNumeroNoNegativo("MARGEN_GANANCIA", input.margenGanancia);
  validarNumeroNoNegativo("MARGEN_PORCENTAJE", input.margenPorcentaje);
  validarNumeroNoNegativo("STOCK_ACTUAL", input.stockActual);
  validarNumeroNoNegativo("STOCK_MINIMO", input.stockMinimo);
  validarNumeroNoNegativo("STOCK_MAXIMO", input.stockMaximo);

  if (input.stockMinimo != null && input.stockMaximo != null && input.stockMaximo < input.stockMinimo) {
    throw new Error("STOCK_RANGE_INVALID");
  }
  if (input.stockActual != null && input.stockMaximo != null && input.stockActual > input.stockMaximo) {
    throw new Error("STOCK_ABOVE_MAXIMUM");
  }
}

function mensajeErrorBackend(error: unknown, fallback: string) {
  const original = typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : error instanceof Error ? error.message : String(error ?? "");

  if (original.includes("PRODUCT_HAS_STOCK")) {
    return "No se puede dar de baja el producto mientras tenga stock. Dejá el stock en cero mediante el circuito operativo antes de desactivarlo.";
  }
  if (original.includes("BARCODE_DUPLICATE_IN_COMPANY")) {
    return "Ese código de barras ya está asignado a otro producto de esta empresa.";
  }
  if (original.includes("INTERNAL_CODE_DUPLICATE_IN_COMPANY")) {
    return "Ese código interno ya está asignado a otro producto de esta empresa.";
  }
  if (original.includes("PRODUCT_NOT_FOUND_IN_TENANT")) {
    return "El producto no pertenece a la empresa activa o ya no está disponible.";
  }
  if (original.includes("FORBIDDEN")) {
    return "Tu perfil no tiene permiso para modificar productos.";
  }

  return original || fallback;
}

export async function listarProductosSigo(empresaId: string): Promise<ProductoSigo[]> {
  if (!empresaId) throw new Error("EMPRESA_REQUIRED");

  const { data, error } = await supabase.rpc("listar_productos_sigo", {
    p_empresa_id: empresaId,
  });

  if (error) throw new Error(mensajeErrorBackend(error, "No se pudieron cargar los productos."));
  return (data ?? []) as ProductoSigo[];
}

export async function guardarProductoSigo(input: GuardarProductoSigoInput): Promise<string> {
  if (!input.empresaId) throw new Error("EMPRESA_REQUIRED");
  if (!input.nombre.trim()) throw new Error("PRODUCT_NAME_REQUIRED");
  validarProducto(input);

  const { data, error } = await supabase.rpc("guardar_producto_sigo", {
    p_empresa_id: input.empresaId,
    p_producto_id: input.productoId ?? null,
    p_codigo_interno: normalizarTexto(input.codigoInterno),
    p_codigo_barras: normalizarTexto(input.codigoBarras),
    p_nombre: input.nombre.trim(),
    p_descripcion: normalizarTexto(input.descripcion),
    p_categoria: normalizarTexto(input.categoria),
    p_marca: normalizarTexto(input.marca),
    p_proveedor: normalizarTexto(input.proveedor),
    p_costo_actual: input.costoActual ?? null,
    p_costo_ultima_compra: input.costoUltimaCompra ?? null,
    p_precio_venta: input.precioVenta ?? null,
    p_margen_ganancia: input.margenGanancia ?? null,
    p_margen_porcentaje: input.margenPorcentaje ?? null,
    p_stock_actual: input.stockActual ?? null,
    p_stock_minimo: input.stockMinimo ?? null,
    p_stock_maximo: input.stockMaximo ?? null,
  });

  if (error) throw new Error(mensajeErrorBackend(error, "No se pudo guardar el producto."));
  if (!data) throw new Error("PRODUCT_SAVE_FAILED");
  return data as string;
}

export async function eliminarProductoSigo(empresaId: string, productoId: string): Promise<void> {
  if (!empresaId) throw new Error("EMPRESA_REQUIRED");
  if (!productoId) throw new Error("PRODUCT_REQUIRED");

  const { data, error } = await supabase.rpc("eliminar_producto_sigo", {
    p_empresa_id: empresaId,
    p_producto_id: productoId,
  });

  if (error) throw new Error(mensajeErrorBackend(error, "No se pudo dar de baja el producto."));
  if (data !== true) throw new Error("PRODUCT_DEACTIVATE_FAILED");
}
