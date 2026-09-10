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

export async function listarProductosSigo(empresaId: string): Promise<ProductoSigo[]> {
  if (!empresaId) throw new Error("EMPRESA_REQUIRED");

  const { data, error } = await supabase.rpc("listar_productos_sigo", {
    p_empresa_id: empresaId,
  });

  if (error) throw error;
  return (data ?? []) as ProductoSigo[];
}

export async function guardarProductoSigo(input: GuardarProductoSigoInput): Promise<string> {
  if (!input.empresaId) throw new Error("EMPRESA_REQUIRED");
  if (!input.nombre.trim()) throw new Error("PRODUCT_NAME_REQUIRED");

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

  if (error) throw error;
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

  if (error) throw error;
  if (data !== true) throw new Error("PRODUCT_DELETE_FAILED");
}
