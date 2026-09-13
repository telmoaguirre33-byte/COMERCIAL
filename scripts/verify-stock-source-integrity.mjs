import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve('supabase/migrations');
const files = fs.readdirSync(migrationsDir).filter((name) => /_stock_(libreria|sertec)_\d+\.sql$/.test(name));
const libreriaFiles = files.filter((name) => name.includes('_stock_libreria_')).sort();
const computacionFiles = files.filter((name) => name.includes('_stock_sertec_')).sort();

if (libreriaFiles.length !== 10) {
  throw new Error(`Expected 10 Libreria stock source migrations, found ${libreriaFiles.length}`);
}
if (computacionFiles.length !== 5) {
  throw new Error(`Expected 5 Computacion stock source migrations, found ${computacionFiles.length}`);
}

const importKeys = new Set();
const identities = new Map();

function normalize(value) {
  return String(value ?? '').trim().toUpperCase();
}

function inspectGroup(groupFiles, sector, expectedRows) {
  let rows = 0;
  for (const file of groupFiles) {
    const source = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    const importKeyMatch = source.match(/'(resguardo-stock-sigo-2026-09-09-(?:libreria|sertec)-\d+)'/);
    if (!importKeyMatch) throw new Error(`Missing controlled import_key in ${file}`);
    const importKey = importKeyMatch[1];
    if (importKeys.has(importKey)) throw new Error(`Duplicate import_key: ${importKey}`);
    importKeys.add(importKey);

    const payloadMatch = source.match(/\$stock\$\s*\n([\s\S]*?)\n\$stock\$/m);
    if (!payloadMatch) throw new Error(`Missing $stock$ payload in ${file}`);
    const payloadRows = payloadMatch[1].split(/\r?\n/).filter((line) => line.trim() !== '');

    for (let index = 0; index < payloadRows.length; index += 1) {
      const line = payloadRows[index];
      const columns = line.split('\t');
      if (columns.length !== 9) {
        throw new Error(`${file}:${index + 1} must have exactly 9 tab-separated columns, found ${columns.length}`);
      }
      const barcode = normalize(columns[0]);
      const internal = normalize(columns[1]);
      const name = String(columns[2] ?? '').trim();
      if (!name || (!barcode && !internal)) {
        throw new Error(`${file}:${index + 1} missing product name or barcode/internal code`);
      }

      const rowRef = `${file}:${index + 1}:${name}`;
      for (const code of new Set([barcode, internal].filter(Boolean))) {
        const previous = identities.get(code);
        if (previous && previous !== rowRef) {
          throw new Error(`Duplicate product identity ${code}: ${previous} <> ${rowRef}`);
        }
        identities.set(code, rowRef);
      }
    }
    rows += payloadRows.length;
  }

  if (rows !== expectedRows) {
    throw new Error(`${sector} source rows mismatch: expected ${expectedRows}, found ${rows}`);
  }
  return rows;
}

const libreriaRows = inspectGroup(libreriaFiles, 'Libreria', 983);
const computacionRows = inspectGroup(computacionFiles, 'Computacion', 417);
const total = libreriaRows + computacionRows;
if (total !== 1400) throw new Error(`Combined source rows mismatch: expected 1400, found ${total}`);
if (importKeys.size !== 15) throw new Error(`Expected 15 unique import keys, found ${importKeys.size}`);

console.log(`Stock source integrity OK: Libreria=${libreriaRows} Computacion=${computacionRows} Total=${total} batches=${importKeys.size} unique product identities=${identities.size}`);
