-- Eliminar una compra que se abrió por error (por ejemplo, una repetida). Solo si no tiene prendas registradas:
-- si las tiene, primero se eliminan desde su ficha (eliminar_producto) y la compra se borra cuando queda vacía.
create function public.eliminar_compra(p_compra_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_compra public.compras;
  v_prendas integer;
begin
  perform public.exigir_equipo();
  select * into v_compra from public.compras where id = p_compra_id for update;
  if not found then raise exception 'La compra ya no existe'; end if;
  select coalesce(sum(cantidad), 0) into v_prendas from public.ingresos where compra_id = p_compra_id;
  if v_prendas > 0 then
    raise exception 'No se puede eliminar la compra %: tiene % % en el inventario. Si se registraron por error, elimine primero esas prendas desde su ficha.',
      v_compra.numero, v_prendas, case when v_prendas = 1 then 'prenda registrada' else 'prendas registradas' end;
  end if;
  delete from public.compras where id = p_compra_id;
  return jsonb_build_object('numero', v_compra.numero, 'proveedor', v_compra.proveedor, 'factura', v_compra.factura);
end $$;

revoke execute on function public.eliminar_compra(uuid) from public, anon;
grant execute on function public.eliminar_compra(uuid) to authenticated;
