// Facturación: la factura de contado. Se emite directo (las prendas salen del inventario) o desde un apartado
// (las prendas ya salieron al apartarse). La misma hoja se envía por WhatsApp, se comparte y se imprime.
import { datos } from "../datos.js";
import { estado, cargarProductos, ir } from "../estado.js";
import { el, icono, dinero, fecha, fechaHora, hace, sinTildes, telefonoBonito, telefonoWa, mismoMes, esHoy, nombreMes,
  trabajando, avisar, mensajeError, abrirHoja } from "../util.js";
import { marcaProducto, sellosFactura, unidades, vacio } from "../componentes.js";
import { armarFactura, textoWhatsApp, enlaceFactura, imprimirFactura, compartirFactura } from "../factura.js";
import { armarPedido, camposCliente } from "./pedido.js";

const FORMAS_PAGO = ["SINPE Móvil", "Efectivo", "Transferencia", "Tarjeta", "Otro"];

export function vistaFacturacion(pagina, ctx) {
  const [primera] = ctx.partes;
  if (primera === "nueva") return vistaNueva(pagina, ctx);
  if (primera) return vistaDetalle(pagina, ctx, primera);
  return vistaLista(pagina, ctx);
}

// ---------- Lista ----------
const FILTROS = [
  ["hoy", "Hoy", (f) => f.estado === "emitida" && esHoy(f.creado_en)],
  ["mes", "Este mes", (f) => f.estado === "emitida" && mismoMes(f.creado_en)],
  ["todas", "Todas", (f) => f.estado === "emitida"],
  ["anuladas", "Anuladas", (f) => f.estado === "anulada"],
];
let filtroLista = "mes";
let textoLista = "";

async function vistaLista(_pagina, ctx) {
  const facturas = await datos.facturas();
  const pestanas = el("div.pestanas-filtro");
  const lista = el("div.lista");
  const resumen = el("div.totales-inventario");

  const pintar = () => {
    pestanas.replaceChildren(...FILTROS.map(([clave, texto, fn]) => el("button", {
      type: "button", "aria-pressed": String(filtroLista === clave),
      onclick: () => { filtroLista = clave; pintar(); },
    }, texto, el("span.n", facturas.filter(fn).length))));
    const [, , condicion] = FILTROS.find(([c]) => c === filtroLista);
    const palabras = sinTildes(textoLista).split(/\s+/).filter(Boolean);
    const elegidas = facturas.filter(condicion).filter((f) => {
      const texto = sinTildes([f.numero, f.cliente_nombre, f.cliente_telefono, f.forma_pago].join(" "));
      return palabras.every((w) => texto.includes(w));
    });
    const monto = elegidas.reduce((s, f) => s + Number(f.total), 0);
    resumen.replaceChildren(
      el("span", el("b", elegidas.length), ` factura${elegidas.length === 1 ? "" : "s"}`),
      el("span", el("b", unidades(elegidas.flatMap((f) => f.articulos))), " prendas"),
      el("span", filtroLista === "anuladas" ? "anulado " : "vendido ", el("b", dinero(monto))));
    lista.replaceChildren(...(elegidas.length ? elegidas.map(fila) : [
      facturas.length
        ? vacio("billete", "No hay facturas aquí.")
        : vacio("billete", "Todavía no hay facturas.", "Cuando un cliente pague, emita aquí su factura de contado.",
          el("a.btn.primario", { href: "#/facturacion/nueva" }, icono("mas"), "Nueva factura")),
    ]));
  };

  const fila = (f) => el("a.renglon.apartado-fila", { href: `#/facturacion/${f.id}` },
    el("span.compra-icono" + (f.estado === "anulada" ? ".pendiente" : ""), icono("billete")),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", f.cliente_nombre),
      el("div.renglon-sub", sellosFactura(f), f.apartado ? el("span.tenue", `de ${f.apartado.numero}`) : null),
      el("div.renglon-sub.tenue", el("span.numero", f.numero), `${unidades(f.articulos)} prendas · ${fecha(f.creado_en)}${f.forma_pago ? ` · ${f.forma_pago}` : ""}`)),
    el("div.renglon-fin", el("div.num", dinero(f.total)), el("small", f.estado === "anulada" ? "anulada" : "cobrado")));

  const buscar = el("input", { type: "search", placeholder: "Buscar cliente, número o forma de pago", value: textoLista, oninput: (e) => { textoLista = e.target.value; pintar(); } });
  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Facturación"), el("p", "Facturas de contado: lo que ya se cobró.")),
      el("div.acciones", el("a.btn.primario", { href: "#/facturacion/nueva" }, icono("mas"), "Nueva factura"))),
    el("div.filtros", el("div.buscar", icono("buscar"), buscar)),
    pestanas,
    resumen,
    el("section.panel", lista));
  pintar();
}

// ---------- Nueva factura (directa o desde un apartado) ----------
async function vistaNueva(_pagina, ctx) {
  const apartadoId = ctx.consulta.get("apartado");
  const [ap] = await Promise.all([apartadoId ? datos.apartado(apartadoId) : null, cargarProductos()]);
  if (apartadoId && (!ap || ap.estado !== "pendiente")) {
    ctx.pintar(vacio("bolsa", !ap ? "Ese apartado no existe." : `Ese apartado ya está ${ap.estado}.`, null, el("a.btn", { href: "#/apartados" }, "Ver apartados")));
    return;
  }
  const error = el("div.error-form.oculto");
  const pedido = ap ? null : armarPedido({ conDescuento: true });
  const cliente = camposCliente({ telefonoAyuda: "(para enviarle la factura)" });
  if (ap) {
    cliente.nombre.value = ap.cliente_nombre;
    cliente.telefono.value = ap.cliente_telefono || "";
    cliente.direccion.value = ap.cliente_direccion || "";
    cliente.notas.value = ap.notas || "";
  }
  const formaPago = el("select", FORMAS_PAGO.map((f) => el("option", { value: f }, f)));
  const referencia = el("input", { placeholder: "Ej.: 4471 o número de comprobante", autocomplete: "off" });
  const boton = el("button.btn.primario.grande.ancho", { type: "submit" }, icono("check"), "Emitir factura");

  const panelApartado = ap ? el("section.panel",
    el("div.panel-titulo", el("h2", `Prendas del apartado ${ap.numero}`)),
    el("div.lista", ap.articulos.map((a) => el("div.renglon",
      marcaProducto(a),
      el("div.renglon-cuerpo", el("div.renglon-titulo", a.nombre), el("div.renglon-sub", a.talla ? el("span.talla", a.talla) : null, a.color || "")),
      el("div.renglon-fin", el("div.num", dinero(a.subtotal ?? a.cantidad * a.precio_unitario)), el("small", `${a.cantidad} × ${dinero(a.precio_unitario)}`))))),
    el("div.recibo", { style: "margin-top:10px" },
      el("div.linea", el("span.et", "Subtotal"), el("span.puntos"), el("span.val", dinero(ap.subtotal))),
      Number(ap.envio) > 0 ? el("div.linea", el("span.et", "Envío"), el("span.puntos"), el("span.val", dinero(ap.envio))) : null,
      el("div.linea.total", el("span.et", "Total"), el("span.puntos"), el("span.val", dinero(ap.total)))),
    el("p.tenue", { style: "margin-top:10px;font-size:13px" }, "Las prendas ya salieron del inventario al apartarse; la factura las toma tal cual.")) : null;

  const form = el("form.dos-columnas", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      const falta = !ap && pedido.vacio() ? "Agregue al menos una prenda." : !cliente.nombre.value.trim() ? "Escriba el nombre del cliente." : null;
      if (falta) {
        error.textContent = falta;
        error.classList.remove("oculto");
        return;
      }
      try {
        const f = await trabajando(boton, () => datos.crearFactura({
          ...cliente.leer(), apartadoId: ap?.id || null,
          articulos: ap ? null : pedido.articulos(), envio: ap ? Number(ap.envio) : pedido.envio(), descuento: ap ? 0 : pedido.descuento(),
          formaPago: formaPago.value, referenciaPago: referencia.value,
        }), "Emitiendo…");
        await cargarProductos();
        avisar(`Factura ${f.numero} emitida`);
        ir(`facturacion/${f.id}`);
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
        await cargarProductos();
      }
    },
  },
    ap ? panelApartado : pedido.panelPrendas("Prendas que se venden"),
    el("section.panel",
      el("div.panel-titulo", el("h2", "Cliente y pago")),
      el("div.pila.media",
        ...cliente.campos,
        ap ? null : pedido.campoEnvio,
        ap ? null : pedido.campoDescuento,
        el("div.rejilla.dos",
          el("label.campo", el("span", "Forma de pago"), formaPago),
          el("label.campo", el("span", "Referencia ", el("em", "(opcional)")), referencia)),
        cliente.campoNotas,
        ap ? null : pedido.totales,
        error,
        boton,
        el("p.tenue", { style: "font-size:13px" }, ap ? "Al emitir, el apartado queda facturado." : "Al emitir, las prendas salen del inventario y la venta queda registrada."))));

  ctx.pintar(
    el("a.volver", { href: ap ? `#/apartados/${ap.id}` : "#/facturacion" }, icono("atras", "chico"), ap ? `Apartado ${ap.numero}` : "Facturación"),
    el("div.cabeza", el("div", el("h1", "Nueva factura"), el("p", ap ? `Factura de contado del apartado ${ap.numero}.` : "Factura de contado de una venta ya pagada."))),
    form);
}

// ---------- Detalle con la factura ----------
async function vistaDetalle(_pagina, ctx, id) {
  let f = await datos.factura(id);
  if (!f) {
    ctx.pintar(vacio("billete", "Esa factura no existe.", null, el("a.btn", { href: "#/facturacion" }, "Ver facturas")));
    return;
  }
  const enlace = enlaceFactura(f.token);

  const franja = () => {
    const n = unidades(f.articulos);
    const prendas = `${n} prenda${n === 1 ? "" : "s"}`;
    if (f.estado === "anulada") return el("div.franja-estado.anulado", icono("anular"), el("div", el("strong", "Anulada"), el("span", `${fecha(f.anulada_en)} · ${prendas} de vuelta al inventario`)));
    return el("div.franja-estado.vendido", icono("check"), el("div", el("strong", `Cobrado · ${dinero(f.total)}`), el("span", `${prendas} · ${f.forma_pago || "pagado"} · ${hace(f.creado_en)}`)));
  };

  const pintar = () => {
    const hoja = armarFactura({ tienda: estado.ajustes, factura: f, articulos: f.articulos, interna: true });
    const factura = el("details.factura-plegable", { open: !matchMedia("(max-width: 960px)").matches },
      el("summary", el("span", icono("imprimir", "chico"), "Ver la factura"), icono("atras", "chico flecha")),
      el("div.contenedor-factura", hoja));
    ctx.pintar(
      el("a.volver", { href: "#/facturacion" }, icono("atras", "chico"), "Facturación"),
      el("div.cabeza",
        el("div",
          el("h1", f.cliente_nombre),
          el("div.renglon-sub", { style: "margin-top:6px" }, el("span.serie", f.numero), sellosFactura(f), f.apartado ? el("a.tenue", { href: `#/apartados/${f.apartado.id}` }, `del apartado ${f.apartado.numero}`) : null))),
      franja(),
      el("div.dos-columnas",
        factura,
        el("aside.acciones-apartado",
          el("div.panel",
            el("div.panel-titulo", el("h2", "Enviar la factura")),
            el("div.pila.chica",
              el("a.btn.primario", { href: whatsapp(), target: "_blank", rel: "noopener" }, icono("chat"), f.cliente_telefono ? `WhatsApp a ${telefonoBonito(f.cliente_telefono)}` : "Enviar por WhatsApp"),
              el("div.fila-botones.pareja",
                el("button.btn", { type: "button", onclick: compartir }, icono("compartir"), "Compartir"),
                el("button.btn", { type: "button", onclick: () => imprimirFactura(hoja, `Factura ${f.numero} · ${f.cliente_nombre}`) }, icono("imprimir"), "Imprimir / PDF")))),
          el("div.panel",
            el("div.panel-titulo", el("h2", "Cliente"), f.estado === "emitida" ? el("button.btn.fantasma.chico", { type: "button", onclick: editarCliente }, icono("editar", "chico"), "Editar") : null),
            el("div.recibo",
              f.cliente_telefono ? el("div.renglon-sub", "Teléfono: ", el("b", telefonoBonito(f.cliente_telefono))) : null,
              f.cliente_direccion ? el("div.renglon-sub", "Entrega: ", f.cliente_direccion) : null,
              f.forma_pago ? el("div.renglon-sub", "Pago: ", el("b", f.forma_pago), f.referencia_pago ? ` · ref. ${f.referencia_pago}` : "") : null,
              f.notas ? el("div.renglon-sub", { style: "margin-top:6px" }, "Notas: ", f.notas) : null)),
          f.estado === "anulada" ? el("div.panel", el("p", `Anulada el ${fechaHora(f.anulada_en)}.`), f.motivo_anulacion ? el("p.suave", { style: "margin-top:6px" }, `Motivo: ${f.motivo_anulacion}`) : null) : null,
          f.estado === "emitida" ? el("button.btn.peligro", { type: "button", onclick: anular }, icono("anular"), "Anular factura") : null)));
  };

  const whatsapp = () => {
    const texto = encodeURIComponent(textoWhatsApp({ tienda: estado.ajustes, factura: f, articulos: f.articulos, enlace }));
    const tel = telefonoWa(f.cliente_telefono);
    return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
  };
  async function compartir() {
    const texto = textoWhatsApp({ tienda: estado.ajustes, factura: f, articulos: f.articulos });
    const r = await compartirFactura({ titulo: `Factura ${f.numero} · ${estado.ajustes?.nombre_tienda || "Myle Store"}`, texto, enlace });
    if (r === "copiado") avisar("Enlace copiado; péguelo donde quiera enviarlo");
  }
  async function anular() {
    const motivo = el("input", { placeholder: "Ej.: se devolvió, error al facturar" });
    const boton = el("button.btn.peligro", { type: "button" }, "Anular y devolver al inventario");
    const { cerrar } = abrirHoja({
      titulo: `Anular ${f.numero}`,
      clase: "chica",
      cuerpo: el("div.pila.media",
        el("p.suave", `Las ${unidades(f.articulos)} prendas vuelven al inventario${f.apartado ? ` y el apartado ${f.apartado.numero} queda anulado` : ""}. Recuerde devolver el dinero si ya lo cobró.`),
        el("label.campo", el("span", "Motivo ", el("em", "(opcional)")), motivo)),
      pie: [el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, "Volver"), boton],
    });
    boton.addEventListener("click", async () => {
      try {
        await trabajando(boton, () => datos.anularFactura(f.id, motivo.value), "Anulando…");
        cerrar();
        await cargarProductos();
        f = await datos.factura(f.id);
        pintar();
        avisar(`${f.numero} anulada; las prendas volvieron al inventario`);
      } catch (e) {
        avisar(mensajeError(e), "error");
      }
    });
  }
  function editarCliente() {
    const error = el("div.error-form.oculto");
    const nombre = el("input", { value: f.cliente_nombre, required: true });
    const telefono = el("input", { type: "tel", value: f.cliente_telefono || "" });
    const direccion = el("input", { value: f.cliente_direccion || "" });
    const formaPago = el("select", FORMAS_PAGO.map((x) => el("option", { value: x }, x)));
    formaPago.value = FORMAS_PAGO.includes(f.forma_pago) ? f.forma_pago : "Otro";
    const referencia = el("input", { value: f.referencia_pago || "" });
    const notas = el("textarea", { value: f.notas || "" });
    const boton = el("button.btn.primario", { type: "button" }, "Guardar");
    const { cerrar } = abrirHoja({
      titulo: `Cliente de ${f.numero}`,
      cuerpo: el("div.pila.media",
        el("label.campo", el("span", "Nombre"), nombre),
        el("label.campo", el("span", "Teléfono"), telefono),
        el("label.campo", el("span", "Dirección o forma de entrega"), direccion),
        el("div.rejilla.dos", el("label.campo", el("span", "Forma de pago"), formaPago), el("label.campo", el("span", "Referencia"), referencia)),
        el("label.campo", el("span", "Notas internas"), notas),
        error),
      pie: [el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, "Volver"), boton],
    });
    boton.addEventListener("click", async () => {
      error.classList.add("oculto");
      if (!nombre.value.trim()) {
        error.textContent = "Escriba el nombre del cliente.";
        error.classList.remove("oculto");
        return;
      }
      try {
        f = await trabajando(boton, () => datos.editarFactura(f.id, {
          cliente_nombre: nombre.value.trim(), cliente_telefono: telefono.value.trim() || null, cliente_direccion: direccion.value.trim() || null,
          forma_pago: formaPago.value, referencia_pago: referencia.value.trim() || null, notas: notas.value.trim() || null,
        }));
        cerrar();
        pintar();
        avisar("Factura actualizada");
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    });
  }
  pintar();
}

export { nombreMes };
