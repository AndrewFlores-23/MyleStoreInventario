// Acceso a los datos: Supabase de verdad o el modo demo (mismas funciones, datos guardados en este navegador)
import { SUPABASE_URL, SUPABASE_KEY, SUPABASE_JS } from "./config.js";

const parametros = new URLSearchParams(location.search);
const esLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
export const DEMO = !SUPABASE_URL || (esLocal && parametros.has("demo"));

export let datos = null;

export async function iniciarDatos() {
  datos = DEMO ? (await import("./demo.js")).datosDemo : await crearReal();
  return datos;
}

const LISTA_APARTADOS = "*, articulos:apartado_articulos(*)";
const LISTA_MOVIMIENTOS = "*, producto:productos(id, nombre, talla, color, foto_path), apartado:apartados(id, numero, estado, cliente_nombre)";

async function crearReal() {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" },
  });
  const fotos = sb.storage.from("productos");
  const respuesta = ({ data, error }) => {
    if (error) throw error;
    return data;
  };
  const rpc = async (nombre, args) => respuesta(await sb.rpc(nombre, args));

  return {
    // ---------- Sesión ----------
    async usuario() {
      const { data } = await sb.auth.getSession();
      return data.session?.user || null;
    },
    alCambiarSesion(fn) {
      sb.auth.onAuthStateChange((evento, sesion) => fn(evento, sesion?.user || null));
    },
    async entrar(email, clave) {
      respuesta(await sb.auth.signInWithPassword({ email, password: clave }));
    },
    async salir() {
      await sb.auth.signOut();
    },
    async recuperar(email) {
      respuesta(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname }));
    },
    async nuevaClave(clave) {
      respuesta(await sb.auth.updateUser({ password: clave }));
    },
    esEquipo: () => rpc("es_equipo"),

    // ---------- Ajustes ----------
    async ajustes() {
      return respuesta(await sb.from("ajustes").select("*").eq("id", 1).single());
    },
    async guardarAjustes(cambios) {
      return respuesta(await sb.from("ajustes").update(cambios).eq("id", 1).select().single());
    },

    // ---------- Productos y fotos ----------
    async productos() {
      return respuesta(await sb.from("productos").select("*").order("nombre").order("talla"));
    },
    async guardarProducto(id, cambios) {
      return respuesta(await sb.from("productos").update(cambios).eq("id", id).select().single());
    },
    async subirFoto(blob) {
      const ruta = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.jpg`;
      respuesta(await fotos.upload(ruta, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false }));
      return ruta;
    },
    urlFoto(ruta) {
      return ruta ? fotos.getPublicUrl(ruta).data.publicUrl : null;
    },

    // ---------- Ingresos y salidas ----------
    registrarIngreso(d) {
      return rpc("registrar_ingreso", {
        p_cantidad: d.cantidad, p_costo: d.costo, p_precio: d.precio, p_producto_id: d.productoId || null,
        p_nombre: d.nombre || null, p_categoria: d.categoria || null, p_talla: d.talla || null, p_color: d.color || null,
        p_foto_path: d.fotoPath || null, p_nota: d.nota || null,
      });
    },
    async ingresos({ productoId, limite = 200 } = {}) {
      let q = sb.from("ingresos").select("*, producto:productos(id, nombre, talla, color, foto_path)").order("creado_en", { ascending: false }).limit(limite);
      if (productoId) q = q.eq("producto_id", productoId);
      return respuesta(await q);
    },
    registrarSalida(d) {
      return rpc("registrar_salida", {
        p_producto_id: d.productoId, p_cantidad: d.cantidad, p_motivo: d.motivo, p_precio: d.precio ?? null, p_nota: d.nota || null,
      });
    },
    async movimientos({ tipo, productoId, limite = 200 } = {}) {
      let q = sb.from("movimientos").select(LISTA_MOVIMIENTOS).order("creado_en", { ascending: false }).order("id", { ascending: false }).limit(limite);
      if (tipo) q = q.eq("tipo", tipo);
      if (productoId) q = q.eq("producto_id", productoId);
      return respuesta(await q);
    },

    // ---------- Apartados ----------
    async apartados() {
      return respuesta(await sb.from("apartados").select(LISTA_APARTADOS).order("creado_en", { ascending: false }).limit(500));
    },
    async apartado(id) {
      return respuesta(await sb.from("apartados").select(LISTA_APARTADOS).eq("id", id).maybeSingle());
    },
    crearApartado(d) {
      return rpc("crear_apartado", {
        p_cliente_nombre: d.clienteNombre, p_articulos: d.articulos, p_cliente_telefono: d.clienteTelefono || null,
        p_cliente_direccion: d.clienteDireccion || null, p_notas: d.notas || null, p_envio: d.envio || 0,
      });
    },
    marcarPago: (id, pagado, referencia) => rpc("marcar_pago", { p_apartado_id: id, p_pagado: pagado, p_referencia: referencia || null }),
    marcarEntrega: (id, entregado) => rpc("marcar_entrega", { p_apartado_id: id, p_entregado: entregado }),
    anularApartado: (id, motivo) => rpc("anular_apartado", { p_apartado_id: id, p_motivo: motivo || null }),
    async editarApartado(id, cambios) {
      return respuesta(await sb.from("apartados").update(cambios).eq("id", id).select(LISTA_APARTADOS).single());
    },
    facturaPublica: (token) => rpc("factura_publica", { p_token: token }),
  };
}
