// Conexión con Supabase. La llave publicable (sb_publishable_… o anon) es pública: los datos los protegen los
// permisos de la base y la tabla equipo. Nunca ponga aquí la llave secreta (service_role).
// Sin SUPABASE_URL la app abre en modo demo; en la compu (localhost) también se ve la demo agregando ?demo a la dirección.
export const SUPABASE_URL = "https://ugbrooifrjpogmtzcjqv.supabase.co";
export const SUPABASE_KEY = "sb_publishable_8SGUaM4n6didx5bb_arJ9g_ajeZBZLO";
export const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm";
