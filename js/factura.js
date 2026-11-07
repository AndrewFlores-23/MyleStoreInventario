// Factura de contado: la misma hoja sale en la app, en el enlace que recibe el cliente y al imprimir o guardar en PDF
import { el, adorno, dinero, fecha, talla, telefonoBonito } from "./util.js";

const unidades = (articulos) => (articulos || []).reduce((s, a) => s + Number(a.cantidad), 0);

export function armarFactura({ tienda, factura: f, articulos, interna = false }) {
  const t = tienda || {};
  const n = unidades(articulos);
  const contacto = [t.whatsapp && `WhatsApp ${telefonoBonito(t.whatsapp)}`, t.instagram].filter(Boolean).join(" · ");
  const anulada = f.estado === "anulada";

  const sello = anulada
    ? el("div.factura-sello.anulado", "Anulada", f.anulada_en ? el("small", fecha(f.anulada_en)) : null)
    : el("div.factura-sello.cancelado", "Cancelado", el("small", f.forma_pago ? `Pagado · ${f.forma_pago}` : "Pagado"));

  const filas = (articulos || []).map((a) => el("tr",
    el("td",
      el("div.factura-articulo",
        el("div",
          el("div.nombre", a.nombre),
          el("div.var", talla(a.talla), a.color || ""),
          el("div.solo-movil", `${a.cantidad} × ${dinero(a.precio_unitario)}`)))),
    el("td.col-cant", a.cantidad),
    el("td.col-precio", dinero(a.precio_unitario)),
    el("td", dinero(a.subtotal ?? a.cantidad * a.precio_unitario))));

  const linea = (et, val, clase = "") => el("div.linea" + clase, el("span.et", et), el("span.puntos"), el("span.val", val));
  const nombreTienda = t.nombre_tienda || "Myle Store";
  const pago = [f.forma_pago, f.referencia_pago && `ref. ${f.referencia_pago}`].filter(Boolean).join(" · ");

  return el("article.factura",
    el("header.factura-cabeza",
      el("img.factura-logo", { src: "img/logo.webp", alt: `${nombreTienda} · Moda & Beauty`, width: 640, height: 527 }),
      el("div.factura-titulo", "Factura de contado"),
      adorno(),
      el("div.factura-meta",
        el("div", el("small", "Número"), el("b", f.numero)),
        el("div", el("small", "Fecha"), el("b", fecha(f.creado_en))))),
    el("section.factura-partes",
      el("div",
        el("div.factura-rotulo", "Cliente"),
        el("div.nombre", f.cliente_nombre),
        f.cliente_telefono || f.cliente_direccion
          ? el("div.datos", [telefonoBonito(f.cliente_telefono), f.cliente_direccion].filter(Boolean).join(" · "))
          : null),
      el("div.tienda",
        el("div.factura-rotulo", "Tienda"),
        el("div.nombre", nombreTienda),
        contacto ? el("div.datos", contacto) : null)),
    el("table.factura-tabla",
      el("thead", el("tr", el("th", "Artículo"), el("th", "Cant."), el("th", "Precio"), el("th", "Subtotal"))),
      el("tbody", filas)),
    el("div.factura-totales",
      sello,
      el("div.recibo",
        linea("Artículos", el("span", n, el("small", n === 1 ? "unidad" : "unidades"))),
        linea("Subtotal", dinero(f.subtotal)),
        Number(f.envio) > 0 ? linea("Envío", dinero(f.envio)) : null,
        Number(f.descuento) > 0 ? linea("Descuento", `−${dinero(f.descuento)}`) : null,
        linea("Total", dinero(f.total), ".total"),
        pago ? linea("Forma de pago", pago) : null)),
    el("footer.factura-pie",
      adorno(),
      el("div.gracias", "Gracias por su compra"),
      el("div.contacto", [nombreTienda, "Moda & Beauty", contacto].filter(Boolean).join(" · "))));
}

// Mensaje listo para WhatsApp con el detalle y el total
export function textoWhatsApp({ tienda, factura: f, articulos, enlace }) {
  const t = tienda || {};
  const nombre = (f.cliente_nombre || "").split(" ")[0];
  const renglones = (articulos || []).map((a) => {
    const variante = [a.talla, a.color].filter(Boolean).join(", ");
    return `• ${a.cantidad} × ${a.nombre}${variante ? ` (${variante})` : ""} — ${dinero(a.subtotal ?? a.cantidad * a.precio_unitario)}`;
  });
  const partes = [`Hola ${nombre}, le saluda ${t.nombre_tienda || "Myle Store"}.`, "", `Esta es su factura ${f.numero}. ¡Gracias por su compra!`, "", ...renglones];
  if (Number(f.envio) > 0) partes.push(`Envío: ${dinero(f.envio)}`);
  if (Number(f.descuento) > 0) partes.push(`Descuento: −${dinero(f.descuento)}`);
  partes.push(`*Total: ${dinero(f.total)}*`);
  if (f.forma_pago) partes.push(`Pagado por ${f.forma_pago}`);
  if (enlace) partes.push("", `Vea su factura aquí: ${enlace}`);
  return partes.join("\n");
}

// Mensaje de WhatsApp para un apartado: el pedido, el total y cómo pagar (sin factura todavía)
export function textoApartado({ tienda, apartado: ap, articulos }) {
  const t = tienda || {};
  const nombre = (ap.cliente_nombre || "").split(" ")[0];
  const renglones = (articulos || []).map((a) => {
    const variante = [a.talla, a.color].filter(Boolean).join(", ");
    return `• ${a.cantidad} × ${a.nombre}${variante ? ` (${variante})` : ""} — ${dinero(a.subtotal ?? a.cantidad * a.precio_unitario)}`;
  });
  const partes = [`Hola ${nombre}, le saluda ${t.nombre_tienda || "Myle Store"}.`, "", `Le apartamos su pedido ${ap.numero}:`, "", ...renglones];
  if (Number(ap.envio) > 0) partes.push(`Envío: ${dinero(ap.envio)}`);
  partes.push(`*Total: ${dinero(ap.total)}*`, "");
  if (t.sinpe_movil) partes.push(`Puede pagar por SINPE Móvil al ${telefonoBonito(t.sinpe_movil)}${t.sinpe_a_nombre ? ` (a nombre de ${t.sinpe_a_nombre})` : ""}.`);
  if (t.cuenta_iban) partes.push(`${t.sinpe_movil ? "O por" : "Puede pagar por"} depósito a la cuenta IBAN ${t.cuenta_iban}${t.banco ? ` del ${t.banco}` : ""}${t.titular_cuenta ? `, a nombre de ${t.titular_cuenta}` : ""}.`);
  if (t.nota_factura) partes.push("", t.nota_factura);
  return partes.join("\n");
}

// Compartir con el menú del celular (WhatsApp, guardar, AirDrop…); en la compu copia el enlace
export async function compartirFactura({ titulo, texto, enlace }) {
  if (navigator.share) {
    try {
      await navigator.share({ title: titulo, text: texto, url: enlace });
      return "compartido";
    } catch (e) {
      if (e?.name === "AbortError") return "cancelado";
    }
  }
  try {
    await navigator.clipboard.writeText(enlace);
    return "copiado";
  } catch {
    prompt("Copie el enlace de la factura:", enlace);
    return "mostrado";
  }
}

export function enlaceFactura(token) {
  const u = new URL("factura.html", location.href);
  u.hash = "";
  u.search = `?t=${token}` + (new URLSearchParams(location.search).has("demo") ? "&demo" : "");
  return u.href;
}

// Imprime solo la hoja; en el celular o la compu se puede elegir "Guardar como PDF"
export async function imprimirFactura(nodo, titulo) {
  let caja = document.getElementById("impresion");
  if (!caja) {
    caja = el("div", { id: "impresion" });
    document.body.append(caja);
  }
  caja.replaceChildren(nodo.cloneNode(true));
  await Promise.all([...caja.querySelectorAll("img")].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
  const tituloAntes = document.title;
  if (titulo) document.title = titulo;
  document.body.classList.add("imprimiendo");
  const limpiar = () => {
    document.body.classList.remove("imprimiendo");
    caja.replaceChildren();
    document.title = tituloAntes;
    window.removeEventListener("afterprint", limpiar);
  };
  window.addEventListener("afterprint", limpiar);
  window.print();
}
