import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import {
  cargarMisEmpresas,
  crearEmpresaSigo,
  guardarEmpresaActiva,
  leerEmpresaActivaGuardada,
  resolverEmpresaActiva,
  type EmpresaOperativa,
} from "./tenant";
import { supabase } from "./supabase";

type Props = {
  value?: string | null;
  onChange: (empresa: EmpresaOperativa | null) => void;
  disabled?: boolean;
};

function mensajeError(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "No se pudieron cargar tus empresas.";
}

export default function TenantSwitcher({ value, onChange, disabled = false }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaOperativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detalleError, setDetalleError] = useState("");
  const [nombreNuevaEmpresa, setNombreNuevaEmpresa] = useState("");
  const [creando, setCreando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setDetalleError("");

    try {
      const disponibles = await cargarMisEmpresas();
      setEmpresas(disponibles);
      const preferida = value ?? leerEmpresaActivaGuardada();
      const activa = resolverEmpresaActiva(disponibles, preferida);
      onChange(activa);
    } catch (e) {
      console.error(e);
      setEmpresas([]);
      setError("No se pudieron cargar tus empresas.");
      setDetalleError(mensajeError(e));
      onChange(null);
    } finally {
      setLoading(false);
    }
  }, [onChange, value]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(() => {
    if (value && empresas.some((empresa) => empresa.empresa_id === value)) return value;
    return empresas[0]?.empresa_id ?? "";
  }, [empresas, value]);

  function selectEmpresa(empresaId: string) {
    const empresa = empresas.find((item) => item.empresa_id === empresaId) ?? null;
    guardarEmpresaActiva(empresa?.empresa_id ?? null);
    onChange(empresa);
  }

  async function cerrarSesion() {
    guardarEmpresaActiva(null);
    await supabase.auth.signOut();
  }

  async function crearEmpresa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nombre = nombreNuevaEmpresa.trim();
    if (!nombre || creando) return;

    setCreando(true);
    setError("");
    setDetalleError("");

    try {
      const empresaId = await crearEmpresaSigo(nombre);
      guardarEmpresaActiva(empresaId);
      setNombreNuevaEmpresa("");
      await load();
    } catch (e) {
      console.error(e);
      setError("No se pudo crear la empresa.");
      setDetalleError(mensajeError(e));
    } finally {
      setCreando(false);
    }
  }

  if (loading) {
    return (
      <div aria-live="polite" style={shellStyle}>
        <span style={eyebrowStyle}>Empresa activa</span>
        <strong>Cargando…</strong>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{ ...shellStyle, borderColor: "rgba(185, 28, 28, .25)" }}>
        <span style={eyebrowStyle}>Empresa activa</span>
        <strong>{error}</strong>
        {detalleError ? <small style={{ opacity: 0.72 }}>{detalleError}</small> : null}
        <div style={buttonRowStyle}>
          <button type="button" onClick={() => void load()} style={secondaryButtonStyle}>
            Reintentar
          </button>
          <button type="button" onClick={() => void cerrarSesion()} style={secondaryButtonStyle}>
            Cambiar usuario
          </button>
        </div>
      </div>
    );
  }

  if (empresas.length === 0) {
    return (
      <div role="status" style={shellStyle}>
        <span style={eyebrowStyle}>Empresa activa</span>
        <strong>Creá tu primera empresa para entrar a SIGO</strong>
        <small style={{ opacity: 0.72 }}>
          La empresa queda asociada a tu usuario como propietario y mantiene separados los datos de cada organización.
        </small>
        <form onSubmit={crearEmpresa} style={createFormStyle}>
          <input
            value={nombreNuevaEmpresa}
            onChange={(event) => setNombreNuevaEmpresa(event.target.value)}
            placeholder="Nombre de la empresa"
            aria-label="Nombre de la nueva empresa"
            disabled={creando}
            required
            style={inputStyle}
          />
          <button type="submit" disabled={creando || !nombreNuevaEmpresa.trim()} style={primaryButtonStyle}>
            {creando ? "Creando…" : "Crear y entrar"}
          </button>
        </form>
        <button type="button" onClick={() => void cerrarSesion()} style={secondaryButtonStyle}>
          Ingresar con otro usuario
        </button>
      </div>
    );
  }

  return (
    <label style={shellStyle}>
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
      <small style={{ opacity: 0.72 }}>
        {empresas.length === 1
          ? "Tu operación está limitada a esta empresa."
          : "Los datos y permisos cambian con la empresa seleccionada."}
      </small>
    </label>
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

const createFormStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 4,
};

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid rgba(15, 23, 42, .16)",
  borderRadius: 10,
  padding: "9px 10px",
  font: "inherit",
};

const primaryButtonStyle: CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "9px 12px",
  fontWeight: 800,
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
