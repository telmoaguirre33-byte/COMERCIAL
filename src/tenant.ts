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
const ROLES_VALIDOS = new Set<RolEmpresaSigo>([
  "owner",
  "admin",
  "administrative",
  "seller",
  "warehouse",
  "client",
]);

function normalizarRol(valor: unknown): RolEmpresaSigo {
  if (typeof valor === "string" && ROLES_VALIDOS.has(valor as RolEmpresaSigo)) {
    return valor as RolEmpresaSigo;
  }
  // Fallar cerrado: un rol desconocido nunca debe transformarse implícitamente
  // en un perfil con permisos dentro de una empresa.
  throw new Error("TENANT_ROLE_INVALID");
}

function normalizarEmpresa(empresa: Omit<EmpresaOperativa, "empresa_nombre">): EmpresaOperativa {
  return {
    ...empresa,
    empresa_nombre: empresa.nombre || empresa.razon_social || "Empresa",
  };
}

function deduplicarEmpresas(empresas: EmpresaOperativa[]): EmpresaOperativa[] {
  const porId = new Map<string, EmpresaOperativa>();
  for (const empresa of empresas) {
    if (!empresa.empresa_id) continue;
    if (!porId.has(empresa.empresa_id)) porId.set(empresa.empresa_id, empresa);
  }
  return Array.from(porId.values());
}

function rpcNoDisponible(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const mensaje = (error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    (mensaje.includes("mis_empresas_sigo") && (mensaje.includes("not found") || mensaje.includes("does not exist")))
  );
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

  const normalizadas = (data ?? []).flatMap((fila: any) => {
    const empresa = Array.isArray(fila.empresas) ? fila.empresas[0] : fila.empresas;
    if (!empresa?.id) return [];

    return [
      normalizarEmpresa({
        empresa_id: empresa.id,
        nombre: empresa.nombre ?? "Empresa",
        razon_social: empresa.razon_social ?? null,
        rol: normalizarRol(fila.rol),
      }),
    ];
  });

  return deduplicarEmpresas(normalizadas);
}

export async function cargarMisEmpresas(): Promise<EmpresaOperativa[]> {
  const { data, error } = await supabase.rpc("mis_empresas_sigo");

  if (!error) {
    const normalizadas = ((data ?? []) as Array<Record<string, unknown>>).map((fila) =>
      normalizarEmpresa({
        empresa_id: String(fila.empresa_id ?? ""),
        nombre: String(fila.nombre ?? "Empresa"),
        razon_social: typeof fila.razon_social === "string" ? fila.razon_social : null,
        rol: normalizarRol(fila.rol),
      }),
    );
    return deduplicarEmpresas(normalizadas);
  }

  // Compatibilidad de despliegue solamente cuando la RPC realmente no existe.
  // Un error de permisos, autenticación o red debe fallar cerrado y hacerse visible;
  // no se enmascara usando otra ruta de acceso a datos.
  if (!rpcNoDisponible(error)) throw error;

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
