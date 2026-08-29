import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Producto = {
  id: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
  nombre: string;
  categoria: string | null;
  marca: string | null;
  proveedor: string | null;
  costo_actual: number | null;
  precio: number | null;
  stock: number | null;
  stock_minimo: number | null;
};

const menuItems = [
  { name: "Inicio", icon: "⌂" },
  { name: "Productos", icon: "▣" },
  { name: "Ventas", icon: "▤" },
  { name: "Compras", icon: "🛒" },
  { name: "Clientes", icon: "♙" },
  { name: "Proveedores", icon: "♧" },
  { name: "Stock", icon: "▦" },
  { name: "Informes", icon: "▥" },
];

function App() {
  const [active, setActive] = useState("Inicio");

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">C</div>
          <div>
            <strong>COMERCIAL</strong>
            <span>Gestión Comercial</span>
          </div>
        </div>

        <nav className="menu">
          {menuItems.map((item) => (
            <button
              key={item.name}
              className={
                active === item.name ? "menu-item active" : "menu-item"
              }
              onClick={() => setActive(item.name)}
            >
              <span className="menu-icon">{item.icon}</span>
              <span>{item.name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="avatar">A</div>
            <div>
              <strong>Administrador</strong>
              <span>Acceso completo</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <h1>{active}</h1>
            <p>Gestión Comercial</p>
          </div>

          <div className="topbar-actions">
            <button className="icon-button">🔔</button>
            <button className="admin-button">Administrador</button>
          </div>
        </header>

        <section className="content">
          {active === "Inicio" && <Dashboard />}
          {active === "Productos" && <Products />}

          {active !== "Inicio" && active !== "Productos" && (
            <ComingSoon title={active} />
          )}
        </section>
      </main>
    </div>
  );
}

function Dashboard() {
  return (
    <>
      <div className="welcome">
        <div>
          <h2>Bienvenido a Comercial</h2>
          <p>
            Desde aquí podés administrar toda la gestión de tu negocio.
          </p>
        </div>

        <button className="primary-button">+ Nueva venta</button>
      </div>

      <div className="stats">
        <Stat
          title="Ventas del día"
          value="$ 0"
          description="Sin ventas registradas"
        />

        <Stat
          title="Productos"
          value="0"
          description="Catálogo de productos"
        />

        <Stat
          title="Stock bajo"
          value="0"
          description="Productos para reponer"
        />

        <Stat
          title="Clientes"
          value="0"
          description="Clientes registrados"
        />
      </div>
    </>
  );
}

function Products() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true });

    if (error) {
      console.error(error);
      setError(error.message);
      setProductos([]);
    } else {
      setProductos((data || []) as Producto[]);
    }

    setLoading(false);
  }

  const filteredProducts = productos.filter((producto) => {
    const text = [
      producto.nombre,
      producto.codigo_interno || "",
      producto.codigo_barras || "",
      producto.marca || "",
      producto.categoria || "",
    ]
      .join(" ")
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Productos</h2>
          <p>Administrá productos, códigos, precios y stock.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowForm(true)}
        >
          + Nuevo producto
        </button>
      </div>

      <div className="product-tools">
        <input
          type="search"
          placeholder="Buscar producto, código o código de barras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <button
          className="admin-button"
          onClick={loadProducts}
        >
          ↻ Actualizar
        </button>
      </div>

      {loading && (
        <div className="panel">
          <p>Cargando productos...</p>
        </div>
      )}

      {!loading && error && (
        <div className="panel">
          <h3>No se pudieron cargar los productos</h3>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && productos.length === 0 && (
        <div className="panel">
          <div className="empty-products">
            <div className="empty-icon large">📦</div>

            <h3>No hay productos cargados</h3>

            <p>
              La conexión funciona correctamente, pero todavía no hay
              productos registrados.
            </p>

            <button
              className="primary-button"
              onClick={() => setShowForm(true)}
            >
              + Cargar primer producto
            </button>
          </div>
        </div>
      )}

      {!loading && !error && productos.length > 0 && (
        <div className="panel">
          <div className="table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Código de barras</th>
                  <th>Costo</th>
                  <th>Precio venta</th>
                  <th>Stock</th>
                </tr>
              </thead>

              <tbody>
                {filteredProducts.map((producto) => (
                  <tr key={producto.id}>
                    <td>
                      <strong>{producto.nombre}</strong>

                      {producto.marca && (
                        <small>{producto.marca}</small>
                      )}
                    </td>

                    <td>{producto.codigo_interno || "-"}</td>

                    <td>{producto.codigo_barras || "-"}</td>

                    <td>
                      $
                      {Number(
                        producto.costo_actual || 0
                      ).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    <td>
                      $
                      {Number(
                        producto.precio || 0
                      ).toLocaleString("es-AR", {
                        minimumFractionDigits: 2,
                      })}
                    </td>

                    <td>{producto.stock || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredProducts.length === 0 && (
              <div className="table-empty">
                No encontramos productos con esa búsqueda.
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <NewProductForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

function NewProductForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [codigoInterno, setCodigoInterno] = useState("");
  const [codigoBarras, setCodigoBarras] = useState("");
  const [categoria, setCategoria] = useState("");
  const [marca, setMarca] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [costo, setCosto] = useState("");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [stockMinimo, setStockMinimo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function guardarProducto(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!nombre.trim()) {
      setError("El nombre del producto es obligatorio.");
      return;
    }

    setSaving(true);
    setError("");

    const { error } = await supabase
      .from("productos")
      .insert({
        nombre: nombre.trim(),
        codigo_interno: codigoInterno.trim() || null,
        codigo_barras: codigoBarras.trim() || null,
        categoria: categoria.trim() || null,
        marca: marca.trim() || null,
        proveedor: proveedor.trim() || null,
        costo_actual: costo ? Number(costo) : null,
        precio: precio ? Number(precio) : null,
        stock: stock ? Number(stock) : 0,
        stock_minimo: stockMinimo ? Number(stockMinimo) : 0,
      });

    if (error) {
      console.error(error);
      setError(error.message);
      setSaving(false);
      return;
    }

    onSaved();
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
          }}
        >
          <div>
            <h2 style={{ marginBottom: 4 }}>Nuevo producto</h2>
            <p style={{ marginTop: 0 }}>
              Completá los datos del producto.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={closeButtonStyle}
          >
            ✕
          </button>
        </div>

        <form onSubmit={guardarProducto}>
          <label>Nombre *</label>
          <input
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={inputStyle}
          />

          <label>Código interno</label>
          <input
            value={codigoInterno}
            onChange={(e) => setCodigoInterno(e.target.value)}
            style={inputStyle}
          />

          <label>Código de barras</label>
          <input
            value={codigoBarras}
            onChange={(e) => setCodigoBarras(e.target.value)}
            style={inputStyle}
          />

          <label>Categoría</label>
          <input
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            style={inputStyle}
          />

          <label>Marca</label>
          <input
            value={marca}
            onChange={(e) => setMarca(e.target.value)}
            style={inputStyle}
          />

          <label>Proveedor</label>
          <input
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
            style={inputStyle}
          />

          <label>Costo</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            style={inputStyle}
          />

          <label>Precio de venta</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            style={inputStyle}
          />

          <label>Stock</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            style={inputStyle}
          />

          <label>Stock mínimo</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={stockMinimo}
            onChange={(e) => setStockMinimo(e.target.value)}
            style={inputStyle}
          />

          {error && (
            <div
              style={{
                padding: 12,
                marginTop: 8,
                borderRadius: 8,
                background: "#fee2e2",
                color: "#991b1b",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
              marginTop: 20,
            }}
          >
            <button
              type="button"
              className="admin-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancelar
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving ? "Guardando..." : "Guardar producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  marginTop: 5,
  marginBottom: 14,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  boxSizing: "border-box",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  background: "#ffffff",
  color: "#111827",
  width: "100%",
  maxWidth: 650,
  maxHeight: "90vh",
  overflowY: "auto",
  borderRadius: 16,
  padding: 24,
  boxSizing: "border-box",
};

const closeButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 22,
  cursor: "pointer",
};

function Stat({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="panel coming-soon">
      <div className="empty-icon large">⚙️</div>
      <h2>{title}</h2>
      <p>Este módulo será incorporado en las próximas fases.</p>
    </div>
  );
}

export default App;
