import { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

type EmpresaMatriz = {
  empresa_id: string;
  nombre: string;
  razon_social: string | null;
  cuit: string | null;
  activa: boolean;
  created_at: string;
  owner_email: string | null;
  usuarios_activos: number;
  administradores: number;
  vendedores: number;
  depositos: number;
  clientes_portal: number;
  soporte_activo: boolean;
};

type Resumen = {
  empresas_total: number;
  empresas_activas: number;
  empresas_suspendidas: number;
  usuarios_activos: number;
  clientes_portal: number;
};

type Props = {
  onOpenEmpresa: (empresaId: string) => Promise<void> | void;
};

const resumenVacio: Resumen = {
  empresas_total: 0,
  empresas_activas: 0,
  empresas_suspendidas: 0,
  usuarios_activos: 0,
  clientes_portal: 0,
};

function normalizarNumero(valor: unknown): number {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? numero : 0;
}

export default function MatrizAdmin({ onOpenEmpresa }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaMatriz[]>([]);
  const [resumen, setResumen] = useState<Resumen>(resumenVacio);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [resumenResp, empresasResp] = await Promise.all([
        supabase.rpc("matriz_resumen_sigo"),
        supabase.rpc("matriz_listar_empresas_sigo"),
      ]);
      if (resumenResp.error) throw resumenResp.error;
      if (empresasResp.error) throw empresasResp.error;

      const filaResumen = Array.isArray(resumenResp.data) ? resumenResp.data[0] : resumenResp.data;
      setResumen({
        empresas_total: normalizarNumero(filaResumen?.empresas_total),
        empresas_activas: normalizarNumero(filaResumen?.empresas_activas),
        empresas_suspendidas: normalizarNumero(filaResumen?.empresas_suspendidas),
        usuarios_activos: normalizarNumero(filaResumen?.usuarios_activos),
        clientes_portal: normalizarNumero(filaResumen?.clientes_portal),
      });
      setEmpresas(((empresasResp.data ?? []) as any[]).map((fila) => ({
        empresa_id: String(fila.empresa_id),
        nombre: String(fila.nombre ?? "Empresa"),
        razon_social: typeof fila.razon_social === "string" ? fila.razon_social : null,
        cuit: typeof fila.cuit === "string" ? fila.cuit : null,
        activa: Boolean(fila.activa),
        created_at: String(fila.created_at ?? ""),
        owner_email: typeof fila.owner_email === "string" ? fila.owner_email : null,
        usuarios_activos: normalizarNumero(fila.usuarios_activos),
        administradores: normalizarNumero(fila.administradores),
        vendedores: normalizarNumero(fila.vendedores),
        depositos: normalizarNumero(fila.depositos),
        clientes_portal: normalizarNumero(fila.clientes_portal),
        soporte_activo: Boolean(fila.soporte_activo),
      })));
    } catch (e) {
      console.error(e);
      setError("No pudimos cargar la Matriz. Revisá el despliegue de Supabase y volvé a intentar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void cargar(); }, []);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return empresas;
    return empresas.filter((empresa) =>
      [empresa.nombre, empresa.razon_social, empresa.cuit, empresa.owner_email]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(q)),
    );
  }, [empresas, busqueda]);

  async function cambiarEstado(empresa: EmpresaMatriz) {
    const proximo = !empresa.activa;
    const accion = proximo ? "reactivar" : "suspender";
    if (!window.confirm(`¿Querés ${accion} ${empresa.nombre}?`)) return;
    setWorkingId(empresa.empresa_id);
    setError("");
    setMensaje("");
    try {
      const { error: rpcError } = await supabase.rpc("matriz_actualizar_estado_empresa_sigo", {
        p_empresa_id: empresa.empresa_id,
        p_activa: proximo,
      });
      if (rpcError) throw rpcError;
      setMensaje(`${empresa.nombre}: estado actualizado correctamente.`);
      await cargar();
    } catch (e) {
      console.error(e);
      setError("No pudimos actualizar el estado de la empresa.");
    } finally {
      setWorkingId(null);
    }
  }

  async function abrirSoporte(empresa: EmpresaMatriz) {
    setWorkingId(empresa.empresa_id);
    setError("");
    setMensaje("");
    try {
      const { error: rpcError } = await supabase.rpc("matriz_iniciar_soporte_sigo", {
        p_empresa_id: empresa.empresa_id,
      });
      if (rpcError) throw rpcError;
      await onOpenEmpresa(empresa.empresa_id);
    } catch (e) {
      console.error(e);
      setError("No pudimos abrir el modo soporte para esa empresa.");
    } finally {
      setWorkingId(null);
    }
  }

  async function cerrarSoporte(empresa: EmpresaMatriz) {
    setWorkingId(empresa.empresa_id);
    setError("");
    setMensaje("");
    try {
      const { error: rpcError } = await supabase.rpc("matriz_finalizar_soporte_sigo", {
        p_empresa_id: empresa.empresa_id,
      });
      if (rpcError) throw rpcError;
      setMensaje(`Modo soporte cerrado para ${empresa.nombre}.`);
      await cargar();
    } catch (e) {
      console.error(e);
      setError("No pudimos cerrar el modo soporte.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="main sigo-matriz-main">
      <section className="content sigo-matriz-content">
        <div className="page-header sigo-matriz-header">
          <div>
            <span className="sigo-matriz-kicker">MATRIZ / SUPERADMIN</span>
            <h2>Administración central de SIGO</h2>
            <p>Empresas, usuarios y soporte desde un solo lugar, sin pedir contraseñas a clientes.</p>
          </div>
          <button className="admin-button" type="button" onClick={() => void cargar()} disabled={loading}>Actualizar</button>
        </div>

        <div className="stats sigo-matriz-stats">
          <article className="stat-card"><span>Empresas</span><strong>{resumen.empresas_total}</strong><small>Total registradas</small></article>
          <article className="stat-card"><span>Activas</span><strong>{resumen.empresas_activas}</strong><small>Operativas</small></article>
          <article className="stat-card"><span>Usuarios</span><strong>{resumen.usuarios_activos}</strong><small>Miembros activos</small></article>
          <article className="stat-card"><span>Portal Cliente</span><strong>{resumen.clientes_portal}</strong><small>Usuarios cliente</small></article>
        </div>

        <section className="panel sigo-matriz-panel">
          <div className="panel-header sigo-matriz-tools">
            <div><h3>Empresas clientes</h3><p>{resumen.empresas_suspendidas} suspendida(s) · soporte auditable por empresa</p></div>
            <input
              className="sigo-matriz-search"
              placeholder="Buscar empresa, CUIT o propietario"
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
            />
          </div>

          {error ? <div className="form-error">{error}</div> : null}
          {mensaje ? <div className="sigo-matriz-success">{mensaje}</div> : null}

          {loading ? <div className="empty-state">Cargando Matriz…</div> : filtradas.length === 0 ? (
            <div className="empty-state">No hay empresas que coincidan con la búsqueda.</div>
          ) : (
            <div className="sigo-matriz-grid">
              {filtradas.map((empresa) => (
                <article className="sigo-matriz-company" key={empresa.empresa_id}>
                  <div className="sigo-matriz-company-head">
                    <div>
                      <div className="sigo-matriz-title-row">
                        <h4>{empresa.nombre}</h4>
                        <span className={empresa.activa ? "sigo-status active" : "sigo-status suspended"}>{empresa.activa ? "Activa" : "Suspendida"}</span>
                        {empresa.soporte_activo ? <span className="sigo-status support">Soporte abierto</span> : null}
                      </div>
                      <p>{empresa.razon_social || empresa.owner_email || "Sin razón social informada"}</p>
                      <small>{empresa.cuit ? `CUIT ${empresa.cuit}` : "CUIT pendiente"}{empresa.owner_email ? ` · ${empresa.owner_email}` : ""}</small>
                    </div>
                  </div>

                  <div className="sigo-matriz-metrics">
                    <span><strong>{empresa.usuarios_activos}</strong> usuarios</span>
                    <span><strong>{empresa.administradores}</strong> admin</span>
                    <span><strong>{empresa.vendedores}</strong> vendedores</span>
                    <span><strong>{empresa.depositos}</strong> depósito</span>
                    <span><strong>{empresa.clientes_portal}</strong> clientes</span>
                  </div>

                  <div className="sigo-matriz-actions">
                    {empresa.soporte_activo ? (
                      <button className="admin-button" type="button" disabled={workingId === empresa.empresa_id} onClick={() => void cerrarSoporte(empresa)}>Cerrar soporte</button>
                    ) : (
                      <button className="primary-button" type="button" disabled={!empresa.activa || workingId === empresa.empresa_id} onClick={() => void abrirSoporte(empresa)}>Entrar en soporte</button>
                    )}
                    <button className={empresa.activa ? "admin-button danger-button" : "admin-button"} type="button" disabled={workingId === empresa.empresa_id} onClick={() => void cambiarEstado(empresa)}>
                      {empresa.activa ? "Suspender" : "Reactivar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
