import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const migrationsDir = path.join(root, "supabase", "migrations");
const baseName = "20260912230000_stock_import_base.sql";
const finalName = "20260912231600_stock_import_verify.sql";
const libreriaNames = Array.from({ length: 10 }, (_, index) => `2026091223${String(index + 1).padStart(2, "0")}00_stock_libreria_${String(index + 1).padStart(2, "0")}.sql`);
const sertecNames = Array.from({ length: 5 }, (_, index) => `2026091223${String(index + 11).padStart(2, "0")}00_stock_sertec_${String(index + 1).padStart(2, "0")}.sql`);
const files = [baseName, ...libreriaNames, ...sertecNames, finalName];

for (const file of files) {
  const full = path.join(migrationsDir, file);
  if (!fs.existsSync(full)) throw new Error(`Missing stock bootstrap migration: ${file}`);
}

const read = (file) => fs.readFileSync(path.join(migrationsDir, file), "utf8");
const base = read(baseName);
const finalVerify = read(finalName);
const libreria = libreriaNames.map(read).join("\n");
const sertec = sertecNames.map(read).join("\n");
const all = [base, libreria, sertec, finalVerify].join("\n");

function payloadRows(text) {
  return [...text.matchAll(/\$stock\$\n([\s\S]*?)\n\$stock\$/g)]
    .flatMap((match) => match[1].split("\n"))
    .filter((line) => line.trim().length > 0);
}

const libreriaRows = payloadRows(libreria);
const sertecRows = payloadRows(sertec);

if (libreriaRows.length !== 983) throw new Error(`Librería bootstrap row count mismatch: ${libreriaRows.length}/983`);
if (sertecRows.length !== 417) throw new Error(`Sertec bootstrap row count mismatch: ${sertecRows.length}/417`);
if (libreriaRows.length + sertecRows.length !== 1400) throw new Error("Stock bootstrap total must remain exactly 1400 rows");

for (const [label, rows] of [["Librería", libreriaRows], ["Sertec", sertecRows]]) {
  rows.forEach((line, index) => {
    const columns = line.split("\t");
    if (columns.length !== 9) throw new Error(`${label} row ${index + 1} has ${columns.length}/9 columns`);
    if (!columns[2].trim()) throw new Error(`${label} row ${index + 1} has no product name`);
    if (!columns[0].trim() && !columns[1].trim()) throw new Error(`${label} row ${index + 1} has no barcode/internal code`);
  });
}

for (const pattern of [
  /delete\s+from\s+public\.productos/i,
  /truncate\s+(table\s+)?public\.productos/i,
  /update\s+public\.productos\s+set\s+stock_actual/i,
]) {
  if (pattern.test(all)) throw new Error(`Destructive stock bootstrap pattern detected: ${pattern}`);
}

for (const required of [
  "Lápiz y Papel",
  "Sertec",
  "sigo_importaciones_stock",
  "not exists",
  "verified_rows",
  "SIGO_STOCK_IMPORT_FINAL_OK",
  "LEGACY-6934274135608-328",
]) {
  if (!all.includes(required)) throw new Error(`Missing stock bootstrap safeguard: ${required}`);
}

console.log("Stock bootstrap verified: Librería 983, Sertec 417, total 1400; non-destructive guards present.");
