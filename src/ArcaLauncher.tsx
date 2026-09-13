import { useCallback, useEffect, useState } from "react";
import ArcaFacturacion from "./ArcaFacturacion";
import { cargarMisEmpresas, leerEmpresaActivaGuardada, type EmpresaOperativa } from "./tenant";
import { supabase } from "./supabase";

export default function ArcaLauncher() {
  const [empresa, setEmpresa] = useState<EmpresaOperativa | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const resolverEmpresa = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setEmpresa(null);
        return null;
      }
      const empresas = await cargarMisEmpresas();
      const preferida = leerEmpresaActivaGuardada(user.id);
      const activa = empresas.find((item) => item.empresa_id === preferida) ?? empresas[0] ?? null;
      if (!activa || !["owner", "admin"].includes(activa.rol)) {
        setEmpresa(null);
        return null;
      }
      setEmpresa(activa);
      return activa;
    } catch (error) {
      console.warn("No se pudo resolver empresa para Facturación ARCA", error);
      setEmpresa(null);
      return null;
    }
  }, []);

  useEffect(() => {
    void resolverEmpresa();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void resolverEmpresa();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [resolverEmpresa]);

  async function abrir() {
    setLoading(true);
    const activa = await resolverEmpresa();
    setLoading(false);
    if (activa) setOpen(true);
  }

  if (!empresa) return null;

  return (
    <>
      <button className="arca-launcher" type="button" onClick={() => void abrir()} disabled={loading} aria-label="Abrir Facturación ARCA">
        <span className="arca-launcher-icon" aria-hidden="true">A</span>
        <span><strong>ARCA</strong><small>Facturar</small></span>
      </button>

      {open && empresa ? (
        <div className="arca-overlay" role="dialog" aria-modal="true" aria-label="Facturación ARCA">
          <div className="arca-overlay-topbar">
            <button type="button" className="admin-button" onClick={() => setOpen(false)}>← Volver</button>
            <div><strong>Facturación ARCA</strong><small>{empresa.empresa_nombre}</small></div>
          </div>
          <main className="arca-overlay-content">
            <ArcaFacturacion empresaId={empresa.empresa_id} />
          </main>
        </div>
      ) : null}
    </>
  );
}
