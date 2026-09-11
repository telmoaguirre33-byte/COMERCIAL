import { supabase } from "./supabase";
import { listarClientesSigo } from "./clientes";
import { listarComprasSigo } from "./compras";
import { listarProductosSigo } from "./productos";

export type ResumenOperativoSigo = {
  productos: number;
  productosSinStock: number;
  productosCriticos: number;
  unidadesStock: number;
  clientes: number;
  clientesConDeuda: number;
  saldoClientes: number;
  comprasCantidad: number;
  comprasTotal: number;
  ventasCantidad: number;
  ventasTotal: number;
  ventasHoy: number;
  ventasHoyTotal: number;
};

type VentaRow = {
  total?: number | string | null;
  created_at?: string | null;
};

export async function cargarResumenOperativoSigo(empresaId: string): Promise<ResumenOperativoSigo> {
  if (!empresaId) throw new Error("Seleccioná una empresa activa.");

  const [productos, clientes, compras, ventasResponse] = await Promise.all([
    listarProductosSigo(empresaId),
    listarClientesSigo(empresaId),
    listarComprasSigo(empresaId),
    supabase
      .from("ventas_sigo")
      .select("total,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);

  if (ventasResponse.error) throw ventasResponse.error;
  const ventas = (ventasResponse.data ?? []) as VentaRow[];

  const visibles = productos.filter((producto) => producto.stock_actual != null);
  const productosSinStock = visibles.filter((producto) => Number(producto.stock_actual ?? 0) <= 0).length;
  const productosCriticos = visibles.filter((producto) =>
    producto.stock_minimo != null && Number(producto.stock_actual ?? 0) <= Number(producto.stock_minimo)
  ).length;
  const unidadesStock = visibles.reduce((total, producto) => total + Number(producto.stock_actual ?? 0), 0);

  const clientesConDeuda = clientes.filter((cliente) => Number(cliente.saldo_actual ?? 0) > 0).length;
  const saldoClientes = clientes.reduce((total, cliente) => total + Number(cliente.saldo_actual ?? 0), 0);
  const comprasTotal = compras.reduce((total, compra) => total + Number(compra.total ?? 0), 0);
  const ventasTotal = ventas.reduce((total, venta) => total + Number(venta.total ?? 0), 0);

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);
  const ventasDeHoy = ventas.filter((venta) => venta.created_at && new Date(venta.created_at).getTime() >= inicioHoy.getTime());
  const ventasHoyTotal = ventasDeHoy.reduce((total, venta) => total + Number(venta.total ?? 0), 0);

  return {
    productos: productos.length,
    productosSinStock,
    productosCriticos,
    unidadesStock,
    clientes: clientes.length,
    clientesConDeuda,
    saldoClientes,
    comprasCantidad: compras.length,
    comprasTotal,
    ventasCantidad: ventas.length,
    ventasTotal,
    ventasHoy: ventasDeHoy.length,
    ventasHoyTotal,
  };
}
