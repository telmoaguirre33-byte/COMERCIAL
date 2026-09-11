import { useCallback, useEffect, useMemo, useState } from "react";
import ClientesOperativos from "./ClientesOperativos";
import ComprasOperativas from "./ComprasOperativas";
import InformesOperativos from "./InformesOperativos";
import SigoApp from "./SigoApp";
import TenantSwitcher from "./TenantSwitcher";
import type { EmpresaOperativa } from "./tenant";
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
        <main className="sigo-tenant-state" role="alert">
          <h1>SIGO necesita una empresa activa</h1>
          <p>Para proteger productos, stock, ventas y clientes, la operación queda bloqueada hasta que el usuario tenga una membresía activa en una empresa.</p>
        </main>
      )}
    </div>
  );
}
