-- Proveedores: a quién le compra la tienda. Se registran en Ajustes y se eligen al crear una compra.
create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  telefono text,
  correo text,
  direccion text,
  nota text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create unique index proveedores_nombre_idx on public.proveedores (lower(nombre));
create trigger proveedores_actualizado before update on public.proveedores
  for each row execute function public.marcar_actualizado();

-- La compra apunta al proveedor registrado; el nombre se copia para que la compra conserve con quién fue
alter table public.compras add column proveedor_id uuid references public.proveedores(id);
create index compras_proveedor_idx on public.compras (proveedor_id);

drop function public.crear_compra(text, text, text, integer, numeric, date);
create function public.crear_compra(
  p_proveedor text default null,
  p_factura text default null,
  p_nota text default null,
  p_prendas_pedidas integer default 0,
  p_monto_pagado numeric default 0,
  p_fecha_compra date default null,
  p_proveedor_id uuid default null
) returns public.compras
language plpgsql security definer set search_path = public as $$
declare
  v_compra public.compras;
  v_nombre text := nullif(trim(p_proveedor), '');
begin
  perform public.exigir_equipo();
  if coalesce(p_prendas_pedidas, 0) < 0 then raise exception 'Revise la cantidad de prendas'; end if;
  if coalesce(p_monto_pagado, 0) < 0 then raise exception 'Revise el monto pagado'; end if;
  if p_proveedor_id is not null then
    select nombre into v_nombre from public.proveedores where id = p_proveedor_id;
    if not found then raise exception 'El proveedor no existe'; end if;
  end if;
  insert into public.compras (numero, proveedor, proveedor_id, factura, nota, prendas_pedidas, monto_pagado, fecha_compra)
  values ('CO-' || lpad(nextval('public.compra_numero_seq')::text, 4, '0'),
          v_nombre, p_proveedor_id, nullif(trim(p_factura), ''), nullif(trim(p_nota), ''),
          coalesce(p_prendas_pedidas, 0), coalesce(p_monto_pagado, 0),
          coalesce(p_fecha_compra, (now() at time zone 'America/Costa_Rica')::date))
  returning * into v_compra;
  return v_compra;
end $$;

-- Permisos: el equipo registra, edita y lee proveedores
alter table public.proveedores enable row level security;
revoke all on table public.proveedores from anon, authenticated;
grant select, insert, update on table public.proveedores to authenticated;
grant update (proveedor_id) on public.compras to authenticated;
create policy "equipo lee" on public.proveedores for select to authenticated using ((select public.es_equipo()));
create policy "equipo agrega" on public.proveedores for insert to authenticated with check ((select public.es_equipo()));
create policy "equipo actualiza" on public.proveedores for update to authenticated
  using ((select public.es_equipo())) with check ((select public.es_equipo()));

revoke execute on function public.crear_compra(text, text, text, integer, numeric, date, uuid) from public, anon;
grant execute on function public.crear_compra(text, text, text, integer, numeric, date, uuid) to authenticated;
