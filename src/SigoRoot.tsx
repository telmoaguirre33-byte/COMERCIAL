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
import { supabase } from "./supabase";
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

type TenantState = "loading" | "ready" | "empty" | "error";

export default function SigoRoot() {
  const [empresaActiva, setEmpresaActiva] = useState<EmpresaOperativa | null>(null);
  const [tenantReady, setTenantReady] = useState(false);
  const [tenantState, setTenantState] = useState<TenantState>("loading");
  const [tenantRetryKey, setTenantRetryKey] = useState(0);
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
      setTenantState("ready");
      setWorkspace(workspaceInicial(creada.rol));
      setNuevaEmpresa("");
    } catch (error) {
      console.error("No se pudo completar el alta inicial de empresa", error);
      setErrorEmpresa("No pudimos terminar la configuración. Tocá Reintentar acceso y volvé a probar.");
    } finally {
      setCreandoEmpresa(false);
    }
  }

  async function cambiarUsuario() {
    await supabase.auth.signOut();
  }

  return (
    <div className="sigo-root">
      <style>{`
        .sigo-operation-only .sidebar .menu > button:nth-child(4),
        .sigo-operation-only .sidebar .menu > button:nth-child(5),
        .sigo-operation-only .sidebar .menu > button:nth-child(7) { display: none; }

        .sigo-role-seller .sidebar .menu > button:nth-child(2),
        .sigo-role-seller .sidebar .menu > button:nth-child(6),
        .sigo-role-seller .welcome .topbar-actions { display: none; }

        .sigo-role-warehouse .sidebar .menu > button:nth-child(3) { display: none; }

        .sigo-onboarding-card {
          width: min(520px, calc(100% - 32px));
          margin: 48px auto;
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
        .sigo-onboarding-actions { display: grid; gap: 10px; margin-top: 18px; }
        .sigo-link-button {
          border: 0;
          background: transparent;
          color: #2563eb;
          font-weight: 800;
          padding: 8px;
        }
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
        <TenantSwitcher
          key={tenantRetryKey}
          value={empresaActiva?.empresa_id ?? null}
          onChange={handleEmpresaChange}
          onStateChange={setTenantState}
        />
      </div>

      {!tenantReady || tenantState === "loading" ? (
        <main className="sigo-onboarding-card" aria-live="polite">
          <h1>Preparando SIGO…</h1>
          <p>Estamos cargando tu empresa y tus permisos.</p>
        </main>
      ) : tenantState === "error" ? (
        <main className="sigo-onboarding-card" role="alert">
          <h1>No pudimos completar el acceso</h1>
          <p>No necesitás configurar nada técnico. Reintentá y SIGO volverá a cargar tu empresa.</p>
          <div className="sigo-onboarding-actions">
            <button className="primary-button" type="button" onClick={() => setTenantRetryKey((v) => v + 1)}>
              Reintentar acceso
            </button>
            <button className="sigo-link-button" type="button" onClick={() => void cambiarUsuario()}>
              Cambiar usuario
            </button>
          </div>
        </main>
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
          <main className="sigo-onboarding-card" role="alert">
            <h1>Acceso limitado</h1>
            <p>Tu perfil no tiene habilitada esta operación.</p>
          </main>
        )
      ) : (
        <main className="sigo-onboarding-card">
          <h1>Creá tu empresa</h1>
          <p>Solo necesitamos el nombre del negocio. Después entrás directo a SIGO como administrador principal.</p>
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
              {creandoEmpresa ? "Creando…" : "Crear y entrar"}
            </button>
          </form>
        </main>
      )}
    </div>
  );
}
