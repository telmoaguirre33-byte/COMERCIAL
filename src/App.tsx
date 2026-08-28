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
          <p>Administrá productos, códigos, precios y stock.</p>
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
