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
  inserted_rows: number | null;
  skipped_existing: number | null;
  verified_rows: number | null;
};

type CatalogRow = {
  id: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
  activo: boolean | null;
  precio_venta: number | null;
  stock_actual: number | null;
};

export type OperationalReadinessResult = {
  ok: boolean;
  checkedAt: string;
  empresaId: string | null;
  empresaNombre: string;
  empresasSigoAdministracion: number;
  libreriaSource: number;
  libreriaVerified: number;
  libreriaLotes: number;
  computacionSource: number;
  computacionVerified: number;
  computacionLotes: number;
  totalSource: number;
  totalVerified: number;
  lotesInconsistentes: number;
  empresasImportadas: number;
  catalogoProductos: number;
  catalogoLeido: number;
  costosActualesNull: number;
  identidadesDuplicadas: number;
  productosSinCodigo: number;
  stockNegativo: number;
  vendiblesConStock: number;
  issues: string[];
  evidence: string;
};

const MAIN_COMPANY = "sigo administración";
const LIBRERIA_PATTERN = "resguardo-stock-sigo-2026-09-09-libreria-%";
const COMPUTACION_PATTERN = "resguardo-stock-sigo-2026-09-09-sertec-%";
const LIBRERIA_LOTES_ESPERADOS = 10;
const COMPUTACION_LOTES_ESPERADOS = 5;
const PAGE_SIZE = 1000;

function sumar(rows: ImportRow[], key: "source_rows" | "verified_rows") {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function normalizarNombre(nombre: string) {
  return nombre.trim().toLocaleLowerCase("es-AR");
}

function normalizarCodigo(valor: string | null) {
  return (valor ?? "").trim().toUpperCase();
}

async function leerCatalogoCompleto(empresaId: string): Promise<CatalogRow[]> {
  const rows: CatalogRow[] = [];
  for (let desde = 0; ; desde += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("productos")
      .select("id,codigo_interno,codigo_barras,activo,precio_venta,stock_actual")
      .eq("empresa_id", empresaId)
      .order("id", { ascending: true })
      .range(desde, desde + PAGE_SIZE - 1);
    if (error) throw error;
    const pagina = (data ?? []) as CatalogRow[];
    rows.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  return rows;
}

function contarIdentidadesDuplicadas(rows: CatalogRow[]) {
  const porCodigo = new Map<string, Set<string>>();
  for (const row of rows) {
    const codigos = new Set([
      normalizarCodigo(row.codigo_barras),
      normalizarCodigo(row.codigo_interno),
    ].filter(Boolean));
    for (const codigo of codigos) {
      const ids = porCodigo.get(codigo) ?? new Set<string>();
      ids.add(row.id);
      porCodigo.set(codigo, ids);
    }
  }
  return [...porCodigo.values()].filter((ids) => ids.size > 1).length;
}

function resultadoVacio(
  checkedAt: string,
  empresasSigoAdministracion: number,
  issues: string[],
): OperationalReadinessResult {
  return {
    ok: false,
    checkedAt,
    empresaId: null,
    empresaNombre: "SIGO Administración",
    empresasSigoAdministracion,
    libreriaSource: 0,
    libreriaVerified: 0,
    libreriaLotes: 0,
    computacionSource: 0,
    computacionVerified: 0,
    computacionLotes: 0,
    totalSource: 0,
    totalVerified: 0,
    lotesInconsistentes: 0,
    empresasImportadas: 0,
    catalogoProductos: 0,
    catalogoLeido: 0,
    costosActualesNull: 0,
    identidadesDuplicadas: 0,
    productosSinCodigo: 0,
    stockNegativo: 0,
    vendiblesConStock: 0,
    issues,
    evidence: `SIGO_LIVE_READINESS_REVIEW tenant_count=${empresasSigoAdministracion} checked_at=${checkedAt}`,
  };
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
    return resultadoVacio(checkedAt, principales.length, issues);
  }

  const [libreriaResp, computacionResp, productosResp, costosNullResp, catalogo] = await Promise.all([
    supabase
      .from("sigo_importaciones_stock")
      .select("import_key,empresa_id,source_rows,inserted_rows,skipped_existing,verified_rows")
      .like("import_key", LIBRERIA_PATTERN),
    supabase
      .from("sigo_importaciones_stock")
      .select("import_key,empresa_id,source_rows,inserted_rows,skipped_existing,verified_rows")
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
    leerCatalogoCompleto(empresa.empresa_id),
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
  const catalogoLeido = catalogo.length;
  const costosActualesNull = Number(costosNullResp.count ?? 0);
  const lotesInconsistentes = importaciones.filter((row) => {
    const source = Number(row.source_rows ?? 0);
    const inserted = Number(row.inserted_rows ?? 0);
    const skipped = Number(row.skipped_existing ?? 0);
    const verified = Number(row.verified_rows ?? 0);
    return inserted + skipped !== source || verified !== source;
  }).length;
  const identidadesDuplicadas = contarIdentidadesDuplicadas(catalogo);
  const productosSinCodigo = catalogo.filter(
    (row) => !normalizarCodigo(row.codigo_barras) && !normalizarCodigo(row.codigo_interno),
  ).length;
  const stockNegativo = catalogo.filter((row) => Number(row.stock_actual ?? 0) < 0).length;
  const vendiblesConStock = catalogo.filter((row) =>
    row.activo !== false
    && Number(row.precio_venta ?? 0) > 0
    && Number(row.stock_actual ?? 0) > 0
    && Boolean(normalizarCodigo(row.codigo_barras) || normalizarCodigo(row.codigo_interno)),
  ).length;

  if (libreria.length !== LIBRERIA_LOTES_ESPERADOS) {
    issues.push(`Librería tiene ${libreria.length} lotes; se esperaban ${LIBRERIA_LOTES_ESPERADOS}.`);
  }
  if (computacion.length !== COMPUTACION_LOTES_ESPERADOS) {
    issues.push(`Computación tiene ${computacion.length} lotes; se esperaban ${COMPUTACION_LOTES_ESPERADOS}.`);
  }
  if (lotesInconsistentes !== 0) {
    issues.push(`Hay ${lotesInconsistentes} lotes con inserted + skipped o verified distintos del origen.`);
  }
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
  if (catalogoLeido !== catalogoProductos) {
    issues.push(`La lectura completa obtuvo ${catalogoLeido} productos pero el conteo reporta ${catalogoProductos}.`);
  }
  if (costosActualesNull !== 0) {
    issues.push(`Hay ${costosActualesNull} productos con costo_actual NULL.`);
  }
  if (identidadesDuplicadas !== 0) {
    issues.push(`Hay ${identidadesDuplicadas} códigos repetidos entre productos; el scanner sería ambiguo.`);
  }
  if (productosSinCodigo !== 0) {
    issues.push(`Hay ${productosSinCodigo} productos sin código interno ni código de barras.`);
  }
  if (stockNegativo !== 0) {
    issues.push(`Hay ${stockNegativo} productos con stock negativo.`);
  }
  if (vendiblesConStock === 0) {
    issues.push("No hay productos activos con código, precio mayor a cero y stock positivo para una venta de prueba.");
  }

  const ok = issues.length === 0;
  const evidence = [
    ok ? "SIGO_LIVE_READINESS_OK" : "SIGO_LIVE_READINESS_REVIEW",
    `tenant=SIGO Administración`,
    `empresa_id=${empresa.empresa_id}`,
    `libreria=${libreriaVerified}/${libreriaSource}`,
    `libreria_lotes=${libreria.length}/${LIBRERIA_LOTES_ESPERADOS}`,
    `computacion=${computacionVerified}/${computacionSource}`,
    `computacion_lotes=${computacion.length}/${COMPUTACION_LOTES_ESPERADOS}`,
    `total=${totalVerified}/${totalSource}`,
    `lotes_inconsistentes=${lotesInconsistentes}`,
    `catalog=${catalogoProductos}`,
    `catalog_loaded=${catalogoLeido}`,
    `costo_actual_null=${costosActualesNull}`,
    `duplicate_codes=${identidadesDuplicadas}`,
    `products_without_code=${productosSinCodigo}`,
    `negative_stock=${stockNegativo}`,
    `sellable_with_stock=${vendiblesConStock}`,
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
    libreriaLotes: libreria.length,
    computacionSource,
    computacionVerified,
    computacionLotes: computacion.length,
    totalSource,
    totalVerified,
    lotesInconsistentes,
    empresasImportadas,
    catalogoProductos,
    catalogoLeido,
    costosActualesNull,
    identidadesDuplicadas,
    productosSinCodigo,
    stockNegativo,
    vendiblesConStock,
    issues,
    evidence,
  };
}
