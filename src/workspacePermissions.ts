import type { RolEmpresaSigo } from "./tenant";

export type SigoWorkspace = "operacion" | "clientes" | "compras" | "informes";

const WORKSPACES_BY_ROLE: Record<RolEmpresaSigo, readonly SigoWorkspace[]> = {
  owner: ["operacion", "clientes", "compras", "informes"],
  admin: ["operacion", "clientes", "compras", "informes"],
  administrative: ["operacion", "clientes", "compras", "informes"],
  seller: ["operacion", "clientes"],
  warehouse: ["operacion", "compras"],
  client: ["clientes"],
};

export function workspacesPermitidos(rol: RolEmpresaSigo): readonly SigoWorkspace[] {
  return WORKSPACES_BY_ROLE[rol] ?? [];
}

export function workspacePermitido(rol: RolEmpresaSigo, workspace: SigoWorkspace): boolean {
  return workspacesPermitidos(rol).includes(workspace);
}

export function workspaceInicial(rol: RolEmpresaSigo): SigoWorkspace {
  return workspacesPermitidos(rol)[0] ?? "operacion";
}

export function etiquetaRol(rol: RolEmpresaSigo): string {
  const etiquetas: Record<RolEmpresaSigo, string> = {
    owner: "Propietario",
    admin: "Administrador",
    administrative: "Administrativo",
    seller: "Vendedor",
    warehouse: "Depósito",
    client: "Cliente",
  };
  return etiquetas[rol] ?? rol;
}
