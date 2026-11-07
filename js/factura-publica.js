// Página que abre el cliente desde el enlace de WhatsApp: su factura, cómo pagar y botón para enviar el comprobante
import { iniciarDatos, datos } from "./datos.js";
import { $, el, icono, ponerMoneda, telefonoWa, mensajeError, avisar } from "./util.js";
import { armarFactura, imprimirFactura, compartirFactura } from "./factura.js";

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
    const { tienda, factura: fc, articulos } = f;
    document.title = `Factura ${fc.numero} · ${tienda?.nombre_tienda || "Myle Store"}`;
    const hoja = armarFactura({ tienda, factura: fc, articulos });
    const tel = telefonoWa(tienda?.whatsapp);
    const texto = encodeURIComponent(`Hola, le escribo por mi factura ${fc.numero}.`);
    caja.replaceChildren(
      hoja,
      el("div.acciones-publicas",
        fc.estado !== "anulada" && tel
          ? el("a.btn.primario.grande", { href: `https://wa.me/${tel}?text=${texto}`, target: "_blank", rel: "noopener" }, icono("chat"), "Escribir a la tienda")
          : null,
        el("button.btn.grande", { type: "button", onclick: async () => { const r = await compartirFactura({ titulo: document.title, texto: `Factura ${fc.numero} · ${tienda?.nombre_tienda || "Myle Store"}`, enlace: location.href }); if (r === "copiado") avisar("Enlace copiado"); } }, icono("compartir"), "Compartir"),
        el("button.btn.grande", { type: "button", onclick: () => imprimirFactura(hoja, document.title) }, icono("imprimir"), "Guardar o imprimir")));
  } catch (e) {
    console.error(e);
    problema(mensajeError(e));
    avisar(mensajeError(e), "error");
  }
}

mostrar();
