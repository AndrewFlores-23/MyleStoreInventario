-- Myle Store · inventario, ingresos, salidas y apartados con factura
-- Las existencias solo cambian con las funciones de este archivo: cada una deja su movimiento, así el inventario
-- siempre cuadra con el historial. La app entra con la llave publicable y solo los correos de la tabla equipo
-- pueden ver o cambiar datos. La factura pública se lee con su token, sin iniciar sesión.

-- ---------- Equipo de la tienda ----------
create table public.equipo (
  email text primary key check (email = lower(trim(email))),
  nombre text,
  creado_en timestamptz not null default now()
);

create function public.es_equipo() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.equipo where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

create function public.exigir_equipo() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.es_equipo() then
    raise exception 'Su cuenta no tiene acceso a la tienda' using errcode = '42501';
  end if;
end $$;

create function public.marcar_actualizado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado_en := now();
  return new;
end $$;

-- ---------- Ajustes: datos de la tienda y del depósito que salen en la factura ----------
create table public.ajustes (
  id smallint primary key default 1 check (id = 1),
  nombre_tienda text not null default 'Myle Store',
  whatsapp text,
  instagram text,
  sinpe_movil text,
  sinpe_a_nombre text,
  banco text,
  cuenta_iban text,
  titular_cuenta text,
  cedula_titular text,
  nota_factura text default 'Envíe el comprobante por WhatsApp para confirmar su apartado.',
  moneda text not null default 'CRC' check (moneda in ('CRC', 'USD')),
  actualizado_en timestamptz not null default now()
);
insert into public.ajustes (id) values (1);
create trigger ajustes_actualizado before update on public.ajustes
  for each row execute function public.marcar_actualizado();

-- ---------- Productos: cada combinación de prenda, talla y color ----------
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  categoria text,
  talla text,
  color text,
  foto_path text,
  precio_venta numeric(12,2) not null default 0 check (precio_venta >= 0),
  costo numeric(12,2) not null default 0 check (costo >= 0),
  existencias integer not null default 0 check (existencias >= 0),
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create trigger productos_actualizado before update on public.productos
  for each row execute function public.marcar_actualizado();

-- ---------- Ingresos: cada entrada de mercadería lleva su número de serie único (MS-00001) ----------
create sequence public.ingreso_serie_seq;
create table public.ingresos (
  id uuid primary key default gen_random_uuid(),
  serie text not null unique,
  producto_id uuid not null references public.productos(id),
  cantidad integer not null check (cantidad > 0),
  costo_unitario numeric(12,2) not null check (costo_unitario >= 0),
  precio_venta numeric(12,2) not null check (precio_venta >= 0),
  nota text,
  creado_en timestamptz not null default now(),
  creado_por text default (auth.jwt() ->> 'email')
);
create index ingresos_producto_idx on public.ingresos (producto_id);
create index ingresos_fecha_idx on public.ingresos (creado_en desc);

-- ---------- Apartados: pedido armado para un cliente, con su factura (AP-0001) ----------
create sequence public.apartado_numero_seq;
create table public.apartados (
  id uuid primary key default gen_random_uuid(),
  numero text not null unique,
  token uuid not null unique default gen_random_uuid(),
  cliente_nombre text not null check (length(trim(cliente_nombre)) > 0),
  cliente_telefono text,
  cliente_direccion text,
  notas text,
  subtotal numeric(12,2) not null default 0,
  envio numeric(12,2) not null default 0 check (envio >= 0),
  total numeric(12,2) generated always as (subtotal + envio) stored,
  pagado boolean not null default false,
  pagado_en timestamptz,
  referencia_pago text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'entregado', 'anulado')),
  entregado_en timestamptz,
  anulado_en timestamptz,
  motivo_anulacion text,
  creado_en timestamptz not null default now(),
  creado_por text default (auth.jwt() ->> 'email')
);
create index apartados_fecha_idx on public.apartados (creado_en desc);

create table public.apartado_articulos (
  id uuid primary key default gen_random_uuid(),
  apartado_id uuid not null references public.apartados(id) on delete cascade,
  producto_id uuid not null references public.productos(id),
  nombre text not null,
  talla text,
  color text,
  foto_path text,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  costo_unitario numeric(12,2) not null default 0,
  subtotal numeric(12,2) generated always as (cantidad * precio_unitario) stored
);
create index apartado_articulos_apartado_idx on public.apartado_articulos (apartado_id);
create index apartado_articulos_producto_idx on public.apartado_articulos (producto_id);

-- ---------- Movimientos: todo lo que entra y sale del inventario ----------
create table public.movimientos (
  id bigint generated always as identity primary key,
  producto_id uuid not null references public.productos(id),
  tipo text not null check (tipo in ('entrada', 'salida')),
  motivo text not null check (motivo in ('ingreso', 'anulacion', 'apartado', 'venta', 'danado', 'devolucion', 'regalo', 'ajuste')),
  cantidad integer not null check (cantidad > 0),
  existencias_despues integer not null,
  precio_unitario numeric(12,2),
  referencia text,
  ingreso_id uuid references public.ingresos(id),
  apartado_id uuid references public.apartados(id),
  nota text,
  creado_en timestamptz not null default now(),
  creado_por text default (auth.jwt() ->> 'email')
);
create index movimientos_producto_idx on public.movimientos (producto_id, creado_en desc);
create index movimientos_fecha_idx on public.movimientos (creado_en desc);
create index movimientos_ingreso_idx on public.movimientos (ingreso_id);
create index movimientos_apartado_idx on public.movimientos (apartado_id);

-- ---------- Funciones de la app ----------

-- Ingreso: producto nuevo (sin p_producto_id) o reposición de uno que ya existe
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
  p_nota text default null
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

  insert into public.ingresos (serie, producto_id, cantidad, costo_unitario, precio_venta, nota)
  values ('MS-' || lpad(nextval('public.ingreso_serie_seq')::text, 5, '0'), v_producto.id, p_cantidad, p_costo, p_precio,
          nullif(trim(p_nota), ''))
  returning * into v_ingreso;

  insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, ingreso_id, nota)
  values (v_producto.id, 'entrada', 'ingreso', p_cantidad, v_producto.existencias, p_costo, v_ingreso.serie, v_ingreso.id, v_ingreso.nota);

  return v_ingreso;
end $$;

-- Salida suelta: venta directa, prenda dañada, devolución al proveedor, regalo o corrección del conteo
create function public.registrar_salida(
  p_producto_id uuid,
  p_cantidad integer,
  p_motivo text,
  p_precio numeric default null,
  p_nota text default null
) returns public.movimientos
language plpgsql security definer set search_path = public as $$
declare
  v_producto public.productos;
  v_mov public.movimientos;
begin
  perform public.exigir_equipo();
  if p_motivo not in ('venta', 'danado', 'devolucion', 'regalo', 'ajuste') then raise exception 'Elija el motivo de la salida'; end if;
  if p_cantidad is null or p_cantidad <= 0 then raise exception 'La cantidad debe ser mayor que cero'; end if;
  if p_precio is not null and p_precio < 0 then raise exception 'Revise el precio'; end if;

  select * into v_producto from public.productos where id = p_producto_id for update;
  if not found then raise exception 'El producto ya no existe'; end if;
  if v_producto.existencias < p_cantidad then
    raise exception 'Solo quedan % de «%»', v_producto.existencias, v_producto.nombre;
  end if;

  update public.productos set existencias = existencias - p_cantidad where id = p_producto_id
  returning * into v_producto;

  insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, nota)
  values (p_producto_id, 'salida', p_motivo, p_cantidad, v_producto.existencias,
          case when p_motivo = 'venta' then coalesce(p_precio, v_producto.precio_venta) end, nullif(trim(p_nota), ''))
  returning * into v_mov;
  return v_mov;
end $$;

-- Apartado: aparta los artículos (salen del inventario disponible) y deja lista la factura
-- p_articulos: [{"producto_id": "...", "cantidad": 2, "precio_unitario": 12500}]; el precio es opcional
create function public.crear_apartado(
  p_cliente_nombre text,
  p_articulos jsonb,
  p_cliente_telefono text default null,
  p_cliente_direccion text default null,
  p_notas text default null,
  p_envio numeric default 0
) returns public.apartados
language plpgsql security definer set search_path = public as $$
declare
  v_ap public.apartados;
  v_art jsonb;
  v_fila record;
  v_producto public.productos;
  v_cantidad integer;
  v_precio numeric;
  v_subtotal numeric := 0;
begin
  perform public.exigir_equipo();
  if coalesce(trim(p_cliente_nombre), '') = '' then raise exception 'Escriba el nombre del cliente'; end if;
  if p_articulos is null or jsonb_typeof(p_articulos) <> 'array' or jsonb_array_length(p_articulos) = 0 then
    raise exception 'Agregue al menos un artículo';
  end if;
  if coalesce(p_envio, 0) < 0 then raise exception 'Revise el monto del envío'; end if;
  if exists (select 1 from jsonb_array_elements(p_articulos) e
              where coalesce((e ->> 'cantidad')::integer, 0) <= 0 or (e ->> 'precio_unitario')::numeric < 0) then
    raise exception 'Revise las cantidades y los precios del apartado';
  end if;

  -- Primero se revisan las existencias: un apartado que no procede no gasta número de factura
  for v_fila in
    select (e ->> 'producto_id')::uuid as producto_id, sum((e ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(p_articulos) e group by 1
  loop
    select * into v_producto from public.productos where id = v_fila.producto_id for update;
    if not found then raise exception 'Uno de los artículos ya no existe'; end if;
    if v_producto.existencias < v_fila.cantidad then
      raise exception 'Solo quedan % de «%»%', v_producto.existencias, v_producto.nombre,
        coalesce(' talla ' || v_producto.talla, '');
    end if;
  end loop;

  insert into public.apartados (numero, cliente_nombre, cliente_telefono, cliente_direccion, notas, envio)
  values ('AP-' || lpad(nextval('public.apartado_numero_seq')::text, 4, '0'), trim(p_cliente_nombre),
          nullif(trim(p_cliente_telefono), ''), nullif(trim(p_cliente_direccion), ''), nullif(trim(p_notas), ''),
          coalesce(p_envio, 0))
  returning * into v_ap;

  for v_art in select * from jsonb_array_elements(p_articulos) loop
    v_cantidad := (v_art ->> 'cantidad')::integer;
    select * into v_producto from public.productos where id = (v_art ->> 'producto_id')::uuid;
    v_precio := coalesce((v_art ->> 'precio_unitario')::numeric, v_producto.precio_venta);

    update public.productos set existencias = existencias - v_cantidad where id = v_producto.id
    returning * into v_producto;

    insert into public.apartado_articulos (apartado_id, producto_id, nombre, talla, color, foto_path, cantidad, precio_unitario, costo_unitario)
    values (v_ap.id, v_producto.id, v_producto.nombre, v_producto.talla, v_producto.color, v_producto.foto_path,
            v_cantidad, v_precio, v_producto.costo);

    insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, apartado_id)
    values (v_producto.id, 'salida', 'apartado', v_cantidad, v_producto.existencias, v_precio, v_ap.numero, v_ap.id);

    v_subtotal := v_subtotal + v_cantidad * v_precio;
  end loop;

  update public.apartados set subtotal = v_subtotal where id = v_ap.id returning * into v_ap;
  return v_ap;
end $$;

-- Pago del apartado (en Costa Rica, "cancelado" = pagado)
create function public.marcar_pago(p_apartado_id uuid, p_pagado boolean, p_referencia text default null)
returns public.apartados
language plpgsql security definer set search_path = public as $$
declare
  v_ap public.apartados;
begin
  perform public.exigir_equipo();
  select * into v_ap from public.apartados where id = p_apartado_id for update;
  if not found then raise exception 'El apartado no existe'; end if;
  if v_ap.estado = 'anulado' then raise exception 'El apartado está anulado'; end if;

  update public.apartados
     set pagado = p_pagado,
         pagado_en = case when p_pagado then coalesce(pagado_en, now()) end,
         referencia_pago = case when p_pagado then nullif(trim(p_referencia), '') end
   where id = p_apartado_id
  returning * into v_ap;
  return v_ap;
end $$;

-- Entrega: las prendas ya salieron del inventario al apartarse; aquí solo cambia el estado
create function public.marcar_entrega(p_apartado_id uuid, p_entregado boolean)
returns public.apartados
language plpgsql security definer set search_path = public as $$
declare
  v_ap public.apartados;
begin
  perform public.exigir_equipo();
  select * into v_ap from public.apartados where id = p_apartado_id for update;
  if not found then raise exception 'El apartado no existe'; end if;
  if v_ap.estado = 'anulado' then raise exception 'El apartado está anulado'; end if;

  update public.apartados
     set estado = case when p_entregado then 'entregado' else 'pendiente' end,
         entregado_en = case when p_entregado then coalesce(entregado_en, now()) end
   where id = p_apartado_id
  returning * into v_ap;
  return v_ap;
end $$;

-- Anular: el cliente no siguió; las prendas vuelven al inventario
create function public.anular_apartado(p_apartado_id uuid, p_motivo text default null)
returns public.apartados
language plpgsql security definer set search_path = public as $$
declare
  v_ap public.apartados;
  v_art public.apartado_articulos;
  v_existencias integer;
begin
  perform public.exigir_equipo();
  select * into v_ap from public.apartados where id = p_apartado_id for update;
  if not found then raise exception 'El apartado no existe'; end if;
  if v_ap.estado = 'anulado' then raise exception 'El apartado ya estaba anulado'; end if;
  if v_ap.estado = 'entregado' then raise exception 'El apartado ya se entregó; si le devolvieron algo, regístrelo como ingreso'; end if;

  for v_art in select * from public.apartado_articulos where apartado_id = p_apartado_id loop
    update public.productos set existencias = existencias + v_art.cantidad, activo = true where id = v_art.producto_id
    returning existencias into v_existencias;
    insert into public.movimientos (producto_id, tipo, motivo, cantidad, existencias_despues, precio_unitario, referencia, apartado_id, nota)
    values (v_art.producto_id, 'entrada', 'anulacion', v_art.cantidad, v_existencias, v_art.precio_unitario, v_ap.numero, v_ap.id,
            nullif(trim(p_motivo), ''));
  end loop;

  update public.apartados
     set estado = 'anulado', anulado_en = now(), motivo_anulacion = nullif(trim(p_motivo), '')
   where id = p_apartado_id
  returning * into v_ap;
  return v_ap;
end $$;

-- Factura pública: se abre con el enlace que le llega al cliente por WhatsApp (sin costos ni notas internas)
create function public.factura_publica(p_token uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'tienda', (select jsonb_build_object(
                 'nombre_tienda', a.nombre_tienda, 'whatsapp', a.whatsapp, 'instagram', a.instagram,
                 'sinpe_movil', a.sinpe_movil, 'sinpe_a_nombre', a.sinpe_a_nombre, 'banco', a.banco,
                 'cuenta_iban', a.cuenta_iban, 'titular_cuenta', a.titular_cuenta, 'cedula_titular', a.cedula_titular,
                 'nota_factura', a.nota_factura, 'moneda', a.moneda)
               from public.ajustes a where a.id = 1),
    'apartado', jsonb_build_object(
                 'numero', ap.numero, 'cliente_nombre', ap.cliente_nombre, 'cliente_telefono', ap.cliente_telefono,
                 'cliente_direccion', ap.cliente_direccion, 'subtotal', ap.subtotal, 'envio', ap.envio, 'total', ap.total,
                 'pagado', ap.pagado, 'pagado_en', ap.pagado_en, 'estado', ap.estado, 'entregado_en', ap.entregado_en,
                 'creado_en', ap.creado_en),
    'articulos', coalesce((select jsonb_agg(jsonb_build_object(
                 'nombre', x.nombre, 'talla', x.talla, 'color', x.color, 'foto_path', x.foto_path,
                 'cantidad', x.cantidad, 'precio_unitario', x.precio_unitario, 'subtotal', x.subtotal) order by x.nombre, x.talla)
               from public.apartado_articulos x where x.apartado_id = ap.id), '[]'::jsonb))
  from public.apartados ap
  where ap.token = p_token;
$$;

-- ---------- Permisos ----------
-- Se lee todo; solo se cambian a mano los datos que no tocan existencias ni historial.
alter table public.equipo enable row level security;
alter table public.ajustes enable row level security;
alter table public.productos enable row level security;
alter table public.ingresos enable row level security;
alter table public.apartados enable row level security;
alter table public.apartado_articulos enable row level security;
alter table public.movimientos enable row level security;

revoke all on table public.equipo, public.ajustes, public.productos, public.ingresos, public.apartados,
  public.apartado_articulos, public.movimientos from anon, authenticated;
revoke all on sequence public.ingreso_serie_seq, public.apartado_numero_seq, public.movimientos_id_seq from anon, authenticated;

grant select on table public.equipo, public.ajustes, public.productos, public.ingresos, public.apartados,
  public.apartado_articulos, public.movimientos to authenticated;
grant update (nombre_tienda, whatsapp, instagram, sinpe_movil, sinpe_a_nombre, banco, cuenta_iban, titular_cuenta,
  cedula_titular, nota_factura, moneda) on public.ajustes to authenticated;
grant update (nombre, categoria, talla, color, foto_path, precio_venta, costo, activo) on public.productos to authenticated;
grant update (cliente_nombre, cliente_telefono, cliente_direccion, notas, envio) on public.apartados to authenticated;

create policy "equipo lee" on public.equipo for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.ajustes for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.productos for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.ingresos for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.apartados for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.apartado_articulos for select to authenticated using ((select public.es_equipo()));
create policy "equipo lee" on public.movimientos for select to authenticated using ((select public.es_equipo()));
create policy "equipo actualiza" on public.ajustes for update to authenticated
  using ((select public.es_equipo())) with check ((select public.es_equipo()));
create policy "equipo actualiza" on public.productos for update to authenticated
  using ((select public.es_equipo())) with check ((select public.es_equipo()));
create policy "equipo actualiza" on public.apartados for update to authenticated
  using ((select public.es_equipo())) with check ((select public.es_equipo()));

revoke execute on function public.es_equipo(), public.exigir_equipo(), public.marcar_actualizado(),
  public.registrar_ingreso(integer, numeric, numeric, uuid, text, text, text, text, text, text),
  public.registrar_salida(uuid, integer, text, numeric, text),
  public.crear_apartado(text, jsonb, text, text, text, numeric),
  public.marcar_pago(uuid, boolean, text),
  public.marcar_entrega(uuid, boolean),
  public.anular_apartado(uuid, text),
  public.factura_publica(uuid) from public, anon;
grant execute on function public.es_equipo(),
  public.registrar_ingreso(integer, numeric, numeric, uuid, text, text, text, text, text, text),
  public.registrar_salida(uuid, integer, text, numeric, text),
  public.crear_apartado(text, jsonb, text, text, text, numeric),
  public.marcar_pago(uuid, boolean, text),
  public.marcar_entrega(uuid, boolean),
  public.anular_apartado(uuid, text) to authenticated;
grant execute on function public.factura_publica(uuid) to anon, authenticated;

-- ---------- Fotos de los productos ----------
-- Carpeta pública para que la foto salga en la factura del cliente; solo el equipo sube, cambia o borra.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "equipo ve fotos" on storage.objects for select to authenticated
  using (bucket_id = 'productos' and (select public.es_equipo()));
create policy "equipo sube fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and (select public.es_equipo()));
create policy "equipo cambia fotos" on storage.objects for update to authenticated
  using (bucket_id = 'productos' and (select public.es_equipo()));
create policy "equipo borra fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and (select public.es_equipo()));

-- Para dar acceso, agregue el correo con el que la dueña entra (Authentication → Users):
-- insert into public.equipo (email, nombre) values ('correo@ejemplo.com', 'Nombre');
