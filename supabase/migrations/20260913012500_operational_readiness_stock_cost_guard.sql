-- SIGO readiness guard: certifica la carga inicial dentro de una sola caja y evita altas con costo_actual NULL.
-- No modifica stock, precios ni historicos. El ALTER solo agrega un valor por defecto y una restriccion de integridad.
do $$
declare
  v_empresa_id uuid;
  v_libreria_source integer;
  v_libreria_verified integer;
  v_computacion_source integer;
  v_computacion_verified integer;
  v_empresas_importadas integer;
  v_costos_null integer;
begin
  select e.id
    into v_empresa_id
    from public.empresas e
   where lower(trim(e.nombre)) = lower('SIGO Administración')
     and e.activa = true
   order by e.created_at asc
   limit 1;

  if v_empresa_id is null then
    raise exception 'SIGO_READINESS_MAIN_TENANT_NOT_FOUND';
  end if;

  select coalesce(sum(source_rows), 0), coalesce(sum(verified_rows), 0)
    into v_libreria_source, v_libreria_verified
    from public.sigo_importaciones_stock
   where import_key like 'resguardo-stock-sigo-2026-09-09-libreria-%';

  select coalesce(sum(source_rows), 0), coalesce(sum(verified_rows), 0)
    into v_computacion_source, v_computacion_verified
    from public.sigo_importaciones_stock
   where import_key like 'resguardo-stock-sigo-2026-09-09-sertec-%';

  select count(distinct empresa_id)
    into v_empresas_importadas
    from public.sigo_importaciones_stock
   where import_key like 'resguardo-stock-sigo-2026-09-09-libreria-%'
      or import_key like 'resguardo-stock-sigo-2026-09-09-sertec-%';

  if v_libreria_source <> 983 or v_libreria_verified <> 983 then
    raise exception 'SIGO_READINESS_LIBRERIA_FAILED source=% verified=%', v_libreria_source, v_libreria_verified;
  end if;

  if v_computacion_source <> 417 or v_computacion_verified <> 417 then
    raise exception 'SIGO_READINESS_COMPUTACION_FAILED source=% verified=%', v_computacion_source, v_computacion_verified;
  end if;

  if v_libreria_source + v_computacion_source <> 1400 then
    raise exception 'SIGO_READINESS_TOTAL_FAILED total=%', v_libreria_source + v_computacion_source;
  end if;

  if v_empresas_importadas <> 1 or exists (
    select 1
      from public.sigo_importaciones_stock i
     where (i.import_key like 'resguardo-stock-sigo-2026-09-09-libreria-%'
         or i.import_key like 'resguardo-stock-sigo-2026-09-09-sertec-%')
       and i.empresa_id <> v_empresa_id
  ) then
    raise exception 'SIGO_READINESS_TENANT_SPLIT_DETECTED';
  end if;

  select count(*)
    into v_costos_null
    from public.productos p
   where p.costo_actual is null;

  if v_costos_null <> 0 then
    raise exception 'SIGO_READINESS_NULL_CURRENT_COST count=%', v_costos_null;
  end if;

  raise notice 'SIGO_READINESS_STOCK_COST_OK tenant=SIGO Administración libreria=983 computacion=417 total=1400 costo_actual_null=0';
end
$$;

alter table public.productos
  alter column costo_actual set default 0,
  alter column costo_actual set not null;
