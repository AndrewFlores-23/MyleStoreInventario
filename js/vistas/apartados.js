// Apartados: pedido armado para un cliente que todavía no se entrega. Al crearlo, las prendas salen del inventario
// disponible y queda lista la factura con los datos de depósito. Luego se marca el pago (cancelado) y la entrega.
import { datos } from "../datos.js";
import { estado, cargarProductos, ponerPendientes, ir } from "../estado.js";
import { el, icono, dinero, numero, fecha, fechaHora, hace, talla, tela, sinTildes, telefonoBonito, telefonoWa, campoDinero, contador,
  trabajando, avisar, mensajeError, abrirHoja, confirmar } from "../util.js";
import { fotoProducto, selectorProducto, sellosApartado, cajaDias, unidades, vacio } from "../componentes.js";
import { armarFactura, textoWhatsApp, enlaceFactura, imprimirFactura } from "../factura.js";

export function vistaApartados(pagina, ctx) {
  const [primera] = ctx.partes;
  if (primera === "nuevo") return vistaNuevo(pagina, ctx);
  if (primera) return vistaDetalle(pagina, ctx, primera);
  return vistaLista(pagina, ctx);
}

// ---------- Lista ----------
const FILTROS = [
  ["entregar", "Por entregar", (a) => a.estado === "pendiente"],
  ["cobrar", "Por cobrar", (a) => a.estado !== "anulado" && !a.pagado],
  ["entregados", "Entregados", (a) => a.estado === "entregado"],
  ["anulados", "Anulados", (a) => a.estado === "anulado"],
  ["todos", "Todos", () => true],
];
let filtroLista = "entregar";
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
    if (filtroLista === "entregar") elegidos.sort((a, b) => a.creado_en.localeCompare(b.creado_en));
    const monto = elegidos.reduce((s, a) => s + Number(a.total), 0);
    resumen.replaceChildren(
      el("span", el("b", elegidos.length), ` apartado${elegidos.length === 1 ? "" : "s"}`),
      el("span", el("b", unidades(elegidos.flatMap((a) => a.articulos))), " prendas"),
      el("span", filtroLista === "cobrar" ? "por cobrar " : "total ", el("b", dinero(monto))));
    lista.replaceChildren(...(elegidos.length ? elegidos.map(fila) : [
      apartados.length
        ? vacio("bolsa", "No hay apartados aquí.")
        : vacio("bolsa", "Todavía no hay apartados.", "Cuando un cliente pida, arme el apartado y envíele la factura.",
          el("a.btn.primario", { href: "#/apartados/nuevo" }, icono("mas"), "Nuevo apartado")),
    ]));
  };

  const fila = (ap) => el("a.renglon.apartado-fila", { href: `#/apartados/${ap.id}` },
    cajaDias(ap),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", el("span", ap.cliente_nombre), el("span.numero", ap.numero)),
      el("div.renglon-sub", sellosApartado(ap), el("span.tenue", `${unidades(ap.articulos)} prendas · ${fecha(ap.creado_en)}`))),
    el("div.renglon-fin", el("div.num", dinero(ap.total)), el("small", ap.pagado ? "pagado" : ap.estado === "anulado" ? "anulado" : "por cobrar")));

  const buscar = el("input", { type: "search", placeholder: "Buscar cliente, número o teléfono", value: textoLista, oninput: (e) => { textoLista = e.target.value; pintar(); } });
  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Apartados"), el("p", "Pedidos armados que esperan pago o entrega.")),
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
  const carrito = []; // { producto, cantidad, precio }
  const error = el("div.error-form.oculto");
  const lineas = el("div");
  const totales = el("div.recibo");
  const nombre = el("input", { required: true, placeholder: "Nombre y apellido", autocomplete: "off" });
  const telefono = el("input", { type: "tel", inputmode: "tel", placeholder: "8888-8888", autocomplete: "off" });
  const direccion = el("input", { placeholder: "Ej.: Heredia, San Pablo · envío por Correos", autocomplete: "off" });
  const notas = el("textarea", { placeholder: "Solo para la tienda; no sale en la factura" });
  const envio = campoDinero({ placeholder: "0", oninput: () => pintarTotales() });
  const envioIn = envio.querySelector("input");
  const boton = el("button.btn.primario.grande.ancho", { type: "submit" }, icono("check"), "Crear apartado y factura");

  const selector = selectorProducto({
    soloDisponibles: true,
    placeholder: "Buscar prenda para agregar",
    alElegir: (p) => {
      const ya = carrito.find((l) => l.producto.id === p.id);
      if (ya) {
        if (ya.cantidad < p.existencias) ya.cantidad += 1;
        else avisar(`Solo hay ${p.existencias} de esta prenda`, "error");
      } else {
        carrito.push({ producto: p, cantidad: 1, precio: Number(p.precio_venta) });
      }
      pintarLineas();
    },
  });

  const pintarLineas = () => {
    lineas.replaceChildren(...(carrito.length ? carrito.map((l, i) => {
      const sub = el("div.subtotal", dinero(l.cantidad * l.precio));
      const cuenta = contador({ valor: l.cantidad, min: 1, max: l.producto.existencias, chico: true, alCambiar: (n) => { l.cantidad = n; sub.textContent = dinero(l.cantidad * l.precio); pintarTotales(); } });
      const precio = campoDinero({ value: l.precio, "aria-label": "Precio por unidad", oninput: (e) => { const v = numero(e.target.value); l.precio = v >= 0 ? v : 0; sub.textContent = dinero(l.cantidad * l.precio); pintarTotales(); } });
      return el("div.linea-carrito",
        fotoProducto(l.producto),
        el("div", { style: "min-width:0" },
          el("div.renglon-titulo", l.producto.nombre),
          el("div.renglon-sub", talla(l.producto.talla), tela(l.producto.color), el("span.tenue", `de ${l.producto.existencias} disponibles`)),
          el("div.controles", cuenta, precio,
            el("button.btn.fantasma.chico", { type: "button", "aria-label": "Quitar", onclick: () => { carrito.splice(i, 1); pintarLineas(); } }, icono("x", "chico"), "Quitar"))),
        sub);
    }) : [vacio("bolsa", "Agregue las prendas que pidió el cliente.", "Búsquelas arriba por nombre, talla o color.")]));
    pintarTotales();
  };

  const linea = (et, val, clase = "") => el("div.linea" + clase, el("span.et", et), el("span.puntos"), el("span.val", val));
  const pintarTotales = () => {
    const sub = carrito.reduce((s, l) => s + l.cantidad * l.precio, 0);
    const env = Math.max(0, numero(envioIn.value) || 0);
    const n = carrito.reduce((s, l) => s + l.cantidad, 0);
    totales.replaceChildren(
      linea("Artículos", el("span", n, el("small", n === 1 ? "unidad" : "unidades"))),
      linea("Subtotal", dinero(sub)),
      linea("Envío", dinero(env)),
      linea("Total a pagar", dinero(sub + env), ".total"));
  };

  const form = el("form.dos-columnas", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      const falta = !carrito.length ? "Agregue al menos una prenda." : !nombre.value.trim() ? "Escriba el nombre del cliente." : null;
      if (falta) {
        error.textContent = falta;
        error.classList.remove("oculto");
        return;
      }
      try {
        const ap = await trabajando(boton, () => datos.crearApartado({
          clienteNombre: nombre.value, clienteTelefono: telefono.value, clienteDireccion: direccion.value, notas: notas.value,
          envio: Math.max(0, numero(envioIn.value) || 0),
          articulos: carrito.map((l) => ({ producto_id: l.producto.id, cantidad: l.cantidad, precio_unitario: l.precio })),
        }), "Creando…");
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
    el("section.panel",
      el("div.panel-titulo", el("h2", "Prendas del pedido")),
      selector,
      el("div", { style: "margin-top:10px" }, lineas)),
    el("section.panel",
      el("div.panel-titulo", el("h2", "Cliente")),
      el("div", { style: "display:flex;flex-direction:column;gap:14px" },
        el("label.campo", el("span", "Nombre"), nombre),
        el("label.campo", el("span", "Teléfono o WhatsApp ", el("em", "(para enviarle la factura)")), telefono),
        el("label.campo", el("span", "Dirección o forma de entrega ", el("em", "(opcional)")), direccion),
        el("label.campo", el("span", "Envío ", el("em", "(opcional)")), envio),
        el("label.campo", el("span", "Notas internas ", el("em", "(opcional)")), notas),
        totales,
        error,
        boton,
        el("p.tenue", { style: "font-size:13px" }, "Las prendas se apartan en este momento: dejan de estar disponibles para otros clientes."))));

  ctx.pintar(
    el("a.volver", { href: "#/apartados" }, icono("atras", "chico"), "Apartados"),
    el("div.cabeza", el("div", el("h1", "Nuevo apartado"), el("p", "Arme el pedido y genere la factura con los datos de depósito."))),
    form);
  pintarLineas();
}

// ---------- Detalle con factura ----------
async function vistaDetalle(_pagina, ctx, id) {
  let ap = await datos.apartado(id);
  if (!ap) {
    ctx.pintar(vacio("bolsa", "Ese apartado no existe.", null, el("a.btn", { href: "#/apartados" }, "Ver apartados")));
    return;
  }
  const enlace = enlaceFactura(ap.token);
  contarPendientes();

  const pintar = () => {
    const hoja = armarFactura({ tienda: estado.ajustes, apartado: ap, articulos: ap.articulos, urlFoto: (r) => datos.urlFoto(r), interna: true });
    const anulado = ap.estado === "anulado";
    ctx.pintar(
      el("a.volver", { href: "#/apartados" }, icono("atras", "chico"), "Apartados"),
      el("div.cabeza",
        el("div",
          el("h1", ap.cliente_nombre),
          el("div.renglon-sub", { style: "margin-top:6px" }, el("span.serie", ap.numero), sellosApartado(ap), el("span.tenue", `Apartado ${hace(ap.creado_en)}`)))),
      el("div.dos-columnas",
        el("div.contenedor-factura", hoja),
        el("aside.acciones-apartado",
          anulado ? null : pasoPago(),
          anulado ? null : pasoEntrega(),
          anulado ? el("div.panel", el("p", `Anulado el ${fechaHora(ap.anulado_en)}.`), ap.motivo_anulacion ? el("p.suave", { style: "margin-top:6px" }, `Motivo: ${ap.motivo_anulacion}`) : null,
            el("p.tenue", { style: "margin-top:6px;font-size:13px" }, "Las prendas volvieron al inventario.")) : null,
          el("div.panel",
            el("div.panel-titulo", el("h2", "Enviar la factura")),
            el("div", { style: "display:flex;flex-direction:column;gap:8px" },
              el("a.btn.primario", { href: whatsapp(), target: "_blank", rel: "noopener" }, icono("chat"), ap.cliente_telefono ? `WhatsApp a ${telefonoBonito(ap.cliente_telefono)}` : "Enviar por WhatsApp"),
              el("button.btn", { type: "button", onclick: copiarEnlace }, icono("enlace"), "Copiar enlace de la factura"),
              el("button.btn", { type: "button", onclick: () => imprimirFactura(hoja, `Factura ${ap.numero} · ${ap.cliente_nombre}`) }, icono("imprimir"), "Imprimir o guardar PDF"))),
          el("div.panel",
            el("div.panel-titulo", el("h2", "Cliente"), anulado ? null : el("button.btn.fantasma.chico", { type: "button", onclick: editarCliente }, icono("editar", "chico"), "Editar")),
            el("div.recibo",
              ap.cliente_telefono ? el("div.renglon-sub", "Teléfono: ", el("b", telefonoBonito(ap.cliente_telefono))) : null,
              ap.cliente_direccion ? el("div.renglon-sub", "Entrega: ", ap.cliente_direccion) : null,
              ap.notas ? el("div.renglon-sub", { style: "margin-top:6px" }, "Notas: ", ap.notas) : null,
              !ap.cliente_telefono && !ap.cliente_direccion && !ap.notas ? el("p.tenue", "Sin más datos.") : null)),
          ap.estado === "pendiente"
            ? el("button.btn.peligro", { type: "button", onclick: anular }, icono("anular"), "Anular apartado")
            : null)));
  };

  const pasoPago = () => el("div.estado-paso" + (ap.pagado ? ".hecho" : ""),
    el("span.marca-paso", ap.pagado ? icono("check", "chico") : icono("billete", "chico")),
    el("div.renglon-cuerpo",
      el("strong", ap.pagado ? "Cancelado" : "Pendiente de pago"),
      el("span", ap.pagado ? `${fecha(ap.pagado_en)}${ap.referencia_pago ? ` · ${ap.referencia_pago}` : ""}` : `Falta cobrar ${dinero(ap.total)}`)),
    ap.pagado
      ? el("button.btn.fantasma.chico", { type: "button", onclick: deshacerPago }, "Deshacer")
      : el("button.btn.primario.chico", { type: "button", onclick: marcarPagado }, "Marcar pagado"));

  const pasoEntrega = () => el("div.estado-paso" + (ap.estado === "entregado" ? ".hecho" : ""),
    el("span.marca-paso", ap.estado === "entregado" ? icono("check", "chico") : icono("entrega", "chico")),
    el("div.renglon-cuerpo",
      el("strong", ap.estado === "entregado" ? "Entregado" : "Por entregar"),
      el("span", ap.estado === "entregado" ? fecha(ap.entregado_en) : `${unidades(ap.articulos)} prendas apartadas ${hace(ap.creado_en)}`)),
    ap.estado === "entregado"
      ? el("button.btn.fantasma.chico", { type: "button", onclick: () => cambiarEntrega(false) }, "Deshacer")
      : el("button.btn.chico", { type: "button", onclick: () => cambiarEntrega(true) }, "Marcar entregado"));

  const whatsapp = () => {
    const texto = encodeURIComponent(textoWhatsApp({ tienda: estado.ajustes, apartado: ap, articulos: ap.articulos, enlace }));
    const tel = telefonoWa(ap.cliente_telefono);
    return tel ? `https://wa.me/${tel}?text=${texto}` : `https://wa.me/?text=${texto}`;
  };

  const actualizar = (nuevo) => {
    ap = nuevo;
    pintar();
  };

  async function marcarPagado() {
    const ref = el("input", { placeholder: "Ej.: SINPE 4471 o número de depósito" });
    const boton = el("button.btn.primario", { type: "button" }, icono("check"), "Marcar como pagado");
    const { cerrar } = abrirHoja({
      titulo: `Pago de ${ap.numero}`,
      clase: "chica",
      cuerpo: el("div", { style: "display:flex;flex-direction:column;gap:14px" },
        el("div.recibo", el("div.linea.total", el("span.et", "Total"), el("span.puntos"), el("span.val", dinero(ap.total)))),
        el("label.campo", el("span", "Comprobante ", el("em", "(opcional)")), ref)),
      pie: [el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, "Volver"), boton],
    });
    boton.addEventListener("click", async () => {
      try {
        await trabajando(boton, () => datos.marcarPago(ap.id, true, ref.value));
        cerrar();
        actualizar(await datos.apartado(ap.id));
        avisar(`${ap.numero} marcado como pagado`);
      } catch (e) {
        avisar(mensajeError(e), "error");
      }
    });
    ref.focus();
  }
  async function deshacerPago() {
    if (!(await confirmar("¿Quitar el pago?", { detalle: "El apartado vuelve a quedar pendiente de pago.", si: "Quitar pago" }))) return;
    try {
      await datos.marcarPago(ap.id, false);
      actualizar(await datos.apartado(ap.id));
    } catch (e) {
      avisar(mensajeError(e), "error");
    }
  }
  async function cambiarEntrega(entregado) {
    if (entregado && !ap.pagado && !(await confirmar("Todavía no está pagado", { detalle: "¿Lo marca como entregado de todas formas? Seguirá apareciendo en «Por cobrar».", si: "Sí, entregado" }))) return;
    if (!entregado && !(await confirmar("¿Deshacer la entrega?", { detalle: "Vuelve a la lista de apartados por entregar.", si: "Deshacer" }))) return;
    try {
      await datos.marcarEntrega(ap.id, entregado);
      actualizar(await datos.apartado(ap.id));
      avisar(entregado ? "Marcado como entregado" : "Vuelve a estar por entregar");
      contarPendientes();
    } catch (e) {
      avisar(mensajeError(e), "error");
    }
  }
  async function anular() {
    const motivo = el("input", { placeholder: "Ej.: no respondió, cambió de idea" });
    const boton = el("button.btn.peligro", { type: "button" }, "Anular y devolver al inventario");
    const { cerrar } = abrirHoja({
      titulo: `Anular ${ap.numero}`,
      clase: "chica",
      cuerpo: el("div", { style: "display:flex;flex-direction:column;gap:14px" },
        el("p.suave", `Las ${unidades(ap.articulos)} prendas vuelven a estar disponibles. La factura queda marcada como anulada.`),
        ap.pagado ? el("div.error-form", "Este apartado está pagado: recuerde devolverle el dinero al cliente.") : null,
        el("label.campo", el("span", "Motivo ", el("em", "(opcional)")), motivo)),
      pie: [el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, "Volver"), boton],
    });
    boton.addEventListener("click", async () => {
      try {
        await trabajando(boton, () => datos.anularApartado(ap.id, motivo.value), "Anulando…");
        cerrar();
        await cargarProductos();
        actualizar(await datos.apartado(ap.id));
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
      cuerpo: el("div", { style: "display:flex;flex-direction:column;gap:14px" },
        el("label.campo", el("span", "Nombre"), nombre),
        el("div.rejilla.dos", el("label.campo", el("span", "Teléfono"), telefono), el("label.campo", el("span", "Envío"), envio)),
        el("label.campo", el("span", "Dirección o forma de entrega"), direccion),
        el("label.campo", el("span", "Notas internas"), notas),
        ap.pagado ? el("p.tenue", { style: "font-size:13px" }, "Ya está pagado: si cambia el envío, cambia el total pagado.") : null,
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
        const nuevo = await trabajando(boton, () => datos.editarApartado(ap.id, {
          cliente_nombre: nombre.value.trim(), cliente_telefono: telefono.value.trim() || null,
          cliente_direccion: direccion.value.trim() || null, notas: notas.value.trim() || null, envio: env,
        }));
        cerrar();
        actualizar(nuevo);
        avisar("Datos del cliente guardados");
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    });
  }
  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(enlace);
      avisar("Enlace copiado");
    } catch {
      prompt("Copie el enlace de la factura:", enlace);
    }
  }

  pintar();
}

async function contarPendientes() {
  try {
    const lista = await datos.apartados();
    ponerPendientes(lista.filter((a) => a.estado === "pendiente").length);
  } catch { /* solo es la insignia */ }
}
