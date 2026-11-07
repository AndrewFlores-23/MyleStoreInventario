-- Facturación y gastos. Los apartados dejan de llevar factura y pago: solo guardan el pedido con las prendas
-- apartadas. La factura de contado (FC-0001) se hace en Facturación, directo o a partir de un apartado.
-- Los gastos del negocio (GA-0001) son salidas de dinero que no son mercadería: cinta, gasolina, bolsas…

-- ---------- Facturas de contado ----------
create sequence public.factura_numero_seq;
create table public.facturas (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  token uuid not null unique default gen_random_uuid(),
  apartado_id uuid references public.apartados(id),
  cliente_nombre text not null check (length(trim(cliente_nombre)) > 0),
  cliente_telefono text,
  cliente_direccion text,
  notas text,
  subtotal numeric(12,2) not null default 0,
  envio numeric(12,2) not null default 0 check (envio >= 0),
  descuento numeric(12,2) not null default 0 check (descuento >= 0),
  total numeric(12,2) generated always as (subtotal + envio - descuento) stored,
  forma_pago text,
  referencia_pago text,
  estado text not null default 'emitida' check (estado in ('emitida', 'anulada')),
  anulada_en timestamptz,
  motivo_anulacion text,
  creado_en timestamptz not null default now(),
  creado_por text default (auth.jwt() ->> 'email')
);
create index facturas_fecha_idx on public.facturas (creado_en desc);
create index facturas_apartado_idx on public.facturas (apartado_id);

create table public.factura_articulos (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  nombre text not null,
  talla text,
  color text,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  costo_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) generated always as (cantidad * precio_unitario) stored
);
create index factura_articulos_factura_idx on public.factura_articulos (factura_id);
create index factura_articulos_producto_idx on public.factura_articulos (producto_id);

-- El apartado ya no lleva pago; su estado es pendiente, facturado o anulado
alter table public.apartados drop constraint apartados_estado_check;
update public.apartados set estado = 'facturado' where estado = 'entregado';
alter table public.apartados add constraint apartados_estado_check check (estado in ('pendiente', 'facturado', 'anulado'));
alter table public.apartados add column factura_id uuid references public.facturas(id);
alter table public.apartados add column facturado_en timestamptz;

-- Los movimientos distinguen la venta por factura
alter table public.movimientos drop constraint movimientos_motivo_check;
alter table public.movimientos add constraint movimientos_motivo_check
  check (motivo in ('ingreso', 'anulacion', 'apartado', 'venta', 'factura', 'danado', 'devolucion', 'regalo', 'ajuste'));
alter table public.movimientos add column factura_id uuid references public.facturas(id);
create index movimientos_factura_idx on public.movimientos (factura_id);

-- ---------- Gastos del negocio ----------
create sequence public.gasto_numero_seq;
create table public.gastos (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  fecha date not null default (now() at time zone 'America/Costa_Rica')::date,
  categoria text not null default 'otro' check (categoria in ('empaque', 'transporte', 'envios', 'publicidad', 'servicios', 'otro')),
  descripcion text not null check (length(trim(descripcion)) > 0),
  monto numeric(12,2) not null check (monto > 0),
  pagado_con text,
  nota text,
  creado_en timestamptz not null default now(),
  creado_por text default (auth.jwt() ->> 'email')
);
create index gastos_fecha_idx on public.gastos (fecha desc);

create function public.crear_gasto(
  p_descripcion text,
  p_monto numeric,
  p_categoria text default 'otro',
  p_fecha date default null,
  p_pagado_con text default null,
  p_nota text default null
) returns public.gastos
language plpgsql security definer set search_path = public as $$
declare
  v_gasto public.gastos;
begin
  perform public.exigir_equipo();
  if coalesce(trim(p_descripcion), '') = '' then raise exception 'Escriba en qué se gastó'; end if;
  if p_monto is null or p_monto <= 0 then raise exception 'Escriba el monto del gasto'; end if;
  insert into public.gastos (numero, fecha, categoria, descripcion, monto, pagado_con, nota)
  values ('GA-' || lpad(nextval('public.gasto_numero_seq')::text, 4, '0'),
          coalesce(p_fecha, (now() at time zone 'America/Costa_Rica')::date), coalesce(p_categoria, 'otro'),
          trim(p_descripcion), p_monto, nullif(trim(p_pagado_con), ''), nullif(trim(p_nota), ''))
  returning * into v_gasto;
  return v_gasto;
end $$;

-- ---------- Factura de contado ----------
-- Directo (p_apartado_id nulo): las prendas salen del inventario ahora.
-- Desde un apartado: sus prendas ya salieron al apartarse; se copian a la factura y el apartado queda facturado.
create function public.crear_factura(
  p_cliente_nombre text,
  p_articulos jsonb default null,
  p_apartado_id uuid default null,
  p_cliente_telefono text default null,
  p_cliente_direccion text default null,
  p_notas text default null,
  p_envio numeric default 0,
  p_descuento numeric default 0,
  p_forma_pago text default null,
  p_referencia_pago text default null
) returns public.facturas
language plpgsql security definer set search_path = public as $$
declare
  v_f public.facturas;
  v_ap public.apartados;
  v_art jsonb;
  v_fila record;
  v_producto public.productos;
  v_cantidad integer;
  v_precio numeric;
  v_subtotal numeric := 0;
  v_a public.apartado_articulos;
begin
  perform public.exigir_equipo();
  if coalesce(trim(p_cliente_nombre), '') = '' then raise exception 'Escriba el nombre del cliente'; end if;
  if coalesce(p_envio, 0) < 0 then raise exception 'Revise el monto del envío'; end if;
  if coalesce(p_descuento, 0) < 0 then raise exception 'Revise el descuento'; end if;

  if p_apartado_id is not null then
    select * into v_ap from public.apartados where id = p_apartado_id for update;
    if not found then raise exception 'El apartado no existe'; end if;
    if v_ap.estado <> 'pendiente' then raise exception 'Ese apartado ya está %', v_ap.estado; end if;
  else
    if p_articulos is null or jsonb_typeof(p_articulos) <> 'array' or jsonb_array_length(p_articulos) = 0 then
      raise exception 'Agregue al menos un artículo';
    end if;
    if exists (select 1 from jsonb_array_elements(p_articulos) e
                where coalesce((e ->> 'cantidad')::integer, 0) <= 0 or (e ->> 'precio_unitario')::numeric < 0) then
      raise exception 'Revise las cantidades y los precios';
    end if;
    for v_fila in
      select (e ->> 'producto_id')::uuid as producto_id, sum((e ->> 'cantidad')::integer) as cantidad
        from jsonb_array_elements(p_articulos) e group by 1
    loop
      select * into v_producto from public.productos where id = v_fila.producto_id for update;
      if not found then raise exception 'Uno de los artículos ya no existe'; end if;
      if v_producto.existencias < v_fila.cantidad then
        raise exception 'Solo quedan % de «%»%', v_producto.existencias, v_producto.nombre, coalesce(' talla ' || v_producto.talla, '');
      end if;
    end loop;
  end if;

  insert into public.facturas (numero, apartado_id, cliente_nombre, cliente_telefono, cliente_direccion, notas, envio, descuento, forma_pago, referencia_pago)
  values ('FC-' || lpad(nextval('public.factura_numero_seq')::text, 4, '0'), p_apartado_id, trim(p_cliente_nombre),
          nullif(trim(p_cliente_telefono), ''), nullif(trim(p_cliente_direccion), ''), nullif(trim(p_notas), ''),
          coalesce(p_envio, 0), coalesce(p_descuento, 0), nullif(trim(p_forma_pago), ''), nullif(trim(p_referencia_pago), ''))
  returning * into v_f;

  if p_apartado_id is not null then
    for v_a in select * from public.apartado_articulos where apartado_id = p_apartado_id loop
      insert into public.factura_articulos (factura_id, producto_id, nombre, talla, color, cantidad, precio_unitario, costo_unitario)
      values (v_f.id, v_a.producto_id, v_a.nombre, v_a.talla, v_a.color, v_a.cantidad, v_a.precio_unitario, v_a.costo_unitario);
      v_subtotal := v_subtotal + v_a.cantidad * v_a.precio_unitario;
    end loop;
    update public.apartados set estado = 'facturado', factura_id = v_f.id, facturado_en = now() where id = p_apartado_id;
    -- Las salidas del apartado quedan ligadas también a la factura
    update public.movimientos set factura_id = v_f.id where apartado_id = p_apartado_id and motivo = 'apartado';
  else
    for v_art in select * from jsonb_array_elements(p_articulos) loop
      v_cantidad := (v_art ->> 'cantidad')::integer;
      select * into v_producto from public.productos where id = (v_art ->> 'producto_id')::uuid;
      v_precio := coalesce((v_art ->> 'precio_unitario')::numeric, v_producto.precio_venta);
      update public.productos set existencias = existencias - v_cantidad where id = v_producto.id returning * into v_producto;
      insert into public.factura_articulos (factura_id, producto_id, nombre, talla, color, cantidad, precio_unitario, costo_unitario)
      values (v_f.id, v_producto.id, v_producto.nombre, v_producto.talla, v_producto.color, v_cantidad, v_precio, v_producto.costo);
      insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, factura_id)
      values (v_producto.id, 'salida', 'factura', v_cantidad, v_producto.existencias, v_precio, v_f.numero, v_f.id);
      v_subtotal := v_subtotal + v_cantidad * v_precio;
    end loop;
  end if;

  update public.facturas set subtotal = v_subtotal where id = v_f.id returning * into v_f;
  return v_f;
end $$;

-- Anular una factura: las prendas vuelven al inventario; si venía de un apartado, el apartado queda anulado también
create function public.anular_factura(p_factura_id uuid, p_motivo text default null)
returns public.facturas
language plpgsql security definer set search_path = public as $$
declare
  v_f public.facturas;
  v_a public.factura_articulos;
  v_existencias integer;
begin
  perform public.exigir_equipo();
  select * into v_f from public.facturas where id = p_factura_id for update;
  if not found then raise exception 'La factura no existe'; end if;
  if v_f.estado = 'anulada' then raise exception 'La factura ya estaba anulada'; end if;
  for v_a in select * from public.factura_articulos where factura_id = p_factura_id loop
    update public.productos set existencias = existencias + v_a.cantidad, activo = true where id = v_a.producto_id
    returning existencias into v_existencias;
    insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, factura_id, nota)
    values (v_a.producto_id, 'entrada', 'anulacion', v_a.cantidad, v_existencias, v_a.precio_unitario, v_f.numero, v_f.id, nullif(trim(p_motivo), ''));
  end loop;
  if v_f.apartado_id is not null then
    update public.apartados set estado = 'anulado', anulado_en = now(), motivo_anulacion = coalesce(nullif(trim(p_motivo), ''), 'Factura anulada') where id = v_f.apartado_id;
  end if;
  update public.facturas set estado = 'anulada', anulada_en = now(), motivo_anulacion = nullif(trim(p_motivo), '') where id = p_factura_id
  returning * into v_f;
  return v_f;
end $$;

-- La factura pública que abre el cliente (sin costos ni notas internas)
create function public.factura_contado_publica(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tienda', (select jsonb_build_object(
                 'nombre_tienda', a.nombre_tienda, 'whatsapp', a.whatsapp, 'instagram', a.instagram,
                 'sinpe_movil', a.sinpe_movil, 'sinpe_a_nombre', a.sinpe_a_nombre, 'banco', a.banco,
                 'cuenta_iban', a.cuenta_iban, 'titular_cuenta', a.titular_cuenta, 'cedula_titular', a.cedula_titular,
                 'nota_factura', a.nota_factura, 'moneda', a.moneda)
               from public.ajustes a where a.id = 1),
    'factura', jsonb_build_object(
                 'numero', f.numero, 'cliente_nombre', f.cliente_nombre, 'cliente_telefono', f.cliente_telefono,
                 'cliente_direccion', f.cliente_direccion, 'subtotal', f.subtotal, 'envio', f.envio, 'descuento', f.descuento,
                 'total', f.total, 'forma_pago', f.forma_pago, 'estado', f.estado, 'creado_en', f.creado_en),
    'articulos', coalesce((select jsonb_agg(jsonb_build_object(
                 'nombre', x.nombre, 'talla', x.talla, 'color', x.color,
                 'cantidad', x.cantidad, 'precio_unitario', x.precio_unitario, 'subtotal', x.subtotal) order by x.nombre, x.talla)
               from public.factura_articulos x where x.factura_id = f.id), '[]'::jsonb))
  from public.facturas f
  where f.token = p_token;
$$;

-- Ya no se usan: el pago y la entrega eran de la factura del apartado
drop function public.marcar_pago(uuid, boolean, text);
drop function public.marcar_entrega(uuid, boolean);
drop function public.factura_publica(uuid);

-- ---------- Permisos ----------
alter table public.facturas enable row level security;
alter table public.factura_articulos enable row level security;
alter table public.gastos enable row level security;
revoke all on table public.facturas, public.factura_articulos, public.gastos from anon, authenticated;
revoke all on sequence public.factura_numero_seq, public.gasto_numero_seq from anon, authenticated;
grant select on table public.facturas, public.factura_articulos, public.gastos to authenticated;
grant update (cliente_nombre, cliente_telefono, cliente_direccion, notas, forma_pago, referencia_pago) on public.facturas to authenticated;
grant update (fecha, categoria, descripcion, monto, pagado_con, nota) on public.gastos to authenticated;
grant delete on table public.gastos to authenticated;
create policy "equipo lee" on public.facturas for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.factura_articulos for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.gastos for select to authenticated using ((select public.es_equipo()));
create policy "equipo actualiza" on public.facturas for update to authenticated
  using ((select public.es_equipo())) with check ((select public.es_equipo()));
create policy "equipo actualiza" on public.gastos for update to authenticated
  using ((select public.es_equipo())) with check ((select public.es_equipo()));
create policy "equipo borra" on public.gastos for delete to authenticated using ((select public.es_equipo()));

revoke execute on function
  public.crear_gasto(text, numeric, text, date, text, text),
  public.crear_factura(text, jsonb, uuid, text, text, text, numeric, numeric, text, text),
  public.anular_factura(uuid, text),
  public.factura_contado_publica(uuid) from public, anon;
grant execute on function
  public.crear_gasto(text, numeric, text, date, text, text),
  public.crear_factura(text, jsonb, uuid, text, text, text, numeric, numeric, text, text),
  public.anular_factura(uuid, text) to authenticated;
grant execute on function public.factura_contado_publica(uuid) to anon, authenticated;
