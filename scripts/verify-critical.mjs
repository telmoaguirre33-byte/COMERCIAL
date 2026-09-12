import fs from 'node:fs';

const checks = [
  {
    file: 'src/SigoAuthGate.tsx',
    required: ['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'Crear cuenta y empresa', 'Ingresar a SIGO'],
    label: 'auth login/register/recovery',
  },
  {
    file: 'src/tenant.ts',
    required: ['mis_empresas_sigo', 'crear_empresa', 'TENANT_BACKEND_MIGRATION_PENDING', 'cargarEmpresasPorMembresia', '"owner"', '"admin"', '"seller"', '"warehouse"', '"client"'],
    forbidden: ['"administrative"'],
    label: 'tenant loading and backend-compatible roles',
  },
  {
    file: 'src/workspacePermissions.ts',
    required: ['owner:', 'admin:', 'seller:', 'warehouse:', 'client:'],
    forbidden: ['administrative:'],
    label: 'workspace/backend role contract',
  },
  {
    file: 'src/permissions.ts',
    required: ['"superadmin"', '"owner"', '"admin"', '"seller"', '"warehouse"', '"client"', 'costs.read', 'margins.read', 'price_lists.read'],
    forbidden: ['"administrative"'],
    label: 'permission/backend role contract',
  },
  {
    file: 'src/TenantSwitcher.tsx',
    required: ['requestRef', 'supabase.auth.getUser', 'cargarMisEmpresas'],
    label: 'tenant switcher ignores stale refreshes',
  },
  {
    file: 'src/BarcodeScanner.tsx',
    required: ['getUserMedia', 'BarcodeDetector', 'onProduct', 'ScanSource = "manual" | "wedge" | "camera"', 'empresaActivaRef'],
    label: 'manual/wedge/mobile-camera barcode scanner with tenant isolation',
  },
  {
    file: 'src/barcode.ts',
    required: ['codigo_barras', 'codigo_interno'],
    label: 'barcode lookup by barcode/internal code',
  },
  {
    file: 'src/productos.ts',
    required: ['validarNumeroNoNegativo', 'STOCK_RANGE_INVALID', 'STOCK_ABOVE_MAXIMUM', 'guardar_producto_sigo'],
    label: 'product numeric and stock-range validation',
  },
  {
    file: 'src/clientes.ts',
    required: ['validarEmail', 'validarLimiteCredito', 'mediosValidos', 'registrar_cobro_cliente_sigo_v2'],
    label: 'customer credit/payment validation',
  },
  {
    file: 'src/ventas.ts',
    required: ['confirmar_venta_sigo_v2', 'consolidarItemsVenta', 'MEDIOS_PAGO_VALIDOS', 'idempotencyKey', 'INSUFFICIENT_STOCK', 'normalizarIdentificador', 'Number.isFinite(total)', 'p_empresa_id: empresaId', 'p_cliente_id: clienteId'],
    label: 'transactional sale, normalized tenant/client identity and safe totals',
  },
  {
    file: 'src/compras.ts',
    required: ['consolidarItemsCompra', 'Number.isFinite', 'validarEmailOpcional', 'validarCuitOpcional', 'idempotencyKey', 'confirmar_compra_sigo'],
    label: 'purchase/supplier validation and duplicate-item consolidation',
  },
  {
    file: 'src/InformesOperativos.tsx',
    required: ['empresaActivaRef', 'cargaRef'],
    label: 'reports tenant isolation',
  },
  {
    file: 'supabase/migrations/20260909191300_multiempresa_base.sql',
    required: ['create table if not exists public.empresas', 'create table if not exists public.empresa_usuarios', 'crear_empresa'],
    label: 'multiempresa base',
  },
  {
    file: 'supabase/migrations/20260910031300_permisos_denegados_granulares.sql',
    required: ['DENY gana siempre', 'costs.read', 'margins.read', 'price_lists.read', "when 'seller'"],
    label: 'granular tenant permissions',
  },
  {
    file: 'supabase/migrations/20260912032000_precio_venta_para_operacion.sql',
    required: ["'sales.read'", "'sales.write'", "'price_lists.read'", 'p.precio_venta', 'p.costo_actual', 'p.margen_ganancia'],
    label: 'operational sale price without sensitive commercial data',
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
  const forbidden = (check.forbidden ?? []).filter((token) => content.includes(token));
  if (missing.length || forbidden.length) {
    if (missing.length) console.error(`FAIL ${check.label}: missing ${missing.join(', ')}`);
    if (forbidden.length) console.error(`FAIL ${check.label}: forbidden ${forbidden.join(', ')}`);
    failed = true;
  } else {
    console.log(`PASS ${check.label}`);
  }
}

if (failed) process.exit(1);
console.log('SIGO_CRITICAL_FLOW_STATIC_CHECKS_OK');