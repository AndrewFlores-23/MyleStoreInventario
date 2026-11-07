// Apartados: el pedido de un cliente que se guarda con sus prendas apartadas (salen del inventario disponible).
// No lleva factura ni pago: cuando el cliente paga, el apartado se pasa a Facturación y ahí sale la factura de contado.
import { datos } from "../datos.js";
import { estado, cargarProductos, ponerPendientes, ir } from "../estado.js";
import { el, icono, dinero, numero, fecha, fechaHora, hace, sinTildes, telefonoBonito, telefonoWa, campoDinero,
  trabajando, avisar, mensajeError, abrirHoja, confirmar } from "../util.js";
import { marcaProducto, sellosApartado, cajaDias, unidades, vacio } from "../componentes.js";
import { textoApartado } from "../factura.js";
import { armarPedido, camposCliente } from "./pedido.js";

export function vistaApartados(pagina, ctx) {
  const [primera] = ctx.partes;
  if (primera === "nuevo") return vistaNuevo(pagina, ctx);
  if (primera) return vistaDetalle(pagina, ctx, primera);
  return vistaLista(pagina, ctx);
}

// ---------- Lista ----------
const FILTROS = [
  ["pendientes", "Apartados", (a) => a.estado === "pendiente"],
  ["facturados", "Facturados", (a) => a.estado === "facturado"],
  ["anulados", "Anulados", (a) => a.estado === "anulado"],
  ["todos", "Todos", () => true],
];
let filtroLista = "pendientes";
let textoLista = "";

async function vistaLista(_pagina, ctx) {
  const apartados = await datos.apartados();
  ponerPendientes(apartados.filter((a) => a.estado === "pendiente").length);
  const pestanas = el("div.pestanas-filtro");
  const lista = el("div.lista");
  const resumen = el("div.totales-inventario");

  const pintar = () => {
    pestanas.replaceChildren(...FILTROS.map(([clave, texto, fn]) => el("button", {
      type: "button", "aria-pressed": String(filtroLista === clave),
      onclick: () => { filtroLista = clave; pintar(); },
    }, texto, el("span.n", apartados.filter(fn).length))));
    const [, , condicion] = FILTROS.find(([c]) => c === filtroLista);
    const palabras = sinTildes(textoLista).split(/\s+/).filter(Boolean);
    const elegidos = apartados.filter(condicion).filter((a) => {
      const texto = sinTildes([a.numero, a.cliente_nombre, a.cliente_telefono, a.cliente_direccion].join(" "));
      return palabras.every((w) => texto.includes(w));
    });
    if (filtroLista === "pendientes") elegidos.sort((a, b) => a.creado_en.localeCompare(b.creado_en));
    const monto = elegidos.reduce((s, a) => s + Number(a.total), 0);
    resumen.replaceChildren(
      el("span", el("b", elegidos.length), ` apartado${elegidos.length === 1 ? "" : "s"}`),
      el("span", el("b", unidades(elegidos.flatMap((a) => a.articulos))), " prendas"),
      el("span", filtroLista === "pendientes" ? "por facturar " : "total ", el("b", dinero(monto))));
    lista.replaceChildren(...(elegidos.length ? elegidos.map(fila) : [
      apartados.length
        ? vacio("bolsa", "No hay apartados aquí.")
        : vacio("bolsa", "Todavía no hay apartados.", "Cuando un cliente pida y todavía no pague, aparte sus prendas aquí.",
          el("a.btn.primario", { href: "#/apartados/nuevo" }, icono("mas"), "Nuevo apartado")),
    ]));
  };

  const fila = (ap) => el("a.renglon.apartado-fila", { href: `#/apartados/${ap.id}` },
    cajaDias(ap),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", ap.cliente_nombre),
      el("div.renglon-sub", sellosApartado(ap)),
      el("div.renglon-sub.tenue", el("span.numero", ap.numero), `${unidades(ap.articulos)} prendas · ${fecha(ap.creado_en)}`)),
    el("div.renglon-fin", el("div.num", dinero(ap.total)), el("small", ap.estado === "facturado" ? "facturado" : ap.estado === "anulado" ? "anulado" : "por facturar")));

  const buscar = el("input", { type: "search", placeholder: "Buscar cliente, número o teléfono", value: textoLista, oninput: (e) => { textoLista = e.target.value; pintar(); } });
  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Apartados"), el("p", "Pedidos con prendas apartadas que todavía no se facturan.")),
      el("div.acciones", el("a.btn.primario", { href: "#/apartados/nuevo" }, icono("mas"), "Nuevo apartado"))),
    el("div.filtros", el("div.buscar", icono("buscar"), buscar)),
    pestanas,
    resumen,
    el("section.panel", lista));
  pintar();
}

// ---------- Nuevo apartado ----------
async function vistaNuevo(_pagina, ctx) {
  await cargarProductos();
  const error = el("div.error-form.oculto");
  const pedido = armarPedido();
  const cliente = camposCliente({ telefonoAyuda: "(para avisarle del pedido)" });
  const boton = el("button.btn.primario.grande.ancho", { type: "submit" }, icono("check"), "Apartar prendas");

  const form = el("form.dos-columnas", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      const falta = pedido.vacio() ? "Agregue al menos una prenda." : !cliente.nombre.value.trim() ? "Escriba el nombre del cliente." : null;
      if (falta) {
        error.textContent = falta;
        error.classList.remove("oculto");
        return;
      }
      try {
        const ap = await trabajando(boton, () => datos.crearApartado({ ...cliente.leer(), envio: pedido.envio(), articulos: pedido.articulos() }), "Apartando…");
        await cargarProductos();
        avisar(`Apartado ${ap.numero} creado`);
        ir(`apartados/${ap.id}`);
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
        await cargarProductos();
      }
    },
  },
    pedido.panelPrendas("Prendas que se apartan"),
    el("section.panel",
      el("div.panel-titulo", el("h2", "Cliente")),
      el("div.pila.media",
        ...cliente.campos,
        pedido.campoEnvio,
        cliente.campoNotas,
        pedido.totales,
        error,
        boton,
        el("p.tenue", { style: "font-size:13px" }, "Las prendas se apartan ahora y dejan de estar disponibles. Cuando el cliente pague, pase el apartado a Facturación."))));

  ctx.pintar(
    el("a.volver", { href: "#/apartados" }, icono("atras", "chico"), "Apartados"),
    el("div.cabeza", el("div", el("h1", "Nuevo apartado"), el("p", "Guarde el pedido con sus prendas apartadas."))),
    form);
}

// ---------- Detalle ----------
async function vistaDetalle(_pagina, ctx, id) {
  let ap = await datos.apartado(id);
  if (!ap) {
    ctx.pintar(vacio("bolsa", "Ese apartado no existe.", null, el("a.btn", { href: "#/apartados" }, "Ver apartados")));
    return;
  }
  contarPendientes();

  const franja = () => {
    const n = unidades(ap.articulos);
    const prendas = `${n} prenda${n === 1 ? "" : "s"}`;
    if (ap.estado === "anulado") return el("div.franja-estado.anulado", icono("anular"), el("div", el("strong", "Anulado"), el("span", `${fecha(ap.anulado_en)} · ${prendas} de vuelta al inventario`)));
    if (ap.estado === "facturado") return el("div.franja-estado.vendido", icono("check"), el("div", el("strong", `Facturado · ${dinero(ap.total)}`), el("span", `Factura ${ap.factura?.numero || ""} · ${fecha(ap.facturado_en)}`)));
    return el("div.franja-estado.pendiente", icono("bolsa"), el("div", el("strong", `Apartado · ${dinero(ap.total)}`), el("span", `${prendas} · apartado ${hace(ap.creado_en)} · pendiente de facturar`)));
  };

  const pintar = () => {
    const pendiente = ap.estado === "pendiente";
    ctx.pintar(
      el("a.volver", { href: "#/apartados" }, icono("atras", "chico"), "Apartados"),
      el("div.cabeza",
        el("div",
          el("h1", ap.cliente_nombre),
          el("div.renglon-sub", { style: "margin-top:6px" }, el("span.serie", ap.numero), sellosApartado(ap)))),
      franja(),
      el("div.dos-columnas",
        el("section.panel",
          el("div.panel-titulo", el("h2", "Prendas apartadas")),
          el("div.lista", ap.articulos.map((a) => el("div.renglon",
            marcaProducto(a),
            el("div.renglon-cuerpo", el("div.renglon-titulo", a.nombre), el("div.renglon-sub", a.talla ? el("span.talla", a.talla) : null, a.color || "")),
            el("div.renglon-fin", el("div.num", dinero(a.subtotal ?? a.cantidad * a.precio_unitario)), el("small", `${a.cantidad} × ${dinero(a.precio_unitario)}`))))),
          el("div.recibo", { style: "margin-top:10px" },
            el("div.linea", el("span.et", "Subtotal"), el("span.puntos"), el("span.val", dinero(ap.subtotal))),
            Number(ap.envio) > 0 ? el("div.linea", el("span.et", "Envío"), el("span.puntos"), el("span.val", dinero(ap.envio))) : null,
            el("div.linea.total", el("span.et", "Total"), el("span.puntos"), el("span.val", dinero(ap.total))))),
        el("aside.acciones-apartado",
          pendiente ? el("div.panel.panel-facturar",
            el("div.panel-titulo", el("h2", "¿Ya pagó?")),
            el("p.suave", { style: "margin-bottom:12px" }, "Pase el apartado a Facturación para emitir la factura de contado con estas prendas."),
            el("a.btn.primario.ancho", { href: `#/facturacion/nueva?apartado=${ap.id}` }, icono("billete"), "Pasar a facturación")) : null,
          ap.estado === "facturado" && ap.factura ? el("div.panel",
            el("div.panel-titulo", el("h2", "Factura")),
            el("a.btn.ancho", { href: `#/facturacion/${ap.factura.id}` }, icono("imprimir"), `Ver factura ${ap.factura.numero}`)) : null,
          ap.estado === "anulado" ? el("div.panel", el("p", `Anulado el ${fechaHora(ap.anulado_en)}.`), ap.motivo_anulacion ? el("p.suave", { style: "margin-top:6px" }, `Motivo: ${ap.motivo_anulacion}`) : null,
            el("p.tenue", { style: "margin-top:6px;font-size:13px" }, "Las prendas volvieron al inventario.")) : null,
          pendiente ? el("div.panel",
            el("div.panel-titulo", el("h2", "Avisar al cliente")),
            el("a.btn", { href: whatsapp(), target: "_blank", rel: "noopener" }, icono("chat"), ap.cliente_telefono ? `WhatsApp a ${telefonoBonito(ap.cliente_telefono)}` : "Enviar por WhatsApp"),
            el("p.tenue", { style: "margin-top:8px;font-size:13px" }, "Le manda el detalle del pedido, el total y cómo pagar.")) : null,
          el("div.panel",
            el("div.panel-titulo", el("h2", "Cliente"), pendiente ? el("button.btn.fantasma.chico", { type: "button", onclick: editarCliente }, icono("editar", "chico"), "Editar") : null),
            el("div.recibo",
              ap.cliente_telefono ? el("div.renglon-sub", "Teléfono: ", el("b", telefonoBonito(ap.cliente_telefono))) : null,
              ap.cliente_direccion ? el("div.renglon-sub", "Entrega: ", ap.cliente_direccion) : null,
              ap.notas ? el("div.renglon-sub", { style: "margin-top:6px" }, "Notas: ", ap.notas) : null,
              !ap.cliente_telefono && !ap.cliente_direccion && !ap.notas ? el("p.tenue", "Sin más datos.") : null)),
          pendiente ? el("button.btn.peligro", { type: "button", onclick: anular }, icono("anular"), "Anular apartado") : null)));
  };

  const whatsapp = () => {
    const texto = encodeURIComponent(textoApartado({ tienda: estado.ajustes, apartado: ap, articulos: ap.articulos }));
    const tel = telefonoWa(ap.cliente_telefono);
    return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
  };

  async function anular() {
    const motivo = el("input", { placeholder: "Ej.: no respondió, cambió de idea" });
    const boton = el("button.btn.peligro", { type: "button" }, "Anular y devolver al inventario");
    const { cerrar } = abrirHoja({
      titulo: `Anular ${ap.numero}`,
      clase: "chica",
      cuerpo: el("div.pila.media",
        el("p.suave", `Las ${unidades(ap.articulos)} prendas vuelven a estar disponibles.`),
        el("label.campo", el("span", "Motivo ", el("em", "(opcional)")), motivo)),
      pie: [el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, "Volver"), boton],
    });
    boton.addEventListener("click", async () => {
      try {
        await trabajando(boton, () => datos.anularApartado(ap.id, motivo.value), "Anulando…");
        cerrar();
        await cargarProductos();
        ap = await datos.apartado(ap.id);
        pintar();
        avisar(`${ap.numero} anulado; las prendas volvieron al inventario`);
        contarPendientes();
      } catch (e) {
        avisar(mensajeError(e), "error");
      }
    });
  }
  function editarCliente() {
    const error = el("div.error-form.oculto");
    const nombre = el("input", { value: ap.cliente_nombre, required: true });
    const telefono = el("input", { type: "tel", value: ap.cliente_telefono || "" });
    const direccion = el("input", { value: ap.cliente_direccion || "" });
    const envio = campoDinero({ value: Number(ap.envio) || "" });
    const notas = el("textarea", { value: ap.notas || "" });
    const boton = el("button.btn.primario", { type: "button" }, "Guardar");
    const { cerrar } = abrirHoja({
      titulo: `Cliente de ${ap.numero}`,
      cuerpo: el("div.pila.media",
        el("label.campo", el("span", "Nombre"), nombre),
        el("div.rejilla.dos", el("label.campo", el("span", "Teléfono"), telefono), el("label.campo", el("span", "Envío"), envio)),
        el("label.campo", el("span", "Dirección o forma de entrega"), direccion),
        el("label.campo", el("span", "Notas internas"), notas),
        error),
      pie: [el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, "Volver"), boton],
    });
    boton.addEventListener("click", async () => {
      error.classList.add("oculto");
      const env = numero(envio.querySelector("input").value || 0);
      if (!nombre.value.trim() || !(env >= 0)) {
        error.textContent = !nombre.value.trim() ? "Escriba el nombre del cliente." : "Revise el monto del envío.";
        error.classList.remove("oculto");
        return;
      }
      try {
        ap = await trabajando(boton, () => datos.editarApartado(ap.id, {
          cliente_nombre: nombre.value.trim(), cliente_telefono: telefono.value.trim() || null,
          cliente_direccion: direccion.value.trim() || null, notas: notas.value.trim() || null, envio: env,
        }));
        cerrar();
        pintar();
        avisar("Datos del cliente guardados");
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    });
  }
  pintar();
}

async function contarPendientes() {
  try {
    const lista = await datos.apartados();
    ponerPendientes(lista.filter((a) => a.estado === "pendiente").length);
  } catch { /* solo es la insignia */ }
}
