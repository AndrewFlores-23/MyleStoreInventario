-- exigir_equipo solo la usan las funciones de la app por dentro; nadie necesita llamarla desde la API
revoke execute on function public.exigir_equipo() from authenticated;
