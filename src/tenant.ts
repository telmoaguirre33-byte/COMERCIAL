import { supabase } from "./supabase";

export type RolEmpresaSigo =
  | "owner"
  | "admin"
  | "administrative"
  | "seller"
  | "warehouse"
  | "client";

export type EmpresaOperativa = {
  empresa_id: string;
  nombre: string;
  razon_social: string | null;
  rol: RolEmpresaSigo;
};

const ACTIVE_COMPANY_KEY = "sigo.activeEmpresaId";

export async function cargarMisEmpresas(): Promise<EmpresaOperativa[]> {
  const { data, error } = await supabase.rpc("mis_empresas_sigo");

  if (error) {
    throw error;
  }

  return (data ?? []) as EmpresaOperativa[];
}

export function leerEmpresaActivaGuardada(): string | null {
  try {
    return window.localStorage.getItem(ACTIVE_COMPANY_KEY);
  } catch {
    return null;
  }
}

export function guardarEmpresaActiva(empresaId: string | null): void {
  try {
    if (empresaId) {
      window.localStorage.setItem(ACTIVE_COMPANY_KEY, empresaId);
    } else {
      window.localStorage.removeItem(ACTIVE_COMPANY_KEY);
    }
  } catch {
    // La app puede continuar sin persistencia local (modo privado/intranet restringida).
  }
}

export function resolverEmpresaActiva(
  empresas: EmpresaOperativa[],
  preferida?: string | null,
): EmpresaOperativa | null {
  if (empresas.length === 0) return null;

  const candidata = preferida ?? leerEmpresaActivaGuardada();
  const encontrada = candidata
    ? empresas.find((empresa) => empresa.empresa_id === candidata)
    : undefined;

  const activa = encontrada ?? empresas[0];
  guardarEmpresaActiva(activa.empresa_id);
  return activa;
}
