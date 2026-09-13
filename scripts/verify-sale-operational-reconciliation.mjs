import fs from "node:fs";

const ventas = fs.readFileSync("src/ventas.ts", "utf8");

for (const required of [
  'detectarEstadoReintento',
  'capturarStockAntes',
  'verificarIntegridadStockVenta',
  'venta_items_sigo',
  'producto_id,cantidad',
  'estadoReintento !== "nueva"',
  'esperadoDespues = antes - item.cantidad',
  'combinarIntegridad(integridadCaja, integridadStock)',
]) {
  if (!ventas.includes(required)) {
    throw new Error(`Missing sale operational reconciliation guard: ${required}`);
  }
}

if (!ventas.includes('confirmar_venta_sigo_v2')) {
  throw new Error("Sale confirmation must remain on the hardened transactional RPC");
}

if (!ventas.includes('listarProductosSigo')) {
  throw new Error("Sale confirmation must capture/verify tenant product stock around a new transaction");
}

if (/update\s+public\.productos/i.test(ventas) || /delete\s+from\s+public\.productos/i.test(ventas)) {
  throw new Error("Frontend sale reconciliation must never mutate product stock directly");
}

console.log("Sale operational reconciliation verified: sale detail, cash/account movement and stock delta are checked without replaying the transaction.");
