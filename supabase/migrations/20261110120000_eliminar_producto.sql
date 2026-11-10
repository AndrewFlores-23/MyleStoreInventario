-- Eliminar un producto que se registró por error (por ejemplo, prendas metidas en la compra equivocada).
-- Se borra con sus ingresos y todo su historial, como si nunca hubiera entrado, y las compras a las que
-- pertenecían esos ingresos vuelven a tener esas prendas por registrar. Solo se permite si el producto
-- nunca salió en un apartado, una factura o una venta: en ese caso se registra una salida y se oculta.
create function public.eliminar_producto(p_producto_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_producto public.productos;
  v_ref text;
  v_ingresos integer;
  v_compras jsonb;
begin
  perform public.exigir_equipo();
  select * into v_producto from public.productos where id = p_producto_id for update;
  if not found then raise exception 'El producto ya no existe'; end if;

  select ap.numero into v_ref
    from public.apartado_articulos a join public.apartados ap on ap.id = a.apartado_id
   where a.producto_id = p_producto_id order by ap.creado_en limit 1;
  if v_ref is not null then
    raise exception 'No se puede eliminar «%»: ya salió en el apartado %. Si sobran unidades, registre una salida por ajuste de conteo y ocúltelo.', v_producto.nombre, v_ref;
  end if;
  select f.numero into v_ref
    from public.factura_articulos a join public.facturas f on f.id = a.factura_id
   where a.producto_id = p_producto_id order by f.creado_en limit 1;
  if v_ref is not null then
    raise exception 'No se puede eliminar «%»: ya salió en la factura %. Si sobran unidades, registre una salida por ajuste de conteo y ocúltelo.', v_producto.nombre, v_ref;
  end if;
  if exists (select 1 from public.movimientos
              where producto_id = p_producto_id and (motivo = 'venta' or apartado_id is not null or factura_id is not null)) then
    raise exception 'No se puede eliminar «%»: ya tiene ventas registradas. Si sobran unidades, registre una salida por ajuste de conteo y ocúltelo.', v_producto.nombre;
  end if;

  -- Las compras recuperan lo que se les había registrado con este producto
  with afectadas as (
    update public.compras c
       set unidades = greatest(0, c.unidades - s.unidades),
           total = greatest(0, c.total - s.total)
      from (select compra_id, sum(cantidad)::integer as unidades, sum(cantidad * costo_unitario) as total
              from public.ingresos where producto_id = p_producto_id and compra_id is not null group by compra_id) s
     where c.id = s.compra_id
    returning c.id, c.numero, greatest(0, c.prendas_pedidas - c.unidades) as faltan
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'numero', numero, 'faltan', faltan) order by numero), '[]'::jsonb)
    into v_compras from afectadas;

  delete from public.movimientos where producto_id = p_producto_id;
  delete from public.ingresos where producto_id = p_producto_id;
  get diagnostics v_ingresos = row_count;
  delete from public.productos where id = p_producto_id;

  return jsonb_build_object('nombre', v_producto.nombre, 'talla', v_producto.talla, 'color', v_producto.color,
    'existencias', v_producto.existencias, 'foto_path', v_producto.foto_path, 'ingresos', v_ingresos, 'compras', v_compras);
end $$;

revoke execute on function public.eliminar_producto(uuid) from public, anon;
grant execute on function public.eliminar_producto(uuid) to authenticated;
