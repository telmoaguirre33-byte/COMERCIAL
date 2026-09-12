-- SIGO: corregir la carga inicial para una sola empresa/caja.
-- Los lotes de Librería y Computación se importan al tenant SIGO Administración.
-- Si la migración base creó shells Lápiz y Papel / Sertec sin productos, se desactivan.
-- No borra datos ni sobrescribe stock/productos existentes.

do $$
begin
  update public.empresas e
     set activa = false
   where lower(e.nombre) in (lower('Lápiz y Papel'), lower('Sertec'))
     and not exists (select 1 from public.productos p where p.empresa_id = e.id);
end
$$;

create or replace function public.sigo_importar_stock_resguardo(
  p_empresa_nombre text,
  p_import_key text,
  p_payload text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_line text;
  v_a text[];
  v_codigo_barras text;
  v_codigo_interno text;
  v_nombre text;
  v_precio numeric;
  v_stock numeric;
  v_proveedor text;
  v_costo numeric;
  v_descripcion text;
  v_categoria text;
  v_source_rows integer := 0;
  v_inserted integer := 0;
  v_verified integer := 0;
  v_rowcount integer;
begin
  if nullif(btrim(p_import_key), '') is null then raise exception 'IMPORT_KEY_REQUIRED'; end if;
  if nullif(p_payload, '') is null then return 0; end if;

  select e.id
    into v_empresa_id
    from public.empresas e
   where lower(e.nombre) = lower('SIGO Administración')
     and e.activa = true
   order by e.created_at asc
   limit 1;

  if v_empresa_id is null then raise exception 'SIGO_STOCK_IMPORT_MAIN_COMPANY_NOT_FOUND'; end if;

  for v_line in
    select line
      from regexp_split_to_table(p_payload, E'\n') line
     where btrim(line) <> ''
  loop
    v_source_rows := v_source_rows + 1;
    v_a := regexp_split_to_array(v_line, E'\t');
    if cardinality(v_a) <> 9 then raise exception 'SIGO_STOCK_IMPORT_BAD_ROW_%', v_source_rows; end if;

    v_codigo_barras := nullif(btrim(v_a[1]), '');
    v_codigo_interno := nullif(btrim(v_a[2]), '');
    v_nombre := nullif(btrim(v_a[3]), '');
    v_precio := coalesce(nullif(v_a[4], '')::numeric, 0);
    v_stock := coalesce(nullif(v_a[5], '')::numeric, 0);
    v_proveedor := nullif(btrim(v_a[6]), '');
    v_costo := coalesce(nullif(v_a[7], '')::numeric, 0);
    v_descripcion := nullif(btrim(v_a[8]), '');
    v_categoria := coalesce(nullif(btrim(v_a[9]), ''), nullif(btrim(p_empresa_nombre), ''));

    if v_nombre is null or (v_codigo_barras is null and v_codigo_interno is null) then
      raise exception 'SIGO_STOCK_IMPORT_IDENTITY_REQUIRED_%', v_source_rows;
    end if;
    if v_precio < 0 or v_stock < 0 or v_costo < 0 then
      raise exception 'SIGO_STOCK_IMPORT_NEGATIVE_VALUE_%', v_source_rows;
    end if;

    if not exists (
      select 1 from public.productos p
       where p.empresa_id = v_empresa_id
         and (
           (v_codigo_barras is not null and (p.codigo_barras = v_codigo_barras or p.codigo_interno = v_codigo_barras))
           or
           (v_codigo_interno is not null and (p.codigo_interno = v_codigo_interno or p.codigo_barras = v_codigo_interno))
         )
    ) then
      insert into public.productos (
        empresa_id, codigo_interno, codigo_barras, nombre, descripcion, categoria, marca, proveedor,
        costo_actual, costo_ultima_compra, precio_venta, margen_ganancia, margen_porcentaje,
        stock_actual, stock_minimo, stock_maximo, activo
      ) values (
        v_empresa_id, v_codigo_interno, v_codigo_barras, v_nombre, v_descripcion, v_categoria, null, v_proveedor,
        v_costo, v_costo, v_precio,
        greatest(v_precio - v_costo, 0),
        case when v_costo = 0 then 0 else round(greatest((v_precio - v_costo) / v_costo * 100, 0), 4) end,
        v_stock, null, null, true
      );
      get diagnostics v_rowcount = row_count;
      v_inserted := v_inserted + v_rowcount;
    end if;

    if exists (
      select 1 from public.productos p
       where p.empresa_id = v_empresa_id
         and (
           (v_codigo_barras is not null and (p.codigo_barras = v_codigo_barras or p.codigo_interno = v_codigo_barras))
           or
           (v_codigo_interno is not null and (p.codigo_interno = v_codigo_interno or p.codigo_barras = v_codigo_interno))
         )
    ) then
      v_verified := v_verified + 1;
    else
      raise exception 'SIGO_STOCK_IMPORT_ROW_NOT_MATCHED_%: %', v_source_rows, v_nombre;
    end if;
  end loop;

  insert into public.sigo_importaciones_stock (
    import_key, empresa_id, source_file, source_rows, inserted_rows, skipped_existing, verified_rows, notes
  ) values (
    p_import_key, v_empresa_id, 'Resguardo_stock_SIGO.xlsx', v_source_rows,
    v_inserted, v_source_rows - v_inserted, v_verified,
    'Importación unificada en SIGO Administración; sector preservado en categoría; no sobrescribe existentes.'
  )
  on conflict (import_key) do update
    set empresa_id = excluded.empresa_id,
        inserted_rows = excluded.inserted_rows,
        skipped_existing = excluded.skipped_existing,
        verified_rows = excluded.verified_rows,
        notes = excluded.notes;

  if v_verified <> v_source_rows then
    raise exception 'SIGO_STOCK_IMPORT_VERIFY_FAILED: %/%', v_verified, v_source_rows;
  end if;

  return v_inserted;
end
$$;

revoke all on function public.sigo_importar_stock_resguardo(text, text, text) from public;

comment on function public.sigo_importar_stock_resguardo(text, text, text) is
  'SIGO: carga inicial unificada en SIGO Administración (una sola caja); Librería/Computación quedan como categoría.';
