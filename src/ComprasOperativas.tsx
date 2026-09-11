import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { listarProductosSigo, type ProductoSigo } from "./productos";
import {
  confirmarCompraSigo,
  guardarProveedorSigo,
  listarComprasSigo,
  listarProveedoresSigo,
  type CompraItemInput,
  type CompraSigo,
  type ProveedorSigo,
} from "./compras";

type Linea = CompraItemInput & { key: string };

function nuevaLinea(): Linea {
  return { key: crypto.randomUUID(), producto_id: "", cantidad: 1, costo_unitario: 0 };
}

export default function ComprasOperativas({ empresaId }: { empresaId: string }) {
  const [proveedores, setProveedores] = useState<ProveedorSigo[]>([]);
  const [compras, setCompras] = useState<CompraSigo[]>([]);
  const [productos, setProductos] = useState<ProductoSigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState("Factura");
  const [numero, setNumero] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([nuevaLinea()]);
  const [nuevoProveedor, setNuevoProveedor] = useState("");
  const [nuevoCuit, setNuevoCuit] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const [ps, cs, prods] = await Promise.all([
        listarProveedoresSigo(empresaId),
        listarComprasSigo(empresaId),
        listarProductosSigo(empresaId),
      ]);
      setProveedores(ps);
      setCompras(cs);
      setProductos(prods);
      if (!proveedorId && ps[0]) setProveedorId(ps[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar Compras");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void cargar(); }, [empresaId]);

  const total = useMemo(
    () => lineas.reduce((sum, l) => sum + Number(l.cantidad || 0) * Number(l.costo_unitario || 0), 0),
    [lineas]
  );

  function editarLinea(key: string, patch: Partial<Linea>) {
    setLineas((actual) => actual.map((l) => l.key === key ? { ...l, ...patch } : l));
  }

  async function crearProveedor() {
    if (!nuevoProveedor.trim()) return;
    setSaving(true);
    setError("");
    try {
      const creado = await guardarProveedorSigo({ empresaId, razonSocial: nuevoProveedor, cuit: nuevoCuit });
      setProveedores((actual) => [...actual, creado].sort((a, b) => a.razon_social.localeCompare(b.razon_social)));
      setProveedorId(creado.id);
      setNuevoProveedor("");
      setNuevoCuit("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el proveedor");
    } finally {
      setSaving(false);
    }
  }

  async function confirmar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const validas = lineas.filter((l) => l.producto_id && l.cantidad > 0 && l.costo_unitario >= 0);
      if (validas.length !== lineas.length) throw new Error("Completá correctamente todas las líneas de la compra.");
      await confirmarCompraSigo({
        empresaId,
        proveedorId,
        items: validas.map(({ producto_id, cantidad, costo_unitario }) => ({ producto_id, cantidad, costo_unitario })),
        fecha,
        tipoComprobante: tipo,
        numeroComprobante: numero,
        idempotencyKey: crypto.randomUUID(),
      });
      setLineas([nuevaLinea()]);
      setNumero("");
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo confirmar la compra");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Compras / Proveedores</h2>
          <p>Recepción tenant-safe: confirmar una compra actualiza stock y último costo en una sola transacción.</p>
        </div>
        <button className="admin-button" onClick={() => void cargar()} disabled={loading || saving}>Actualizar</button>
      </div>

      {error && <div className="panel"><p className="form-error" role="alert">{error}</p></div>}

      <div className="panel">
        <h3>Alta rápida de proveedor</h3>
        <div className="form-grid">
          <div className="form-group"><label>Razón social</label><input value={nuevoProveedor} onChange={(e) => setNuevoProveedor(e.target.value)} placeholder="Proveedor" /></div>
          <div className="form-group"><label>CUIT</label><input value={nuevoCuit} onChange={(e) => setNuevoCuit(e.target.value)} placeholder="Opcional" /></div>
        </div>
        <div className="form-actions"><button type="button" className="admin-button" disabled={saving || !nuevoProveedor.trim()} onClick={() => void crearProveedor()}>Crear proveedor</button></div>
      </div>

      <form className="panel" onSubmit={(e) => void confirmar(e)}>
        <h3>Nueva compra</h3>
        <div className="form-grid">
          <div className="form-group"><label>Proveedor *</label><select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)} required><option value="">Seleccionar</option>{proveedores.map((p) => <option key={p.id} value={p.id}>{p.razon_social}</option>)}</select></div>
          <div className="form-group"><label>Fecha</label><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
          <div className="form-group"><label>Tipo</label><input value={tipo} onChange={(e) => setTipo(e.target.value)} /></div>
          <div className="form-group"><label>Nº comprobante</label><input value={numero} onChange={(e) => setNumero(e.target.value)} /></div>
        </div>

        <div className="table-wrapper" style={{ marginTop: 18 }}>
          <table className="products-table">
            <thead><tr><th>Producto</th><th>Cantidad</th><th>Costo unitario</th><th>Subtotal</th><th></th></tr></thead>
            <tbody>
              {lineas.map((l) => (
                <tr key={l.key}>
                  <td><select value={l.producto_id} onChange={(e) => { const p = productos.find((x) => x.id === e.target.value); editarLinea(l.key, { producto_id: e.target.value, costo_unitario: Number(p?.costo_actual ?? p?.costo_ultima_compra ?? 0) }); }} required><option value="">Seleccionar producto</option>{productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></td>
                  <td><input type="number" min="0.001" step="0.001" value={l.cantidad} onChange={(e) => editarLinea(l.key, { cantidad: Number(e.target.value) })} /></td>
                  <td><input type="number" min="0" step="0.01" value={l.costo_unitario} onChange={(e) => editarLinea(l.key, { costo_unitario: Number(e.target.value) })} /></td>
                  <td>$ {(l.cantidad * l.costo_unitario).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td>
                  <td><button type="button" className="admin-button danger-button" disabled={lineas.length === 1} onClick={() => setLineas((actual) => actual.filter((x) => x.key !== l.key))}>Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="page-header" style={{ marginTop: 16 }}>
          <button type="button" className="admin-button" onClick={() => setLineas((actual) => [...actual, nuevaLinea()])}>+ Agregar producto</button>
          <div><strong>Total compra: $ {total.toLocaleString("es-AR", { minimumFractionDigits: 2 })}</strong></div>
        </div>
        <div className="form-actions"><button type="submit" className="primary-button" disabled={saving || loading || !proveedorId}>{saving ? "Confirmando…" : "Confirmar compra e ingresar stock"}</button></div>
      </form>

      <div className="panel">
        <h3>Últimas compras</h3>
        {loading ? <p>Cargando…</p> : compras.length === 0 ? <p>Sin compras confirmadas.</p> : (
          <div className="table-wrapper"><table className="products-table"><thead><tr><th>Fecha</th><th>Proveedor</th><th>Comprobante</th><th>Total</th><th>Estado</th></tr></thead><tbody>{compras.map((c) => <tr key={c.id}><td>{c.fecha_compra}</td><td>{proveedores.find((p) => p.id === c.proveedor_id)?.razon_social ?? "-"}</td><td>{[c.tipo_comprobante, c.numero_comprobante].filter(Boolean).join(" ") || "-"}</td><td>$ {Number(c.total).toLocaleString("es-AR", { minimumFractionDigits: 2 })}</td><td>{c.estado}</td></tr>)}</tbody></table></div>
        )}
      </div>
    </div>
  );
}
