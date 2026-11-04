// Página que abre el cliente desde el enlace de WhatsApp: su factura, cómo pagar y botón para enviar el comprobante
import { iniciarDatos, datos } from "./datos.js";
import { $, el, icono, ponerMoneda, telefonoWa, mensajeError, avisar } from "./util.js";
import { armarFactura, imprimirFactura } from "./factura.js";

const caja = $("#factura");
const token = new URLSearchParams(location.search).get("t");
const esToken = /^[0-9a-f-]{36}$/i.test(token || "");

function problema(texto) {
  caja.replaceChildren(el("div.vacio", icono("alerta"), el("p", texto), el("p", "Escríbale a la tienda para que le envíe el enlace de nuevo.")));
}

async function mostrar() {
  if (!esToken) return problema("Este enlace de factura no está completo.");
  try {
    await iniciarDatos();
    const f = await datos.facturaPublica(token);
    if (!f) return problema("No encontramos esta factura.");
    ponerMoneda(f.tienda?.moneda);
    const { tienda, apartado: ap, articulos } = f;
    document.title = `Factura ${ap.numero} · ${tienda?.nombre_tienda || "Myle Store"}`;
    const hoja = armarFactura({ tienda, apartado: ap, articulos, urlFoto: (r) => datos.urlFoto(r) });
    const tel = telefonoWa(tienda?.whatsapp);
    const texto = encodeURIComponent(ap.pagado
      ? `Hola, le escribo por mi apartado ${ap.numero}.`
      : `Hola, le envío el comprobante de pago del apartado ${ap.numero}.`);
    caja.replaceChildren(
      hoja,
      el("div.acciones-publicas",
        ap.estado !== "anulado" && tel
          ? el("a.btn.primario.grande", { href: `https://wa.me/${tel}?text=${texto}`, target: "_blank", rel: "noopener" }, icono("chat"), ap.pagado ? "Escribir a la tienda" : "Enviar comprobante por WhatsApp")
          : null,
        el("button.btn.grande", { type: "button", onclick: () => imprimirFactura(hoja, document.title) }, icono("imprimir"), "Guardar o imprimir")));
  } catch (e) {
    console.error(e);
    problema(mensajeError(e));
    avisar(mensajeError(e), "error");
  }
}

mostrar();
