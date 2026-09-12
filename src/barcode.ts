import { supabase } from "./supabase";

export type BarcodeAction =
  | "vender"
  | "ingresar"
  | "consultar"
  | "editar";

export type BarcodeProduct = {
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

export function normalizeBarcode(raw: string): string {
  return String(raw ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, 128);
}

function normalizarEmpresaId(raw: string): string {
  return String(raw ?? "").trim();
}

export async function buscarProductoPorCodigo(
  empresaIdRaw: string,
  codigoRaw: string,
): Promise<BarcodeProduct[]> {
  const empresaId = normalizarEmpresaId(empresaIdRaw);
  const codigo = normalizeBarcode(codigoRaw);

  if (!empresaId) {
    throw new Error("EMPRESA_REQUIRED");
  }

  if (!codigo) {
    return [];
  }

  const { data, error } = await supabase.rpc(
    "buscar_producto_codigo_sigo",
    {
      p_empresa_id: empresaId,
      p_codigo: codigo,
    },
  );

  if (error) {
    throw error;
  }

  const productos = (data ?? []) as BarcodeProduct[];
  const fueraDeTenant = productos.some(
    (producto) => normalizarEmpresaId(producto.empresa_id) !== empresaId,
  );
  if (fueraDeTenant) {
    console.error("SIGO tenant isolation violation in barcode lookup", { empresaId });
    throw new Error("TENANT_PRODUCT_MISMATCH");
  }

  return productos;
}

export function routeForBarcodeAction(
  action: BarcodeAction,
  productoId: string,
): string {
  const id = encodeURIComponent(productoId);

  switch (action) {
    case "vender":
      return `/ventas?producto=${id}`;
    case "ingresar":
      return `/compras?producto=${id}`;
    case "consultar":
      return `/productos?producto=${id}&modo=consulta`;
    case "editar":
      return `/productos?producto=${id}&modo=editar`;
  }
}

export function isLikelyScannerSubmit(key: string): boolean {
  return key === "Enter" || key === "Tab";
}
