import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Producto = {
  id: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
  nombre: string;
  categoria: string | null;
  marca: string | null;
  costo_ultima_compra: number | null;
  margen_ganancia: number | null;
  precio_venta: number | null;
  stock_actual: number | null;
  stock_minimo: number | null;
  activo: boolean | null;
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
                active === item.name
                  ? "menu-item active"
                  : "menu-item"
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

            <button className="admin-button">
              Administrador
            </button>
          </div>
        </header>

        <section className="content">
          {active === "Inicio" && <Dashboard />}

          {active === "Productos" && <Products />}

          {active !== "Inicio" &&
            active !== "Productos" && (
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

        <button className="primary-button">
          + Nueva venta
        </button>
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

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Actividad reciente</h3>
              <p>Últimos movimientos del sistema</p>
            </div>
          </div>

          <div className="empty-state">
            <div className="empty-icon">▣</div>

            <strong>Sistema conectado</strong>

            <span>
              La aplicación está conectada con Supabase.
            </span>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <h3>Acciones rápidas</h3>
              <p>Operaciones frecuentes</p>
            </div>
          </div>

          <div className="quick-actions">
            <button>
              <span>📦</span>
              Nuevo producto
            </button>

            <button>
              <span>🛒</span>
              Nueva compra
            </button>

            <button>
              <span>👤</span>
              Nuevo cliente
            </button>

            <button>
              <span>📊</span>
              Ver informes
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function Products() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
      setProductos(data || []);
    }

    setLoading(false);
  }

  const filteredProducts = productos.filter((producto) => {
    const text = `
      ${producto.nombre}
      ${producto.codigo_interno || ""}
      ${producto.codigo_barras || ""}
      ${producto.marca || ""}
      ${producto.categoria || ""}
    `.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Productos</h2>
          <p>
            Administrá productos, códigos, precios y stock.
          </p>
        </div>

        <button className="primary-button">
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
          <div className="empty-products">
            <div className="empty-icon large">⏳</div>

            <h3>Cargando productos...</h3>

            <p>Consultando la base de datos.</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="panel">
          <div className="empty-products">
            <div className="empty-icon large">⚠️</div>

            <h3>No se pudieron cargar los productos</h3>

            <p>{error}</p>

            <button
              className="primary-button"
              onClick={loadProducts}
            >
              Intentar nuevamente
            </button>
          </div>
        </div>
      )}

      {!loading && !error && productos.length === 0 && (
        <div className="panel">
          <div className="empty-products">
            <div className="empty-icon large">📦</div>

            <h3>No hay productos cargados</h3>

            <p>
              La conexión funciona correctamente, pero todavía
              no hay productos registrados.
            </p>

            <button className="primary-button">
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

                    <td>
                      {producto.codigo_interno || "-"}
                    </td>

                    <td>
                      {producto.codigo_barras || "-"}
                    </td>

                    <td>
                      $
                      {(producto.costo_ultima_compra || 0).toLocaleString(
                        "es-AR",
                        { minimumFractionDigits: 2 }
                      )}
                    </td>

                    <td>
                      $
                      {(producto.precio_venta || 0).toLocaleString(
                        "es-AR",
                        { minimumFractionDigits: 2 }
                      )}
                    </td>

                    <td>
                      {producto.stock_actual || 0}
                    </td>
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
    </div>
  );
}

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

      <p>
        Este módulo será incorporado en las próximas fases.
      </p>
    </div>
  );
}

export default App;
