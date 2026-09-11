import { useCallback, useEffect, useMemo, useState } from "react";
import ClientesOperativos from "./ClientesOperativos";
import ComprasOperativas from "./ComprasOperativas";
import InformesOperativos from "./InformesOperativos";
import SigoApp from "./SigoApp";
import TenantSwitcher from "./TenantSwitcher";
import {
  cargarMisEmpresas,
  crearEmpresaSigo,
  resolverEmpresaActiva,
  type EmpresaOperativa,
} from "./tenant";
import {
  etiquetaRol,
  type SigoWorkspace,
  workspaceInicial,
  workspacePermitido,
  workspacesPermitidos,
} from "./workspacePermissions";

const WORKSPACE_LABELS: Record<SigoWorkspace, string> = {
  operacion: "Operación",
  clientes: "Clientes / Ctas. corrientes",
  compras: "Compras / Proveedores",
  informes: "Informes",
};

export default function SigoRoot() {
  const [empresaActiva, setEmpresaActiva] = useState<EmpresaOperativa | null>(null);
  const [tenantReady, setTenantReady] = useState(false);
  const [workspace, setWorkspace] = useState<SigoWorkspace>("operacion");
  const [nuevaEmpresa, setNuevaEmpresa] = useState("");
  const [creandoEmpresa, setCreandoEmpresa] = useState(false);
  const [errorEmpresa, setErrorEmpresa] = useState("");

  const permitidos = useMemo(
    () => (empresaActiva ? workspacesPermitidos(empresaActiva.rol) : []),
    [empresaActiva],
  );

  const handleEmpresaChange = useCallback((empresa: EmpresaOperativa | null) => {
    setEmpresaActiva(empresa);
    setTenantReady(true);
    setWorkspace(empresa ? workspaceInicial(empresa.rol) : "operacion");
  }, []);

  useEffect(() => {
    if (!empresaActiva) return;
    if (!workspacePermitido(empresaActiva.rol, workspace)) {
      setWorkspace(workspaceInicial(empresaActiva.rol));
    }
  }, [empresaActiva, workspace]);

  function abrirWorkspace(destino: SigoWorkspace) {
    if (!empresaActiva || !workspacePermitido(empresaActiva.rol, destino)) return;
    setWorkspace(destino);
  }

  async function crearPrimeraEmpresa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creandoEmpresa) return;
    const nombre = nuevaEmpresa.trim();
    if (!nombre) {
      setErrorEmpresa("Ingresá el nombre de tu empresa o negocio.");
      return;
    }

    setCreandoEmpresa(true);
    setErrorEmpresa("");
    try {
      const empresaId = await crearEmpresaSigo(nombre);
      const empresas = await cargarMisEmpresas();
      const creada = resolverEmpresaActiva(empresas, empresaId);
      if (!creada) throw new Error("EMPRESA_CREATED_NOT_VISIBLE");
      setEmpresaActiva(creada);
      setWorkspace(workspaceInicial(creada.rol));
      setNuevaEmpresa("");
    } catch (error) {
      console.error("No se pudo completar el alta inicial de empresa", error);
      setErrorEmpresa("No pudimos crear la empresa todavía. Reintentá en unos segundos.");
    } finally {
      setCreandoEmpresa(false);
    }
  }

  return (
    <div className="sigo-root">
      <style>{`
        /* Clientes, Compras e Informes se navegan desde la barra global.
           Se ocultan sus duplicados legacy para evitar botones que llevan a "Pendiente". */
        .sigo-operation-only .sidebar .menu > button:nth-child(4),
        .sigo-operation-only .sidebar .menu > button:nth-child(5),
        .sigo-operation-only .sidebar .menu > button:nth-child(7) { display: none; }

        /* El rol también limita la navegación interna de Operación.
           Backend/RLS sigue siendo la autoridad: esto evita ofrecer acciones que el rol no debe usar. */
        .sigo-role-seller .sidebar .menu > button:nth-child(2),
        .sigo-role-seller .sidebar .menu > button:nth-child(6),
        .sigo-role-seller .welcome .topbar-actions { display: none; }

        .sigo-role-warehouse .sidebar .menu > button:nth-child(3) { display: none; }

        .sigo-onboarding-card {
          width: min(520px, calc(100% - 32px));
          margin: 64px auto;
          padding: 28px;
          border-radius: 22px;
          background: #fff;
          box-shadow: 0 18px 50px rgba(15, 23, 42, .12);
        }
        .sigo-onboarding-card h1 { margin: 0 0 8px; }
        .sigo-onboarding-card p { color: #64748b; line-height: 1.5; }
        .sigo-onboarding-card form { display: grid; gap: 14px; margin-top: 20px; }
        .sigo-onboarding-card input {
          min-height: 50px;
          padding: 12px 14px;
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          font-size: 16px;
        }
        .sigo-onboarding-error { color: #b91c1c; font-size: 13px; }
      `}</style>

      <div className="sigo-tenant-bar" role="region" aria-label="Contexto operativo SIGO">
        <div className="sigo-tenant-copy">
          <strong>SIGO</strong>
          <span>Sistema Inteligente de Gestión Operativa</span>
          {empresaActiva && <small>{empresaActiva.empresa_nombre} · {etiquetaRol(empresaActiva.rol)}</small>}
        </div>
        {empresaActiva && (
          <div className="topbar-actions" role="navigation" aria-label="Módulos habilitados">
            {permitidos.map((item) => (
              <button
                key={item}
                className={workspace === item ? "primary-button" : "admin-button"}
                aria-current={workspace === item ? "page" : undefined}
                onClick={() => abrirWorkspace(item)}
              >
                {WORKSPACE_LABELS[item]}
              </button>
            ))}
          </div>
        )}
        <TenantSwitcher value={empresaActiva?.empresa_id ?? null} onChange={handleEmpresaChange} />
      </div>

      {!tenantReady ? (
        <div className="sigo-tenant-state" aria-live="polite">Preparando empresa activa…</div>
      ) : empresaActiva ? (
        workspace === "clientes" ? (
          <main className="main" style={{ minHeight: "calc(100vh - 88px)" }}><section className="content"><ClientesOperativos key={empresaActiva.empresa_id} empresaId={empresaActiva.empresa_id} /></section></main>
        ) : workspace === "compras" ? (
          <main className="main" style={{ minHeight: "calc(100vh - 88px)" }}><section className="content"><ComprasOperativas key={empresaActiva.empresa_id} empresaId={empresaActiva.empresa_id} /></section></main>
        ) : workspace === "informes" ? (
          <main className="main" style={{ minHeight: "calc(100vh - 88px)" }}><section className="content"><InformesOperativos key={empresaActiva.empresa_id} empresaId={empresaActiva.empresa_id} /></section></main>
        ) : workspacePermitido(empresaActiva.rol, "operacion") ? (
          <div className={`sigo-operation-only sigo-role-${empresaActiva.rol}`}><SigoApp key={empresaActiva.empresa_id} empresa={empresaActiva} /></div>
        ) : (
          <main className="sigo-tenant-state" role="alert">
            <h1>Acceso limitado por rol</h1>
            <p>Tu perfil {etiquetaRol(empresaActiva.rol)} no tiene habilitada la operación interna de esta empresa.</p>
          </main>
        )
      ) : (
        <main className="sigo-onboarding-card">
          <h1>Configurá tu empresa</h1>
          <p>Tu cuenta ya está activa. Creá tu primera empresa para empezar a trabajar en SIGO como administrador principal.</p>
          <form onSubmit={crearPrimeraEmpresa}>
            <input
              aria-label="Nombre de la empresa"
              placeholder="Nombre de la empresa o negocio"
              value={nuevaEmpresa}
              onChange={(event) => setNuevaEmpresa(event.target.value)}
              autoComplete="organization"
              required
            />
            {errorEmpresa ? <div className="sigo-onboarding-error" role="alert">{errorEmpresa}</div> : null}
            <button className="primary-button" type="submit" disabled={creandoEmpresa}>
              {creandoEmpresa ? "Creando empresa…" : "Crear empresa y continuar"}
            </button>
          </form>
        </main>
      )}
    </div>
  );
}
