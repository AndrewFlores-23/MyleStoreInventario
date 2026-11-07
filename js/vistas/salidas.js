// Salidas: lo que sale del inventario sin venta (prenda dañada, devolución al proveedor, regalo o ajuste de conteo).
// Las ventas se registran en Facturación. El historial muestra todas las salidas, también las de facturas y apartados, que se descuentan solas.
import { datos } from "../datos.js";
import { estado, cargarProductos } from "../estado.js";
import { el, icono, mismoMes, nombreMes, contador, trabajando, avisar, mensajeError } from "../util.js";
import { selectorProducto, productoElegido, renglonMovimiento, vacio } from "../componentes.js";
import { abrirFicha } from "./inventario.js";

const OPCIONES = [
  ["danado", "Dañado o defectuoso", "Mancha, roto o con falla"],
  ["devolucion", "Devolución al proveedor", "Se le regresó al proveedor"],
  ["regalo", "Regalo o uso personal", "Sale sin venta"],
  ["ajuste", "Ajuste de conteo", "El conteo físico dio menos"],
];

export async function vistaSalidas(_pagina, ctx) {
  const [salidas] = await Promise.all([datos.movimientos({ tipo: "salida", limite: 200 }), cargarProductos()]);
  const f = { producto: estado.productos.find((p) => p.id === ctx.consulta.get("producto") && p.existencias > 0) || null, motivo: "danado" };

  const error = el("div.error-form.oculto");
  const zonaProducto = el("div");
  const cantidad = contador({ valor: 1, min: 1, max: f.producto?.existencias || 1 });
  const nota = el("input", { placeholder: "Ej.: mancha en la manga, se le regresó al proveedor" });
  const boton = el("button.btn.primario.grande", { type: "submit" }, icono("salida"), "Registrar salida");
  const motivos = el("div.chips.motivos");

  const pintarMotivos = () => {
    motivos.replaceChildren(...OPCIONES.map(([clave, texto, ayuda]) => el("button.chip", {
      type: "button", title: ayuda, "aria-pressed": String(f.motivo === clave),
      onclick: () => { f.motivo = clave; pintarMotivos(); },
    }, texto)));
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
    pintarProducto();
  };

  const form = el("form.panel", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      if (!f.producto) {
        error.textContent = "Busque y elija el producto que sale.";
        error.classList.remove("oculto");
        return;
      }
      try {
        await trabajando(boton, () => datos.registrarSalida({
          productoId: f.producto.id, cantidad: cantidad.leer(), motivo: f.motivo, precio: null, nota: nota.value,
        }), "Registrando…");
        await cargarProductos();
        const p = estado.productos.find((x) => x.id === f.producto.id);
        avisar(`Salida registrada · quedan ${p?.existencias ?? 0}`);
        f.producto = null;
        nota.value = "";
        cantidad.poner(1);
        pintarProducto();
        pintarHistorial(await datos.movimientos({ tipo: "salida", limite: 200 }));
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    },
  },
    el("div.pila",
      zonaProducto,
      el("div.campo", el("span", "Motivo"), motivos),
      el("div.campo", el("span", "Cantidad que sale"), cantidad),
      el("label.campo", el("span", "Nota ", el("em", "(opcional)")), nota),
      error,
      el("div.acciones-form", boton)));

  // ---------- Historial ----------
  const lista = el("div.lista");
  const resumen = el("span.tenue", { style: "font-size:13px" });
  const pintarHistorial = (items) => {
    const sinVenta = items.filter((m) => OPCIONES.some(([clave]) => clave === m.motivo) && mismoMes(m.creado_en));
    const prendas = sinVenta.reduce((s, m) => s + m.cantidad, 0);
    resumen.textContent = `Sin venta en ${nombreMes()}: ${prendas} prenda${prendas === 1 ? "" : "s"}`;
    lista.replaceChildren(...(items.length
      ? items.map((m) => renglonMovimiento(m, {
        alAbrir: (x) => (x.factura_id ? (location.hash = `#/facturacion/${x.factura_id}`) : x.apartado_id ? (location.hash = `#/apartados/${x.apartado_id}`) : abrirFicha(x.producto_id)),
      }))
      : [vacio("salida", "Todavía no hay salidas.")]));
  };

  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Salidas"), el("p", "Prendas dañadas, devoluciones al proveedor, regalos y ajustes de conteo. Las ventas van por Facturación; los apartados se descuentan solos."))),
    form,
    el("section.panel",
      el("div.panel-titulo", el("h2", "Historial de salidas"), resumen),
      lista));
  pintarMotivos();
  pintarProducto();
  pintarHistorial(salidas);
}
