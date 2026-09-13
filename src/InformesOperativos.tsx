import { useEffect, useRef, useState } from "react";
import { verificarSaludOperativaSigo, type SaludOperativaSigo } from "./health";
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
  cajaHoyIngresos: 0,
  cajaHoyEgresos: 0,
  cajaHoyNeto: 0,
  cajaHoyPorMedio: {},
  modulosNoDisponibles: [],
};

function dinero(valor: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(valor);
}

function nombreMedio(medio: string) {
  const nombres: Record<string, string> = {
    efectivo: "Efectivo",
    debito: "Débito",
    credito: "Crédito",
    transferencia: "Transferencia",
    mercado_pago: "Mercado Pago",
    cuenta_corriente: "Cuenta corriente",
    otro: "Otro",
  };
  return nombres[medio] ?? medio;
}

function etiquetaSalud(salud: SaludOperativaSigo) {
  if (salud.estado === "operativo") return "Operación crítica disponible";
  if (salud.estado === "parcial") return "Operación parcialmente validada";
  return "Bloqueo de base detectado";
}

function irA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function InformesOperativos({ empresaId }: { empresaId: string }) {
  const [resumen, setResumen] = useState<ResumenOperativoSigo>(vacio);
  const [salud, setSalud] = useState<SaludOperativaSigo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const empresaActivaRef = useRef(empresaId);
  const cargaRef = useRef(0);

  async function cargar(targetEmpresaId = empresaId) {
    const cargaId = ++cargaRef.current;
    setLoading(true);
    setError("");
    try {
      const [nuevoResumen, nuevaSalud] = await Promise.all([
        cargarResumenOperativoSigo(targetEmpresaId),
        verificarSaludOperativaSigo(targetEmpresaId),
      ]);
      if (empresaActivaRef.current !== targetEmpresaId || cargaRef.current !== cargaId) return;
      setResumen(nuevoResumen);
      setSalud(nuevaSalud);
    } catch (err) {
      if (empresaActivaRef.current !== targetEmpresaId || cargaRef.current !== cargaId) return;
      setResumen(vacio);
      setSalud(null);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los informes.");
    } finally {
      if (empresaActivaRef.current === targetEmpresaId && cargaRef.current === cargaId) setLoading(false);
    }
  }

  useEffect(() => {
    empresaActivaRef.current = empresaId;
    cargaRef.current += 1;
    setResumen(vacio);
    setSalud(null);
    setError("");
    setLoading(true);
    void cargar(empresaId);
    // cargar captura el tenant y descarta respuestas tardías de otra empresa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresaId]);

  if (loading) return <div className="panel"><p>Cargando indicadores operativos…</p></div>;

  const mediosCaja = Object.entries(resumen.cajaHoyPorMedio).sort((a, b) => b[1] - a[1]);

  const catalogo = [
    { icono: "↗", titulo: "Informe de ventas", texto: "Ventas confirmadas, monto total y actividad del día.", destino: "informe-ventas" },
    { icono: "◫", titulo: "Informe de stock", texto: "Productos, unidades, faltantes y stock crítico.", destino: "informe-stock" },
    { icono: "👥", titulo: "Cuenta corriente", texto: "Clientes con deuda y saldo total pendiente de cobro.", destino: "informe-clientes", destacado: true },
    { icono: "↓", titulo: "Informe de compras", texto: "Compras confirmadas y monto comprado a proveedores.", destino: "informe-compras" },
    { icono: "$", titulo: "Caja e ingresos", texto: "Ingresos, egresos, neto diario y medios de pago.", destino: "informe-caja" },
    { icono: "▥", titulo: "Resumen gerencial", texto: "Lectura rápida del negocio y estado operativo de SIGO.", destino: "informe-resumen" },
  ];

  return (
    <div className="products-page sigo-reports-page">
      <div className="page-header sigo-reports-heading">
        <div>
          <h2>Informes</h2>
          <p>Todo el negocio en una vista clara y rápida.</p>
        </div>
        <button className="admin-button" onClick={() => void cargar(empresaId)}>Actualizar</button>
      </div>

      <section className="sigo-report-catalog" aria-label="Listado de informes">
        {catalogo.map((item) => (
          <button
            key={item.titulo}
            type="button"
            className={`sigo-report-card${item.destacado ? " highlighted" : ""}`}
            onClick={() => irA(item.destino)}
          >
            <span className="sigo-report-icon" aria-hidden="true">{item.icono}</span>
            <strong>{item.titulo}</strong>
            <span>{item.texto}</span>
          </button>
        ))}
      </section>

      {error && (
        <div className="panel" role="alert">
          <h3>No se pudo cargar el tablero</h3>
          <p>{error}</p>
        </div>
      )}

      {!error && (
        <>
          <section id="informe-ventas" className="panel sigo-report-detail">
            <div className="sigo-detail-title"><span>↗</span><h3>Ventas</h3></div>
            <div className="stats-grid">
              <div className="stat-card"><span>Ventas de hoy</span><strong>{resumen.ventasHoy}</strong><small>{dinero(resumen.ventasHoyTotal)}</small></div>
              <div className="stat-card"><span>Ventas confirmadas</span><strong>{resumen.ventasCantidad}</strong><small>{dinero(resumen.ventasTotal)}</small></div>
            </div>
          </section>

          <section id="informe-stock" className="panel sigo-report-detail">
            <div className="sigo-detail-title"><span>◫</span><h3>Stock</h3></div>
            <div className="stats-grid">
              <div className="stat-card"><span>Unidades en stock</span><strong>{resumen.unidadesStock}</strong><small>{resumen.productos} productos</small></div>
              <div className="stat-card"><span>Stock crítico</span><strong>{resumen.productosCriticos}</strong><small>{resumen.productosSinStock} sin stock</small></div>
            </div>
          </section>

          <section id="informe-clientes" className="panel sigo-report-detail">
            <div className="sigo-detail-title"><span>👥</span><h3>Cuenta corriente</h3></div>
            <div className="stats-grid">
              <div className="stat-card"><span>Clientes</span><strong>{resumen.clientes}</strong><small>{resumen.clientesConDeuda} con deuda</small></div>
              <div className="stat-card"><span>Saldo a cobrar</span><strong>{dinero(resumen.saldoClientes)}</strong><small>Sólo saldos deudores</small></div>
            </div>
          </section>

          <section id="informe-compras" className="panel sigo-report-detail">
            <div className="sigo-detail-title"><span>↓</span><h3>Compras</h3></div>
            <div className="stats-grid">
              <div className="stat-card"><span>Compras confirmadas</span><strong>{resumen.comprasCantidad}</strong><small>{dinero(resumen.comprasTotal)}</small></div>
            </div>
          </section>

          <section id="informe-caja" className="panel sigo-report-detail">
            <div className="sigo-detail-title"><span>$</span><h3>Caja de hoy</h3></div>
            <div className="stats-grid">
              <div className="stat-card"><span>Neto</span><strong>{dinero(resumen.cajaHoyNeto)}</strong><small>Ingresos {dinero(resumen.cajaHoyIngresos)} · Egresos {dinero(resumen.cajaHoyEgresos)}</small></div>
              {mediosCaja.map(([medio, total]) => (
                <div className="stat-card" key={medio}>
                  <span>{nombreMedio(medio)}</span>
                  <strong>{dinero(total)}</strong>
                  <small>Ingresos registrados</small>
                </div>
              ))}
            </div>
          </section>

          <section id="informe-resumen" className="panel sigo-report-detail">
            <div className="sigo-detail-title"><span>▥</span><h3>Resumen gerencial</h3></div>
            <p>SIGO consolida ventas confirmadas, caja, compras, stock y cuentas corrientes sin mezclar empresas.</p>
            {salud && (
              <div className="sigo-health-inline" role={salud.estado === "operativo" ? undefined : "alert"}>
                <strong>{etiquetaSalud(salud)}</strong>
                <span>{salud.operativos}/{salud.total} bloques críticos accesibles.</span>
              </div>
            )}
          </section>

          {resumen.modulosNoDisponibles.length > 0 && (
            <div className="panel" role="alert">
              <h3>Tablero parcial</h3>
              <p>Los módulos siguientes no respondieron y sus indicadores se muestran en cero: {resumen.modulosNoDisponibles.join(", ")}.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
