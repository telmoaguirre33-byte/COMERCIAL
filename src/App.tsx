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
