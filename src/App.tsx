async function loadProducts() {
  setLoading(true);
  setError("");

  try {
    const response = await fetch(
      ${import.meta.env.VITE_SUPABASE_URL}/rest/v1/productos?select=*,
      {
        method: "GET",
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );

    const result = await response.json();

    console.log("SUPABASE RESPONSE:", result);

    if (!response.ok) {
      throw new Error(
        result?.message ||
        result?.error ||
        Error HTTP ${response.status}
      );
    }

    setProductos(result || []);
  } catch (err) {
    console.error("ERROR PRODUCTOS:", err);

    setError(
      err instanceof Error
        ? err.message
        : "Error desconocido al cargar productos"
    );

    setProductos([]);
  }

  setLoading(false);
}
