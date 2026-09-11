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
  cajaHoyIngresos: number;
  cajaHoyEgresos: number;
  cajaHoyNeto: number;
  cajaHoyPorMedio: Record<string, number>;
  modulosNoDisponibles: string[];
};

type VentaRow = {
  total?: number | string | null;
  created_at?: string | null;
};

type CajaRow = {
  tipo?: "ingreso" | "egreso" | string | null;
  medio_pago?: string | null;
  importe?: number | string | null;
};

async function listarVentasSigoCompletas(empresaId: string): Promise<VentaRow[]> {
  const pagina = 1000;
  const filas: VentaRow[] = [];

  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase
      .from("ventas_sigo")
      .select("total,created_at")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false })
      .range(desde, desde + pagina - 1);

    if (error) throw error;
    const lote = (data ?? []) as VentaRow[];
    filas.push(...lote);
    if (lote.length < pagina) break;
  }

  return filas;
}

async function listarCajaHoySigo(empresaId: string, inicioHoyIso: string): Promise<CajaRow[]> {
  const pagina = 1000;
  const filas: CajaRow[] = [];

  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase
      .from("caja_movimientos_sigo")
      .select("tipo,medio_pago,importe")
      .eq("empresa_id", empresaId)
      .gte("created_at", inicioHoyIso)
      .order("created_at", { ascending: false })
      .range(desde, desde + pagina - 1);

    if (error) throw error;
    const lote = (data ?? []) as CajaRow[];
    filas.push(...lote);
    if (lote.length < pagina) break;
  }

  return filas;
}

export async function cargarResumenOperativoSigo(empresaId: string): Promise<ResumenOperativoSigo> {
  if (!empresaId) throw new Error("Seleccioná una empresa activa.");

  const inicioHoy = new Date();
  inicioHoy.setHours(0, 0, 0, 0);

  const [productosResult, clientesResult, comprasResult, ventasResult, cajaResult] = await Promise.allSettled([
    listarProductosSigo(empresaId),
    listarClientesSigo(empresaId),
    listarComprasSigo(empresaId),
    listarVentasSigoCompletas(empresaId),
    listarCajaHoySigo(empresaId, inicioHoy.toISOString()),
  ]);

  const modulosNoDisponibles: string[] = [];
  const productos = productosResult.status === "fulfilled" ? productosResult.value : [];
  const clientes = clientesResult.status === "fulfilled" ? clientesResult.value : [];
  const compras = comprasResult.status === "fulfilled" ? comprasResult.value : [];
  const ventas = ventasResult.status === "fulfilled" ? ventasResult.value : [];
  const cajaHoy = cajaResult.status === "fulfilled" ? cajaResult.value : [];

  if (productosResult.status === "rejected") modulosNoDisponibles.push("Productos/Stock");
  if (clientesResult.status === "rejected") modulosNoDisponibles.push("Clientes/Cuentas corrientes");
  if (comprasResult.status === "rejected") modulosNoDisponibles.push("Compras/Proveedores");
  if (ventasResult.status === "rejected") modulosNoDisponibles.push("Ventas");
  if (cajaResult.status === "rejected") modulosNoDisponibles.push("Caja");

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

  const ventasDeHoy = ventas.filter((venta) => venta.created_at && new Date(venta.created_at).getTime() >= inicioHoy.getTime());
  const ventasHoyTotal = ventasDeHoy.reduce((total, venta) => total + Number(venta.total ?? 0), 0);

  const cajaHoyIngresos = cajaHoy
    .filter((movimiento) => movimiento.tipo === "ingreso")
    .reduce((total, movimiento) => total + Number(movimiento.importe ?? 0), 0);
  const cajaHoyEgresos = cajaHoy
    .filter((movimiento) => movimiento.tipo === "egreso")
    .reduce((total, movimiento) => total + Number(movimiento.importe ?? 0), 0);
  const cajaHoyPorMedio = cajaHoy.reduce<Record<string, number>>((acumulado, movimiento) => {
    if (movimiento.tipo !== "ingreso") return acumulado;
    const medio = movimiento.medio_pago?.trim() || "otro";
    acumulado[medio] = (acumulado[medio] ?? 0) + Number(movimiento.importe ?? 0);
    return acumulado;
  }, {});

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
    cajaHoyIngresos,
    cajaHoyEgresos,
    cajaHoyNeto: cajaHoyIngresos - cajaHoyEgresos,
    cajaHoyPorMedio,
    modulosNoDisponibles,
  };
}
