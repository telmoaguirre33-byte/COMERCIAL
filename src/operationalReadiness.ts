import { supabase } from "./supabase";

export type EmpresaReadinessRef = {
  empresa_id: string;
  nombre: string;
  activa: boolean;
};

type ImportRow = {
  import_key: string;
  empresa_id: string;
  source_rows: number | null;
  verified_rows: number | null;
};

export type OperationalReadinessResult = {
  ok: boolean;
  checkedAt: string;
  empresaId: string | null;
  empresaNombre: string;
  empresasSigoAdministracion: number;
  libreriaSource: number;
  libreriaVerified: number;
  computacionSource: number;
  computacionVerified: number;
  totalSource: number;
  totalVerified: number;
  empresasImportadas: number;
  catalogoProductos: number;
  costosActualesNull: number;
  issues: string[];
  evidence: string;
};

const MAIN_COMPANY = "sigo administración";
const LIBRERIA_PATTERN = "resguardo-stock-sigo-2026-09-09-libreria-%";
const COMPUTACION_PATTERN = "resguardo-stock-sigo-2026-09-09-sertec-%";

function sumar(rows: ImportRow[], key: "source_rows" | "verified_rows") {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function normalizarNombre(nombre: string) {
  return nombre.trim().toLocaleLowerCase("es-AR");
}

export async function validarReadinessSigoAdministracion(
  empresas: EmpresaReadinessRef[],
): Promise<OperationalReadinessResult> {
  const checkedAt = new Date().toISOString();
  const principales = empresas.filter(
    (empresa) => empresa.activa && normalizarNombre(empresa.nombre) === MAIN_COMPANY,
  );
  const empresa = principales.length === 1 ? principales[0] : null;
  const issues: string[] = [];

  if (principales.length !== 1 || !empresa) {
    issues.push(`Se esperaba una única empresa activa SIGO Administración y se encontraron ${principales.length}.`);
    return {
      ok: false,
      checkedAt,
      empresaId: null,
      empresaNombre: "SIGO Administración",
      empresasSigoAdministracion: principales.length,
      libreriaSource: 0,
      libreriaVerified: 0,
      computacionSource: 0,
      computacionVerified: 0,
      totalSource: 0,
      totalVerified: 0,
      empresasImportadas: 0,
      catalogoProductos: 0,
      costosActualesNull: 0,
      issues,
      evidence: `SIGO_LIVE_READINESS_REVIEW tenant_count=${principales.length} checked_at=${checkedAt}`,
    };
  }

  const [libreriaResp, computacionResp, productosResp, costosNullResp] = await Promise.all([
    supabase
      .from("sigo_importaciones_stock")
      .select("import_key,empresa_id,source_rows,verified_rows")
      .like("import_key", LIBRERIA_PATTERN),
    supabase
      .from("sigo_importaciones_stock")
      .select("import_key,empresa_id,source_rows,verified_rows")
      .like("import_key", COMPUTACION_PATTERN),
    supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.empresa_id),
    supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("empresa_id", empresa.empresa_id)
      .is("costo_actual", null),
  ]);

  for (const response of [libreriaResp, computacionResp, productosResp, costosNullResp]) {
    if (response.error) throw response.error;
  }

  const libreria = (libreriaResp.data ?? []) as ImportRow[];
  const computacion = (computacionResp.data ?? []) as ImportRow[];
  const importaciones = [...libreria, ...computacion];
  const libreriaSource = sumar(libreria, "source_rows");
  const libreriaVerified = sumar(libreria, "verified_rows");
  const computacionSource = sumar(computacion, "source_rows");
  const computacionVerified = sumar(computacion, "verified_rows");
  const totalSource = libreriaSource + computacionSource;
  const totalVerified = libreriaVerified + computacionVerified;
  const empresasImportadasSet = new Set(importaciones.map((row) => row.empresa_id));
  const empresasImportadas = empresasImportadasSet.size;
  const catalogoProductos = Number(productosResp.count ?? 0);
  const costosActualesNull = Number(costosNullResp.count ?? 0);

  if (libreriaSource !== 983 || libreriaVerified !== 983) {
    issues.push(`Librería no coincide con 983/983: ${libreriaSource}/${libreriaVerified}.`);
  }
  if (computacionSource !== 417 || computacionVerified !== 417) {
    issues.push(`Computación no coincide con 417/417: ${computacionSource}/${computacionVerified}.`);
  }
  if (totalSource !== 1400 || totalVerified !== 1400) {
    issues.push(`La carga total no coincide con 1400/1400: ${totalSource}/${totalVerified}.`);
  }
  if (empresasImportadas !== 1 || !empresasImportadasSet.has(empresa.empresa_id)) {
    issues.push("La carga inicial no pertenece exclusivamente a SIGO Administración.");
  }
  if (catalogoProductos < 1400) {
    issues.push(`El catálogo visible tiene ${catalogoProductos} productos; se esperaban al menos 1400.`);
  }
  if (costosActualesNull !== 0) {
    issues.push(`Hay ${costosActualesNull} productos con costo_actual NULL.`);
  }

  const ok = issues.length === 0;
  const evidence = [
    ok ? "SIGO_LIVE_READINESS_OK" : "SIGO_LIVE_READINESS_REVIEW",
    `tenant=SIGO Administración`,
    `empresa_id=${empresa.empresa_id}`,
    `libreria=${libreriaVerified}/${libreriaSource}`,
    `computacion=${computacionVerified}/${computacionSource}`,
    `total=${totalVerified}/${totalSource}`,
    `catalog=${catalogoProductos}`,
    `costo_actual_null=${costosActualesNull}`,
    `import_tenants=${empresasImportadas}`,
    `checked_at=${checkedAt}`,
  ].join(" ");

  return {
    ok,
    checkedAt,
    empresaId: empresa.empresa_id,
    empresaNombre: empresa.nombre,
    empresasSigoAdministracion: principales.length,
    libreriaSource,
    libreriaVerified,
    computacionSource,
    computacionVerified,
    totalSource,
    totalVerified,
    empresasImportadas,
    catalogoProductos,
    costosActualesNull,
    issues,
    evidence,
  };
}
