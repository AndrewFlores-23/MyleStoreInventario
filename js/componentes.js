// Piezas que se repiten en varias vistas: foto de la prenda, buscador de productos, sellos y renglones del historial
import { datos } from "./datos.js";
import { estado } from "./estado.js";
import { el, icono, talla, tela, colorTela, dinero, fechaHora, diasDesde, sinTildes } from "./util.js";

export const MOTIVOS = {
  ingreso: "Ingreso",
  anulacion: "Apartado anulado",
  apartado: "Apartado",
  venta: "Venta directa",
  danado: "Dañado o defectuoso",
  devolucion: "Devolución al proveedor",
  regalo: "Regalo o uso personal",
  ajuste: "Ajuste de conteo",
};

export function fotoProducto(p, clase = "miniatura") {
  const url = datos.urlFoto(p?.foto_path);
  if (url) return el("img." + clase, { src: url, alt: "", loading: "lazy", decoding: "async" });
  const c = colorTela(p?.color);
  return el("div." + clase + ".marcador", c ? { style: `--tela:${c}` } : {}, el("div.foto-marcador", icono("percha")));
}

export const detallesProducto = (p) => [talla(p.talla), tela(p.color)];

// Botones de la foto: en el celular, «Tomar foto» abre directo la cámara de atrás y «Galería» elige una guardada.
// En la compu (sin pantalla táctil) queda un solo botón para elegir el archivo.
export function botonesFoto(alElegir, { chico = false } = {}) {
  const tactil = matchMedia("(pointer: coarse)").matches;
  const entrada = (camara) => el("input.oculto", {
    type: "file", accept: "image/*", capture: camara ? "environment" : null, tabindex: "-1",
    onchange: (e) => { const archivo = e.target.files[0]; e.target.value = ""; if (archivo) alElegir(archivo); },
  });
  const camara = entrada(true), galeria = entrada(false);
  const boton = "button.btn" + (chico ? ".chico" : "");
  return el("div.botones-foto", camara, galeria,
    tactil ? el(boton, { type: "button", onclick: () => camara.click() }, icono("camara", "chico"), "Tomar foto") : null,
    el(boton, { type: "button", onclick: () => galeria.click() }, icono("galeria", "chico"), tactil ? "Galería" : "Elegir foto"));
}

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
        fotoProducto(p),
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
    fotoProducto(p),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", p.nombre),
      el("div.renglon-sub", detallesProducto(p), el("span", `${p.existencias} disponible${p.existencias === 1 ? "" : "s"}`))),
    alQuitar ? el("button.btn.fantasma.chico", { type: "button", onclick: alQuitar }, "Cambiar") : null);
}

// ---------- Apartados ----------
export function sellosApartado(ap) {
  if (ap.estado === "anulado") return [el("span.sello.anulado", "Anulado")];
  return [
    ap.pagado ? el("span.sello.pagado", "Pagado") : el("span.sello.pago-pendiente", "Pendiente de pago"),
    ap.estado === "entregado" ? el("span.sello.entregado", "✓ Entregado") : el("span.sello.por-entregar", "Por entregar"),
  ];
}

// Días que lleva un apartado sin entregarse: a los 4 se pone amarillo y a los 8 rojo
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
      m.motivo === "apartado" && m.apartado?.estado === "entregado" ? el("span.sello.entregado", "✓ Entregado") : null,
      m.motivo === "apartado" && m.apartado?.estado === "anulado" ? el("span.sello.anulado", "Anulado") : null,
      el("span.tenue", fechaHora(m.creado_en))),
    m.nota ? el("div.renglon-sub.tenue", m.nota) : null,
  ];
  const fin = el("div.renglon-fin",
    el("div.num", { style: `color:var(${m.tipo === "entrada" ? "--listo" : "--texto"})` }, `${signo}${m.cantidad}`),
    el("small", `quedan ${m.existencias_despues}`));
  const props = alAbrir ? { type: "button", onclick: () => alAbrir(m) } : {};
  return el(alAbrir ? "button.renglon" : "div.renglon", props, mostrarProducto ? fotoProducto(p) : null, el("div.renglon-cuerpo", cuerpo), fin);
}

export function vacio(iconoNombre, titulo, detalle, accion) {
  return el("div.vacio", icono(iconoNombre), el("p", titulo), detalle ? el("p", detalle) : null, accion || null);
}
