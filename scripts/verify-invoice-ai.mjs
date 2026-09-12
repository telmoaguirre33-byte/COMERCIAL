import fs from 'node:fs';

const checks = [
  ['src/ComprasOperativas.tsx', ['Escanear factura con IA', 'Tomar foto de factura', 'Usar datos de esta factura', 'guardarProductoSigo', 'analizarFacturaCompraSigo', 'Confirmar compra e ingresar stock']],
  ['src/facturaIA.ts', ['analizarFacturaCompraSigo', '/api/compras/analizar-factura', 'capture', 'image/jpeg', 'AI_NOT_CONFIGURED']],
  ['api/compras/analizar-factura.js', ['OPENAI_API_KEY', 'purchases.write', '/v1/responses', 'input_image', 'No inventes datos']],
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

console.log('AI purchase invoice flow: OK');
