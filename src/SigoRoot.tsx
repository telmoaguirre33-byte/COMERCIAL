import { useCallback, useState } from "react";
import ClientesOperativos from "./ClientesOperativos";
import SigoApp from "./SigoApp";
import TenantSwitcher from "./TenantSwitcher";
import type { EmpresaOperativa } from "./tenant";

export default function SigoRoot() {
  const [empresaActiva, setEmpresaActiva] = useState<EmpresaOperativa | null>(null);
  const [tenantReady, setTenantReady] = useState(false);
  const [workspace, setWorkspace] = useState<"operacion" | "clientes">("operacion");

  const handleEmpresaChange = useCallback((empresa: EmpresaOperativa | null) => {
    setEmpresaActiva(empresa);
    setTenantReady(true);
    setWorkspace("operacion");
  }, []);

  return (
    <div className="sigo-root">
      <div className="sigo-tenant-bar" role="region" aria-label="Contexto operativo SIGO">
        <div className="sigo-tenant-copy">
          <strong>SIGO</strong>
          <span>Sistema Inteligente de Gestión Operativa</span>
        </div>
        {empresaActiva && (
          <div className="topbar-actions">
            <button
              className={workspace === "operacion" ? "primary-button" : "admin-button"}
              onClick={() => setWorkspace("operacion")}
            >
              Operación
            </button>
            <button
              className={workspace === "clientes" ? "primary-button" : "admin-button"}
              onClick={() => setWorkspace("clientes")}
            >
              Clientes / Ctas. corrientes
            </button>
          </div>
        )}
        <TenantSwitcher value={empresaActiva?.empresa_id ?? null} onChange={handleEmpresaChange} />
      </div>

      {!tenantReady ? (
        <div className="sigo-tenant-state" aria-live="polite">
          Preparando empresa activa…
        </div>
      ) : empresaActiva ? (
        workspace === "clientes" ? (
          <main className="main" style={{ minHeight: "calc(100vh - 88px)" }}>
            <section className="content">
              <ClientesOperativos key={empresaActiva.empresa_id} empresaId={empresaActiva.empresa_id} />
            </section>
          </main>
        ) : (
          <SigoApp key={empresaActiva.empresa_id} empresa={empresaActiva} />
        )
      ) : (
        <main className="sigo-tenant-state" role="alert">
          <h1>SIGO necesita una empresa activa</h1>
          <p>
            Para proteger productos, stock, ventas y clientes, la operación queda bloqueada
            hasta que el usuario tenga una membresía activa en una empresa.
          </p>
        </main>
      )}
    </div>
  );
}
