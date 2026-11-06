// Ayudas compartidas: armar nodos, íconos, dinero y fechas de Costa Rica, colores de tela, fotos y ventanas

export const $ = (sel, raiz = document) => raiz.querySelector(sel);

// el("div.clase.otra", { atributos }, ...hijos): los on* son eventos y value se pone al final (para select)
export function el(etiqueta, props, ...hijos) {
  const [tag, ...clases] = etiqueta.split(".");
  const nodo = document.createElement(tag || "div");
  if (clases.length) nodo.className = clases.join(" ");
  if (props == null || typeof props !== "object" || props instanceof Node || Array.isArray(props)) {
    hijos.unshift(props);
    props = {};
  }
  let valor;
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) nodo.addEventListener(k.slice(2), v);
    else if (k === "class") nodo.classList.add(...String(v).split(" ").filter(Boolean));
    else if (k === "style") nodo.style.cssText = v;
    else if (k === "value") valor = v;
    else nodo.setAttribute(k, v === true ? "" : v);
  }
  for (const h of hijos.flat(Infinity)) {
    if (h == null || h === false) continue;
    nodo.append(h instanceof Node ? h : String(h));
  }
  if (valor !== undefined) nodo.value = valor;
  return nodo;
}

// ---------- Íconos de línea ----------
const TRAZOS = {
  inicio: "M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z",
  percha: "M9.8 5.6a2.2 2.2 0 1 1 3 2.05c-.48.2-.8.62-.8 1.12V9.3M12 9.3 3.6 15.1a1.6 1.6 0 0 0 .9 2.9h15a1.6 1.6 0 0 0 .9-2.9L12 9.3",
  ingreso: "M12 3.5v10M12 13.5 8.5 10M12 13.5l3.5-3.5M4 13v5.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V13M4 16h4.2l1.2 2h5.2l1.2-2H20",
  salida: "M12 13.5v-10M12 3.5 8.5 7M12 3.5 15.5 7M4 13v5.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V13M4 16h4.2l1.2 2h5.2l1.2-2H20",
  bolsa: "M5 8.5h14l-.9 11a1.5 1.5 0 0 1-1.5 1.4H7.4a1.5 1.5 0 0 1-1.5-1.4L5 8.5zM8.5 10.5V7a3.5 3.5 0 0 1 7 0v3.5",
  ajustes: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  buscar: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
  mas: "M12 5v14M5 12h14",
  camara: "M4 8h3.2l1.8-2.6h6l1.8 2.6H20v11H4zM12 16.6a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8z",
  galeria: "M4 5h16v14H4zM4 16l4.5-4.5 3.5 3.5 2.5-2.5L20 17M15.5 9.5h.01",
  check: "M5 12.5 10 17l9-10",
  x: "M6 6l12 12M18 6 6 18",
  atras: "M15 5l-7 7 7 7",
  chat: "M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.4 18.6z M9 11.5h.01M12 11.5h.01M15 11.5h.01",
  imprimir: "M7 9V4h10v5M7 17H5v-6h14v6h-2M7 14h10v6H7z",
  enlace: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  editar: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  anular: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM5.6 5.6l12.8 12.8",
  alerta: "M12 4 2.5 20h19zM12 10v4M12 17h.01",
  salir: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  tema: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z",
  copiar: "M8 8h11v11H8zM5 16V5h11",
  caja: "M3.5 8 12 4l8.5 4v8.5L12 20.5l-8.5-4V8zM3.5 8 12 12l8.5-4M12 12v8.5M7.75 6l8.5 4",
  billete: "M3 7h18v10H3zM12 14.8a2.8 2.8 0 1 0 0-5.6 2.8 2.8 0 0 0 0 5.6zM6 10v4M18 10v4",
  entrega: "M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  ojo: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  corazon: "M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z",
  compartir: "M12 3.5v11M12 3.5 8.5 7M12 3.5 15.5 7M6 11v7.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V11",
};
const SVG = "http://www.w3.org/2000/svg";
export function icono(nombre, clase = "") {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", ("ico " + clase).trim());
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(SVG, "path");
  p.setAttribute("d", TRAZOS[nombre] || "");
  svg.append(p);
  return svg;
}

// Línea dorada con un corazón al centro, como la del logo
export const adorno = () => el("div.adorno", { "aria-hidden": "true" }, icono("corazon"));

// ---------- Dinero ----------
let moneda = "CRC";
export const ponerMoneda = (m) => { moneda = m === "USD" ? "USD" : "CRC"; };
export const simbolo = () => (moneda === "USD" ? "$" : "₡");
export function dinero(n) {
  const v = Number(n) || 0;
  const dec = moneda === "USD" && Math.round(Math.abs(v) * 100) % 100 !== 0 ? 2 : 0;
  return (v < 0 ? "-" : "") + simbolo() + Math.abs(v).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export const numero = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

// ---------- Fechas (hora de Costa Rica) ----------
const ZONA = "America/Costa_Rica";
const formato = (o) => new Intl.DateTimeFormat("es-CR", { timeZone: ZONA, ...o });
const fDia = formato({ day: "numeric", month: "short", year: "numeric" });
const fDiaCorto = formato({ day: "numeric", month: "short" });
const fHora = formato({ hour: "numeric", minute: "2-digit" });
const fNumerico = formato({ day: "2-digit", month: "2-digit", year: "numeric" });
const sinPunto = (t) => t.replace(/\./g, "");
// Una fecha sin hora («2026-11-05») se toma como día de Costa Rica, no como medianoche UTC
const aFecha = (d) => (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T12:00:00-06:00") : new Date(d));
export const fecha = (d) => (d ? sinPunto(fDia.format(aFecha(d))) : "");
export const fechaHora = (d) => (d ? `${sinPunto(fDiaCorto.format(new Date(d)))} · ${fHora.format(new Date(d))}` : "");
const diaCR = (d) => {
  const [dd, mm, aa] = fNumerico.format(new Date(d)).split("/").map(Number);
  return Date.UTC(aa, mm - 1, dd);
};
export const diasDesde = (d) => Math.max(0, Math.round((diaCR(Date.now()) - diaCR(d)) / 86400000));
export const mismoMes = (d) => fNumerico.format(new Date(d)).slice(3) === fNumerico.format(new Date()).slice(3);
export const nombreMes = () => formato({ month: "long" }).format(new Date());
export function hace(d) {
  const n = diasDesde(d);
  return n === 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
}

// ---------- Colores de tela ----------
const MULTI = "conic-gradient(#e7859a, #e9c46a, #7cc39b, #6aa5e9, #b48ae8, #e7859a)";
const TELAS = {
  negro: "#1d1d1f", blanco: "#f7f7f5", hueso: "#ece6da", crema: "#efe6d2", beige: "#d9c4a3", arena: "#d6c2a0",
  gris: "#8e8e93", "gris oscuro": "#4a4a4f", "gris claro": "#c9c9cd", plomo: "#6c6c72",
  rojo: "#c8323a", vino: "#6e1f2e", terracota: "#b5583c", rosado: "#f2a7bd", rosa: "#f2a7bd", "rosa palo": "#efc3cc",
  fucsia: "#d6337a", morado: "#7b4fa0", lila: "#b9a3d6", lavanda: "#c6b8e6",
  azul: "#2f5fb3", "azul marino": "#1f2f57", marino: "#1f2f57", "azul rey": "#2448b8", celeste: "#8cc4ea", turquesa: "#2bb3b1",
  verde: "#3f8f5a", "verde oliva": "#6b7340", oliva: "#6b7340", menta: "#a8e0c8", "verde menta": "#a8e0c8", esmeralda: "#1f8a5f",
  amarillo: "#f1cf4a", mostaza: "#c99a2e", naranja: "#ec8a3a", coral: "#f07c6b", durazno: "#f4b48f",
  cafe: "#6d4a33", chocolate: "#4e3426", camel: "#b88a5a", caqui: "#b8a77a", khaki: "#b8a77a",
  dorado: "#c9a44a", plateado: "#c0c0c6", mezclilla: "#4a6a94", denim: "#4a6a94",
  multicolor: MULTI, estampado: MULTI, floral: MULTI, rayas: MULTI, cuadros: MULTI,
};
const normal = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
const CLAVES = Object.keys(TELAS).sort((a, b) => b.length - a.length);
export function colorTela(nombre) {
  const n = normal(nombre);
  if (!n) return null;
  if (TELAS[n]) return TELAS[n];
  const clave = CLAVES.find((k) => n.includes(k));
  return clave ? TELAS[clave] : null;
}
export const COLORES_COMUNES = ["Negro", "Blanco", "Beige", "Gris", "Rojo", "Vino", "Rosado", "Fucsia", "Lila", "Azul",
  "Azul marino", "Celeste", "Verde", "Verde oliva", "Amarillo", "Mostaza", "Café", "Camel", "Mezclilla", "Estampado"];
export const TALLAS_COMUNES = ["XS", "S", "M", "L", "XL", "XXL", "Única"];
export const CATEGORIAS_COMUNES = ["Blusas", "Camisas", "Tops", "Vestidos", "Enaguas", "Pantalones", "Jeans", "Shorts",
  "Conjuntos", "Abrigos", "Ropa deportiva", "Ropa de baño", "Accesorios", "Zapatos"];
export { normal as sinTildes };

// Muestra de tela + nombre del color
export function tela(nombre) {
  if (!nombre) return null;
  const c = colorTela(nombre);
  return el("span.tela", c ? { style: `--tela:${c}` } : {}, nombre);
}
export const talla = (t, clase = "") => (t ? el("span.talla" + (clase ? "." + clase : ""), t) : null);

// ---------- Teléfonos ----------
export const soloDigitos = (t) => String(t || "").replace(/\D/g, "");
export function telefonoWa(t) {
  const d = soloDigitos(t);
  return d.length === 8 ? "506" + d : d;
}
export function telefonoBonito(t) {
  const d = soloDigitos(t);
  return d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4)}` : t || "";
}

// ---------- Fotos ----------
// Achica la foto antes de subirla (la del celular pesa 3–5 MB; así queda en ~150 KB)
export async function comprimirFoto(archivo, lado = 1280, calidad = 0.82) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error("No se pudo leer la foto. Pruebe con otra imagen (JPG o PNG)."));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement("canvas");
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    const ctx = lienzo.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise((ok) => lienzo.toBlob(ok, "image/jpeg", calidad));
    if (!blob) throw new Error("No se pudo preparar la foto.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Vuelve al inicio del contenido (el marco no se desplaza; se desplaza .desplazable)
export function subir(suave = false) {
  (document.querySelector(".desplazable") || window).scrollTo({ top: 0, behavior: suave ? "smooth" : "auto" });
}

// ---------- Avisos y errores ----------
export function avisar(texto, tipo = "listo") {
  const caja = document.getElementById("avisos");
  if (!caja) return;
  const t = el("div.toast." + tipo, icono(tipo === "error" ? "alerta" : "check"), el("span", texto));
  caja.append(t);
  setTimeout(() => {
    t.classList.add("saliendo");
    setTimeout(() => t.remove(), 250);
  }, tipo === "error" ? 5500 : 2800);
}

export function mensajeError(e) {
  const m = e?.message || String(e || "");
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) return "Sin conexión. Revise el internet e intente de nuevo.";
  if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(m)) return "Falta confirmar el correo. Revise la bandeja de entrada.";
  if (/jwt expired|refresh token/i.test(m)) return "La sesión venció. Vuelva a entrar.";
  if (/permission denied|row-level security/i.test(m)) return "Su cuenta no tiene permiso para hacer esto.";
  if (/payload too large|exceeded the maximum/i.test(m)) return "La foto es muy pesada. Pruebe con otra.";
  return m || "Algo salió mal. Intente de nuevo.";
}

// ---------- Ventanas ----------
// En el celular la hoja sube desde abajo y se cierra deslizándola hacia abajo (desde el asa o la cabecera)
export function abrirHoja({ titulo, cuerpo, pie, clase = "", alCerrar } = {}) {
  const d = el("dialog.hoja" + (clase ? "." + clase : ""));
  let cerrando = false;
  const cerrar = () => {
    if (!d.open || cerrando) return;
    cerrando = true;
    d.classList.add("saliendo");
    const fin = () => d.open && d.close();
    d.addEventListener("animationend", fin, { once: true });
    setTimeout(fin, 260);
  };
  const cabeza = el("div.hoja-cabeza",
    el("span.hoja-asa", { "aria-hidden": "true" }),
    titulo ? el("h2", titulo) : el("span"),
    el("button.btn.fantasma.btn-icono", { type: "button", "aria-label": "Cerrar", onclick: cerrar }, icono("x")));
  d.append(cabeza, el("div.hoja-cuerpo", cuerpo));
  if (pie) d.append(el("div.hoja-pie", pie));
  d.addEventListener("close", () => { d.remove(); alCerrar?.(); });
  d.addEventListener("cancel", (ev) => { ev.preventDefault(); cerrar(); });
  d.addEventListener("mousedown", (ev) => { if (ev.target === d) d.dataset.fuera = "1"; });
  d.addEventListener("click", (ev) => { if (ev.target === d && d.dataset.fuera) cerrar(); delete d.dataset.fuera; });
  // Deslizar hacia abajo desde la cabecera para cerrar
  let y0 = null;
  cabeza.addEventListener("touchstart", (ev) => { y0 = ev.touches[0].clientY; d.style.transition = "none"; }, { passive: true });
  cabeza.addEventListener("touchmove", (ev) => {
    if (y0 == null) return;
    const dy = Math.max(0, ev.touches[0].clientY - y0);
    d.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  cabeza.addEventListener("touchend", (ev) => {
    if (y0 == null) return;
    const dy = ev.changedTouches[0].clientY - y0;
    y0 = null;
    d.style.transition = "";
    if (dy > 90) { d.style.transform = ""; cerrar(); } else d.style.transform = "";
  });
  document.body.append(d);
  d.showModal();
  return { dialogo: d, cerrar };
}

// Hoja de acciones: lista de opciones grandes, una por renglón (el menú del botón «+»)
export function hojaAcciones(titulo, opciones) {
  let elegida = null;
  const { cerrar } = abrirHoja({
    titulo,
    clase: "chica.acciones",
    alCerrar: () => elegida?.alElegir(),
    cuerpo: el("div.lista-acciones", opciones.map((o) => el("button.accion", { type: "button", onclick: () => { elegida = o; cerrar(); } },
      el("span.accion-icono", icono(o.icono)),
      el("span.accion-texto", el("strong", o.titulo), o.detalle ? el("small", o.detalle) : null),
      icono("atras", "chico accion-flecha")))),
  });
  return cerrar;
}

export function confirmar(titulo, { detalle, si = "Sí, seguir", no = "Volver", peligro = false } = {}) {
  return new Promise((resolver) => {
    let respuesta = false;
    const { cerrar } = abrirHoja({
      titulo,
      clase: "chica",
      cuerpo: detalle ? el("p.suave", detalle) : null,
      pie: [
        el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, no),
        el("button.btn" + (peligro ? ".peligro" : ".primario"), { type: "button", onclick: () => { respuesta = true; cerrar(); } }, si),
      ],
      alCerrar: () => resolver(respuesta),
    });
  });
}

// Botón que se deshabilita mientras trabaja
export async function trabajando(boton, tarea, texto = "Guardando…") {
  const antes = boton.innerHTML;
  boton.disabled = true;
  boton.textContent = texto;
  try {
    return await tarea();
  } finally {
    boton.disabled = false;
    boton.innerHTML = antes;
  }
}

// Campo de dinero con el símbolo de la moneda
export function campoDinero(props = {}) {
  return el("div.dinero-campo", { "data-simbolo": simbolo() },
    el("input", { type: "number", inputmode: "decimal", min: "0", step: "any", placeholder: "0", ...props }));
}

// Contador con − y +
export function contador({ valor = 1, min = 1, max = 9999, chico = false, alCambiar } = {}) {
  const entrada = el("input", { type: "number", inputmode: "numeric", min, max, step: "1", value: valor, "aria-label": "Cantidad" });
  const poner = (v) => {
    const n = Math.min(max, Math.max(min, Math.round(Number(v) || min)));
    entrada.value = n;
    alCambiar?.(n);
  };
  entrada.addEventListener("change", () => poner(entrada.value));
  entrada.addEventListener("input", () => { const n = Number(entrada.value); if (n >= min && n <= max) alCambiar?.(Math.round(n)); });
  const caja = el("div.contador" + (chico ? ".chico" : ""),
    el("button", { type: "button", "aria-label": "Uno menos", onclick: () => poner(Number(entrada.value) - 1) }, "−"),
    entrada,
    el("button", { type: "button", "aria-label": "Uno más", onclick: () => poner(Number(entrada.value) + 1) }, "+"));
  caja.leer = () => Math.min(max, Math.max(min, Math.round(Number(entrada.value) || min)));
  caja.poner = poner;
  caja.cambiarMax = (m) => { max = m; entrada.max = m; if (Number(entrada.value) > m) poner(m); };
  return caja;
}
