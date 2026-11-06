-- Compras de mercadería: agrupa los ingresos de un mismo viaje al proveedor (una factura de compra).
-- Cada compra lleva su número (CO-0001), proveedor y número de factura; sus ingresos siguen teniendo su serie.
create sequence public.compra_numero_seq;
create table public.compras (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  proveedor text,
  factura text,
  nota text,
  total numeric(12,2) not null default 0,
  unidades integer not null default 0,
  creado_en timestamptz not null default now(),
  creado_por text default (auth.jwt() ->> 'email')
);
create index compras_fecha_idx on public.compras (creado_en desc);

alter table public.ingresos add column compra_id uuid references public.compras(id);
create index ingresos_compra_idx on public.ingresos (compra_id);

-- Abre una compra; los ingresos se van sumando con registrar_ingreso(..., p_compra_id)
create function public.crear_compra(p_proveedor text default null, p_factura text default null, p_nota text default null)
returns public.compras
language plpgsql security definer set search_path = public as $$
declare
  v_compra public.compras;
begin
  perform public.exigir_equipo();
  insert into public.compras (numero, proveedor, factura, nota)
  values ('CO-' || lpad(nextval('public.compra_numero_seq')::text, 4, '0'),
          nullif(trim(p_proveedor), ''), nullif(trim(p_factura), ''), nullif(trim(p_nota), ''))
  returning * into v_compra;
  return v_compra;
end $$;

-- registrar_ingreso con compra: misma función, más p_compra_id; la compra acumula total y unidades
drop function public.registrar_ingreso(integer, numeric, numeric, uuid, text, text, text, text, text, text);
create function public.registrar_ingreso(
  p_cantidad integer,
  p_costo numeric,
  p_precio numeric,
  p_producto_id uuid default null,
  p_nombre text default null,
  p_categoria text default null,
  p_talla text default null,
  p_color text default null,
  p_foto_path text default null,
  p_nota text default null,
  p_compra_id uuid default null
) returns public.ingresos
language plpgsql security definer set search_path = public as $$
declare
  v_producto public.productos;
  v_ingreso public.ingresos;
begin
  perform public.exigir_equipo();
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
  if p_costo is null or p_costo < 0 then raise exception 'Revise el precio de costo'; end if;
  if p_precio is null or p_precio < 0 then raise exception 'Revise el precio de venta'; end if;
  if p_compra_id is not null and not exists (select 1 from public.compras where id = p_compra_id) then
    raise exception 'La compra no existe';
  end if;

  if p_producto_id is null then
    if coalesce(trim(p_nombre), '') = '' then raise exception 'Escriba el nombre del producto'; end if;
    insert into public.productos (nombre, categoria, talla, color, foto_path, precio_venta, costo, existencias)
    values (trim(p_nombre), nullif(trim(p_categoria), ''), nullif(trim(p_talla), ''), nullif(trim(p_color), ''),
            p_foto_path, p_precio, p_costo, p_cantidad)
    returning * into v_producto;
  else
    update public.productos
       set existencias = existencias + p_cantidad,
           precio_venta = p_precio,
           costo = p_costo,
           foto_path = coalesce(p_foto_path, foto_path),
           activo = true
     where id = p_producto_id
    returning * into v_producto;
    if not found then raise exception 'El producto ya no existe'; end if;
  end if;

  insert into public.ingresos (serie, producto_id, cantidad, costo_unitario, precio_venta, nota, compra_id)
  values ('MS-' || lpad(nextval('public.ingreso_serie_seq')::text, 5, '0'), v_producto.id, p_cantidad, p_costo, p_precio,
          nullif(trim(p_nota), ''), p_compra_id)
  returning * into v_ingreso;

  insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, ingreso_id, nota)
  values (v_producto.id, 'entrada', 'ingreso', p_cantidad, v_producto.existencias, p_costo, v_ingreso.serie, v_ingreso.id, v_ingreso.nota);

  if p_compra_id is not null then
    update public.compras
       set total = total + p_cantidad * p_costo, unidades = unidades + p_cantidad
     where id = p_compra_id;
  end if;

  return v_ingreso;
end $$;

-- Permisos: el equipo lee compras y corrige proveedor, factura o nota; total y unidades solo cambian con los ingresos
alter table public.compras enable row level security;
revoke all on table public.compras from anon, authenticated;
revoke all on sequence public.compra_numero_seq from anon, authenticated;
grant select on table public.compras to authenticated;
grant update (proveedor, factura, nota) on public.compras to authenticated;
create policy "equipo lee" on public.compras for select to authenticated using ((select public.es_equipo()));
create policy "equipo actualiza" on public.compras for update to authenticated
  using ((select public.es_equipo())) with check ((select public.es_equipo()));

revoke execute on function public.crear_compra(text, text, text),
  public.registrar_ingreso(integer, numeric, numeric, uuid, text, text, text, text, text, text, uuid) from public, anon;
grant execute on function public.crear_compra(text, text, text),
  public.registrar_ingreso(integer, numeric, numeric, uuid, text, text, text, text, text, text, uuid) to authenticated;
