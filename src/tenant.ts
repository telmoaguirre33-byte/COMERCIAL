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
  empresa_nombre: string;
  razon_social: string | null;
  rol: RolEmpresaSigo;
};

const ACTIVE_COMPANY_KEY = "sigo.activeEmpresaId";

function normalizarEmpresa(empresa: Omit<EmpresaOperativa, "empresa_nombre">): EmpresaOperativa {
  return {
    ...empresa,
    empresa_nombre: empresa.nombre || empresa.razon_social || "Empresa",
  };
}

async function cargarEmpresasPorMembresia(): Promise<EmpresaOperativa[]> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("AUTH_REQUIRED");

  const { data, error } = await supabase
    .from("empresa_usuarios")
    .select("empresa_id, rol, empresas!inner(id, nombre, razon_social, activa)")
    .eq("user_id", user.id)
    .eq("activo", true)
    .eq("empresas.activa", true);

  if (error) throw error;

  return (data ?? []).flatMap((fila: any) => {
    const empresa = Array.isArray(fila.empresas) ? fila.empresas[0] : fila.empresas;
    if (!empresa?.id) return [];

    return [
      normalizarEmpresa({
        empresa_id: empresa.id,
        nombre: empresa.nombre ?? "Empresa",
        razon_social: empresa.razon_social ?? null,
        rol: fila.rol as RolEmpresaSigo,
      }),
    ];
  });
}

export async function cargarMisEmpresas(): Promise<EmpresaOperativa[]> {
  const { data, error } = await supabase.rpc("mis_empresas_sigo");

  if (!error) {
    return ((data ?? []) as Array<Omit<EmpresaOperativa, "empresa_nombre">>).map(normalizarEmpresa);
  }

  // Compatibilidad de despliegue: si la RPC todavía no fue aplicada en producción,
  // usamos las mismas tablas protegidas por RLS. No amplía permisos ni salta el tenant.
  console.warn("mis_empresas_sigo no disponible; usando fallback RLS", error);
  return cargarEmpresasPorMembresia();
}

export async function crearEmpresaSigo(nombre: string): Promise<string> {
  const limpio = nombre.trim();
  if (!limpio) throw new Error("EMPRESA_NOMBRE_REQUIRED");

  const { data, error } = await supabase.rpc("crear_empresa", {
    p_nombre: limpio,
    p_razon_social: null,
    p_cuit: null,
  });

  if (error) throw error;
  return data as string;
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
