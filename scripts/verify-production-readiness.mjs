import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowPath = path.join(root, ".github", "workflows", "supabase-production.yml");
const readinessPath = path.join(root, "supabase", "migrations", "20260913012500_operational_readiness_stock_cost_guard.sql");

for (const file of [workflowPath, readinessPath]) {
  if (!fs.existsSync(file)) throw new Error(`Missing production readiness file: ${path.relative(root, file)}`);
}

const workflow = fs.readFileSync(workflowPath, "utf8");
const readiness = fs.readFileSync(readinessPath, "utf8");

for (const required of [
  "SUPABASE_DB_PASSWORD",
  "SUPABASE_PROJECT_REF",
  "SIGO_DB_URL",
  "SIGO_DB_MODE=direct",
  "supabase migration list --db-url",
  "supabase db push --db-url",
  "supabase migration repair --db-url",
  "Database migrations can continue independently",
]) {
  if (!workflow.includes(required)) throw new Error(`Production database fallback safeguard missing: ${required}`);
}

// Un token de Management vencido no puede volver a bloquear migraciones de negocio.
if (/for key in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_PROJECT_REF/.test(workflow)) {
  throw new Error("SUPABASE_ACCESS_TOKEN must not be mandatory for production database migrations");
}

for (const required of [
  "v_main_tenant_count <> 1",
  "v_libreria_source <> 983",
  "v_computacion_source <> 417",
  "v_libreria_source + v_computacion_source <> 1400",
  "v_empresas_importadas <> 1",
  "v_productos_tenant < 1400",
  "p.empresa_id = v_empresa_id",
  "SIGO_READINESS_NULL_CURRENT_COST_TENANT",
  "SIGO_READINESS_NULL_CURRENT_COST_GLOBAL",
  "SIGO_READINESS_STOCK_COST_OK",
  "alter column costo_actual set default 0",
  "alter column costo_actual set not null",
]) {
  if (!readiness.includes(required)) throw new Error(`Operational readiness certification safeguard missing: ${required}`);
}

for (const destructive of [
  /delete\s+from\s+public\.productos/i,
  /truncate\s+(table\s+)?public\.productos/i,
  /update\s+public\.productos\s+set\s+(stock_actual|costo_actual|precio_venta)/i,
]) {
  if (destructive.test(readiness)) throw new Error(`Destructive readiness migration pattern detected: ${destructive}`);
}

console.log("Production readiness verified: 1400-row single-tenant certification, real catalog floor, null-cost guard and direct DB deployment fallback are protected by CI.");
