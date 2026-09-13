import fs from 'node:fs';

const compras = fs.readFileSync('src/compras.ts', 'utf8');

const required = [
  'MAX_COMPRA_ITEMS = 300',
  'MAX_CANTIDAD_ITEM',
  'MAX_COSTO_UNITARIO',
  'fechaIsoValida',
  'normalizarDocumento',
  '.limit(200)',
  'precio_venta',
  'Definí precio antes de vender',
  'preparación para venta conciliados correctamente',
];

for (const token of required) {
  if (!compras.includes(token)) {
    throw new Error(`Purchase readiness regression: missing ${token}`);
  }
}

if (!compras.includes('normalizarDocumento(compra.numero_comprobante) === documentoNormalizado')) {
  throw new Error('Purchase readiness regression: duplicate-document preflight must normalize stored numbers');
}

if (!compras.includes('cantidad > MAX_CANTIDAD_ITEM') || !compras.includes('costo > MAX_COSTO_UNITARIO')) {
  throw new Error('Purchase readiness regression: operational numeric limits must be enforced client-side');
}

if (!compras.includes('sinPrecioVenta.push')) {
  throw new Error('Purchase readiness regression: post-receipt reconciliation must surface products without sale price');
}

console.log('Purchase operational readiness: OK');
