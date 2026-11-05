// Factura del apartado: la misma hoja sale en la app, en el enlace que recibe el cliente y al imprimir o guardar en PDF
import { el, adorno, dinero, fecha, talla, telefonoBonito } from "./util.js";

const unidades = (articulos) => (articulos || []).reduce((s, a) => s + Number(a.cantidad), 0);

export function armarFactura({ tienda, apartado: ap, articulos, urlFoto, interna = false }) {
  const t = tienda || {};
  const n = unidades(articulos);
  const contacto = [t.whatsapp && `WhatsApp ${telefonoBonito(t.whatsapp)}`, t.instagram].filter(Boolean).join(" · ");

  const sello = ap.estado === "anulado"
    ? el("div.factura-sello.anulado", "Anulado")
    : ap.pagado
      ? el("div.factura-sello.cancelado", "Cancelado", ap.pagado_en ? el("small", `Pagado el ${fecha(ap.pagado_en)}`) : null)
      : el("div.factura-sello.pendiente", "Pendiente", el("small", "de pago"));

  const filas = (articulos || []).map((a) => {
    const foto = urlFoto?.(a.foto_path);
    return el("tr",
      el("td",
        el("div.factura-articulo",
          foto ? el("img", { src: foto, alt: "", loading: "eager" }) : el("span.sin-foto"),
          el("div",
            el("div.nombre", a.nombre),
            el("div.var", talla(a.talla), a.color || ""),
            el("div.solo-movil", `${a.cantidad} × ${dinero(a.precio_unitario)}`)))),
      el("td.col-cant", a.cantidad),
      el("td.col-precio", dinero(a.precio_unitario)),
      el("td", dinero(a.subtotal ?? a.cantidad * a.precio_unitario)));
  });

  const linea = (et, val, clase = "") => el("div.linea" + clase, el("span.et", et), el("span.puntos"), el("span.val", val));

  const deposito = [
    t.sinpe_movil && ["SINPE Móvil", el("span", el("span.copiable", telefonoBonito(t.sinpe_movil)), t.sinpe_a_nombre ? el("small", ` · a nombre de ${t.sinpe_a_nombre}`) : null)],
    t.banco && ["Banco", t.banco],
    t.cuenta_iban && ["Cuenta IBAN", el("span.copiable", t.cuenta_iban)],
    (t.titular_cuenta || t.cedula_titular) && ["Titular", el("span", t.titular_cuenta || "", t.cedula_titular ? el("small", ` · cédula ${t.cedula_titular}`) : null)],
  ].filter(Boolean);

  let pago = null;
  if (ap.estado !== "anulado" && !ap.pagado && (deposito.length || interna)) {
    pago = el("section.factura-pago",
      el("div.factura-rotulo", "Datos para el depósito"),
      deposito.length
        ? el("dl", deposito.map(([k, v]) => [el("dt", k), el("dd", v)]))
        : el("div.factura-falta", "Faltan los datos de depósito. Complételos en Ajustes para que salgan en la factura."),
      t.nota_factura ? el("div.factura-nota", t.nota_factura) : null);
  }

  const nombreTienda = t.nombre_tienda || "Myle Store";
  return el("article.factura",
    el("header.factura-cabeza",
      el("img.factura-logo", { src: "img/logo.webp", alt: `${nombreTienda} · Moda & Beauty`, width: 640, height: 527 }),
      el("div.factura-titulo", "Factura de apartado"),
      adorno(),
      el("div.factura-meta",
        el("div", el("small", "Número"), el("b", ap.numero)),
        el("div", el("small", "Fecha"), el("b", fecha(ap.creado_en))))),
    el("section.factura-partes",
      el("div",
        el("div.factura-rotulo", "Cliente"),
        el("div.nombre", ap.cliente_nombre),
        ap.cliente_telefono || ap.cliente_direccion
          ? el("div.datos", [telefonoBonito(ap.cliente_telefono), ap.cliente_direccion].filter(Boolean).join(" · "))
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
        linea("Subtotal", dinero(ap.subtotal)),
        Number(ap.envio) > 0 ? linea("Envío", dinero(ap.envio)) : null,
        linea(ap.pagado ? "Total pagado" : "Total a pagar", dinero(ap.total), ".total"))),
    pago,
    el("footer.factura-pie",
      adorno(),
      el("div.gracias", "Gracias por su compra"),
      el("div.contacto", [nombreTienda, "Moda & Beauty", contacto].filter(Boolean).join(" · "))));
}

// Mensaje listo para WhatsApp con el detalle, el total y cómo pagar
export function textoWhatsApp({ tienda, apartado: ap, articulos, enlace }) {
  const t = tienda || {};
  const nombre = (ap.cliente_nombre || "").split(" ")[0];
  const renglones = (articulos || []).map((a) => {
    const variante = [a.talla, a.color].filter(Boolean).join(", ");
    return `• ${a.cantidad} × ${a.nombre}${variante ? ` (${variante})` : ""} — ${dinero(a.subtotal ?? a.cantidad * a.precio_unitario)}`;
  });
  const partes = [`Hola ${nombre}, le saluda ${t.nombre_tienda || "Myle Store"}.`, ""];
  if (ap.pagado) {
    partes.push(`Su apartado ${ap.numero} ya está cancelado. ¡Muchas gracias!`, "", ...renglones);
    if (Number(ap.envio) > 0) partes.push(`Envío: ${dinero(ap.envio)}`);
    partes.push(`*Total pagado: ${dinero(ap.total)}*`);
  } else {
    partes.push(`Este es su apartado ${ap.numero}:`, "", ...renglones);
    if (Number(ap.envio) > 0) partes.push(`Envío: ${dinero(ap.envio)}`);
    partes.push(`*Total a pagar: ${dinero(ap.total)}*`, "");
    if (t.sinpe_movil) partes.push(`Puede pagar por SINPE Móvil al ${telefonoBonito(t.sinpe_movil)}${t.sinpe_a_nombre ? ` (a nombre de ${t.sinpe_a_nombre})` : ""}.`);
    if (t.cuenta_iban) partes.push(`${t.sinpe_movil ? "O por" : "Puede pagar por"} depósito a la cuenta IBAN ${t.cuenta_iban}${t.banco ? ` del ${t.banco}` : ""}${t.titular_cuenta ? `, a nombre de ${t.titular_cuenta}` : ""}.`);
  }
  if (enlace) partes.push("", `Vea su factura aquí: ${enlace}`);
  if (!ap.pagado && t.nota_factura) partes.push("", t.nota_factura);
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
