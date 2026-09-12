import fs from 'node:fs';
import path from 'node:path';

const checks = [
  {
    file: 'src/SigoAuthGate.tsx',
    required: ['signInWithPassword', 'signUp', 'resetPasswordForEmail', 'Crear cuenta y empresa', 'Ingresar a SIGO', 'PENDING_EMPRESA_METADATA_KEY', 'sigo_empresa_nombre', 'Email o contraseña incorrectos.'],
    label: 'auth login/register/recovery with activation-safe company onboarding',
  },
  {
    file: 'src/SigoRoot.tsx',
    required: ['autoProvisionAttemptedRef', 'sigo_empresa_nombre', 'crearEmpresaSigo(nombrePendiente)', 'cargarMisEmpresas()', 'no vuelvas a crearla', 'setTenantRetryKey'],
    label: 'post-activation company provisioning without duplicate manual creation',
  },
  {
    file: 'src/tenant.ts',
    required: ['mis_empresas_sigo', 'crear_empresa', 'TENANT_BACKEND_MIGRATION_PENDING', 'cargarEmpresasPorMembresia', '"owner"', '"admin"', '"seller"', '"warehouse"', '"client"'],
    forbidden: ['"administrative"'],
    label: 'tenant loading and backend-compatible roles',
  },
  {
    file: 'src/workspacePermissions.ts',
    required: ['owner:', 'admin:', 'seller:', 'warehouse:', 'client:', 'seller: ["operacion"]', 'warehouse: ["operacion"]', 'client: []'],
    forbidden: ['administrative:'],
    label: 'workspace/backend role contract',
  },
  {
    file: 'src/permissions.ts',
    required: ['"superadmin"', '"owner"', '"admin"', '"seller"', '"warehouse"', '"client"', 'costs.read', 'margins.read', 'price_lists.read', '"users.manage"'],
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
    required: ['getUserMedia', 'BarcodeDetector', 'onProduct', 'ScanSource = "manual" | "wedge" | "camera"', 'empresaActivaRef', 'onActionChange && (', '📷 Escanear con cámara', 'Pistola USB/Bluetooth', 'detector = new detectorCtor()', 'lector de cámara de este navegador no pudo inicializarse'],
    label: 'manual/wedge/mobile-camera barcode scanner with tenant isolation and resilient camera startup',
  },
  {
    file: 'src/barcode.ts',
    required: ['codigo_barras', 'codigo_interno', 'normalizarEmpresaId', 'TENANT_PRODUCT_MISMATCH', 'fueraDeTenant', 'replace(/[\\u0000-\\u001F\\u007F]/g'],
    label: 'barcode lookup normalization and tenant-response isolation',
  },
  {
    file: 'src/productos.ts',
    required: ['validarNumeroNoNegativo', 'STOCK_RANGE_INVALID', 'STOCK_ABOVE_MAXIMUM', 'guardar_producto_sigo', 'PRODUCT_HAS_STOCK', 'BARCODE_DUPLICATE_IN_COMPANY', 'No se pudo dar de baja el producto.'],
    label: 'product validation and user-safe lifecycle errors',
  },
  {
    file: 'src/SigoApp.tsx',
    required: ['puedeEditarProductos', 'can(empresa.rol, "products.write")', 'Precio de venta', 'stockActual: null', 'Modo solo lectura', 'El stock actual no se edita acá', 'required={!editing}', 'Dar de baja', 'No se borrarán ventas, compras ni históricos'],
    label: 'sellable product setup, safe deactivation UX, read-only warehouse UX and no direct live-stock overwrite',
  },
  {
    file: 'src/clientes.ts',
    required: ['validarEmail', 'validarLimiteCredito', 'mediosValidos', 'registrar_cobro_cliente_sigo_v2'],
    label: 'customer credit/payment validation',
  },
  {
    file: 'src/ventas.ts',
    required: ['confirmar_venta_sigo_v2', 'consolidarItemsVenta', 'MEDIOS_PAGO_VALIDOS', '"mercado_pago"', 'idempotencyKey', 'INSUFFICIENT_STOCK', 'normalizarIdentificador', 'Number.isFinite(total)', 'p_empresa_id: empresaId', 'p_cliente_id: clienteId'],
    label: 'transactional sale, normalized tenant/client identity, Mercado Pago and safe totals',
  },
  {
    file: 'src/VentaRapidaOperativa.tsx',
    required: ['value="mercado_pago"', 'Mercado Pago', 'BarcodeScanner', 'Confirmar venta'],
    label: 'quick sale exposes scanner and Mercado Pago checkout',
  },
  {
    file: 'src/compras.ts',
    required: ['consolidarItemsCompra', 'Number.isFinite', 'validarEmailOpcional', 'validarCuitOpcional', 'idempotencyKey', 'confirmar_compra_sigo'],
    label: 'purchase/supplier validation and duplicate-item consolidation',
  },
  {
    file: 'src/informes.ts',
    required: ['listarComprasSigoCompletas', '.eq("estado", "confirmada")', 'saldosPositivos', 'numeroSeguro', 'cajaHoyPorMedio'],
    label: 'complete confirmed-only management totals and debtor-only receivables',
  },
  {
    file: 'src/InformesOperativos.tsx',
    required: ['empresaActivaRef', 'cargaRef', 'mercado_pago: "Mercado Pago"', 'Ventas confirmadas', 'Compras confirmadas', 'Sólo saldos deudores'],
    label: 'tenant-isolated reports with explicit confirmed totals and payment labels',
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
    file: 'supabase/migrations/20260912142200_productos_precio_operativo_seguro.sql',
    required: ["'products.write'", "'sales.write'", "'price_lists.read'", 'v_puede_precio', 'PRECIO_VENTA_INVALID', 'STOCK_RANGE_INVALID'],
    forbidden: ['delete from public.productos', 'truncate'],
    label: 'admin product sale-price write without granting sensitive list access',
  },
  {
    file: 'supabase/migrations/20260912142500_productos_edicion_no_pisa_stock_costo.sql',
    required: ['p_stock_actual is not null', 'else p.stock_actual', 'p_costo_actual is not null', 'else p.costo_actual', 'v_puede_precio', 'p.empresa_id = p_empresa_id'],
    forbidden: ['delete from public.productos', 'truncate'],
    label: 'product master edits preserve concurrent stock and purchase costs',
  },
  {
    file: 'supabase/migrations/20260912151800_productos_baja_logica_segura.sql',
    required: ['add column if not exists activo boolean', 'PRODUCT_HAS_STOCK', 'PRODUCT_INACTIVE', 'proteger_producto_inactivo_sigo', 'set activo = false', 'reactivar_producto_sigo', 'and p.activo = true'],
    forbidden: ['delete from public.productos', 'truncate'],
    label: 'product deactivation preserves history, requires zero stock and blocks inactive stock mutation',
  },
  {
    file: 'supabase/migrations/20260912111800_evitar_codigos_duplicados_por_empresa.sql',
    required: ['validar_codigo_producto_unico_sigo', 'BARCODE_DUPLICATE_IN_COMPANY', 'INTERNAL_CODE_DUPLICATE_IN_COMPANY', 'before insert or update', 'p.empresa_id = new.empresa_id'],
    label: 'new product-code collisions blocked per tenant without destructive cleanup',
  },
  {
    file: 'supabase/migrations/20260912122500_ventas_idempotencia_cliente_segura.sql',
    required: ['IDEMPOTENCY_CONFLICT', 'CLIENTS_READ_FORBIDDEN', 'SALE_ITEM_INVALID', 'SALE_TOO_MANY_ITEMS', 'v_existente_cliente is distinct from p_cliente_id', 'p_empresa_id'],
    forbidden: ['delete from public.ventas_sigo', 'truncate'],
    label: 'sale retry/client authorization hardening without destructive history changes',
  },
  {
    file: 'supabase/migrations/20260912123000_compras_idempotencia_stock_segura.sql',
    required: ['IDEMPOTENCY_KEY_REQUIRED', 'IDEMPOTENCY_CONFLICT', 'DUPLICATE_PRODUCT_ITEM', 'STOCK_WRITE_REQUIRED', 'v_producto_id = any(v_seen)', 'p_empresa_id'],
    forbidden: ['delete from public.compras_sigo', 'truncate'],
    label: 'purchase retry/stock hardening without destructive history changes',
  },
  {
    file: 'supabase/migrations/20260912131700_mercado_pago_ventas.sql',
    required: ['ventas_sigo_medio_pago_check', "'mercado_pago'", 'confirmar_venta_sigo_v2', 'caja_movimientos_sigo'],
    forbidden: ['delete from public.ventas_sigo', 'truncate'],
    label: 'Mercado Pago enabled in sales without destructive history changes',
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

const projectRoots = ['src', 'supabase', 'docs'];
const textExtensions = new Set(['.ts', '.tsx', '.css', '.sql', '.md']);
for (const root of projectRoots) {
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    if (!current || !fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(fullPath);
        continue;
      }
      if (!textExtensions.has(path.extname(entry.name))) continue;
      const content = fs.readFileSync(fullPath, 'utf8');
      if (/\bSOVI\b/i.test(content)) {
        console.error(`FAIL project boundary: SOVI reference found in ${fullPath}`);
        failed = true;
      }
    }
  }
}
if (!failed) console.log('PASS project boundary: no SOVI contamination in SIGO code/docs/migrations');

if (failed) process.exit(1);
console.log('SIGO_CRITICAL_FLOW_STATIC_CHECKS_OK');
