import fs from 'node:fs';

const checks = [
  {
    file: 'src/SigoAuthGate.tsx',
    required: ['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'Crear cuenta y empresa', 'Ingresar a SIGO'],
    label: 'auth login/register/recovery',
  },
  {
    file: 'src/tenant.ts',
    required: ['mis_empresas_sigo', 'crear_empresa', 'TENANT_BACKEND_MIGRATION_PENDING', 'cargarEmpresasPorMembresia'],
    label: 'tenant loading and fallback',
  },
  {
    file: 'src/BarcodeScanner.tsx',
    required: ['getUserMedia', 'BarcodeDetector', 'onProduct', 'ScanSource = "manual" | "wedge" | "camera"'],
    label: 'manual/wedge/mobile-camera barcode scanner',
  },
  {
    file: 'src/barcode.ts',
    required: ['codigo_barras', 'codigo_interno'],
    label: 'barcode lookup by barcode/internal code',
  },
  {
    file: 'supabase/migrations/20260909191300_multiempresa_base.sql',
    required: ['create table if not exists public.empresas', 'create table if not exists public.empresa_usuarios', 'crear_empresa'],
    label: 'multiempresa base',
  },
  {
    file: 'supabase/migrations/20260910110800_mis_empresas_operativas.sql',
    required: ['mis_empresas_sigo', 'auth.uid()', 'eu.activo = true', 'e.activa = true'],
    label: 'active-company RPC',
  },
  {
    file: 'supabase/migrations/20260912004500_bootstrap_telmo_owner.sql',
    required: ['sigo_superadmins', 'empresa_usuarios', "'owner'", 'auth.users'],
    label: 'owner bootstrap',
  },
  {
    file: 'docs/SIGO_ACCESS_REPAIR.sql',
    required: ['SIGO_ACCESS_REPAIR_OK', 'mis_empresas_sigo', 'sigo_access_healthcheck'],
    label: 'one-shot production access repair',
  },
];

let failed = false;
for (const check of checks) {
  if (!fs.existsSync(check.file)) {
    console.error(`FAIL ${check.label}: missing ${check.file}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(check.file, 'utf8');
  const missing = check.required.filter((token) => !content.includes(token));
  if (missing.length) {
    console.error(`FAIL ${check.label}: missing ${missing.join(', ')}`);
    failed = true;
  } else {
    console.log(`PASS ${check.label}`);
  }
}

if (failed) process.exit(1);
console.log('SIGO_CRITICAL_FLOW_STATIC_CHECKS_OK');
