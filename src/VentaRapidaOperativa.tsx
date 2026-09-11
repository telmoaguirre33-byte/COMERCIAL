import { useMemo, useState } from "react";
import BarcodeScanner from "./BarcodeScanner";
import type { BarcodeProduct } from "./barcode";
import { confirmarVentaSigo, type MedioPagoSigo } from "./ventas";

type ItemVenta = { producto: BarcodeProduct; cantidad: number };

function nuevaClaveVenta() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function VentaRapidaOperativa({ empresaId }: { empresaId: string }) {
  const [items, setItems] = useState<ItemVenta[]>([]);
  const [medioPago, setMedioPago] = useState<MedioPagoSigo>("efectivo");
  const [confirmando, setConfirmando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(nuevaClaveVenta);

  function agregar(producto: BarcodeProduct) {
    setError("");
    setExito("");
    if (producto.precio_venta == null) {
      setError(`${producto.nombre}: no tiene precio de venta habilitado.`);
      return;
    }
    if (producto.stock_actual == null || Number(producto.stock_actual) <= 0) {
      setError(`${producto.nombre}: sin stock disponible.`);
      return;
    }

    setItems((actual) => {
      const existente = actual.find((item) => item.producto.id === producto.id);
      const cantidadActual = existente?.cantidad ?? 0;
      if (cantidadActual + 1 > Number(producto.stock_actual)) {
        setError(`${producto.nombre}: no hay stock para agregar otra unidad.`);
        return actual;
      }
      if (existente) {
        return actual.map((item) => item.producto.id === producto.id ? { ...item, cantidad: item.cantidad + 1 } : item);
      }
      return [...actual, { producto, cantidad: 1 }];
    });
  }

  function cambiarCantidad(productoId: string, delta: number) {
    setError("");
    setItems((actual) => actual.flatMap((item) => {
      if (item.producto.id !== productoId) return [item];
      const siguiente = item.cantidad + delta;
      if (siguiente <= 0) return [];
      if (item.producto.stock_actual != null && siguiente > Number(item.producto.stock_actual)) {
        setError(`${item.producto.nombre}: stock máximo disponible ${item.producto.stock_actual}.`);
        return [item];
      }
      return [{ ...item, cantidad: siguiente }];
    }));
  }

  function vaciar() {
    if (confirmando) return;
    setItems([]);
    setError("");
    setExito("");
    setIdempotencyKey(nuevaClaveVenta());
  }

  const total = useMemo(
    () => items.reduce((suma, item) => suma + Number(item.producto.precio_venta ?? 0) * item.cantidad, 0),
    [items],
  );

  const puedeConfirmar = items.length > 0
    && items.every((item) => item.producto.precio_venta != null && item.producto.stock_actual != null && item.cantidad <= Number(item.producto.stock_actual));

  async function confirmar() {
    if (!puedeConfirmar || confirmando) return;
    setConfirmando(true);
    setError("");
    setExito("");
    try {
      const resultado = await confirmarVentaSigo({
        empresaId,
        medioPago,
        idempotencyKey,
        items: items.map((item) => ({ productoId: item.producto.id, cantidad: item.cantidad })),
      });
      setExito(`Venta confirmada · ${resultado.ventaId.slice(0, 8).toUpperCase()} · Total $ ${total.toLocaleString("es-AR")}`);
      setItems([]);
      setIdempotencyKey(nuevaClaveVenta());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar la venta.");
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Venta rápida</h2>
          <p>Pistola USB/Bluetooth, ingreso manual o cámara celular. Confirmación transaccional con descuento de stock y registro de caja.</p>
        </div>
        <button className="admin-button" disabled={items.length === 0 || confirmando} onClick={vaciar}>Vaciar</button>
      </div>

      <div className="panel">
        <h3>Escanear producto</h3>
        <BarcodeScanner empresaId={empresaId} action="vender" onProduct={agregar} disabled={confirmando} />
      </div>

      <div className="panel">
        <div className="page-header">
          <div><h3>Carrito</h3><p>El precio final y el stock se vuelven a validar en backend al confirmar.</p></div>
          <label className="form-group" style={{ minWidth: 190 }}>
            <span>Medio de pago</span>
            <select value={medioPago} disabled={confirmando} onChange={(e) => setMedioPago(e.target.value as MedioPagoSigo)}>
              <option value="efectivo">Efectivo</option>
              <option value="debito">Débito</option>
              <option value="credito">Crédito</option>
              <option value="transferencia">Transferencia</option>
              <option value="cuenta_corriente">Cuenta corriente</option>
              <option value="otro">Otro</option>
            </select>
          </label>
        </div>

        <div className="table-wrapper">
          <table className="products-table">
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th><th>Stock</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.producto.id}>
                  <td><strong>{item.producto.nombre}</strong></td>
                  <td>
                    <div className="row-actions">
                      <button className="admin-button" disabled={confirmando} onClick={() => cambiarCantidad(item.producto.id, -1)}>−</button>
                      <strong>{item.cantidad}</strong>
                      <button className="admin-button" disabled={confirmando} onClick={() => cambiarCantidad(item.producto.id, 1)}>+</button>
                    </div>
                  </td>
                  <td>$ {Number(item.producto.precio_venta).toLocaleString("es-AR")}</td>
                  <td>$ {(Number(item.producto.precio_venta) * item.cantidad).toLocaleString("es-AR")}</td>
                  <td>{item.producto.stock_actual}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <div className="table-empty">Escaneá un producto para iniciar la venta.</div>}
        </div>

        {error && <p className="form-error" role="alert">{error}</p>}
        {exito && <p role="status"><strong>{exito}</strong></p>}

        <div className="form-actions">
          <strong>Total: $ {total.toLocaleString("es-AR")}</strong>
          <button className="primary-button" disabled={!puedeConfirmar || confirmando} onClick={() => void confirmar()}>
            {confirmando ? "Confirmando…" : "Confirmar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}
