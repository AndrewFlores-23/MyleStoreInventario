// Salidas: lo que sale del inventario fuera de un apartado (venta directa, prenda dañada, devolución, regalo o ajuste).
// El historial muestra todas las salidas, también las de los apartados, que se descuentan solas.
import { datos } from "../datos.js";
import { estado, cargarProductos } from "../estado.js";
import { el, icono, dinero, numero, mismoMes, nombreMes, campoDinero, contador, trabajando, avisar, mensajeError } from "../util.js";
import { selectorProducto, productoElegido, renglonMovimiento, vacio } from "../componentes.js";
import { abrirFicha } from "./inventario.js";

const OPCIONES = [
  ["venta", "Venta directa", "Se vendió y se entregó en el momento"],
  ["danado", "Dañado o defectuoso", "Mancha, roto o con falla"],
  ["devolucion", "Devolución al proveedor", "Se le regresó al proveedor"],
  ["regalo", "Regalo o uso personal", "Sale sin venta"],
  ["ajuste", "Ajuste de conteo", "El conteo físico dio menos"],
];

export async function vistaSalidas(_pagina, ctx) {
  const [salidas] = await Promise.all([datos.movimientos({ tipo: "salida", limite: 200 }), cargarProductos()]);
  const f = { producto: estado.productos.find((p) => p.id === ctx.consulta.get("producto") && p.existencias > 0) || null, motivo: "venta" };

  const error = el("div.error-form.oculto");
  const zonaProducto = el("div");
  const cantidad = contador({ valor: 1, min: 1, max: f.producto?.existencias || 1, alCambiar: () => pintarTotal() });
  const precio = campoDinero({ value: f.producto ? Number(f.producto.precio_venta) : "", oninput: () => pintarTotal() });
  const precioIn = precio.querySelector("input");
  const campoPrecio = el("label.campo", el("span", "Precio de venta ", el("em", "(c/u)")), precio);
  const total = el("div.ganancia");
  const nota = el("input", { placeholder: "Ej.: venta a una vecina, mancha en la manga" });
  const boton = el("button.btn.primario.grande", { type: "submit" }, icono("salida"), "Registrar salida");
  const motivos = el("div.chips");

  const pintarMotivos = () => {
    motivos.replaceChildren(...OPCIONES.map(([clave, texto, ayuda]) => el("button.chip", {
      type: "button", title: ayuda, "aria-pressed": String(f.motivo === clave),
      onclick: () => { f.motivo = clave; pintarMotivos(); pintarTotal(); },
    }, texto)));
    campoPrecio.classList.toggle("oculto", f.motivo !== "venta");
  };
  const pintarTotal = () => {
    if (f.motivo !== "venta" || !f.producto) return total.classList.add("oculto");
    total.classList.remove("oculto");
    const v = numero(precioIn.value);
    total.replaceChildren(el("span", "Total de la venta ", el("b", dinero((v || 0) * cantidad.leer()))));
    if (v >= 0) total.append(el("span", "Ganancia ", el("b.listo", dinero((v - Number(f.producto.costo)) * cantidad.leer()))));
  };
  const pintarProducto = () => {
    zonaProducto.replaceChildren(f.producto
      ? el("div.campo", el("span", "Producto"), productoElegido(f.producto, () => { f.producto = null; pintarProducto(); }))
      : el("div.campo", el("span", "Busque el producto que sale"), selectorProducto({ soloDisponibles: true, alElegir: elegir })));
  };
  const elegir = (p) => {
    f.producto = p;
    cantidad.cambiarMax(Math.max(1, p.existencias));
    cantidad.poner(1);
    precioIn.value = Number(p.precio_venta) || "";
    pintarProducto();
    pintarTotal();
  };

  const form = el("form.panel", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      const v = numero(precioIn.value);
      const falta = !f.producto ? "Busque y elija el producto que sale."
        : f.motivo === "venta" && !(v >= 0) ? "Escriba el precio de la venta." : null;
      if (falta) {
        error.textContent = falta;
        error.classList.remove("oculto");
        return;
      }
      try {
        await trabajando(boton, () => datos.registrarSalida({
          productoId: f.producto.id, cantidad: cantidad.leer(), motivo: f.motivo, precio: f.motivo === "venta" ? v : null, nota: nota.value,
        }), "Registrando…");
        await cargarProductos();
        const p = estado.productos.find((x) => x.id === f.producto.id);
        avisar(`Salida registrada · quedan ${p?.existencias ?? 0}`);
        f.producto = null;
        nota.value = "";
        cantidad.poner(1);
        pintarProducto();
        pintarTotal();
        pintarHistorial(await datos.movimientos({ tipo: "salida", limite: 200 }));
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    },
  },
    el("div", { style: "display:flex;flex-direction:column;gap:16px" },
      zonaProducto,
      el("div.campo", el("span", "Motivo"), motivos),
      el("div.rejilla.dos", el("div.campo", el("span", "Cantidad que sale"), cantidad), campoPrecio),
      total,
      el("label.campo", el("span", "Nota ", el("em", "(opcional)")), nota),
      error,
      el("div", { style: "display:flex;justify-content:flex-end" }, boton)));

  // ---------- Historial ----------
  const lista = el("div.lista");
  const resumen = el("span.tenue", { style: "font-size:13px" });
  const pintarHistorial = (items) => {
    const ventas = items.filter((m) => m.motivo === "venta" && mismoMes(m.creado_en));
    resumen.textContent = `Ventas directas en ${nombreMes()}: ${dinero(ventas.reduce((s, m) => s + m.cantidad * Number(m.precio_unitario || 0), 0))}`;
    lista.replaceChildren(...(items.length
      ? items.map((m) => renglonMovimiento(m, {
        alAbrir: (x) => (x.apartado_id ? (location.hash = `#/apartados/${x.apartado_id}`) : abrirFicha(x.producto_id)),
      }))
      : [vacio("salida", "Todavía no hay salidas.")]));
  };

  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Salidas"), el("p", "Ventas directas, prendas dañadas, devoluciones y ajustes. Los apartados se descuentan solos."))),
    form,
    el("section.panel",
      el("div.panel-titulo", el("h2", "Historial de salidas"), resumen),
      lista));
  pintarMotivos();
  pintarProducto();
  pintarTotal();
  pintarHistorial(salidas);
}
