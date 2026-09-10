import { useEffect, useMemo, useState } from "react";
import {
  cargarMisEmpresas,
  guardarEmpresaActiva,
  leerEmpresaActivaGuardada,
  resolverEmpresaActiva,
  type EmpresaOperativa,
} from "./tenant";

type Props = {
  value?: string | null;
  onChange: (empresa: EmpresaOperativa | null) => void;
  disabled?: boolean;
};

export default function TenantSwitcher({ value, onChange, disabled = false }: Props) {
  const [empresas, setEmpresas] = useState<EmpresaOperativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const disponibles = await cargarMisEmpresas();
        if (cancelled) return;

        setEmpresas(disponibles);
        const preferida = value ?? leerEmpresaActivaGuardada();
        const activa = resolverEmpresaActiva(disponibles, preferida);
        onChange(activa);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setEmpresas([]);
          setError("No se pudieron cargar tus empresas.");
          onChange(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // onChange debe ser estable en el contenedor para evitar recargas innecesarias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => {
    if (value && empresas.some((empresa) => empresa.empresa_id === value)) return value;
    return empresas[0]?.empresa_id ?? "";
  }, [empresas, value]);

  function selectEmpresa(empresaId: string) {
    const empresa = empresas.find((item) => item.empresa_id === empresaId) ?? null;
    guardarEmpresaActiva(empresa?.empresa_id ?? null);
    onChange(empresa);
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
      </div>
    );
  }

  if (empresas.length === 0) {
    return (
      <div role="status" style={shellStyle}>
        <span style={eyebrowStyle}>Empresa activa</span>
        <strong>Sin empresa operativa asignada</strong>
        <small style={{ opacity: 0.72 }}>
          Un propietario o superadmin debe asignarte una membresía activa.
        </small>
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

const shellStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 220,
  padding: "10px 12px",
  border: "1px solid rgba(15, 23, 42, .10)",
  borderRadius: 14,
  background: "rgba(255, 255, 255, .92)",
  boxShadow: "0 8px 24px rgba(15, 23, 42, .06)",
};

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  opacity: 0.58,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  border: 0,
  outline: 0,
  padding: 0,
  font: "inherit",
  fontWeight: 700,
  background: "transparent",
  cursor: "pointer",
};
