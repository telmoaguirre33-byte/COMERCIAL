-- SIGO: verificación final de la carga inicial de stock y cierre del helper temporal.
do $$
declare
  v_libreria_source integer;
  v_libreria_verified integer;
  v_sertec_source integer;
  v_sertec_verified integer;
begin
  select coalesce(sum(source_rows),0), coalesce(sum(verified_rows),0)
    into v_libreria_source, v_libreria_verified
    from public.sigo_importaciones_stock
   where import_key like 'resguardo-stock-sigo-2026-09-09-libreria-%';

  select coalesce(sum(source_rows),0), coalesce(sum(verified_rows),0)
    into v_sertec_source, v_sertec_verified
    from public.sigo_importaciones_stock
   where import_key like 'resguardo-stock-sigo-2026-09-09-sertec-%';

  if v_libreria_source <> 983 or v_libreria_verified <> 983 then
    raise exception 'SIGO_STOCK_IMPORT_FINAL_LIBRERIA_FAILED source=% verified=%', v_libreria_source, v_libreria_verified;
  end if;

  if v_sertec_source <> 417 or v_sertec_verified <> 417 then
    raise exception 'SIGO_STOCK_IMPORT_FINAL_SERTEC_FAILED source=% verified=%', v_sertec_source, v_sertec_verified;
  end if;

  if v_libreria_source + v_sertec_source <> 1400 then
    raise exception 'SIGO_STOCK_IMPORT_FINAL_TOTAL_FAILED: %', v_libreria_source + v_sertec_source;
  end if;

  raise notice 'SIGO_STOCK_IMPORT_FINAL_OK Lápiz y Papel=983/983 Sertec=417/417 Total=1400/1400';
end
$$;

drop function if exists public.sigo_importar_stock_resguardo(text, text, text);
