-- Modificar las prendas de un apartado pendiente: quitar, agregar o cambiar cantidades.
-- Se manda la lista completa; por producto, lo que sobra vuelve al inventario (movimiento «quitado»)
-- y lo que falta se aparta ahora (movimiento «apartado»), revisando existencias. El precio de una prenda
-- que ya estaba se conserva si no viene uno nuevo. Solo se modifica un apartado pendiente.
alter table public.movimientos drop constraint movimientos_motivo_check;
alter table public.movimientos add constraint movimientos_motivo_check
  check (motivo in ('ingreso', 'anulacion', 'apartado', 'quitado', 'venta', 'factura', 'danado', 'devolucion', 'regalo', 'ajuste'));

create function public.modificar_apartado(p_apartado_id uuid, p_articulos jsonb) returns public.apartados
language plpgsql security definer set search_path = public as $$
declare
  v_ap public.apartados;
  v_fila record;
  v_producto public.productos;
  v_precio numeric;
  v_existencias integer;
  v_subtotal numeric;
begin
  perform public.exigir_equipo();
  select * into v_ap from public.apartados where id = p_apartado_id for update;
  if not found then raise exception 'El apartado no existe'; end if;
  if v_ap.estado <> 'pendiente' then raise exception 'El apartado ya está %; no se puede modificar', v_ap.estado; end if;
  if p_articulos is null or jsonb_typeof(p_articulos) <> 'array' or jsonb_array_length(p_articulos) = 0 then
    raise exception 'El apartado necesita al menos una prenda; si el cliente no sigue, anúlelo';
  end if;
  if exists (select 1 from jsonb_array_elements(p_articulos) e
              where coalesce((e ->> 'cantidad')::integer, 0) <= 0 or (e ->> 'precio_unitario')::numeric < 0) then
    raise exception 'Revise las cantidades y los precios del apartado';
  end if;

  -- Diferencia por producto: lo que sobra vuelve al inventario, lo que falta se aparta
  for v_fila in
    with nuevo as (
      select (e ->> 'producto_id')::uuid as producto_id, sum((e ->> 'cantidad')::integer)::integer as cantidad,
             min((e ->> 'precio_unitario')::numeric) as precio
        from jsonb_array_elements(p_articulos) e group by 1),
    viejo as (
      select producto_id, sum(cantidad)::integer as cantidad, min(precio_unitario) as precio
        from public.apartado_articulos where apartado_id = p_apartado_id group by 1)
    select coalesce(n.producto_id, v.producto_id) as producto_id,
           coalesce(n.cantidad, 0) - coalesce(v.cantidad, 0) as delta,
           coalesce(n.precio, v.precio) as precio
      from nuevo n full join viejo v on v.producto_id = n.producto_id
     where coalesce(n.cantidad, 0) <> coalesce(v.cantidad, 0)
     order by 1
  loop
    select * into v_producto from public.productos where id = v_fila.producto_id for update;
    if not found then raise exception 'Uno de los artículos ya no existe'; end if;
    v_precio := coalesce(v_fila.precio, v_producto.precio_venta);
    if v_fila.delta > 0 then
      if v_producto.existencias < v_fila.delta then
        raise exception 'Solo quedan % de «%»%', v_producto.existencias, v_producto.nombre, coalesce(' talla ' || v_producto.talla, '');
      end if;
      update public.productos set existencias = existencias - v_fila.delta where id = v_producto.id returning existencias into v_existencias;
      insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, apartado_id)
      values (v_producto.id, 'salida', 'apartado', v_fila.delta, v_existencias, v_precio, v_ap.numero, v_ap.id);
    else
      update public.productos set existencias = existencias - v_fila.delta, activo = true where id = v_producto.id returning existencias into v_existencias;
      insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, apartado_id)
      values (v_producto.id, 'entrada', 'quitado', -v_fila.delta, v_existencias, v_precio, v_ap.numero, v_ap.id);
    end if;
  end loop;

  -- Las prendas del apartado quedan como en la lista nueva; el precio que no venga se conserva del apartado
  with viejo as (
    delete from public.apartado_articulos where apartado_id = p_apartado_id
    returning producto_id, precio_unitario)
  insert into public.apartado_articulos (apartado_id, producto_id, nombre, talla, color, foto_path, cantidad, precio_unitario, costo_unitario)
  select p_apartado_id, p.id, p.nombre, p.talla, p.color, p.foto_path, (e ->> 'cantidad')::integer,
         coalesce((e ->> 'precio_unitario')::numeric, (select min(v.precio_unitario) from viejo v where v.producto_id = p.id), p.precio_venta),
         p.costo
    from jsonb_array_elements(p_articulos) e join public.productos p on p.id = (e ->> 'producto_id')::uuid;

  select coalesce(sum(cantidad * precio_unitario), 0) into v_subtotal from public.apartado_articulos where apartado_id = p_apartado_id;
  update public.apartados set subtotal = v_subtotal where id = p_apartado_id returning * into v_ap;
  return v_ap;
end $$;

revoke execute on function public.modificar_apartado(uuid, jsonb) from public, anon;
grant execute on function public.modificar_apartado(uuid, jsonb) to authenticated;
