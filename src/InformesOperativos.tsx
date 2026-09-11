import { useEffect, useState } from "react";
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

export default function InformesOperativos({ empresaId }: { empresaId: string }) {
  const [resumen, setResumen] = useState<ResumenOperativoSigo>(vacio);
  const [salud, setSalud] = useState<SaludOperativaSigo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [nuevoResumen, nuevaSalud] = await Promise.all([
        cargarResumenOperativoSigo(empresaId),
        verificarSaludOperativaSigo(empresaId),
      ]);
      setResumen(nuevoResumen);
      setSalud(nuevaSalud);
    } catch (err) {
      setResumen(vacio);
      setSalud(null);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los informes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [empresaId]);

  if (loading) return <div className="panel"><p>Cargando indicadores operativos…</p></div>;

  const mediosCaja = Object.entries(resumen.cajaHoyPorMedio).sort((a, b) => b[1] - a[1]);

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
          <h3>No se pudo cargar el tablero</h3>
          <p>{error}</p>
        </div>
      )}

      {!error && salud && (
        <div className="panel" role={salud.estado === "operativo" ? undefined : "alert"}>
          <h3>{etiquetaSalud(salud)}</h3>
          <p>{salud.operativos}/{salud.total} bloques críticos accesibles para la empresa activa.</p>
          <div className="stats-grid">
            {salud.modulos.map((modulo) => (
              <div className="stat-card" key={modulo.modulo}>
                <span>{modulo.modulo}</span>
                <strong>{modulo.estado === "operativo" ? "OK" : modulo.estado === "no_disponible" ? "FALTA SQL" : "REVISAR"}</strong>
                <small>{modulo.detalle}</small>
              </div>
            ))}
          </div>
          <small>Última validación: {new Date(salud.verificadoEn).toLocaleString("es-AR")}</small>
        </div>
      )}

      {!error && resumen.modulosNoDisponibles.length > 0 && (
        <div className="panel" role="alert">
          <h3>Tablero parcial</h3>
          <p>Los módulos siguientes no respondieron y sus indicadores se muestran en cero: {resumen.modulosNoDisponibles.join(", ")}.</p>
          <p>El resto del tablero continúa operativo para no ocultar información disponible.</p>
        </div>
      )}

      {!error && (
        <>
          <div className="stats-grid">
            <div className="stat-card"><span>Ventas de hoy</span><strong>{resumen.ventasHoy}</strong><small>{dinero(resumen.ventasHoyTotal)}</small></div>
            <div className="stat-card"><span>Caja de hoy</span><strong>{dinero(resumen.cajaHoyNeto)}</strong><small>Ingresos {dinero(resumen.cajaHoyIngresos)} · Egresos {dinero(resumen.cajaHoyEgresos)}</small></div>
            <div className="stat-card"><span>Ventas registradas</span><strong>{resumen.ventasCantidad}</strong><small>{dinero(resumen.ventasTotal)}</small></div>
            <div className="stat-card"><span>Compras registradas</span><strong>{resumen.comprasCantidad}</strong><small>{dinero(resumen.comprasTotal)}</small></div>
            <div className="stat-card"><span>Unidades en stock</span><strong>{resumen.unidadesStock}</strong><small>{resumen.productos} productos</small></div>
            <div className="stat-card"><span>Stock crítico</span><strong>{resumen.productosCriticos}</strong><small>{resumen.productosSinStock} sin stock</small></div>
            <div className="stat-card"><span>Clientes</span><strong>{resumen.clientes}</strong><small>{resumen.clientesConDeuda} con deuda</small></div>
            <div className="stat-card"><span>Saldo a cobrar</span><strong>{dinero(resumen.saldoClientes)}</strong><small>Cuenta corriente</small></div>
          </div>

          <div className="panel">
            <h3>Caja de hoy por medio de pago</h3>
            {mediosCaja.length === 0 ? (
              <p>Sin ingresos de Caja registrados hoy.</p>
            ) : (
              <div className="stats-grid">
                {mediosCaja.map(([medio, total]) => (
                  <div className="stat-card" key={medio}>
                    <span>{nombreMedio(medio)}</span>
                    <strong>{dinero(total)}</strong>
                    <small>Ingresos registrados</small>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel">
            <h3>Lectura gerencial rápida</h3>
            <p>
              SIGO consolida ventas, caja, compras, stock y cuentas corrientes sin mezclar empresas. Además valida en tiempo de ejecución si la base productiva tiene disponibles los bloques críticos, para distinguir un módulo vacío de una migración faltante o un problema de permisos.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
