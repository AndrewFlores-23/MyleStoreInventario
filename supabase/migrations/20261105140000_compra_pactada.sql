-- La compra se registra primero, con lo que se pactó con el proveedor: cuántas prendas y cuánto se pagó.
-- Después se van registrando las prendas en el inventario (ingresos de esa compra) hasta completarla.
-- total y unidades siguen siendo lo ya registrado; prendas_pedidas y monto_pagado son lo pactado.
alter table public.compras
  add column prendas_pedidas integer not null default 0 check (prendas_pedidas >= 0),
  add column monto_pagado numeric(12,2) not null default 0 check (monto_pagado >= 0),
  add column fecha_compra date not null default (now() at time zone 'America/Costa_Rica')::date;

drop function public.crear_compra(text, text, text);
create function public.crear_compra(
  p_proveedor text default null,
  p_factura text default null,
  p_nota text default null,
  p_prendas_pedidas integer default 0,
  p_monto_pagado numeric default 0,
  p_fecha_compra date default null
) returns public.compras
language plpgsql security definer set search_path = public as $$
declare
  v_compra public.compras;
begin
  perform public.exigir_equipo();
  if coalesce(p_prendas_pedidas, 0) < 0 then raise exception 'Revise la cantidad de prendas'; end if;
  if coalesce(p_monto_pagado, 0) < 0 then raise exception 'Revise el monto pagado'; end if;
  insert into public.compras (numero, proveedor, factura, nota, prendas_pedidas, monto_pagado, fecha_compra)
  values ('CO-' || lpad(nextval('public.compra_numero_seq')::text, 4, '0'),
          nullif(trim(p_proveedor), ''), nullif(trim(p_factura), ''), nullif(trim(p_nota), ''),
          coalesce(p_prendas_pedidas, 0), coalesce(p_monto_pagado, 0),
          coalesce(p_fecha_compra, (now() at time zone 'America/Costa_Rica')::date))
  returning * into v_compra;
  return v_compra;
end $$;

-- Lo pactado se puede corregir a mano; total y unidades siguen cambiando solo con los ingresos
grant update (prendas_pedidas, monto_pagado, fecha_compra) on public.compras to authenticated;

revoke execute on function public.crear_compra(text, text, text, integer, numeric, date) from public, anon;
grant execute on function public.crear_compra(text, text, text, integer, numeric, date) to authenticated;
