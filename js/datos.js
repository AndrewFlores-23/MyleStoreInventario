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

// ---------- Sesión guardada ----------
// Con «Mantener la sesión iniciada» (lo normal), la sesión queda en este dispositivo hasta cerrar sesión y Supabase
// la renueva sola. Sin marcarla, dura lo que la pestaña esté abierta. El último correo se recuerda para la entrada.
const MARCA_NO_RECORDAR = "myle-no-recordar";
const CLAVE_CORREO = "myle-correo";
const local = {
  leer(k) { try { return localStorage.getItem(k); } catch { return null; } },
  poner(k, v) { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: la sesión dura lo que la pestaña */ } },
  quitar(k) { try { localStorage.removeItem(k); } catch { /* nada que quitar */ } },
};
export const recordando = () => local.leer(MARCA_NO_RECORDAR) !== "1";
export const ultimoCorreo = () => local.leer(CLAVE_CORREO) || "";
function recordarSesion(si, email) {
  if (si) local.quitar(MARCA_NO_RECORDAR); else local.poner(MARCA_NO_RECORDAR, "1");
  if (si && email) local.poner(CLAVE_CORREO, email); else local.quitar(CLAVE_CORREO);
}
const almacenSesion = {
  getItem(k) { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k); } catch { return null; } },
  setItem(k, v) {
    try {
      const [usar, limpiar] = recordando() ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
      usar.setItem(k, v);
      limpiar.removeItem(k);
    } catch { /* sin almacenamiento */ }
  },
  removeItem(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch { /* nada que quitar */ } },
};

const LISTA_APARTADOS = "*, articulos:apartado_articulos(*), factura:facturas!apartados_factura_id_fkey(id, numero, estado)";
const LISTA_FACTURAS = "*, articulos:factura_articulos(*), apartado:apartados!facturas_apartado_id_fkey(id, numero)";
const LISTA_MOVIMIENTOS = "*, producto:productos(id, nombre, talla, color, foto_path), apartado:apartados(id, numero, estado, cliente_nombre)";

async function crearReal() {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storage: almacenSesion },
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
    async entrar(email, clave, recordar = true) {
      recordarSesion(recordar, email);
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
    // Borra un producto registrado por error con sus ingresos y su historial (la base revisa que no tenga ventas)
    async eliminarProducto(id) {
      const r = await rpc("eliminar_producto", { p_producto_id: id });
      if (r?.foto_path) fotos.remove([r.foto_path]).catch(() => { /* una foto vieja suelta no estorba */ });
      return r;
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
        p_foto_path: d.fotoPath || null, p_nota: d.nota || null, p_compra_id: d.compraId || null,
      });
    },
    async ingresos({ productoId, compraId, limite = 200 } = {}) {
      let q = sb.from("ingresos").select("*, producto:productos(id, nombre, talla, color, foto_path)").order("creado_en", { ascending: false }).limit(limite);
      if (productoId) q = q.eq("producto_id", productoId);
      if (compraId) q = q.eq("compra_id", compraId);
      return respuesta(await q);
    },

    // ---------- Compras (facturas de proveedor) ----------
    crearCompra: (d) => rpc("crear_compra", {
      p_proveedor: d.proveedor || null, p_proveedor_id: d.proveedorId || null, p_factura: d.factura || null, p_nota: d.nota || null,
      p_prendas_pedidas: d.prendasPedidas || 0, p_monto_pagado: d.montoPagado || 0, p_fecha_compra: d.fechaCompra || null,
    }),

    // ---------- Proveedores ----------
    async proveedores() {
      return respuesta(await sb.from("proveedores").select("*").order("nombre"));
    },
    async crearProveedor(d) {
      return respuesta(await sb.from("proveedores").insert({
        nombre: d.nombre.trim(), telefono: d.telefono || null, correo: d.correo || null, direccion: d.direccion || null, nota: d.nota || null,
      }).select().single());
    },
    async editarProveedor(id, cambios) {
      return respuesta(await sb.from("proveedores").update(cambios).eq("id", id).select().single());
    },
    async compra(id) {
      return respuesta(await sb.from("compras").select("*, ingresos(id, serie, cantidad, costo_unitario, precio_venta, creado_en, producto:productos(id, nombre, talla, color, foto_path))").eq("id", id).maybeSingle());
    },
    async compras({ limite = 300 } = {}) {
      return respuesta(await sb.from("compras").select("*, ingresos(id, serie, cantidad, costo_unitario, precio_venta, creado_en, producto:productos(id, nombre, talla, color, foto_path))").order("creado_en", { ascending: false }).limit(limite));
    },
    async editarCompra(id, cambios) {
      return respuesta(await sb.from("compras").update(cambios).eq("id", id).select().single());
    },
    // Borra una compra sin prendas registradas (si tiene, la base se niega)
    eliminarCompra: (id) => rpc("eliminar_compra", { p_compra_id: id }),
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
    anularApartado: (id, motivo) => rpc("anular_apartado", { p_apartado_id: id, p_motivo: motivo || null }),
    // Lista completa de prendas del apartado; la base ajusta el inventario por diferencia
    modificarApartado: (id, articulos) => rpc("modificar_apartado", { p_apartado_id: id, p_articulos: articulos }),
    async editarApartado(id, cambios) {
      return respuesta(await sb.from("apartados").update(cambios).eq("id", id).select(LISTA_APARTADOS).single());
    },

    // ---------- Facturas de contado ----------
    async facturas() {
      return respuesta(await sb.from("facturas").select(LISTA_FACTURAS).order("creado_en", { ascending: false }).limit(500));
    },
    async factura(id) {
      return respuesta(await sb.from("facturas").select(LISTA_FACTURAS).eq("id", id).maybeSingle());
    },
    crearFactura(d) {
      return rpc("crear_factura", {
        p_cliente_nombre: d.clienteNombre, p_articulos: d.articulos || null, p_apartado_id: d.apartadoId || null,
        p_cliente_telefono: d.clienteTelefono || null, p_cliente_direccion: d.clienteDireccion || null, p_notas: d.notas || null,
        p_envio: d.envio || 0, p_descuento: d.descuento || 0, p_forma_pago: d.formaPago || null, p_referencia_pago: d.referenciaPago || null,
      });
    },
    anularFactura: (id, motivo) => rpc("anular_factura", { p_factura_id: id, p_motivo: motivo || null }),
    async editarFactura(id, cambios) {
      return respuesta(await sb.from("facturas").update(cambios).eq("id", id).select(LISTA_FACTURAS).single());
    },
    facturaPublica: (token) => rpc("factura_contado_publica", { p_token: token }),

    // ---------- Gastos ----------
    async gastos({ limite = 500 } = {}) {
      return respuesta(await sb.from("gastos").select("*").order("fecha", { ascending: false }).order("creado_en", { ascending: false }).limit(limite));
    },
    crearGasto: (d) => rpc("crear_gasto", { p_descripcion: d.descripcion, p_monto: d.monto, p_categoria: d.categoria || "otro", p_fecha: d.fecha || null, p_pagado_con: d.pagadoCon || null, p_nota: d.nota || null }),
    async editarGasto(id, cambios) {
      return respuesta(await sb.from("gastos").update(cambios).eq("id", id).select().single());
    },
    async borrarGasto(id) {
      respuesta(await sb.from("gastos").delete().eq("id", id));
    },
  };
}
