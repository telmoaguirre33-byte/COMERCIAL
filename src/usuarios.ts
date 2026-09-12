import { supabase } from "./supabase";
import type { SigoRole } from "./permissions";

export type UsuarioEmpresaSigo = {
  membresia_id: string;
  user_id: string;
  email: string;
  rol: SigoRole;
  activo: boolean;
  permisos_extra: string[];
  permisos_denegados: string[];
  created_at: string;
};

const rolesGestionables: SigoRole[] = ["admin", "seller", "warehouse", "client"];

function mensajeUsuarios(errorMessage: string): string {
  const normalized = errorMessage.toUpperCase();
  if (normalized.includes("USER_NOT_REGISTERED")) return "Ese email todavía no tiene una cuenta SIGO. Pedile que cree una cuenta de usuario y volvé a agregarlo.";
  if (normalized.includes("USER_EMAIL_REQUIRED")) return "Ingresá el email del usuario.";
  if (normalized.includes("ROLE_NOT_ALLOWED")) return "Tu perfil no puede asignar ese rol.";
  if (normalized.includes("OWNER_MEMBERSHIP_IMMUTABLE")) return "El propietario principal no puede modificarse desde esta pantalla.";
  if (normalized.includes("SELF_DEACTIVATION_FORBIDDEN")) return "No podés desactivar tu propio acceso.";
  if (normalized.includes("USERS_MANAGE_FORBIDDEN") || normalized.includes("PERMISSION")) return "No tenés permiso para administrar usuarios de esta empresa.";
  if (normalized.includes("MEMBERSHIP_NOT_FOUND")) return "La membresía ya no existe o pertenece a otra empresa.";
  return "No pudimos completar la administración de usuarios. Actualizá e intentá nuevamente.";
}

export function rolUsuarioValido(rol: string): rol is SigoRole {
  return ["owner", ...rolesGestionables].includes(rol as SigoRole);
}

export async function listarUsuariosEmpresaSigo(empresaId: string): Promise<UsuarioEmpresaSigo[]> {
  const { data, error } = await supabase.rpc("listar_usuarios_empresa_sigo", { p_empresa_id: empresaId });
  if (error) throw new Error(mensajeUsuarios(error.message));
  return ((data ?? []) as unknown[])
    .map((row) => row as Record<string, unknown>)
    .filter((row) => typeof row.membresia_id === "string" && typeof row.user_id === "string" && rolUsuarioValido(String(row.rol ?? "")))
    .map((row) => ({
      membresia_id: String(row.membresia_id),
      user_id: String(row.user_id),
      email: String(row.email ?? ""),
      rol: String(row.rol) as SigoRole,
      activo: Boolean(row.activo),
      permisos_extra: Array.isArray(row.permisos_extra) ? row.permisos_extra.map(String) : [],
      permisos_denegados: Array.isArray(row.permisos_denegados) ? row.permisos_denegados.map(String) : [],
      created_at: String(row.created_at ?? ""),
    }));
}

export async function agregarUsuarioEmpresaSigo(empresaId: string, email: string, rol: SigoRole): Promise<string> {
  if (!rolesGestionables.includes(rol)) throw new Error("Rol de usuario inválido.");
  const { data, error } = await supabase.rpc("agregar_usuario_empresa_sigo", {
    p_empresa_id: empresaId,
    p_email: email.trim().toLowerCase(),
    p_rol: rol,
  });
  if (error) throw new Error(mensajeUsuarios(error.message));
  return String(data);
}

export async function actualizarUsuarioEmpresaSigo(
  empresaId: string,
  membresiaId: string,
  rol: SigoRole,
  activo: boolean,
): Promise<string> {
  if (!rolesGestionables.includes(rol)) throw new Error("Rol de usuario inválido.");
  const { data, error } = await supabase.rpc("actualizar_usuario_empresa_sigo", {
    p_empresa_id: empresaId,
    p_membresia_id: membresiaId,
    p_rol: rol,
    p_activo: activo,
  });
  if (error) throw new Error(mensajeUsuarios(error.message));
  return String(data);
}
