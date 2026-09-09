export type SigoRole =
  | "superadmin"
  | "owner"
  | "admin"
  | "seller"
  | "warehouse"
  | "client";

export type SigoPermission =
  | "companies.manage"
  | "users.manage"
  | "products.read"
  | "products.write"
  | "stock.read"
  | "stock.write"
  | "sales.read"
  | "sales.write"
  | "purchases.read"
  | "purchases.write"
  | "clients.read"
  | "clients.write"
  | "suppliers.read"
  | "suppliers.write"
  | "reports.read"
  | "costs.read"
  | "margins.read"
  | "price_lists.read"
  | "arca.configure"
  | "invoices.issue"
  | "client_portal.read";

const rolePermissions: Record<SigoRole, ReadonlySet<SigoPermission>> = {
  superadmin: new Set<SigoPermission>([
    "companies.manage",
    "users.manage",
    "products.read",
    "products.write",
    "stock.read",
    "stock.write",
    "sales.read",
    "sales.write",
    "purchases.read",
    "purchases.write",
    "clients.read",
    "clients.write",
    "suppliers.read",
    "suppliers.write",
    "reports.read",
    "costs.read",
    "margins.read",
    "price_lists.read",
    "arca.configure",
    "invoices.issue",
    "client_portal.read",
  ]),
  owner: new Set<SigoPermission>([
    "users.manage",
    "products.read",
    "products.write",
    "stock.read",
    "stock.write",
    "sales.read",
    "sales.write",
    "purchases.read",
    "purchases.write",
    "clients.read",
    "clients.write",
    "suppliers.read",
    "suppliers.write",
    "reports.read",
    "costs.read",
    "margins.read",
    "price_lists.read",
    "arca.configure",
    "invoices.issue",
    "client_portal.read",
  ]),
  admin: new Set<SigoPermission>([
    "products.read",
    "products.write",
    "stock.read",
    "stock.write",
    "sales.read",
    "sales.write",
    "purchases.read",
    "purchases.write",
    "clients.read",
    "clients.write",
    "suppliers.read",
    "suppliers.write",
    "reports.read",
    "invoices.issue",
  ]),
  seller: new Set<SigoPermission>([
    "products.read",
    "stock.read",
    "sales.read",
    "sales.write",
    "clients.read",
    "invoices.issue",
  ]),
  warehouse: new Set<SigoPermission>([
    "products.read",
    "stock.read",
    "stock.write",
    "purchases.read",
    "purchases.write",
  ]),
  client: new Set<SigoPermission>([
    "client_portal.read",
  ]),
};

/**
 * Permisos base por rol. Los permisos extra deben venir de la membresia
 * empresa/usuario almacenada en backend y nunca reemplazan las RLS de Supabase.
 */
export function can(
  role: SigoRole,
  permission: SigoPermission,
  extraPermissions: readonly SigoPermission[] = []
): boolean {
  return (
    rolePermissions[role].has(permission) ||
    extraPermissions.includes(permission)
  );
}

export function canSeeSensitiveCommercialData(
  role: SigoRole,
  extraPermissions: readonly SigoPermission[] = []
): boolean {
  return (
    can(role, "costs.read", extraPermissions) ||
    can(role, "margins.read", extraPermissions) ||
    can(role, "price_lists.read", extraPermissions)
  );
}
