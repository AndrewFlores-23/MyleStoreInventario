// Pieza compartida entre el apartado y la factura: el buscador de prendas con el carrito y sus totales
import { el, icono, dinero, numero, talla, tela, campoDinero, contador, avisar } from "../util.js";
import { marcaProducto, selectorProducto, vacio } from "../componentes.js";

export function armarPedido({ conDescuento = false, alCambiar } = {}) {
  const carrito = []; // { producto, cantidad, precio }
  const lineas = el("div.carrito");
  const totales = el("div.recibo");
  const envio = campoDinero({ placeholder: "0", oninput: () => pintarTotales() });
  const descuento = campoDinero({ placeholder: "0", oninput: () => pintarTotales() });
  const envioIn = envio.querySelector("input");
  const descuentoIn = descuento.querySelector("input");

  const selector = selectorProducto({
    soloDisponibles: true,
    placeholder: "Buscar prenda para agregar",
    alElegir: (p) => {
      const ya = carrito.find((l) => l.producto.id === p.id);
      if (ya) {
        if (ya.cantidad < p.existencias) ya.cantidad += 1;
        else avisar(`Solo hay ${p.existencias} de esta prenda`, "error");
      } else {
        carrito.push({ producto: p, cantidad: 1, precio: Number(p.precio_venta) });
      }
      pintarLineas();
    },
  });

  const pintarLineas = () => {
    lineas.replaceChildren(...(carrito.length ? carrito.map((l, i) => {
      const sub = el("div.subtotal", dinero(l.cantidad * l.precio));
      const cuenta = contador({ valor: l.cantidad, min: 1, max: l.producto.existencias, chico: true, alCambiar: (n) => { l.cantidad = n; sub.textContent = dinero(l.cantidad * l.precio); pintarTotales(); } });
      const precio = campoDinero({ value: l.precio, "aria-label": "Precio por unidad", oninput: (e) => { const v = numero(e.target.value); l.precio = v >= 0 ? v : 0; sub.textContent = dinero(l.cantidad * l.precio); pintarTotales(); } });
      return el("div.linea-carrito",
        marcaProducto(l.producto),
        el("div.info",
          el("div.renglon-titulo", l.producto.nombre),
          el("div.renglon-sub", talla(l.producto.talla), tela(l.producto.color), el("span.tenue", `de ${l.producto.existencias} disponibles`))),
        sub,
        el("div.controles", cuenta, precio,
          el("button.btn.fantasma.btn-icono.quitar", { type: "button", "aria-label": "Quitar", title: "Quitar", onclick: () => { carrito.splice(i, 1); pintarLineas(); } }, icono("x"))));
    }) : [vacio("bolsa", "Agregue las prendas que pidió el cliente.", "Búsquelas arriba por nombre, talla o color.")]));
    pintarTotales();
  };

  const linea = (et, val, clase = "") => el("div.linea" + clase, el("span.et", et), el("span.puntos"), el("span.val", val));
  const leerEnvio = () => Math.max(0, numero(envioIn.value) || 0);
  const leerDescuento = () => (conDescuento ? Math.max(0, numero(descuentoIn.value) || 0) : 0);
  const pintarTotales = () => {
    const sub = carrito.reduce((s, l) => s + l.cantidad * l.precio, 0);
    const n = carrito.reduce((s, l) => s + l.cantidad, 0);
    totales.replaceChildren(
      linea("Artículos", el("span", n, el("small", n === 1 ? "unidad" : "unidades"))),
      linea("Subtotal", dinero(sub)),
      linea("Envío", dinero(leerEnvio())),
      conDescuento && leerDescuento() > 0 ? linea("Descuento", `−${dinero(leerDescuento())}`) : null,
      linea("Total", dinero(sub + leerEnvio() - leerDescuento()), ".total"));
    alCambiar?.();
  };

  pintarLineas();
  return {
    panelPrendas: (titulo = "Prendas del pedido") => el("section.panel", el("div.panel-titulo", el("h2", titulo)), selector, lineas),
    campoEnvio: el("label.campo", el("span", "Envío ", el("em", "(opcional)")), envio),
    campoDescuento: conDescuento ? el("label.campo", el("span", "Descuento ", el("em", "(opcional)")), descuento) : null,
    totales,
    vacio: () => carrito.length === 0,
    articulos: () => carrito.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, precio_unitario: l.precio })),
    envio: leerEnvio,
    descuento: leerDescuento,
  };
}

// Campos del cliente, también compartidos
export function camposCliente({ telefonoAyuda = "(para enviarle por WhatsApp)" } = {}) {
  const nombre = el("input", { required: true, placeholder: "Nombre y apellido", autocomplete: "off" });
  const telefono = el("input", { type: "tel", inputmode: "tel", placeholder: "8888-8888", autocomplete: "off" });
  const direccion = el("input", { placeholder: "Ej.: Heredia, San Pablo · envío por Correos", autocomplete: "off" });
  const notas = el("textarea", { placeholder: "Solo para la tienda; no sale en la factura" });
  return {
    nombre, telefono, direccion, notas,
    campos: [
      el("label.campo", el("span", "Nombre"), nombre),
      el("label.campo", el("span", "Teléfono o WhatsApp ", el("em", telefonoAyuda)), telefono),
      el("label.campo", el("span", "Dirección o forma de entrega ", el("em", "(opcional)")), direccion),
    ],
    campoNotas: el("label.campo", el("span", "Notas internas ", el("em", "(opcional)")), notas),
    leer: () => ({ clienteNombre: nombre.value, clienteTelefono: telefono.value, clienteDireccion: direccion.value, notas: notas.value }),
  };
}
