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
      setErrorEmpresa("No pudimos terminar la configuración. Intentá nuevamente.");
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

        .sigo-access-shell {
          min-height: calc(100vh - 86px);
          display: grid;
          place-items: start center;
          padding: 56px 20px 28px;
          background:
            radial-gradient(circle at top left, rgba(37, 99, 235, .08), transparent 34%),
            linear-gradient(180deg, #f8fafc 0%, #f3f6fb 100%);
        }
        .sigo-access-card {
          width: min(470px, 100%);
          padding: 28px;
          border: 1px solid rgba(148, 163, 184, .22);
          border-radius: 24px;
          background: rgba(255,255,255,.98);
          box-shadow: 0 24px 60px rgba(15,23,42,.10);
        }
        .sigo-access-status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: 999px;
          background: #eff6ff;
          color: #1d4ed8;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: .02em;
        }
        .sigo-access-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: #2563eb;
          box-shadow: 0 0 0 4px rgba(37,99,235,.10);
        }
        .sigo-access-card h1 {
          margin: 18px 0 10px;
          color: #0f172a;
          font-size: clamp(28px, 6vw, 38px);
          line-height: 1.08;
          letter-spacing: -.035em;
        }
        .sigo-access-card p {
          margin: 0;
          color: #64748b;
          font-size: 15px;
          line-height: 1.6;
        }
        .sigo-access-actions {
          display: grid;
          gap: 10px;
          margin-top: 24px;
        }
        .sigo-access-primary {
          min-height: 52px;
          border: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, #1d4ed8, #2563eb);
          color: #fff;
          font-size: 16px;
          font-weight: 850;
          box-shadow: 0 12px 24px rgba(37,99,235,.22);
        }
        .sigo-access-secondary {
          min-height: 46px;
          border: 1px solid #dbe3ee;
          border-radius: 14px;
          background: #fff;
          color: #334155;
          font-size: 14px;
          font-weight: 750;
        }
        .sigo-access-foot {
          margin-top: 18px;
          padding-top: 16px;
          border-top: 1px solid #eef2f7;
          color: #94a3b8;
          font-size: 12px;
          line-height: 1.45;
        }
        @media (max-width: 560px) {
          .sigo-access-shell { padding: 28px 16px; }
          .sigo-access-card { padding: 24px 20px; border-radius: 20px; }
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
        <main className="sigo-access-shell">
          <section className="sigo-access-card" aria-live="polite">
            <div className="sigo-access-status"><span className="sigo-access-dot" /> Acceso temporalmente interrumpido</div>
            <h1>No pudimos sincronizar tu empresa</h1>
            <p>SIGO está disponible, pero no pudo completar la carga de tu empresa en este momento. Podés intentar nuevamente o volver al ingreso.</p>
            <div className="sigo-access-actions">
              <button className="sigo-access-primary" type="button" onClick={() => setTenantRetryKey((v) => v + 1)}>
                Intentar nuevamente
              </button>
              <button className="sigo-access-secondary" type="button" onClick={() => void cambiarUsuario()}>
                Volver al ingreso
              </button>
            </div>
            <div className="sigo-access-foot">Tus datos no se modificaron. La operación permanece protegida hasta completar la sincronización.</div>
          </section>
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
