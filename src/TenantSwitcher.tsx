import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  cargarMisEmpresas,
  guardarEmpresaActiva,
  leerEmpresaActivaGuardada,
  resolverEmpresaActiva,
  type EmpresaOperativa,
} from "./tenant";
import { supabase } from "./supabase";

type TenantState = "loading" | "ready" | "empty" | "error";

type Props = {
  value?: string | null;
  onChange: (empresa: EmpresaOperativa | null) => void;
  onStateChange?: (state: TenantState) => void;
  disabled?: boolean;
};

export default function TenantSwitcher({ value, onChange, onStateChange, disabled = false }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaOperativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(false);
    onStateChange?.("loading");

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const currentUserId = authData.user?.id ?? null;
      if (!currentUserId) throw new Error("Sesión no disponible para cargar empresas.");

      const disponibles = await cargarMisEmpresas();
      if (requestRef.current !== requestId) return;

      setUserId(currentUserId);
      setEmpresas(disponibles);
      const preferida = value ?? leerEmpresaActivaGuardada(currentUserId);
      const activa = resolverEmpresaActiva(disponibles, preferida, currentUserId);
      onChange(activa);
      onStateChange?.(disponibles.length ? "ready" : "empty");
    } catch (e) {
      if (requestRef.current !== requestId) return;
      console.error(e);
      setEmpresas([]);
      setError(true);
      onChange(null);
      onStateChange?.("error");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [onChange, onStateChange, value]);

  useEffect(() => {
    void load();
    return () => {
      requestRef.current += 1;
    };
  }, [load]);

  useEffect(() => {
    const refrescarAlVolver = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", refrescarAlVolver);
    return () => document.removeEventListener("visibilitychange", refrescarAlVolver);
  }, [load]);

  const selected = useMemo(() => {
    if (value && empresas.some((empresa) => empresa.empresa_id === value)) return value;
    return empresas[0]?.empresa_id ?? "";
  }, [empresas, value]);

  function selectEmpresa(empresaId: string) {
    const empresa = empresas.find((item) => item.empresa_id === empresaId) ?? null;
    guardarEmpresaActiva(empresa?.empresa_id ?? null, userId);
    onChange(empresa);
  }

  async function cerrarSesion() {
    requestRef.current += 1;
    guardarEmpresaActiva(null, userId);
    await supabase.auth.signOut();
  }

  if (loading || error || empresas.length === 0) return null;

  return (
    <div style={shellStyle}>
      <label>
        <span style={eyebrowStyle}>Empresa activa</span>
        <select
          value={selected}
          disabled={disabled || empresas.length === 1}
          onChange={(event) => selectEmpresa(event.target.value)}
          aria-label="Seleccionar empresa activa"
          style={selectStyle}
        >
          {empresas.map((empresa) => (
            <option key={empresa.empresa_id} value={empresa.empresa_id}>
              {empresa.nombre || empresa.razon_social || "Empresa"}
            </option>
          ))}
        </select>
      </label>
      <div style={buttonRowStyle}>
        <button type="button" disabled={disabled} onClick={() => void load()} style={secondaryButtonStyle}>
          Actualizar
        </button>
        <button type="button" disabled={disabled} onClick={() => void cerrarSesion()} style={secondaryButtonStyle}>
          Salir
        </button>
      </div>
    </div>
  );
}

const shellStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 220,
  padding: "10px 12px",
  border: "1px solid rgba(15, 23, 42, .10)",
  borderRadius: 14,
  background: "rgba(255, 255, 255, .92)",
  boxShadow: "0 8px 24px rgba(15, 23, 42, .06)",
};

const eyebrowStyle: CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  opacity: 0.58,
};

const selectStyle: CSSProperties = {
  width: "100%",
  border: 0,
  outline: 0,
  padding: 0,
  font: "inherit",
  fontWeight: 700,
  background: "transparent",
  cursor: "pointer",
};

const secondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(15, 23, 42, .14)",
  borderRadius: 10,
  padding: "8px 10px",
  background: "transparent",
  fontWeight: 700,
  cursor: "pointer",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};
