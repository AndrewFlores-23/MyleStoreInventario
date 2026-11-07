// Piezas que se repiten en varias vistas: muestra de color de la prenda, buscador de productos, sellos y renglones del historial
import { estado } from "./estado.js";
import { el, icono, talla, tela, colorTela, dinero, fecha, fechaHora, diasDesde, sinTildes, abrirHoja } from "./util.js";

export const MOTIVOS = {
  ingreso: "Ingreso",
  anulacion: "Apartado anulado",
  apartado: "Apartado",
  factura: "Factura de contado",
  venta: "Venta directa",
  danado: "Dañado o defectuoso",
  devolucion: "Devolución al proveedor",
  regalo: "Regalo o uso personal",
  ajuste: "Ajuste de conteo",
};

// Muestra de la prenda: su color como un retazo de tela (no se usan fotos); sin color, una percha
export function marcaProducto(p, clase = "miniatura") {
  const c = colorTela(p?.color);
  return el("div." + clase + ".marcador", c ? { style: `--tela:${c}`, title: p.color } : {}, c ? null : icono("percha"));
}

export const detallesProducto = (p) => [talla(p.talla), tela(p.color)];

export function nombreCompleto(p) {
  return [p.nombre, p.talla && `talla ${p.talla}`, p.color].filter(Boolean).join(" · ");
}

// Buscador de productos: escribe y elige. Muestra lo disponible y avisa los agotados.
export function selectorProducto({ alElegir, soloDisponibles = false, placeholder = "Buscar por nombre, talla, color o categoría", excluir = () => false } = {}) {
  const entrada = el("input", { type: "search", placeholder, autocomplete: "off", enterkeyhint: "search" });
  const resultados = el("div.resultados.lista", { role: "listbox" });
  const pintar = () => {
    const q = sinTildes(entrada.value);
    resultados.replaceChildren();
    if (!q && document.activeElement !== entrada) return;
    const palabras = q.split(/\s+/).filter(Boolean);
    const lista = estado.productos.filter((p) => {
      if (!p.activo && p.existencias === 0) return false;
      if (excluir(p)) return false;
      const texto = sinTildes([p.nombre, p.talla, p.color, p.categoria].join(" "));
      return palabras.every((w) => texto.includes(w));
    }).slice(0, 40);
    if (!lista.length) {
      resultados.append(el("div.vacio", el("p", q ? "No hay productos con ese nombre." : "Todavía no hay productos.")));
      return;
    }
    for (const p of lista) {
      const agotado = p.existencias <= 0;
      const bloqueado = soloDisponibles && agotado;
      resultados.append(el("button.renglon", {
        type: "button",
        role: "option",
        disabled: bloqueado,
        style: bloqueado ? "opacity:.5;cursor:not-allowed" : null,
        onclick: () => { if (!bloqueado) { entrada.value = ""; resultados.replaceChildren(); alElegir(p); } },
      },
        marcaProducto(p),
        el("div.renglon-cuerpo",
          el("div.renglon-titulo", p.nombre),
          el("div.renglon-sub", detallesProducto(p), p.categoria ? el("span.tenue", p.categoria) : null)),
        el("div.renglon-fin",
          el("div.num", dinero(p.precio_venta)),
          el("small", agotado ? "Agotado" : `${p.existencias} disponible${p.existencias === 1 ? "" : "s"}`))));
    }
  };
  entrada.addEventListener("input", pintar);
  entrada.addEventListener("focus", pintar);
  const caja = el("div.selector", el("div.buscar-caja", { style: "position:relative" }, entrada), resultados);
  caja.enfocar = () => entrada.focus();
  return caja;
}

// Producto elegido, con botón para cambiarlo
export function productoElegido(p, alQuitar) {
  return el("div.elegido",
    marcaProducto(p),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", p.nombre),
      el("div.renglon-sub", detallesProducto(p), el("span", `${p.existencias} disponible${p.existencias === 1 ? "" : "s"}`))),
    alQuitar ? el("button.btn.fantasma.chico", { type: "button", onclick: alQuitar }, "Cambiar") : null);
}

// ---------- Apartados ----------
export function sellosApartado(ap) {
  if (ap.estado === "anulado") return [el("span.sello.anulado", "Anulado")];
  if (ap.estado === "facturado") return [el("span.sello.pagado", `✓ Facturado${ap.factura?.numero ? ` · ${ap.factura.numero}` : ""}`)];
  return [el("span.sello.pago-pendiente", "Apartado")];
}

export function sellosFactura(f) {
  return f.estado === "anulada" ? [el("span.sello.anulado", "Anulada")] : [el("span.sello.pagado", "Cancelado")];
}

// Días que lleva un apartado sin facturarse: a los 4 se pone amarillo y a los 8 rojo
export function cajaDias(ap) {
  if (ap.estado !== "pendiente") return el("div.dias.listo", el("b", ap.estado === "anulado" ? "—" : "✓"), el("small", ap.estado === "anulado" ? "anulado" : "listo"));
  const n = diasDesde(ap.creado_en);
  const clase = n >= 8 ? ".urgente" : n >= 4 ? ".aviso" : "";
  return el("div.dias" + clase, { title: `Apartado hace ${n} día${n === 1 ? "" : "s"}` }, el("b", n), el("small", n === 1 ? "día" : "días"));
}

export const unidades = (articulos) => (articulos || []).reduce((s, a) => s + Number(a.cantidad), 0);

// ---------- Historial ----------
export function renglonMovimiento(m, { alAbrir, mostrarProducto = true } = {}) {
  const p = m.producto || {};
  const signo = m.tipo === "entrada" ? "+" : "−";
  let detalle = MOTIVOS[m.motivo] || m.motivo;
  if (m.motivo === "apartado" && m.apartado) detalle = `Apartado · ${m.apartado.cliente_nombre}`;
  const ref = m.referencia ? el("span.serie", m.referencia) : null;
  const cuerpo = [
    el("div.renglon-titulo", mostrarProducto ? p.nombre || "Producto" : detalle),
    el("div.renglon-sub",
      mostrarProducto ? [talla(p.talla), el("span", detalle)] : null,
      ref,
      m.motivo === "apartado" && m.apartado?.estado === "facturado" ? el("span.sello.entregado", "✓ Facturado") : null,
      m.motivo === "apartado" && m.apartado?.estado === "anulado" ? el("span.sello.anulado", "Anulado") : null,
      el("span.tenue", fechaHora(m.creado_en))),
    m.nota ? el("div.renglon-sub.tenue", m.nota) : null,
  ];
  const fin = el("div.renglon-fin",
    el("div.num", { style: `color:var(${m.tipo === "entrada" ? "--listo" : "--texto"})` }, `${signo}${m.cantidad}`),
    el("small", `quedan ${m.existencias_despues}`));
  if (m.motivo === "factura" && m.referencia) detalle = `Factura ${m.referencia}`;
  const props = alAbrir ? { type: "button", onclick: () => alAbrir(m) } : {};
  return el(alAbrir ? "button.renglon" : "div.renglon", props, mostrarProducto ? marcaProducto(p) : null, el("div.renglon-cuerpo", cuerpo), fin);
}

// Etiqueta del número de serie de un ingreso (marbete), la misma que sale al registrar y se puede volver a ver e imprimir
export function marbete(ingreso, p) {
  return el("div.marbete",
    el("img.logo", { src: "img/logo-chico.webp", alt: estado.ajustes?.nombre_tienda || "Myle Store" }),
    el("div.nombre", p?.nombre || ingreso.producto?.nombre || "Producto"),
    el("div.detalles", talla(p?.talla ?? ingreso.producto?.talla), tela(p?.color ?? ingreso.producto?.color)),
    el("div.precio", dinero(ingreso.precio_venta)),
    el("div.codigo", el("small", "Serie de ingreso"), ingreso.serie),
    el("div.cantidad", `${ingreso.cantidad} ${ingreso.cantidad === 1 ? "unidad" : "unidades"} · ${fecha(ingreso.creado_en)}`));
}

// Imprime solo la etiqueta (sirve para pegarla en la bolsa o la percha)
export async function imprimirEtiqueta(nodo, titulo) {
  const { imprimirFactura } = await import("./factura.js");
  const hoja = el("div.hoja-etiqueta", nodo.cloneNode(true));
  await imprimirFactura(hoja, titulo);
}

// Hoja con la etiqueta de una serie, para verla las veces que haga falta
export function verEtiqueta(ingreso, p) {
  const etiqueta = marbete(ingreso, p);
  abrirHoja({
    titulo: `Etiqueta ${ingreso.serie}`,
    clase: "chica",
    cuerpo: el("div", etiqueta, el("p.tenue", { style: "text-align:center;margin-top:16px;font-size:13px" }, "Puede imprimirla para pegarla en la bolsa o la percha.")),
    pie: [el("button.btn.primario", { type: "button", onclick: () => imprimirEtiqueta(etiqueta, `Etiqueta ${ingreso.serie}`) }, icono("imprimir"), "Imprimir etiqueta")],
  });
}

export function vacio(iconoNombre, titulo, detalle, accion) {
  return el("div.vacio", icono(iconoNombre), el("p", titulo), detalle ? el("p", detalle) : null, accion || null);
}
