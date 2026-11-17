// Factura de contado como imagen (PNG) para mandarla por WhatsApp. Se dibuja en un lienzo con la marca de Myle
// y crece con las prendas, así nunca sale cortada como el PDF. Los costos y las notas internas no salen.
import { dinero, fecha, telefonoBonito, colorTela } from "./util.js";

const ANCHO = 440;              // ancho de diseño; la imagen sale de 1080 px
const PX = 1080 / ANCHO;
const MARGEN = 12;              // rubor alrededor del papel
const RELLENO = 24;             // del borde del papel al contenido
const X0 = MARGEN + RELLENO;
const CW = ANCHO - 2 * X0;      // ancho útil
const CX = ANCHO / 2;

const C = {
  rubor: "#fcf1ee", papel: "#ffffff", borde: "#f0dcd3", tinta: "#3b1322", tinta2: "#7c4b5a", tinta3: "#a9818c",
  raya: "#f1dcd7", puntos: "#e6c3c3", acento: "#b80840", oro: "#c49a5c", talla: "#e0bcbc", pagado: "#2b8656", anulado: "#c62828",
};
const MARCA = '"Bodoni Moda", Didot, "Bodoni 72", Georgia, serif';
const TEXTO = '"Segoe UI", system-ui, -apple-system, "Helvetica Neue", sans-serif';
const NUM = 'Bahnschrift, "DIN Alternate", "Segoe UI", system-ui, sans-serif';
const CORAZON = "M12 19.5s-7-4.3-7-9.6A3.9 3.9 0 0 1 12 7.6a3.9 3.9 0 0 1 7 2.3c0 5.3-7 9.6-7 9.6z";

const cargarImagen = (src) => new Promise((listo) => {
  const i = new Image();
  i.onload = () => listo(i);
  i.onerror = () => listo(null);
  i.src = src;
});

// La Bodoni viene de Google Fonts: se espera a que cargue, pero sin internet sale con la letra de respaldo
async function letrasListas() {
  if (!document.fonts?.load) return;
  const pedir = ["500 13px", "600 20px", "italic 500 22px"].map((f) => document.fonts.load(`${f} "Bodoni Moda"`, "Factura FC-0123").catch(() => null));
  await Promise.race([Promise.all(pedir), new Promise((r) => setTimeout(r, 2500))]);
}

// ---------- Ayudas de dibujo ----------
function renglones(ctx, texto, ancho) {
  const palabras = String(texto || "").split(/\s+/).filter(Boolean).flatMap((p) => {
    if (ctx.measureText(p).width <= ancho) return [p];
    const trozos = [];
    let t = "";
    for (const letra of p) {
      if (t && ctx.measureText(t + letra).width > ancho) { trozos.push(t); t = letra; } else t += letra;
    }
    return [...trozos, t];
  });
  const salida = [];
  let actual = "";
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (!actual || ctx.measureText(prueba).width <= ancho) actual = prueba;
    else { salida.push(actual); actual = p; }
  }
  if (actual) salida.push(actual);
  return salida;
}

function recortar(ctx, texto, ancho) {
  if (ctx.measureText(texto).width <= ancho) return texto;
  let t = texto;
  while (t && ctx.measureText(t + "…").width > ancho) t = t.slice(0, -1);
  return t + "…";
}

// Texto con letras separadas (los rótulos en mayúscula); devuelve el ancho que ocupó
function espaciado(ctx, texto, x, y, sep, alinear = "left") {
  const letras = [...texto];
  const anchos = letras.map((l) => ctx.measureText(l).width);
  const total = anchos.reduce((s, a) => s + a, 0) + sep * (letras.length - 1);
  let cx = alinear === "center" ? x - total / 2 : alinear === "right" ? x - total : x;
  letras.forEach((l, i) => { ctx.fillText(l, cx, y); cx += anchos[i] + sep; });
  return total;
}

function escribir(ctx, texto, x, y, fuente, color, alinear = "left") {
  ctx.font = fuente;
  ctx.fillStyle = color;
  ctx.textAlign = alinear;
  ctx.fillText(texto, x, y);
  ctx.textAlign = "left";
}

function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function raya(ctx, y, color = C.raya) {
  ctx.fillStyle = color;
  ctx.fillRect(X0, y, CW, 1);
}

// Línea dorada con el corazón al centro, como la del logo
function adorno(ctx, y, ancho, cx) {
  ctx.save();
  ctx.fillStyle = C.oro;
  ctx.fillRect(cx - ancho / 2, y, ancho / 2 - 15, 1);
  ctx.fillRect(cx + 15, y, ancho / 2 - 15, 1);
  ctx.translate(cx - 8, y - 8.5);
  ctx.scale(2 / 3, 2 / 3);
  ctx.strokeStyle = C.oro;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = "round";
  ctx.stroke(new Path2D(CORAZON));
  ctx.restore();
}

// Rótulo · · · · · valor (como .linea de la app)
function renglonTotal(ctx, y, rotulo, valor, fuente, color = C.tinta) {
  ctx.font = `600 10.5px ${TEXTO}`;
  ctx.fillStyle = C.tinta2;
  const anchoRotulo = espaciado(ctx, rotulo.toUpperCase(), X0, y, 0.9);
  ctx.font = fuente;
  const anchoValor = ctx.measureText(valor).width;
  const cabe = anchoRotulo + anchoValor + 28 <= CW;
  const yValor = cabe ? y : y + 20;
  escribir(ctx, valor, X0 + CW, yValor, fuente, color, "right");
  if (cabe) {
    ctx.save();
    ctx.strokeStyle = C.puntos;
    ctx.lineWidth = 1;
    ctx.setLineDash([1, 3]);
    ctx.beginPath();
    ctx.moveTo(X0 + anchoRotulo + 10, y - 3.5);
    ctx.lineTo(X0 + CW - anchoValor - 10, y - 3.5);
    ctx.stroke();
    ctx.restore();
  }
  return yValor;
}

function pastillaTalla(ctx, texto, x, y) {
  ctx.font = `600 10.5px ${NUM}`;
  const t = texto.toUpperCase();
  const w = Math.max(20, ctx.measureText(t).width + 10);
  ctx.strokeStyle = C.talla;
  ctx.lineWidth = 1;
  redondo(ctx, x + 0.5, y + 0.5, w, 16, 2);
  ctx.stroke();
  escribir(ctx, t, x + 0.5 + w / 2, y + 12.3, ctx.font, C.tinta, "center");
  return w;
}

function sello(ctx, x, y, anulada, f) {
  const titulo = anulada ? "ANULADA" : "CANCELADO";
  const detalle = anulada ? (f.anulada_en ? fecha(f.anulada_en) : "") : f.forma_pago ? `Pagado · ${f.forma_pago}` : "Pagado";
  const color = anulada ? C.anulado : C.pagado;
  ctx.font = `800 15px ${TEXTO}`;
  const letras = [...titulo];
  const anchoTitulo = letras.reduce((s, l) => s + ctx.measureText(l).width, 0) + 2.2 * (letras.length - 1);
  ctx.font = `600 9px ${TEXTO}`;
  const w = Math.max(anchoTitulo, ctx.measureText(detalle).width) + 26;
  const h = 40;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(-9 * Math.PI / 180);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.4;
  if (anulada) ctx.setLineDash([2, 3]);
  redondo(ctx, -w / 2, -h / 2, w, h, 8);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `800 15px ${TEXTO}`;
  espaciado(ctx, titulo, 0, -1, 2.2, "center");
  escribir(ctx, detalle, 0, 12.5, `600 9px ${TEXTO}`, color, "center");
  ctx.restore();
}

// ---------- La hoja ----------
function fondo(ctx, alto, rec) {
  const x = MARGEN, y = MARGEN, w = ANCHO - 2 * MARGEN, h = alto - 2 * MARGEN;
  ctx.fillStyle = C.rubor;
  ctx.fillRect(0, 0, ANCHO, alto);
  ctx.save();
  ctx.shadowColor = "rgba(120, 30, 60, 0.12)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 6;
  redondo(ctx, x, y, w, h, 16);
  ctx.fillStyle = C.papel;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = C.borde;
  ctx.lineWidth = 1;
  redondo(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 16);
  ctx.stroke();
  // Mariposa del logo como marca de agua
  if (rec.mariposa) {
    const mw = 150, mh = mw * rec.mariposa.height / rec.mariposa.width;
    ctx.save();
    redondo(ctx, x, y, w, h, 16);
    ctx.clip();
    ctx.globalAlpha = 0.08;
    ctx.translate(x + w - mw / 2 + 30, y + h - mh / 2 + 22);
    ctx.scale(-1, 1);
    ctx.rotate(-8 * Math.PI / 180);
    ctx.drawImage(rec.mariposa, -mw / 2, -mh / 2, mw, mh);
    ctx.restore();
  }
  ctx.strokeStyle = "rgba(196, 154, 92, 0.7)";
  redondo(ctx, x + 8.5, y + 8.5, w - 17, h - 17, 9);
  ctx.stroke();
}

// Dibuja el contenido y devuelve hasta dónde llegó (la primera pasada solo mide el alto)
function contenido(ctx, { tienda: t, factura: f, articulos }, rec) {
  ctx.textBaseline = "alphabetic";
  const nombreTienda = t.nombre_tienda || "Myle Store";
  const derecha = X0 + CW;
  let y = MARGEN + RELLENO;

  // Encabezado: logo a la izquierda; número y fecha a la derecha
  let altoLogo = 40;
  if (rec.logo) {
    const w = 132, h = w * rec.logo.height / rec.logo.width;
    ctx.drawImage(rec.logo, X0 - 8, y - 4, w, h);
    altoLogo = h - 4;
  } else {
    ctx.font = `600 28px ${MARCA}`;
    escribir(ctx, recortar(ctx, nombreTienda, CW - 190), X0, y + 30, ctx.font, C.acento);
  }
  ctx.font = `500 11px ${MARCA}`;
  ctx.fillStyle = C.tinta2;
  const anchoTitulo = espaciado(ctx, "FACTURA DE CONTADO", derecha, y + 12, 2.4, "right");
  adorno(ctx, y + 24, anchoTitulo, derecha - anchoTitulo / 2);
  [["NÚMERO", f.numero], ["FECHA", fecha(f.creado_en)]].forEach(([rotulo, valor], i) => {
    const yy = y + 46 + i * 39;
    ctx.font = `700 9px ${TEXTO}`;
    ctx.fillStyle = C.tinta3;
    espaciado(ctx, rotulo, derecha, yy, 1.6, "right");
    escribir(ctx, valor, derecha, yy + 19, `600 18px ${MARCA}`, C.tinta, "right");
  });
  y += Math.max(altoLogo, 104) + 14;

  // Cliente y tienda, lado a lado
  raya(ctx, y);
  y += 20;
  const anchoCliente = CW * 0.54 - 9, anchoTienda = CW * 0.46 - 9;
  const columna = (x, ancho, alinear, rotulo, nombre, datos) => {
    let yy = y;
    ctx.font = `700 9px ${TEXTO}`;
    ctx.fillStyle = C.tinta3;
    espaciado(ctx, rotulo, x, yy, 1.4, alinear);
    yy += 19;
    ctx.font = `600 16px ${MARCA}`;
    for (const r of renglones(ctx, nombre, ancho)) { escribir(ctx, r, x, yy, ctx.font, C.tinta, alinear); yy += 19; }
    ctx.font = `12.5px ${TEXTO}`;
    for (const d of datos) for (const r of renglones(ctx, d, ancho)) { yy += 1; escribir(ctx, r, x, yy, ctx.font, C.tinta2, alinear); yy += 16; }
    return yy;
  };
  const yCliente = columna(X0, anchoCliente, "left", "CLIENTE", f.cliente_nombre,
    [telefonoBonito(f.cliente_telefono), f.cliente_direccion].filter(Boolean));
  const yTienda = columna(X0 + CW, anchoTienda, "right", "TIENDA", nombreTienda,
    [t.whatsapp && `WhatsApp ${telefonoBonito(t.whatsapp)}`, t.instagram].filter(Boolean));
  y = Math.max(yCliente, yTienda) - 2;
  raya(ctx, y);
  y += 22;

  // Prendas: nombre y subtotal; debajo talla, color y cantidad × precio
  ctx.font = `700 9px ${TEXTO}`;
  ctx.fillStyle = C.tinta3;
  espaciado(ctx, "ARTÍCULO", X0, y, 1.3);
  espaciado(ctx, "SUBTOTAL", derecha, y, 1.3, "right");
  y += 8;
  raya(ctx, y, C.oro);
  for (const a of articulos) {
    const sub = dinero(a.subtotal ?? a.cantidad * a.precio_unitario);
    ctx.font = `600 14px ${NUM}`;
    const anchoSub = ctx.measureText(sub).width;
    y += 23;
    escribir(ctx, sub, derecha, y, ctx.font, C.tinta, "right");
    ctx.font = `600 14px ${TEXTO}`;
    const nombre = renglones(ctx, a.nombre, CW - anchoSub - 16);
    nombre.forEach((r, i) => escribir(ctx, r, X0, y + i * 18, ctx.font, C.tinta));
    y += (nombre.length - 1) * 18 + 8;

    const cantidad = `${a.cantidad} × ${dinero(a.precio_unitario)}`;
    ctx.font = `12px ${NUM}`;
    const anchoCant = ctx.measureText(cantidad).width;
    escribir(ctx, cantidad, derecha, y + 12.3, ctx.font, C.tinta2, "right");
    let x = X0;
    if (a.talla) x += pastillaTalla(ctx, a.talla, x, y) + 7;
    if (a.color) {
      const muestra = colorTela(a.color);
      if (muestra?.startsWith("#")) {
        ctx.beginPath();
        ctx.arc(x + 4.5, y + 8, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = muestra;
        ctx.fill();
        ctx.strokeStyle = "rgba(59, 19, 34, 0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
        x += 13;
      }
      ctx.font = `12px ${TEXTO}`;
      escribir(ctx, recortar(ctx, a.color, derecha - anchoCant - 14 - x), x, y + 12.3, ctx.font, C.tinta2);
    }
    y += 27;
    raya(ctx, y);
  }

  // Totales
  const n = articulos.reduce((s, a) => s + Number(a.cantidad), 0);
  const valor = `600 15px ${NUM}`;
  y += 26;
  y = renglonTotal(ctx, y, "Artículos", `${n} ${n === 1 ? "unidad" : "unidades"}`, valor) + 24;
  y = renglonTotal(ctx, y, "Subtotal", dinero(f.subtotal), valor) + 24;
  if (Number(f.envio) > 0) y = renglonTotal(ctx, y, "Envío", dinero(f.envio), valor) + 24;
  if (Number(f.descuento) > 0) y = renglonTotal(ctx, y, "Descuento", `−${dinero(f.descuento)}`, valor) + 24;
  y -= 12;
  raya(ctx, y, C.oro);
  y += 32;
  y = renglonTotal(ctx, y, "Total", dinero(f.total), `600 26px ${MARCA}`, C.acento);
  const pago = [f.forma_pago, f.referencia_pago && `ref. ${f.referencia_pago}`].filter(Boolean).join(" · ");
  if (pago) y = renglonTotal(ctx, y + 26, "Forma de pago", pago, `600 14px ${NUM}`);

  // Sello a la izquierda y el agradecimiento a la derecha
  y += 26;
  sello(ctx, X0 + 4, y, f.estado === "anulada", f);
  ctx.font = `italic 500 19px ${MARCA}`;
  const anchoGracias = ctx.measureText("Gracias por su compra").width;
  escribir(ctx, "Gracias por su compra", derecha, y + 20, ctx.font, C.acento, "right");
  adorno(ctx, y + 36, anchoGracias, derecha - anchoGracias / 2);
  y += 68;

  // Pie
  ctx.font = `11.5px ${TEXTO}`;
  const contacto = [nombreTienda, "Moda & Beauty", t.whatsapp && `WhatsApp ${telefonoBonito(t.whatsapp)}`, t.instagram].filter(Boolean).join(" · ");
  for (const r of renglones(ctx, contacto, CW)) { escribir(ctx, r, CX, y, ctx.font, C.tinta3, "center"); y += 15; }
  return y;
}

// Devuelve el archivo PNG listo para compartir
export async function imagenFactura({ tienda, factura, articulos }) {
  const [logo, mariposa] = await Promise.all([cargarImagen("img/logo.webp"), cargarImagen("img/mariposa.webp"), letrasListas()]);
  const rec = { logo, mariposa };
  const d = { tienda: tienda || {}, factura, articulos: articulos || [] };
  const alto = Math.ceil(contenido(document.createElement("canvas").getContext("2d"), d, rec) + RELLENO - 4 + MARGEN);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(ANCHO * PX);
  lienzo.height = Math.round(alto * PX);
  const ctx = lienzo.getContext("2d");
  ctx.scale(PX, PX);
  fondo(ctx, alto, rec);
  contenido(ctx, d, rec);
  const blob = await new Promise((listo, mal) => lienzo.toBlob((b) => (b ? listo(b) : mal(new Error("No se pudo crear la imagen de la factura"))), "image/png"));
  return new File([blob], `Factura ${factura.numero}.png`, { type: "image/png" });
}

// Comparte la imagen con el menú del celular (WhatsApp, Fotos…); donde no se puede compartir archivos, la descarga
export async function compartirImagen(archivo) {
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo] });
      return "compartida";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelado";
      if (e?.name === "NotAllowedError") return "sin-permiso";
    }
  }
  descargarImagen(archivo);
  return "descargada";
}

export function descargarImagen(archivo) {
  const url = URL.createObjectURL(archivo);
  const a = Object.assign(document.createElement("a"), { href: url, download: archivo.name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
