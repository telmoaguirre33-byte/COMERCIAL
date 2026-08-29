import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
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
  precio_venta: number | null;
  margen_ganancia: number | null;
  margen_porcentaje: number | null;
  stock_actual: number | null;
  stock_minimo: number | null;
  stock_maximo: number | null;
};

type Categoria = {
  id: string;
  nombre: string;
  activo: boolean | null;
};

type Marca = {
  id: string;
  nombre: string;
  activo: boolean | null;
};

type Proveedor = {
  id: string;
  razon_social: string;
  activo: boolean | null;
};

const menuItems = [
  { name: "Inicio", icon: "I" },
  { name: "Productos", icon: "P" },
  { name: "Ventas", icon: "V" },
  { name: "Compras", icon: "C" },
  { name: "Clientes", icon: "CL" },
  { name: "Proveedores", icon: "PR" },
  { name: "Stock", icon: "S" },
  { name: "Informes", icon: "IN" },
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
            <span>Gestion Comercial</span>
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
            <p>Gestion Comercial</p>
          </div>

          <div className="topbar-actions">
            <button className="icon-button">Avisos</button>

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
            Desde aqui podes administrar toda la gestion
            de tu negocio.
          </p>
        </div>

        <button className="primary-button">
          + Nueva venta
        </button>
      </div>

      <div className="stats">
        <Stat
          title="Ventas del dia"
          value="$ 0"
          description="Sin ventas registradas"
        />

        <Stat
          title="Productos"
          value="0"
          description="Catalogo de productos"
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

  const [productoEditar, setProductoEditar] =
    useState<Producto | null>(null);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    setLoading(true);
    setError("");

    const resultado = await supabase
      .from("productos")
      .select("*")
      .order("nombre", { ascending: true });

    if (resultado.error) {
      console.error(resultado.error);
      setError(resultado.error.message);
      setProductos([]);
    } else {
      setProductos(
        (resultado.data || []) as Producto[]
      );
    }

    setLoading(false);
  }

  async function eliminarProducto(
    producto: Producto
  ) {
    const confirmar = window.confirm(
      'Seguro que queres eliminar "' +
        producto.nombre +
        '"?'
    );

    if (!confirmar) {
      return;
    }

    setDeletingId(producto.id);

    const resultado = await supabase
      .from("productos")
      .delete()
      .eq("id", producto.id);

    if (resultado.error) {
      console.error(resultado.error);

      window.alert(
        "No se pudo eliminar: " +
          resultado.error.message
      );

      setDeletingId(null);
      return;
    }

    setDeletingId(null);
    await loadProducts();
  }

  const filteredProducts = productos.filter(
    (producto) => {
      const text = [
        producto.nombre,
        producto.codigo_interno || "",
        producto.codigo_barras || "",
        producto.marca || "",
        producto.categoria || "",
        producto.proveedor || "",
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search.toLowerCase());
    }
  );

  function abrirNuevoProducto() {
    setProductoEditar(null);
    setShowForm(true);
  }

  function abrirEditarProducto(
    producto: Producto
  ) {
    setProductoEditar(producto);
    setShowForm(true);
  }

  function cerrarFormulario() {
    setShowForm(false);
    setProductoEditar(null);
  }

  async function productoGuardado() {
    setShowForm(false);
    setProductoEditar(null);
    await loadProducts();
  }

  return (
    <div className="products-page">
      <div className="page-header">
        <div>
          <h2>Productos</h2>

          <p>
            Administra productos, codigos, precios y
            stock.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={abrirNuevoProducto}
        >
          + Nuevo producto
        </button>
      </div>

      <div className="product-tools">
        <input
          type="search"
          placeholder="Buscar producto, codigo o codigo de barras..."
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
        />

        <button
          className="admin-button"
          onClick={loadProducts}
        >
          Actualizar
        </button>
      </div>

      {loading && (
        <div className="panel">
          <p>Cargando productos...</p>
        </div>
      )}

      {!loading && error && (
        <div className="panel">
          <h3>
            No se pudieron cargar los productos
          </h3>

          <p>{error}</p>
        </div>
      )}

      {!loading &&
        !error &&
        productos.length === 0 && (
          <div className="panel">
            <div className="empty-products">
              <h3>No hay productos cargados</h3>

              <p>
                La conexion funciona correctamente,
                pero todavia no hay productos
                registrados.
              </p>

              <button
                className="primary-button"
                onClick={abrirNuevoProducto}
              >
                + Cargar primer producto
              </button>
            </div>
          </div>
        )}

      {!loading &&
        !error &&
        productos.length > 0 && (
          <div className="panel">
            <div className="table-wrapper">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Codigo</th>
                    <th>Codigo de barras</th>
                    <th>Costo</th>
                    <th>Precio venta</th>
                    <th>Stock</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (producto) => (
                      <tr key={producto.id}>
                        <td>
                          <strong>
                            {producto.nombre}
                          </strong>

                          {producto.marca && (
                            <small>
                              {producto.marca}
                            </small>
                          )}
                        </td>

                        <td>
                          {producto.codigo_interno ||
                            "-"}
                        </td>

                        <td>
                          {producto.codigo_barras ||
                            "-"}
                        </td>

                        <td>
                          $
                          {Number(
                            producto.costo_actual ||
                              0
                          ).toLocaleString(
                            "es-AR",
                            {
                              minimumFractionDigits: 2,
                            }
                          )}
                        </td>

                        <td>
                          $
                          {Number(
                            producto.precio_venta ||
                              0
                          ).toLocaleString(
                            "es-AR",
                            {
                              minimumFractionDigits: 2,
                            }
                          )}
                        </td>

                        <td>
                          {producto.stock_actual || 0}
                        </td>

                        <td>
                          <div
                            style={
                              actionButtonsStyle
                            }
                          >
                            <button
                              type="button"
                              className="admin-button"
                              onClick={() =>
                                abrirEditarProducto(
                                  producto
                                )
                              }
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              style={
                                deleteButtonStyle
                              }
                              disabled={
                                deletingId ===
                                producto.id
                              }
                              onClick={() =>
                                eliminarProducto(
                                  producto
                                )
                              }
                            >
                              {deletingId ===
                              producto.id
                                ? "Eliminando..."
                                : "Eliminar"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>

              {filteredProducts.length ===
                0 && (
                <div className="table-empty">
                  No encontramos productos con esa
                  busqueda.
                </div>
              )}
            </div>
          </div>
        )}

      {showForm && (
        <ProductForm
          producto={productoEditar}
          onClose={cerrarFormulario}
          onSaved={productoGuardado}
        />
      )}
    </div>
  );
}

function ProductForm({
  producto,
  onClose,
  onSaved,
}: {
  producto: Producto | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState(
    producto?.nombre || ""
  );

  const [codigoInterno, setCodigoInterno] =
    useState(
      producto?.codigo_interno || ""
    );

  const [codigoBarras, setCodigoBarras] =
    useState(
      producto?.codigo_barras || ""
    );

  const [categoria, setCategoria] =
    useState(
      producto?.categoria || ""
    );

  const [marca, setMarca] = useState(
    producto?.marca || ""
  );

  const [proveedor, setProveedor] =
    useState(
      producto?.proveedor || ""
    );

  const [costo, setCosto] = useState(
    producto?.costo_actual != null
      ? String(producto.costo_actual)
      : ""
  );

  const [precio, setPrecio] = useState(
    producto?.precio_venta != null
      ? String(producto.precio_venta)
      : ""
  );

  const [stock, setStock] = useState(
    producto?.stock_actual != null
      ? String(producto.stock_actual)
      : ""
  );

  const [stockMinimo, setStockMinimo] =
    useState(
      producto?.stock_minimo != null
        ? String(producto.stock_minimo)
        : ""
    );

  const [categorias, setCategorias] =
    useState<Categoria[]>([]);

  const [marcas, setMarcas] =
    useState<Marca[]>([]);

  const [proveedores, setProveedores] =
    useState<Proveedor[]>([]);

  const [loadingCatalogos, setLoadingCatalogos] =
    useState(true);

  const [catalogError, setCatalogError] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    cargarCatalogos();
  }, []);

  async function cargarCatalogos() {
    setLoadingCatalogos(true);
    setCatalogError("");

    const [
      resultadoCategorias,
      resultadoMarcas,
      resultadoProveedores,
    ] = await Promise.all([
      supabase
        .from("categorias")
        .select("id,nombre,activo")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("marcas")
        .select("id,nombre,activo")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("proveedores")
        .select("id,razon_social,activo")
        .eq("activo", true)
        .order("razon_social", {
          ascending: true,
        }),
    ]);

    if (resultadoCategorias.error) {
      console.error(
        resultadoCategorias.error
      );

      setCatalogError(
        "No se pudieron cargar las categorias."
      );
    } else {
      setCategorias(
        (resultadoCategorias.data ||
          []) as Categoria[]
      );
    }

    if (resultadoMarcas.error) {
      console.error(
        resultadoMarcas.error
      );

      setCatalogError(
        "No se pudieron cargar los catalogos."
      );
    } else {
      setMarcas(
        (resultadoMarcas.data ||
          []) as Marca[]
      );
    }

    if (resultadoProveedores.error) {
      console.error(
        resultadoProveedores.error
      );

      setCatalogError(
        "No se pudieron cargar los catalogos."
      );
    } else {
      setProveedores(
        (resultadoProveedores.data ||
          []) as Proveedor[]
      );
    }

    setLoadingCatalogos(false);
  }

  const costoNumero =
    Number(costo) || 0;

  const precioNumero =
    Number(precio) || 0;

  const margenGanancia =
    precioNumero > 0 &&
    costoNumero > 0
      ? precioNumero - costoNumero
      : 0;

  const margenPorcentaje =
    costoNumero > 0
      ? (margenGanancia /
          costoNumero) *
        100
      : 0;

  const categoriaExiste =
    categoria === "" ||
    categorias.some(
      (item) => item.nombre === categoria
    );

  const marcaExiste =
    marca === "" ||
    marcas.some(
      (item) => item.nombre === marca
    );

  const proveedorExiste =
    proveedor === "" ||
    proveedores.some(
      (item) =>
        item.razon_social === proveedor
    );

  async function guardarProducto(
    e: FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    if (!nombre.trim()) {
      setError(
        "El nombre del producto es obligatorio."
      );
      return;
    }

    setSaving(true);
    setError("");

    const datosProducto = {
      nombre: nombre.trim(),

      codigo_interno:
        codigoInterno.trim() || null,

      codigo_barras:
        codigoBarras.trim() || null,

      categoria:
        categoria || null,

      marca:
        marca || null,

      proveedor:
        proveedor || null,

      costo_actual:
        costo !== ""
          ? Number(costo)
          : null,

      costo_ultima_compra:
        costo !== ""
          ? Number(costo)
          : null,

      precio_venta:
        precio !== ""
          ? Number(precio)
          : null,

      margen_ganancia:
        costo !== "" &&
        precio !== ""
          ? margenGanancia
          : null,

      margen_porcentaje:
        costo !== "" &&
        precio !== ""
          ? margenPorcentaje
          : null,

      stock_actual:
        stock !== ""
          ? Number(stock)
          : 0,

      stock_minimo:
        stockMinimo !== ""
          ? Number(stockMinimo)
          : 0,
    };

    if (producto) {
      const resultado =
        await supabase
          .from("productos")
          .update(datosProducto)
          .eq("id", producto.id);

      if (resultado.error) {
        console.error(
          resultado.error
        );

        setError(
          resultado.error.message
        );

        setSaving(false);
        return;
      }
    } else {
      const resultado =
        await supabase
          .from("productos")
          .insert(datosProducto);

      if (resultado.error) {
        console.error(
          resultado.error
        );

        setError(
          resultado.error.message
        );

        setSaving(false);
        return;
      }
    }

    onSaved();
  }

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <h2>
              {producto
                ? "Editar producto"
                : "Nuevo producto"}
            </h2>

            <p>
              {producto
                ? "Modifica los datos y guarda los cambios."
                : "Completa los datos del producto."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={closeButtonStyle}
          >
            X
          </button>
        </div>

        <form
          onSubmit={guardarProducto}
        >
          <label>Nombre *</label>

          <input
            required
            value={nombre}
            onChange={(e) =>
              setNombre(
                e.target.value
              )
            }
            style={inputStyle}
          />

          <label>
            Codigo interno
          </label>

          <input
            value={codigoInterno}
            onChange={(e) =>
              setCodigoInterno(
                e.target.value
              )
            }
            style={inputStyle}
          />

          <label>
            Codigo de barras
          </label>

          <input
            value={codigoBarras}
            onChange={(e) =>
              setCodigoBarras(
                e.target.value
              )
            }
            style={inputStyle}
          />

          <label>Categoria</label>

          <select
            value={categoria}
            onChange={(e) =>
              setCategoria(
                e.target.value
              )
            }
            style={inputStyle}
            disabled={loadingCatalogos}
          >
            <option value="">
              Seleccionar categoria
            </option>

            {!categoriaExiste &&
              categoria && (
                <option value={categoria}>
                  {categoria}
                </option>
              )}

            {categorias.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.nombre}
                >
                  {item.nombre}
                </option>
              )
            )}
          </select>

          <label>Marca</label>

          <select
            value={marca}
            onChange={(e) =>
              setMarca(
                e.target.value
              )
            }
            style={inputStyle}
            disabled={loadingCatalogos}
          >
            <option value="">
              Seleccionar marca
            </option>

            {!marcaExiste &&
              marca && (
                <option value={marca}>
                  {marca}
                </option>
              )}

            {marcas.map(
              (item) => (
                <option
                  key={item.id}
                  value={item.nombre}
                >
                  {item.nombre}
                </option>
              )
            )}
          </select>

          <label>Proveedor</label>

          <select
            value={proveedor}
            onChange={(e) =>
              setProveedor(
                e.target.value
              )
            }
            style={inputStyle}
            disabled={loadingCatalogos}
          >
            <option value="">
              Seleccionar proveedor
            </option>

            {!proveedorExiste &&
              proveedor && (
                <option value={proveedor}>
                  {proveedor}
                </option>
              )}

            {proveedores.map(
              (item) => (
                <option
                  key={item.id}
                  value={
                    item.razon_social
                  }
                >
                  {item.razon_social}
                </option>
              )
            )}
          </select>

          {loadingCatalogos && (
            <div style={infoStyle}>
              Cargando categorias, marcas y
              proveedores...
            </div>
          )}

          {catalogError && (
            <div style={errorStyle}>
              {catalogError}
            </div>
          )}

          <label>Costo actual</label>

          <input
            type="number"
            step="0.01"
            min="0"
            value={costo}
            onChange={(e) =>
              setCosto(
                e.target.value
              )
            }
            style={inputStyle}
          />

          <label>
            Precio de venta
          </label>

          <input
            type="number"
            step="0.01"
            min="0"
            value={precio}
            onChange={(e) =>
              setPrecio(
                e.target.value
              )
            }
            style={inputStyle}
          />

          {costoNumero > 0 &&
            precioNumero > 0 && (
              <div
                style={
                  marginBoxStyle
                }
              >
                <strong>
                  Margen: $
                  {margenGanancia.toLocaleString(
                    "es-AR",
                    {
                      minimumFractionDigits: 2,
                    }
                  )}
                </strong>

                <span>
                  {" ("}
                  {margenPorcentaje.toFixed(
                    2
                  )}
                  {"%)"}
                </span>
              </div>
            )}

          <label>Stock actual</label>

          <input
            type="number"
            step="0.01"
            min="0"
            value={stock}
            onChange={(e) =>
              setStock(
                e.target.value
              )
            }
            style={inputStyle}
          />

          <label>Stock minimo</label>

          <input
            type="number"
            step="0.01"
            min="0"
            value={stockMinimo}
            onChange={(e) =>
              setStockMinimo(
                e.target.value
              )
            }
            style={inputStyle}
          />

          {error && (
            <div style={errorStyle}>
              {error}
            </div>
          )}

          <div
            style={buttonRowStyle}
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
              {saving
                ? "Guardando..."
                : producto
                ? "Guardar cambios"
                : "Guardar producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  marginTop: 5,
  marginBottom: 14,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  boxSizing: "border-box",
  background: "#ffffff",
  color: "#111827",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: 20,
};

const modalStyle: CSSProperties = {
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

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 20,
};

const closeButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  cursor: "pointer",
};

const marginBoxStyle: CSSProperties = {
  padding: 12,
  marginBottom: 14,
  background: "#f3f4f6",
  borderRadius: 8,
};

const infoStyle: CSSProperties = {
  padding: 10,
  marginBottom: 14,
  background: "#f3f4f6",
  borderRadius: 8,
};

const errorStyle: CSSProperties = {
  padding: 12,
  marginTop: 8,
  marginBottom: 14,
  borderRadius: 8,
  background: "#fee2e2",
  color: "#991b1b",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 20,
};

const actionButtonsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const deleteButtonStyle: CSSProperties = {
  border: "1px solid #ef4444",
  background: "#ffffff",
  color: "#b91c1c",
  borderRadius: 8,
  padding: "8px 10px",
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

function ComingSoon({
  title,
}: {
  title: string;
}) {
  return (
    <div className="panel coming-soon">
      <h2>{title}</h2>

      <p>
        Este modulo sera incorporado en las proximas
        fases.
      </p>
    </div>
  );
}

export default App;
