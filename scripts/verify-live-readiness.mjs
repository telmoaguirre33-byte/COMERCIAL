import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function requireText(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${label}: ${needle}`);
  }
}

const readiness = read('src/operationalReadiness.ts');
const matriz = read('src/MatrizAdmin.tsx');

for (const [needle, label] of [
  ['SIGO_LIVE_READINESS_OK', 'success evidence code'],
  ['sigo_importaciones_stock', 'initial stock ledger'],
  ['productos', 'live catalog query'],
  ['LIBRERIA_PATTERN', 'Libreria import selector'],
  ['COMPUTACION_PATTERN', 'Computacion import selector'],
  ['libreriaSource !== 983', '983 Libreria check'],
  ['computacionSource !== 417', '417 Computacion check'],
  ['totalSource !== 1400', '1,400 total check'],
  ['catalogoProductos < 1400', 'live catalog count check'],
  ['costosActualesNull !== 0', 'non-null current-cost check'],
  ['empresasImportadas !== 1', 'single import tenant check'],
  ['.is("costo_actual", null)', 'null current-cost query'],
  ['head: true', 'read-only count query'],
]) {
  requireText(readiness, needle, label);
}

for (const forbidden of ['.insert(', '.update(', '.upsert(', '.delete(', '.rpc(']) {
  if (readiness.includes(forbidden)) {
    throw new Error(`Live readiness verifier must remain read-only; forbidden token: ${forbidden}`);
  }
}

for (const [needle, label] of [
  ['Preparación operativa · SIGO Administración', 'Matriz live readiness panel'],
  ['Validar ahora', 'manual live verification action'],
  ['Copiar evidencia', 'evidence copy action'],
  ['readiness.totalVerified', '1,400 evidence display'],
  ['readiness.costosActualesNull', 'null-cost evidence display'],
]) {
  requireText(matriz, needle, label);
}

console.log('Live operational readiness guard OK: read-only 983 + 417 = 1,400 verifier exposed in Matriz');
