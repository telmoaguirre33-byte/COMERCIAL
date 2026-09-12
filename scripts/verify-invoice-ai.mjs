import fs from 'node:fs';

const checks = [
  ['src/ComprasOperativas.tsx', ['Escanear factura con IA', 'Tomar foto de factura', 'capture="environment"', 'Usar datos de esta factura', 'guardarProductoSigo', 'analizarFacturaCompraSigo', 'Confirmar compra e ingresar stock']],
  ['src/facturaIA.ts', ['analizarFacturaCompraSigo', '/api/compras/analizar-factura', 'image/jpeg', 'AI_NOT_CONFIGURED', 'validarFactura']],
  ['api/compras/analizar-factura.js', ['OPENAI_API_KEY', 'purchases.write', '/v1/responses', 'input_image', 'No inventes datos', 'normalizarFacturaIA', 'MAX_INVOICE_ITEMS', 'NO_VALID_INVOICE_ITEMS']],
];

for (const [file, required] of checks) {
  const text = fs.readFileSync(file, 'utf8');
  for (const token of required) {
    if (!text.includes(token)) throw new Error(`Invoice AI regression: ${file} missing ${token}`);
  }
}

const compras = fs.readFileSync('src/ComprasOperativas.tsx', 'utf8');
if (!compras.includes('precioVenta: null')) throw new Error('Invoice AI regression: new products must not invent sale prices');
if (!compras.includes('stockActual: null')) throw new Error('Invoice AI regression: AI must not write stock before purchase confirmation');

const api = fs.readFileSync('api/compras/analizar-factura.js', 'utf8');
if (!api.includes('itemsRaw.slice(0, MAX_INVOICE_ITEMS)') && !api.includes('raw.items.slice(0, MAX_INVOICE_ITEMS)')) {
  throw new Error('Invoice AI regression: server must cap invoice line count');
}
if (!api.includes('cuitLeido.length === 11')) throw new Error('Invoice AI regression: server must validate CUIT length');
if (!api.includes('Number.isFinite')) throw new Error('Invoice AI regression: server must reject non-finite numeric values');

console.log('AI purchase invoice flow: OK');
