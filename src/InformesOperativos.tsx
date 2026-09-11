import { useEffect, useState } from "react";
import { cargarResumenOperativoSigo, type ResumenOperativoSigo } from "./informes";

const vacio: ResumenOperativoSigo = {
  productos: 0,
  productosSinStock: 0,
  productosCriticos: 0,
  unidadesStock: 0,
  clientes: 0,
  clientesConDeuda: 0,
  saldoClientes: 0,
  comprasCantidad: 0,
  comprasTotal: 0,
  ventasCantidad: 0,
  ventasTotal: 0,
  ventasHoy: 0,
  ventasHoyTotal: 0,
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valor);
}

export default function InformesOperativos({ empresaId }: { empresaId: string }) {
  const [resumen, setResumen] = useState<ResumenOperativoSigo>(vacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      setResumen(await cargarResumenOperativoSigo(empresaId));
    } catch (err) {
      setResumen(vacio);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los informes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [empresaId]);

  if (loading) return <div className="panel"><p>Cargando indicadores operativos…</p></div>;

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Informes operativos</h2>
          <p>Indicadores consolidados únicamente de la empresa activa.</p>
        </div>
        <button className="admin-button" onClick={() => void cargar()}>Actualizar</button>
      </div>

      {error && (
        <div className="panel" role="alert">
          <h3>No se pudieron consolidar todos los indicadores</h3>
          <p>{error}</p>
          <p>Verificá que las migraciones de Ventas, Clientes y Compras estén aplicadas en Supabase.</p>
        </div>
      )}

      {!error && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span>Ventas de hoy</span><strong>{resumen.ventasHoy}</strong><small>{dinero(resumen.ventasHoyTotal)}</small></div>
            <div className="stat-card"><span>Ventas registradas</span><strong>{resumen.ventasCantidad}</strong><small>{dinero(resumen.ventasTotal)}</small></div>
            <div className="stat-card"><span>Compras registradas</span><strong>{resumen.comprasCantidad}</strong><small>{dinero(resumen.comprasTotal)}</small></div>
            <div className="stat-card"><span>Unidades en stock</span><strong>{resumen.unidadesStock}</strong><small>{resumen.productos} productos</small></div>
            <div className="stat-card"><span>Stock crítico</span><strong>{resumen.productosCriticos}</strong><small>{resumen.productosSinStock} sin stock</small></div>
            <div className="stat-card"><span>Clientes</span><strong>{resumen.clientes}</strong><small>{resumen.clientesConDeuda} con deuda</small></div>
            <div className="stat-card"><span>Saldo a cobrar</span><strong>{dinero(resumen.saldoClientes)}</strong><small>Cuenta corriente</small></div>
          </div>

          <div className="panel">
            <h3>Lectura gerencial rápida</h3>
            <p>
              SIGO consolida ventas, compras, stock y cuentas corrientes sin mezclar empresas. Los valores se leen desde tablas protegidas por tenant/RLS.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
