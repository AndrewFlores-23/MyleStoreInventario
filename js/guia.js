// Guía animada: cada escena arma la pantalla del celular con datos de ejemplo y va revelando sus partes.
// Se reproduce sola, se puede pausar y saltar entre escenas. No toca la base de datos.
import { el } from "./util.js";

const pantalla = document.getElementById("pantalla");
const subtitulo = document.getElementById("subtitulo");
const listaEscenas = document.getElementById("escenas");
const botonPausa = document.getElementById("pausa");
const telefono = document.getElementById("telefono");

// Si la guía se abrió desde la demo, el botón de volver regresa a la demo
if (new URLSearchParams(location.search).has("demo")) document.getElementById("volver").href = "./?demo#/ajustes";

// ---------- Piezas del celular ----------
const marco = (pestana, ...cuerpo) => [
  el("div.p-barra", el("img", { src: "img/perfil.jpg", alt: "" }), el("b", "Myle Store")),
  el("div.p-pestanas", ["Inicio", "Inventario", "Movimientos", "Apartados"].map((t) => el("span" + (t === pestana ? ".activa" : ""), t))),
  el("div.p-cuerpo", ...cuerpo),
];
const campo = (nombre, valor, vacio = "", escribiendo = false) => el("div.p-campo", el("span", nombre), el("div" + (escribiendo ? ".escribiendo" : ""), { "data-vacio": vacio }, valor));
const boton = (texto, extra = "") => el("div.p-boton" + extra, texto);
const renglon = (color, titulo, sub, fin, finSub) => el("div.p-renglon", el("div.p-foto." + color), el("div.info", el("b", titulo), el("small", sub)), el("div.fin", fin, finSub ? el("small", finSub) : null));
const linea = (et, val, total = false) => el("div.linea" + (total ? ".total" : ""), el("span.et", et), el("span.puntos"), el("span.val", val));
const toast = (texto) => el("div.p-toast", texto);
const logo = () => el("img", { src: "img/logo-chico.webp", alt: "" });
function nube() {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "icono-nube");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", "M7 18a4 4 0 0 1-.6-7.95A6 6 0 0 1 18 8.5a3.5 3.5 0 0 1-.5 7H7z");
  svg.append(p);
  return svg;
}

// Escribe un texto letra por letra en un campo (como si alguien lo tecleara)
function teclear(caja, texto, ms = 45) {
  caja.classList.add("escribiendo");
  caja.textContent = "";
  let i = 0;
  const t = setInterval(() => {
    if (pausada) return;
    caja.textContent = texto.slice(0, ++i);
    if (i >= texto.length) { clearInterval(t); caja.classList.remove("escribiendo"); }
  }, ms);
  temporizadores.push(t);
}
function luego(ms, fn) {
  const inicio = Date.now();
  let restante = ms;
  const programar = () => {
    const t = setTimeout(() => { if (pausada) { restante = 0; programar(); return; } fn(); }, restante);
    temporizadores.push(t);
  };
  // Si se pausa, el tiempo que faltaba se vuelve a esperar al reanudar
  esperas.push({ reanudar: () => { restante = Math.max(0, ms - (Date.now() - inicio)); } });
  programar();
}

// ---------- Escenas ----------
const ESCENAS = [
  {
    titulo: "Todo en la nube", dur: 7000,
    texto: "Los datos de la tienda viven en la <b>nube</b>. Con el correo y la contraseña, los mismos productos, compras y apartados aparecen en cualquier celular o computadora.",
    armar() {
      pantalla.replaceChildren(...marco("Inicio",
        el("div.p-titulo.aparece", "Resumen"),
        el("div.p-nube.aparece-2",
          nube(),
          el("p", { style: "margin-top:8px;font-size:12.5px;color:var(--texto-2)" }, "Un solo lugar para todo"),
          el("div.dispositivos",
            el("div.dispositivo", { style: "--d:1.2s" }),
            el("div.dispositivo.ancho", { style: "--d:1.8s" }),
            el("div.dispositivo", { style: "--d:2.4s" }))),
        el("div.p-panel.aparece-5",
          el("h4", "Entrar"),
          campo("Correo", "mylestorecr@gmail.com"),
          campo("Contraseña", "••••••••"),
          boton("Entrar"))));
    },
  },
  {
    titulo: "Registrar un proveedor", dur: 9000,
    texto: "Primero, <b>a quién le compra</b>. En Ajustes se registran los proveedores con su teléfono, y luego se eligen de una lista al anotar cada compra.",
    armar() {
      const nombre = campo("Nombre", "", "Ej.: Mayorista San José");
      const tel = campo("Teléfono o WhatsApp", "", "8888-8888");
      pantalla.replaceChildren(...marco("Inicio",
        el("div.p-titulo.aparece", "Ajustes"),
        el("div.p-panel.aparece-2", el("h4", "Proveedores"), renglon("beige", "Importadora Luna", "8800-5566", "")),
        el("div.p-hoja", el("h4", "Nuevo proveedor"), nombre, tel, boton("Registrar proveedor"))));
      luego(1200, () => teclear(nombre.lastChild, "Mayorista San José"));
      luego(3200, () => teclear(tel.lastChild, "2222-0000", 70));
      luego(5200, () => { pantalla.querySelector(".p-hoja .p-boton").classList.add("pulsa"); });
      luego(5900, () => {
        pantalla.querySelector(".p-hoja").remove();
        pantalla.querySelector(".p-panel").append(renglon("rosa", "Mayorista San José", "2222-0000", ""));
        pantalla.append(toast("Proveedor registrado"));
      });
    },
  },
  {
    titulo: "Anotar una compra", dur: 10000,
    texto: "Cada pedido al proveedor se anota como una <b>compra</b>: cuántas prendas trajo y cuánto se pagó. Después se registra prenda por prenda hasta completarla.",
    armar() {
      const prendas = campo("Prendas compradas", "1");
      const monto = campo("Monto pagado", "", "₡ 0");
      pantalla.replaceChildren(...marco("Movimientos",
        el("div.p-titulo.aparece", "Nueva compra"),
        el("div.p-panel.aparece-2",
          campo("Proveedor", "Mayorista San José"),
          campo("Número de factura", "F-20451"),
          el("div.p-rejilla", prendas, monto),
          boton("Guardar compra"))));
      luego(1500, () => { prendas.lastChild.textContent = "7"; });
      luego(2300, () => teclear(monto.lastChild, "₡ 45.500", 80));
      luego(4200, () => pantalla.querySelector(".p-boton").classList.add("pulsa"));
      luego(5000, () => {
        pantalla.replaceChildren(...marco("Movimientos",
          el("div.p-titulo.aparece", "Mayorista San José"),
          el("div.p-franja.pendiente.aparece", el("span", "⬇"), el("div", el("b", "Faltan 7 prendas por registrar"), "0 de 7 ya están en el inventario")),
          el("div.p-panel.aparece-2", el("h4", "Prendas registradas"), boton("+ Registrar prenda")),
          el("div.p-panel.p-recibo.aparece-3", linea("Prendas compradas", "7"), linea("Monto pagado", "₡45.500", true))));
      });
    },
  },
  {
    titulo: "Registrar cada prenda", dur: 11000,
    texto: "Cada prenda entra con <b>cantidad, costo y precio de venta</b>. Al guardar recibe su <b>etiqueta de serie</b>, que se puede imprimir y volver a ver desde la ficha.",
    armar() {
      const nombre = campo("Nombre del producto", "", "Ej.: Blusa de lino");
      pantalla.replaceChildren(...marco("Movimientos",
        el("div.p-titulo.aparece", "Registrar prenda"),
        el("div.p-franja.pendiente.aparece", el("span", "⬇"), el("div", el("b", "Compra CO-0001 · Mayorista San José"), "0 de 7 registradas · faltan 7")),
        el("div.p-panel.aparece-2",
          nombre,
          el("div.p-rejilla", campo("Talla", "M"), campo("Cantidad", "4")),
          el("div.p-rejilla", campo("Costo", "₡6.500"), campo("Precio de venta", "₡14.900")),
          boton("Registrar ingreso"))));
      luego(1200, () => teclear(nombre.lastChild, "Blusa de lino manga corta", 40));
      luego(3600, () => pantalla.querySelector(".p-boton").classList.add("pulsa"));
      luego(4400, () => {
        pantalla.append(el("div.p-hoja",
          el("h4", "Ingreso registrado"),
          el("div.p-etiqueta", logo(), el("div.n", "Blusa de lino manga corta"), el("div.pr", "₡14.900"), el("div.serie", el("small", "Serie de ingreso"), "MS-00001")),
          el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px" }, boton("Imprimir etiqueta", ".suave"), boton("Siguiente prenda (faltan 3)"))));
      });
    },
  },
  {
    titulo: "El inventario", dur: 8000,
    texto: "El <b>inventario</b> muestra lo que hay para vender: talla, color, precio y cuántas quedan. Tocando una prenda se ve su ficha, sus etiquetas y todo su historial.",
    armar() {
      const prenda = (color, nombre, talla, precio, quedan, poco) => el("div.p-prenda", el("div.p-foto." + color), el("div", el("b", nombre), `${talla} · ${precio}`, el("br"), el(poco ? "small" : "span", { style: poco ? "" : "color:var(--texto-2)" }, `${quedan} disponibles`)));
      pantalla.replaceChildren(...marco("Inventario",
        el("div.p-titulo.aparece", "Inventario"),
        el("div", { class: "aparece-2", style: "font-size:11.5px;color:var(--texto-2)" }, "11 productos · 27 unidades disponibles"),
        el("div.p-rejilla.aparece-3",
          prenda("rosa", "Blusa de lino", "M", "₡14.900", 4),
          prenda("azul", "Jeans tiro alto", "10", "₡19.900", 5),
          prenda("beige", "Enagua plisada", "S", "₡16.500", 1, true),
          prenda("verde", "Vestido midi", "M", "₡24.900", 3)),
        el("div.p-mas.aparece-5", "+")));
    },
  },
  {
    titulo: "Armar un apartado", dur: 11000,
    texto: "Cuando un cliente pide y todavía no paga, se arma el <b>apartado</b>: se buscan las prendas y se escriben sus datos. Las prendas se <b>restan del inventario</b> y quedan guardadas para él.",
    armar() {
      const cliente = campo("Nombre", "", "Nombre y apellido");
      pantalla.replaceChildren(...marco("Apartados",
        el("div.p-titulo.aparece", "Nuevo apartado"),
        el("div.p-panel.aparece-2", el("h4", "Prendas del pedido"),
          renglon("rosa", "Blusa de lino manga corta", "M · Blanco", "₡14.900"),
          renglon("verde", "Vestido midi floral", "M · Estampado", "₡24.900")),
        el("div.p-panel.aparece-3", el("h4", "Cliente"), cliente, campo("WhatsApp", "8800-1122"),
          el("div.p-recibo", linea("Subtotal", "₡39.800"), linea("Envío", "₡2.500"), linea("Total", "₡42.300", true)),
          boton("Apartar prendas"))));
      luego(1800, () => teclear(cliente.lastChild, "Sofía Jiménez", 60));
      luego(3600, () => pantalla.querySelector(".p-boton").classList.add("pulsa"));
      luego(4400, () => {
        pantalla.replaceChildren(...marco("Apartados",
          el("div.p-titulo.aparece", "Sofía Jiménez"),
          el("div.p-franja.pendiente.aparece", el("span", "🛍"), el("div", el("b", "Apartado · ₡42.300"), "2 prendas · pendiente de facturar")),
          el("div.p-panel.aparece-2", el("h4", "¿Ya pagó?"), boton("Pasar a facturación")),
          el("div.p-panel.aparece-3", el("h4", "Avisar al cliente"), boton("WhatsApp a 8800-1122", ".suave"))));
        pantalla.append(toast("Apartado AP-0001 creado"));
      });
    },
  },
  {
    titulo: "Facturar, gastos y movimientos", dur: 12000,
    texto: "Cuando el cliente paga, se emite la <b>factura de contado</b> (directa o desde el apartado) y se le envía. Los <b>gastos</b> del negocio se anotan aparte, y todo queda en <b>Movimientos</b>.",
    armar() {
      const forma = campo("Forma de pago", "SINPE Móvil");
      pantalla.replaceChildren(...marco("Apartados",
        el("div.p-titulo.aparece", "Nueva factura"),
        el("div.p-franja.pendiente.aparece", el("span", "🛍"), el("div", el("b", "Del apartado AP-0001"), "2 prendas · ₡42.300")),
        el("div.p-panel.aparece-2", el("h4", "Cliente y pago"), campo("Nombre", "Sofía Jiménez"), forma, boton("Emitir factura"))));
      luego(2000, () => pantalla.querySelector(".p-boton").classList.add("pulsa"));
      luego(2800, () => {
        pantalla.replaceChildren(...marco("Apartados",
          el("div.p-titulo.aparece", "Sofía Jiménez"),
          el("div.p-franja.listo.aparece", el("span", "✓"), el("div", el("b", "Cobrado · ₡42.300"), "2 prendas · SINPE Móvil")),
          el("div.p-panel.aparece-2", boton("WhatsApp a 8800-1122"), el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px" }, boton("Compartir", ".suave"), boton("Imprimir / PDF", ".suave"))),
          el("div.p-factura.aparece-3", logo(), el("div.t", "Factura de contado"),
            el("div.cliente", el("b", "Sofía Jiménez"), el("br"), "FC-0001 · 2 prendas · ₡42.300"),
            el("div.p-sello-grande.cancelado", "Cancelado"))));
        pantalla.append(toast("Factura FC-0001 emitida"));
      });
      luego(6800, () => {
        pantalla.replaceChildren(...marco("Movimientos",
          el("div.p-titulo.aparece", "Movimientos"),
          el("div", { class: "aparece", style: "font-size:11px;color:var(--texto-3);font-weight:700;letter-spacing:.08em" }, "5 NOV 2026"),
          el("div.p-panel.aparece-2",
            renglon("rosa", "Blusa de lino manga corta", "Factura FC-0001 · Sofía Jiménez", "−1", "quedan 3"),
            renglon("verde", "Vestido midi floral", "Factura FC-0001 · Sofía Jiménez", "−1", "quedan 2"),
            renglon("azul", "Jeans tiro alto", "Gasto · Gasolina para entregas", "", "−₡8.000"),
            renglon("beige", "Enagua plisada", "Dañado o defectuoso", "−1", "quedan 0"),
            renglon("rosa", "Blusa de lino manga corta", "Ingreso · MS-00001", "+4", "quedan 4"))));
      });
    },
  },
];

// ---------- Reproducción ----------
let actual = -1;
let pausada = false;
let temporizadores = [];
let esperas = [];
let avance = null;

function limpiar() {
  temporizadores.forEach((t) => { clearTimeout(t); clearInterval(t); });
  temporizadores = [];
  esperas = [];
  if (avance) clearTimeout(avance);
}

function ir(n) {
  limpiar();
  actual = (n + ESCENAS.length) % ESCENAS.length;
  const e = ESCENAS[actual];
  subtitulo.classList.add("cambiando");
  setTimeout(() => { subtitulo.innerHTML = e.texto; subtitulo.classList.remove("cambiando"); }, 200);
  e.armar();
  [...listaEscenas.children].forEach((li, i) => {
    const b = li.firstChild;
    b.setAttribute("aria-current", String(i === actual));
    const barra = b.querySelector(".progreso i");
    barra.style.animation = "none";
    void barra.offsetWidth;
    barra.style.animation = "";
    barra.style.setProperty("--dur", e.dur + "ms");
  });
  if (!pausada) programarAvance(e.dur);
}
function programarAvance(ms) {
  if (avance) clearTimeout(avance);
  avance = setTimeout(() => ir(actual + 1), ms);
}
function pausar(si) {
  pausada = si;
  document.body.classList.toggle("pausada", si);
  botonPausa.querySelector("span").textContent = si ? "Reanudar" : "Pausar";
  botonPausa.querySelector("svg path").setAttribute("d", si ? "M8 5v14l11-7z" : "M7 5h3v14H7zM14 5h3v14h-3z");
  if (si) { if (avance) clearTimeout(avance); }
  else { esperas.forEach((x) => x.reanudar()); programarAvance(ESCENAS[actual].dur); }
}

listaEscenas.replaceChildren(...ESCENAS.map((e, i) => el("li", el("button", { type: "button", onclick: () => ir(i) }, el("span", e.titulo), el("span.progreso", el("i"))))));
document.getElementById("anterior").addEventListener("click", () => ir(actual - 1));
document.getElementById("siguiente").addEventListener("click", () => ir(actual + 1));
botonPausa.addEventListener("click", () => pausar(!pausada));
telefono.addEventListener("click", () => pausar(!pausada));
document.addEventListener("keydown", (ev) => {
  if (ev.key === "ArrowRight") ir(actual + 1);
  if (ev.key === "ArrowLeft") ir(actual - 1);
  if (ev.key === " ") { ev.preventDefault(); pausar(!pausada); }
});
ir(0);
