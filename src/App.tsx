import { useEffect, useState } from "react";
import { supabase } from "./supabase";

type Producto = {
  id: string;
  codigo_interno: string | null;
  codigo_barras: string | null;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  marca: string | null;
  proveedor: string | null;
  costo_actual: number | null;
  costo_ultima_compra: number | null;
  precio: number | null;
  margen: number | null;
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
          <p>Desde aquí podés administrar toda la gestión de tu negocio.</p>
        </div>

        <button className="primary-button">+ Nueva venta</button>
      </div>

      <div className="stats">
        <Stat
          title="Ventas del día"
          value="$ 0"
          description="Sin ventas registradas"
        />
        <Stat title="Productos" value="0" description="Catálogo de productos" />
        <Stat
          title="Stock bajo"
          value="0"
          description="Productos para reponer"
        />
        <Stat title="Clientes" value="0" description="Clientes registrados" />
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
    const text = `
      ${producto.nombre}
      ${producto.codigo_interno || ""}
      ${producto.codigo_barras || ""}
      ${producto.marca || ""}
      ${producto.categoria || ""}
    `.toLowerCase();
