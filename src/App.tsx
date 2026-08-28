import { useState } from "react";

type MenuItem = {
  name: string;
  icon: string;
};

const menuItems: MenuItem[] = [
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
              className={active === item.name ? "menu-item active" : "menu-item"}
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
            <button className="icon-button" title="Notificaciones">
              🔔
            </button>

            <button className="admin-button">
              Administrador
            </button>
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
            <strong>No hay movimientos todavía</strong>
            <span>
              Las ventas, compras y movimientos de stock aparecerán aquí.
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
  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Productos</h2>
          <p>
            Administrá productos, códigos de barras, costos, precios y stock.
          </p>
        </div>

        <button className="primary-button">
          + Nuevo producto
        </button>
      </div>

      <div className="product-tools">
        <input
          type="search"
          placeholder="Buscar por producto o código de barras..."
        />

        <select defaultValue="">
          <option value="" disabled>
            Categoría
          </option>
          <option value="all">Todas</option>
        </select>

        <select defaultValue="">
          <option value="" disabled>
            Estado
          </option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      <div className="panel">
        <div className="empty-products">
          <div className="empty-icon large">📦</div>

          <h3>No hay productos cargados</h3>

          <p>
            Cuando conectemos esta pantalla con Supabase,
            tus productos aparecerán automáticamente aquí.
          </p>

          <button className="primary-button">
            + Cargar primer producto
          </button>
        </div>
      </div>
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
        Este módulo será incorporado en las próximas fases del sistema.
      </p>
    </div>
  );
}

export default App;
