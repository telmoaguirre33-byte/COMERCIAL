import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PENDING_EMPRESA_METADATA_KEY = "sigo_empresa_nombre";
type TenantState = "loading" | "ready" | "empty" | "error";

export default function SigoRoot() {
  const [empresaActiva, setEmpresaActiva] = useState<EmpresaOperativa | null>(null);
  const [tenantReady, setTenantReady] = useState(false);
  const [tenantState, setTenantState] = useState<TenantState>("loading");
  const [tenantRetryKey, setTenantRetryKey] = useState(0);
  const [workspace, setWorkspace] = useState<SigoWorkspace>("operacion");
  const [nuevaEmpresa, setNuevaEmpresa] = useState("");
  const [creandoEmpresa, setCreandoEmpresa] = useState(false);
  const [autoProvisionando, setAutoProvisionando] = useState(false);
  const [errorEmpresa, setErrorEmpresa] = useState("");
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const autoProvisionAttemptedRef = useRef(false);

  const permitidos = useMemo(
    () => (empresaActiva ? workspacesPermitidos(empresaActiva.rol) : []),
    [empresaActiva],
  );

  const handleEmpresaChange = useCallback((empresa: EmpresaOperativa | null) => {
    setEmpresaActiva(empresa);
    setTenantReady(true);
    setWorkspace(empresa ? workspaceInicial(empresa.rol) : "operacion");
    if (empresa) setAutoRetryCount(0);
  }, []);

  useEffect(() => {
    if (!empresaActiva) return;
    if (!workspacePermitido(empresaActiva.rol, workspace)) {
      setWorkspace(workspaceInicial(empresaActiva.rol));
    }
  }, [empresaActiva, workspace]);

  useEffect(() => {
    if (tenantState !== "error" || autoRetryCount >= 3) return;
    const timer = window.setTimeout(() => {
      setAutoRetryCount((v) => v + 1);
      setTenantRetryKey((v) => v + 1);
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [tenantState, autoRetryCount]);

  useEffect(() => {
    if (!tenantReady || tenantState !== "empty" || empresaActiva || autoProvisionAttemptedRef.current) return;
    autoProvisionAttemptedRef.current = true;
    let cancelled = false;

    void (async () => {
      let empresaCreadaId: string | null = null;
      setAutoProvisionando(true);
      setErrorEmpresa("");
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const user = data.user;
        const nombrePendiente = String(user?.user_metadata?.[PENDING_EMPRESA_METADATA_KEY] ?? "").trim();
        if (!user || !nombrePendiente) return;

        if (!cancelled) setNuevaEmpresa(nombrePendiente);
        empresaCreadaId = await crearEmpresaSigo(nombrePendiente);
        const empresas = await cargarMisEmpresas();
        const creada = resolverEmpresaActiva(empresas, empresaCreadaId, user.id);
        if (!creada) throw new Error("EMPRESA_CREATED_NOT_VISIBLE");

        const { error: metadataError } = await supabase.auth.updateUser({
          data: { [PENDING_EMPRESA_METADATA_KEY]: null },
        });
        if (metadataError) console.warn("No se pudo limpiar el alta pendiente de empresa", metadataError);
        if (cancelled) return;

        setEmpresaActiva(creada);
        setTenantState("ready");
        setWorkspace(workspaceInicial(creada.rol));
        setNuevaEmpresa("");
        setTenantRetryKey((v) => v + 1);
      } catch (error) {
        if (cancelled) return;
        console.error("No se pudo completar automáticamente el alta de empresa", error);
        if (empresaCreadaId) {
          setErrorEmpresa("La empresa ya se creó. Estamos actualizando tu acceso; no vuelvas a crearla.");
          setTenantRetryKey((v) => v + 1);
        } else {
          setErrorEmpresa("No pudimos completar automáticamente el alta. Podés reintentar con el nombre de tu empresa.");
        }
      } finally {
        if (!cancelled) setAutoProvisionando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantReady, tenantState, empresaActiva]);

  function abrirWorkspace(destino: SigoWorkspace) {
    if (!empresaActiva || !workspacePermitido(empresaActiva.rol, destino)) return;
    setWorkspace(destino);
  }

  async function crearPrimeraEmpresa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creandoEmpresa || autoProvisionando) return;
    const nombre = nuevaEmpresa.trim();
    if (!nombre) {
      setErrorEmpresa("Ingresá el nombre de tu empresa o negocio.");
      return;
    }

    setCreandoEmpresa(true);
    setErrorEmpresa("");
    let empresaId: string | null = null;
    try {
      empresaId = await crearEmpresaSigo(nombre);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const empresas = await cargarMisEmpresas();
      const creada = resolverEmpresaActiva(empresas, empresaId, user?.id ?? null);
      if (!creada) throw new Error("EMPRESA_CREATED_NOT_VISIBLE");

      const { error: metadataError } = await supabase.auth.updateUser({
        data: { [PENDING_EMPRESA_METADATA_KEY]: null },
      });
      if (metadataError) console.warn("No se pudo limpiar el alta pendiente de empresa", metadataError);

      setEmpresaActiva(creada);
      setTenantState("ready");
      setWorkspace(workspaceInicial(creada.rol));
      setNuevaEmpresa("");
      setTenantRetryKey((v) => v + 1);
    } catch (error) {
      console.error("No se pudo completar el alta inicial de empresa", error);
      if (empresaId) {
        setErrorEmpresa("La empresa se creó. Estamos actualizando tu acceso; no vuelvas a crearla.");
        setTenantRetryKey((v) => v + 1);
      } else {
        setErrorEmpresa("No pudimos terminar la configuración. Intentá nuevamente.");
      }
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
        .sigo-link-button { border: 0; background: transparent; color: #2563eb; font-weight: 800; padding: 8px; }

        .sigo-recovery {
          width: min(560px, calc(100% - 28px));
          margin: 42px auto;
          background: linear-gradient(180deg,#ffffff 0%,#fbfdff 100%);
          border: 1px solid #e5edf6;
          border-radius: 24px;
          box-shadow: 0 24px 60px rgba(15,23,42,.10);
          overflow: hidden;
        }
        .sigo-recovery-head { padding: 28px 28px 20px; }
        .sigo-recovery-brand { display:flex; align-items:center; gap:12px; margin-bottom:22px; }
        .sigo-recovery-mark { width:42px; height:42px; border-radius:12px; display:grid; place-items:center; background:#2563eb; color:#fff; font-weight:900; letter-spacing:.03em; box-shadow:0 8px 22px rgba(37,99,235,.24); }
        .sigo-recovery-brand strong { display:block; font-size:18px; color:#0f172a; }
        .sigo-recovery-brand span { display:block; font-size:13px; color:#64748b; margin-top:2px; }
        .sigo-recovery-status { display:inline-flex; align-items:center; gap:8px; padding:7px 11px; border-radius:999px; background:#eef5ff; color:#1d4ed8; font-size:13px; font-weight:800; }
        .sigo-recovery-dot { width:8px; height:8px; border-radius:50%; background:#2563eb; box-shadow:0 0 0 5px rgba(37,99,235,.10); }
        .sigo-recovery h1 { margin:18px 0 10px; font-size:clamp(30px,7vw,46px); line-height:1.04; color:#0f172a; letter-spacing:-.035em; }
        .sigo-recovery p { margin:0; color:#64748b; font-size:16px; line-height:1.6; }
        .sigo-recovery-actions { display:grid; gap:10px; padding:0 28px 28px; }
        .sigo-recovery .primary-button { min-height:54px; border-radius:14px; font-size:16px; }
        .sigo-recovery-secondary { min-height:50px; border:1px solid #dbe3ee; border-radius:14px; background:#fff; color:#334155; font-weight:800; font-size:15px; }
        .sigo-recovery-foot { border-top:1px solid #eef2f7; padding:16px 28px 20px; color:#94a3b8; font-size:12px; line-height:1.5; }
        @media (max-width:600px){
          .sigo-recovery { margin:24px auto; border-radius:20px; }
          .sigo-recovery-head { padding:24px 22px 18px; }
          .sigo-recovery-actions { padding:0 22px 22px; }
          .sigo-recovery-foot { padding:14px 22px 18px; }
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
              <button key={item} className={workspace === item ? "primary-button" : "admin-button"} aria-current={workspace === item ? "page" : undefined} onClick={() => abrirWorkspace(item)}>
                {WORKSPACE_LABELS[item]}
              </button>
            ))}
          </div>
        )}
        <TenantSwitcher key={tenantRetryKey} value={empresaActiva?.empresa_id ?? null} onChange={handleEmpresaChange} onStateChange={setTenantState} />
      </div>

      {!tenantReady || tenantState === "loading" ? (
        <main className="sigo-onboarding-card" aria-live="polite">
          <h1>Preparando SIGO…</h1>
          <p>Estamos cargando tu empresa y tus permisos.</p>
        </main>
      ) : tenantState === "error" ? (
        <main className="sigo-recovery" role="status" aria-live="polite">
          <div className="sigo-recovery-head">
            <div className="sigo-recovery-brand"><div className="sigo-recovery-mark">SG</div><div><strong>SIGO</strong><span>Sistema Inteligente de Gestión Operativa</span></div></div>
            <div className="sigo-recovery-status"><span className="sigo-recovery-dot" />Reconectando tu empresa</div>
            <h1>Estamos recuperando tu acceso</h1>
            <p>SIGO está intentando restablecer la conexión con tu empresa automáticamente. No necesitás configurar nada.</p>
          </div>
          <div className="sigo-recovery-actions">
            <button className="primary-button" type="button" onClick={() => { setAutoRetryCount(0); setTenantRetryKey((v) => v + 1); }}>
              Reintentar ahora
            </button>
            <button className="sigo-recovery-secondary" type="button" onClick={() => void cambiarUsuario()}>
              Volver al ingreso
            </button>
          </div>
          <div className="sigo-recovery-foot">Tus datos permanecen protegidos. SIGO no modifica información mientras completa la reconexión.</div>
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
          <main className="sigo-onboarding-card" role="alert"><h1>Acceso limitado</h1><p>Tu perfil no tiene habilitada esta operación.</p></main>
        )
      ) : (
        <main className="sigo-onboarding-card" aria-live="polite">
          <h1>{autoProvisionando ? "Terminando de crear tu empresa…" : "Creá tu empresa"}</h1>
          <p>{autoProvisionando ? "Detectamos el alta iniciada al registrarte y estamos completando tu acceso automáticamente." : "Solo necesitamos el nombre del negocio. Después entrás directo a SIGO como administrador principal."}</p>
          <form onSubmit={crearPrimeraEmpresa}>
            <input aria-label="Nombre de la empresa" placeholder="Nombre de la empresa o negocio" value={nuevaEmpresa} onChange={(event) => setNuevaEmpresa(event.target.value)} autoComplete="organization" required disabled={autoProvisionando} />
            {errorEmpresa ? <div className="sigo-onboarding-error" role="alert">{errorEmpresa}</div> : null}
            <button className="primary-button" type="submit" disabled={creandoEmpresa || autoProvisionando}>{creandoEmpresa || autoProvisionando ? "Configurando…" : "Crear y entrar"}</button>
          </form>
        </main>
      )}
    </div>
  );
}
