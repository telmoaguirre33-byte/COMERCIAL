import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { EmpresaOperativa } from "./tenant";
import {
  eliminarProductoSigo,
  guardarProductoSigo,
  listarProductosSigo,
  type ProductoSigo,
} from "./productos";

type Section = "Inicio" | "Productos" | "Ventas" | "Clientes" | "Compras" | "Stock" | "Informes";

const sections: Section[] = ["Inicio", "Productos", "Ventas", "Clientes", "Compras", "Stock", "Informes"];

type ProductoForm = {
  nombre: string;
  codigoInterno: string;
  codigoBarras: string;
  categoria: string;
  marca: string;
};

const productoVacio: ProductoForm = {
  nombre: "",
  codigoInterno: "",
  codigoBarras: "",
  categoria: "",
  marca: "",
};

export default function SigoApp({ empresa }: { empresa: EmpresaOperativa }) {
  const [section, setSection] = useState<Section>("Inicio");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">S</div>
          <div>
            <strong>SIGO</strong>
            <span>Gestión Operativa</span>
          </div>
        </div>
        <nav className="menu">
          {sections.map((item) => (
            <button key={item} className={section === item ? "menu-item active" : "menu-item"} onClick={() => setSection(item)}>
              <span className="menu-icon">{item.slice(0, 2).toUpperCase()}</span>
              <span>{item}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">A</div>
            <div>
              <strong>{empresa.empresa_nombre}</strong>
              <span>Empresa activa</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{section}</h1>
            <p>{empresa.empresa_nombre} · SIGO</p>
          </div>
        </header>
        <section className="content">
          {section === "Inicio" && <Inicio empresa={empresa} onProductos={() => setSection("Productos")} />}
          {section === "Productos" && <Productos empresaId={empresa.empresa_id} />}
          {section !== "Inicio" && section !== "Productos" && <Pendiente title={section} />}
        </section>
      </main>
    </div>
  );
}

function Inicio({ empresa, onProductos }: { empresa: EmpresaOperativa; onProductos: () => void }) {
  return (
    <div className="welcome">
      <div>
        <h2>SIGO · {empresa.empresa_nombre}</h2>
        <p>Operación protegida por empresa activa. Productos trabaja con aislamiento por tenant.</p>
      </div>
      <button className="primary-button" onClick={onProductos}>Abrir productos</button>
    </div>
  );
}

function Productos({ empresaId }: { empresaId: string }) {
  const [productos, setProductos] = useState<ProductoSigo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductoSigo | null>(null);
  const [form, setForm] = useState<ProductoForm>(productoVacio);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      setProductos(await listarProductosSigo(empresaId));
    } catch (err) {
      setProductos([]);
      setError(err instanceof Error ? err.message : "No se pudieron cargar los productos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void cargar();
  }, [empresaId]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return productos;
    return productos.filter((p) => [p.nombre, p.codigo_interno, p.codigo_barras, p.marca, p.categoria]
      .filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [productos, search]);

  function abrirNuevo() {
    setEditing(null);
    setForm(productoVacio);
    setFormError("");
    setFormOpen(true);
  }

  function abrirEdicion(producto: ProductoSigo) {
    setEditing(producto);
    setForm({
      nombre: producto.nombre,
      codigoInterno: producto.codigo_interno ?? "",
      codigoBarras: producto.codigo_barras ?? "",
      categoria: producto.categoria ?? "",
      marca: producto.marca ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  function cerrarForm() {
    if (saving) return;
    setFormOpen(false);
    setEditing(null);
    setForm(productoVacio);
    setFormError("");
  }

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.nombre.trim()) {
      setFormError("El nombre del producto es obligatorio.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await guardarProductoSigo({
        empresaId,
        productoId: editing?.id ?? null,
        nombre: form.nombre,
        codigoInterno: form.codigoInterno,
        codigoBarras: form.codigoBarras,
        categoria: form.categoria,
        marca: form.marca,
        descripcion: editing?.descripcion ?? null,
        proveedor: editing?.proveedor ?? null,
        costoActual: editing?.costo_actual ?? null,
        costoUltimaCompra: editing?.costo_ultima_compra ?? null,
        precioVenta: editing?.precio_venta ?? null,
        margenGanancia: editing?.margen_ganancia ?? null,
        margenPorcentaje: editing?.margen_porcentaje ?? null,
        stockActual: editing?.stock_actual ?? null,
        stockMinimo: editing?.stock_minimo ?? null,
        stockMaximo: editing?.stock_maximo ?? null,
      });
      cerrarForm();
      await cargar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el producto");
    } finally {
      setSaving(false);
    }
  }

  async function eliminar(producto: ProductoSigo) {
    if (!window.confirm(`¿Eliminar ${producto.nombre}?`)) return;
    setDeletingId(producto.id);
    try {
      await eliminarProductoSigo(empresaId, producto.id);
      await cargar();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo eliminar el producto");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Productos</h2>
          <p>Catálogo de la empresa activa. Lectura y cambios se validan en backend por tenant y permisos.</p>
        </div>
        <div className="topbar-actions product-actions">
          <button className="admin-button" onClick={() => void cargar()}>Actualizar</button>
          <button className="primary-button" onClick={abrirNuevo}>Nuevo producto</button>
        </div>
      </div>

      <div className="product-tools">
        <input type="search" placeholder="Buscar producto o código de barras..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading && <div className="panel"><p>Cargando productos…</p></div>}
      {!loading && error && <div className="panel"><h3>No se pudieron cargar los productos</h3><p>{error}</p></div>}
      {!loading && !error && (
        <div className="panel">
          <div className="table-wrapper">
            <table className="products-table">
              <thead><tr><th>Producto</th><th>Código</th><th>Código de barras</th><th>Precio</th><th>Stock</th><th>Acciones</th></tr></thead>
              <tbody>
                {filtrados.map((p) => (
                  <tr key={p.id}>
                    <td><strong>{p.nombre}</strong>{p.marca && <small>{p.marca}</small>}</td>
                    <td>{p.codigo_interno ?? "-"}</td>
                    <td>{p.codigo_barras ?? "-"}</td>
                    <td>{p.precio_venta == null ? "Restringido" : `$ ${Number(p.precio_venta).toLocaleString("es-AR")}`}</td>
                    <td>{p.stock_actual == null ? "Restringido" : p.stock_actual}</td>
                    <td>
                      <div className="row-actions">
                        <button className="admin-button" onClick={() => abrirEdicion(p)}>Editar</button>
                        <button className="admin-button danger-button" disabled={deletingId === p.id} onClick={() => void eliminar(p)}>{deletingId === p.id ? "Eliminando…" : "Eliminar"}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtrados.length === 0 && <div className="table-empty">No hay productos para mostrar.</div>}
          </div>
        </div>
      )}

      {formOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) cerrarForm(); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="producto-form-title">
            <div className="page-header modal-header">
              <div>
                <h2 id="producto-form-title">{editing ? "Editar producto" : "Nuevo producto"}</h2>
                <p>{editing ? "Los campos no editados se preservan." : "Alta segura dentro de la empresa activa."}</p>
              </div>
              <button type="button" className="admin-button" onClick={cerrarForm} disabled={saving}>Cerrar</button>
            </div>
            <form onSubmit={(e) => void guardar(e)}>
              <div className="form-grid">
                <div className="form-group form-span-2">
                  <label htmlFor="producto-nombre">Nombre *</label>
                  <input id="producto-nombre" value={form.nombre} onChange={(e) => setForm((actual) => ({ ...actual, nombre: e.target.value }))} autoFocus required />
                </div>
                <div className="form-group">
                  <label htmlFor="producto-codigo">Código interno</label>
                  <input id="producto-codigo" value={form.codigoInterno} onChange={(e) => setForm((actual) => ({ ...actual, codigoInterno: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="producto-barras">Código de barras</label>
                  <input id="producto-barras" inputMode="numeric" value={form.codigoBarras} onChange={(e) => setForm((actual) => ({ ...actual, codigoBarras: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="producto-categoria">Categoría</label>
                  <input id="producto-categoria" value={form.categoria} onChange={(e) => setForm((actual) => ({ ...actual, categoria: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label htmlFor="producto-marca">Marca</label>
                  <input id="producto-marca" value={form.marca} onChange={(e) => setForm((actual) => ({ ...actual, marca: e.target.value }))} />
                </div>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="form-actions">
                <button type="button" className="admin-button" onClick={cerrarForm} disabled={saving}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={saving}>{saving ? "Guardando…" : editing ? "Guardar cambios" : "Crear producto"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Pendiente({ title }: { title: string }) {
  return <div className="panel"><h2>{title}</h2><p>Módulo en integración operativa. No se marca como aprobado hasta probar el circuito real.</p></div>;
}
