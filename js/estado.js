// Estado compartido entre vistas: ajustes de la tienda y productos ya cargados
import { datos } from "./datos.js";
import { ponerMoneda } from "./util.js";

export const estado = { usuario: null, ajustes: null, productos: [] };

export async function cargarAjustes() {
  estado.ajustes = await datos.ajustes();
  ponerMoneda(estado.ajustes?.moneda);
  return estado.ajustes;
}

const ORDEN_TALLAS = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "UNICA", "ÚNICA"];
const pesoTalla = (t) => {
  const s = String(t || "").toUpperCase();
  const i = ORDEN_TALLAS.indexOf(s);
  if (i >= 0) return i;
  const n = parseFloat(s);
  return Number.isFinite(n) ? 100 + n : 1000;
};
export function ordenarProductos(lista) {
  return lista.slice().sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) ||
    String(a.color || "").localeCompare(String(b.color || ""), "es") ||
    pesoTalla(a.talla) - pesoTalla(b.talla));
}

export async function cargarProductos() {
  estado.productos = ordenarProductos(await datos.productos());
  return estado.productos;
}

export const ir = (ruta) => { location.hash = "#/" + ruta; };

// Insignia de apartados por entregar en el menú
export function ponerPendientes(n) {
  estado.pendientes = n;
  document.querySelectorAll('[data-insignia="apartados"]').forEach((b) => {
    b.textContent = n;
    b.classList.toggle("oculto", !n);
  });
}
