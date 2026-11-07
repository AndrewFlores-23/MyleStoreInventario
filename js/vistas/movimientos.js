// Movimientos: el registro de la mercadería en tres pestañas. Compras (facturas de proveedor con sus prendas),
// Salidas (qué salió, cuándo y por qué) y Todo (entradas y salidas en orden), con filtros por mes y por producto.
import { datos } from "../datos.js";
import { estado, cargarProductos } from "../estado.js";
import { el, icono, dinero, fecha, talla, tela, numero, abrirHoja, campoDinero, contador, trabajando, avisar, mensajeError } from "../util.js";
import { marcaProducto, renglonMovimiento, selectorProducto, productoElegido, vacio, MOTIVOS } from "../componentes.js";
import { abrirFicha } from "./inventario.js";
import { selectorProveedor } from "./proveedores.js";

const PESTANAS = [["compras", "Compras"], ["salidas", "Salidas"], ["todo", "Todo"]];
const MOTIVOS_SALIDA = ["factura", "apartado", "danado", "devolucion", "regalo", "ajuste"];
const ZONA = "America/Costa_Rica";
const fMes = new Intl.DateTimeFormat("es-CR", { month: "long", year: "numeric", timeZone: ZONA });
const claveMes = (d) => { const p = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: ZONA }).formatToParts(new Date(d)); return `${p.find((x) => x.type === "year").value}-${p.find((x) => x.type === "month").value}`; };
const nombreDeMes = (clave) => { const t = fMes.format(new Date(`${clave}-15T12:00:00`)); return t.charAt(0).toUpperCase() + t.slice(1); };
const suma = (lista, fn) => lista.reduce((s, x) => s + fn(x), 0);

// Lo que se eligió se recuerda al volver a la sección
const filtro = { pestana: "compras", mes: "", motivo: "", productoId: null };

export async function vistaMovimientos(pagina, ctx) {
  if (ctx.partes[0] === "compras" && ctx.partes[1] === "nueva") return vistaNuevaCompra(pagina, ctx);
  if (ctx.partes[0] === "compras" && ctx.partes[1]) return vistaCompra(pagina, ctx, ctx.partes[1]);
  if (PESTANAS.some(([c]) => c === ctx.partes[0])) filtro.pestana = ctx.partes[0];
  const [compras, movimientos] = await Promise.all([datos.compras({ limite: 300 }), datos.movimientos({ limite: 1000 }), cargarProductos()]);
  const ingresosSueltos = (await datos.ingresos({ limite: 300 })).filter((i) => !i.compra_id);

  const pestanas = el("div.pestanas-filtro");
  const filtros = el("div.filtros");
  const resumen = el("div.totales-inventario");
  const cuerpo = el("section.panel");

  // Meses disponibles (de lo que haya en compras y movimientos)
  const meses = [...new Set([...compras.map((c) => claveMes(c.creado_en)), ...movimientos.map((m) => claveMes(m.creado_en))])].sort().reverse();
  const selectorMes = el("select", { "aria-label": "Mes", onchange: (e) => { filtro.mes = e.target.value; pintar(); } },
    el("option", { value: "" }, "Todos los meses"),
    meses.map((m) => el("option", { value: m }, nombreDeMes(m))));

  const pintarPestanas = () => {
    const n = { compras: compras.length + ingresosSueltos.length, salidas: movimientos.filter((m) => m.tipo === "salida").length, todo: movimientos.length };
    pestanas.replaceChildren(...PESTANAS.map(([clave, texto]) => el("button", {
      type: "button", "aria-pressed": String(filtro.pestana === clave),
      onclick: () => { filtro.pestana = clave; history.replaceState(null, "", `#/movimientos/${clave}`); pintar(); },
    }, texto, el("span.n", n[clave]))));
  };

  const enMes = (d) => !filtro.mes || claveMes(d) === filtro.mes;

  function pintar() {
    pintarPestanas();
    selectorMes.value = filtro.mes;
    filtros.replaceChildren(selectorMes);
    if (filtro.pestana === "compras") pintarCompras();
    else if (filtro.pestana === "salidas") pintarSalidas();
    else pintarTodo();
  }

  // ---------- Compras ----------
  function pintarCompras() {
    const lista = compras.filter((c) => enMes(c.fecha_compra || c.creado_en));
    const sueltos = ingresosSueltos.filter((i) => enMes(i.creado_en));
    const pagado = suma(lista, (c) => Number(c.monto_pagado) || Number(c.total)) + suma(sueltos, (i) => i.cantidad * Number(i.costo_unitario));
    const prendas = suma(lista, (c) => c.prendas_pedidas || c.unidades) + suma(sueltos, (i) => i.cantidad);
    const pendientes = lista.filter((c) => faltan(c) > 0);
    resumen.replaceChildren(
      el("span", el("b", lista.length), ` compra${lista.length === 1 ? "" : "s"}`),
      el("span", el("b", prendas), " prendas"),
      el("span", "pagado ", el("b", dinero(pagado))),
      pendientes.length ? el("span", el("b", pendientes.length), " por terminar de registrar") : null);
    cuerpo.replaceChildren(
      el("div.panel-titulo", el("h2", "Compras de mercadería"), el("a.btn.primario.chico", { href: "#/movimientos/compras/nueva" }, icono("mas", "chico"), "Nueva compra")),
      lista.length || sueltos.length
        ? el("div.lista",
          lista.map(filaCompra),
          sueltos.length ? el("details.sueltos",
            el("summary", el("span", icono("ingreso", "chico"), `${sueltos.length} ingreso${sueltos.length === 1 ? "" : "s"} sin compra`), el("span.tenue", dinero(suma(sueltos, (i) => i.cantidad * Number(i.costo_unitario))))),
            el("div.lista", sueltos.map(filaIngreso))) : null)
        : vacio("caja", "Todavía no hay compras.", "Registre primero la compra al proveedor y después vaya metiendo sus prendas al inventario.",
          el("a.btn.primario", { href: "#/movimientos/compras/nueva" }, icono("mas"), "Nueva compra")));
  }

  const filaCompra = (c) => {
    const f = faltan(c);
    return el("a.renglon.compra-fila", { href: `#/movimientos/compras/${c.id}` },
      el("span.compra-icono" + (f > 0 ? ".pendiente" : ""), icono("caja")),
      el("div.renglon-cuerpo",
        el("div.renglon-titulo", c.proveedor || "Compra sin proveedor"),
        el("div.renglon-sub", el("span.serie", c.numero), c.factura ? el("span", `Factura ${c.factura}`) : null, el("span.tenue", fecha(c.fecha_compra || c.creado_en))),
        el("div.renglon-sub", avance(c))),
      el("div.renglon-fin", el("div.num", dinero(Number(c.monto_pagado) || Number(c.total))), el("small", "pagado")));
  };

  const filaIngreso = (i) => el("button.renglon", { type: "button", onclick: () => abrirFicha(i.producto_id) },
    marcaProducto(i.producto),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", i.producto?.nombre || "Producto"),
      el("div.renglon-sub", el("span.serie", i.serie), talla(i.producto?.talla), tela(i.producto?.color), el("span.tenue", fecha(i.creado_en)))),
    el("div.renglon-fin", el("div.num", `+${i.cantidad}`), el("small", `${dinero(i.costo_unitario)} c/u · ${dinero(i.cantidad * i.costo_unitario)}`)));

  const linea = (et, val, clase = "") => el("div.linea" + (clase === ".total" ? ".total" : ""), el("span.et", et), el("span.puntos"), el("span.val" + (clase !== ".total" ? clase : ""), val));

  // ---------- Salidas ----------
  const chipsMotivo = el("div.chips.motivos");
  function pintarSalidas() {
    chipsMotivo.replaceChildren(...["", ...MOTIVOS_SALIDA].map((m) => el("button.chip", {
      type: "button", "aria-pressed": String(filtro.motivo === m),
      onclick: () => { filtro.motivo = m; pintar(); },
    }, m ? MOTIVOS[m] : "Todos los motivos")));
    filtros.append(chipsMotivo);
    const lista = movimientos.filter((m) => m.tipo === "salida" && enMes(m.creado_en) && (!filtro.motivo || m.motivo === filtro.motivo));
    const vendido = suma(lista.filter((m) => m.motivo === "factura" || (m.motivo === "apartado" && m.factura_id)), (m) => m.cantidad * Number(m.precio_unitario || 0));
    const perdidas = lista.filter((m) => ["danado", "regalo", "ajuste"].includes(m.motivo));
    resumen.replaceChildren(
      el("span", el("b", lista.length), ` salida${lista.length === 1 ? "" : "s"}`),
      el("span", el("b", suma(lista, (m) => m.cantidad)), " prendas"),
      el("span", "vendido ", el("b", dinero(vendido))),
      perdidas.length ? el("span", "sin venta ", el("b", suma(perdidas, (m) => m.cantidad)), " prendas") : null);
    cuerpo.replaceChildren(
      el("div.panel-titulo", el("h2", "Salidas de mercadería"), el("a", { href: "#/salidas" }, "+ Registrar salida")),
      lista.length ? listaPorDia(lista) : vacio("salida", "No hay salidas con ese filtro."));
  }

  // ---------- Todo ----------
  const zonaProducto = el("div");
  function pintarTodo() {
    zonaProducto.replaceChildren(filtro.productoId
      ? productoElegido(estado.productos.find((p) => p.id === filtro.productoId) || { nombre: "Producto", existencias: 0 }, () => { filtro.productoId = null; pintar(); })
      : selectorProducto({ placeholder: "Filtrar por producto", alElegir: (p) => { filtro.productoId = p.id; pintar(); } }));
    filtros.append(zonaProducto);
    const lista = movimientos.filter((m) => enMes(m.creado_en) && (!filtro.productoId || m.producto_id === filtro.productoId));
    const entradas = lista.filter((m) => m.tipo === "entrada"), salidas = lista.filter((m) => m.tipo === "salida");
    resumen.replaceChildren(
      el("span", el("b", lista.length), " movimientos"),
      el("span", "entraron ", el("b", suma(entradas, (m) => m.cantidad))),
      el("span", "salieron ", el("b", suma(salidas, (m) => m.cantidad))),
      el("span", "invertido ", el("b", dinero(suma(entradas.filter((m) => m.motivo === "ingreso"), (m) => m.cantidad * Number(m.precio_unitario || 0))))),
      el("span", "vendido ", el("b", dinero(suma(salidas.filter((m) => m.motivo === "factura" || (m.motivo === "apartado" && m.factura_id)), (m) => m.cantidad * Number(m.precio_unitario || 0))))));
    cuerpo.replaceChildren(
      el("div.panel-titulo", el("h2", "Todos los movimientos")),
      lista.length ? listaPorDia(lista) : vacio("caja", "No hay movimientos con ese filtro."));
  }

  // Lista agrupada por día, con la fecha como separador
  function listaPorDia(lista) {
    const grupos = [];
    for (const m of lista) {
      const dia = fecha(m.creado_en);
      if (!grupos.length || grupos[grupos.length - 1].dia !== dia) grupos.push({ dia, items: [] });
      grupos[grupos.length - 1].items.push(m);
    }
    return el("div.lista", grupos.map((g) => [
      el("div.separador-dia", g.dia),
      g.items.map((m) => renglonMovimiento(m, { alAbrir: (x) => (x.factura_id && x.motivo !== "apartado" ? (location.hash = `#/facturacion/${x.factura_id}`) : x.apartado_id ? (location.hash = `#/apartados/${x.apartado_id}`) : abrirFicha(x.producto_id)) })),
    ]));
  }

  ctx.pintar(
    el("div.cabeza", el("div", el("h1", "Movimientos"), el("p", "Compras, salidas y todo lo que entra y sale de la mercadería."))),
    pestanas,
    filtros,
    resumen,
    cuerpo);
  pintar();
}

// Prendas que faltan por registrar en el inventario respecto de lo pactado
const faltan = (c) => Math.max(0, (c.prendas_pedidas || 0) - (c.unidades || 0));
function avance(c) {
  if (!c.prendas_pedidas) return el("span.tenue", `${c.unidades} ${c.unidades === 1 ? "prenda registrada" : "prendas registradas"}`);
  const f = faltan(c);
  return f > 0
    ? el("span.sello.pago-pendiente", `${c.unidades} de ${c.prendas_pedidas} registradas · faltan ${f}`)
    : el("span.sello.pagado", `${c.unidades} de ${c.prendas_pedidas} registradas`);
}
const lineaRecibo = (et, val, clase = "") => el("div.linea" + (clase === ".total" ? ".total" : ""), el("span.et", et), el("span.puntos"), el("span.val" + (clase !== ".total" ? clase : ""), val));
const hoyCR = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ZONA }).format(new Date());

// ---------- Nueva compra: lo que se pactó con el proveedor ----------
async function vistaNuevaCompra(_pagina, ctx) {
  const proveedores = await datos.proveedores().catch(() => []);
  const error = el("div.error-form.oculto");
  const proveedor = selectorProveedor(proveedores);
  const factura = el("input", { placeholder: "Ej.: F-20451", autocomplete: "off" });
  const fechaCompra = el("input", { type: "date", value: hoyCR(), max: hoyCR() });
  const prendas = contador({ valor: 1, min: 1, max: 9999 });
  const monto = campoDinero({ required: true });
  const nota = el("textarea", { placeholder: "Ej.: pagado por SINPE, llega el viernes" });
  const boton = el("button.btn.primario.grande.ancho", { type: "submit" }, icono("check"), "Guardar compra");
  const form = el("form.panel.pila", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      const m = numero(monto.querySelector("input").value);
      const falta = !proveedor.leer() ? "Elija el proveedor o registre uno nuevo." : !(m >= 0) || monto.querySelector("input").value === "" ? "Escriba cuánto se pagó." : null;
      if (falta) { error.textContent = falta; error.classList.remove("oculto"); return; }
      try {
        const c = await trabajando(boton, () => datos.crearCompra({
          proveedorId: proveedor.leer(), factura: factura.value, nota: nota.value,
          prendasPedidas: prendas.leer(), montoPagado: m, fechaCompra: fechaCompra.value || null,
        }), "Guardando…");
        avisar(`Compra ${c.numero} guardada`);
        location.hash = `#/movimientos/compras/${c.id}`;
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    },
  },
    el("div.campo", el("span", "Proveedor ", el("em", "(a quién se le compró)")), proveedor,
      !proveedores.length ? el("small", "Todavía no hay proveedores: toque «Nuevo» para registrar el primero.") : null),
    el("div.rejilla.dos",
      el("label.campo", el("span", "Número de factura ", el("em", "(opcional)")), factura),
      el("label.campo", el("span", "Fecha de la compra"), fechaCompra)),
    el("div.rejilla.dos.siempre",
      el("div.campo", el("span", "Prendas compradas"), prendas),
      el("label.campo", el("span", "Monto pagado"), monto)),
    el("label.campo", el("span", "Nota ", el("em", "(opcional)")), nota),
    error,
    boton,
    el("p.tenue", { style: "font-size:13px" }, "Después de guardar, registre cada prenda en el inventario desde esta compra. Las existencias suben con cada prenda, no con la compra."));
  ctx.pintar(
    el("a.volver", { href: "#/movimientos/compras" }, icono("atras", "chico"), "Compras"),
    el("div.cabeza", el("div", el("h1", "Nueva compra"), el("p", "Lo que se pactó con el proveedor: cuántas prendas y cuánto se pagó."))),
    form);
  proveedor.querySelector("select").focus();
}

// ---------- Detalle de la compra: avance, prendas registradas y botón para seguir registrando ----------
async function vistaCompra(_pagina, ctx, id) {
  let c = await datos.compra(id);
  if (!c) {
    ctx.pintar(vacio("caja", "Esa compra no existe.", null, el("a.btn", { href: "#/movimientos/compras" }, "Ver compras")));
    return;
  }
  const pintar = () => {
    const f = faltan(c);
    const completa = c.prendas_pedidas > 0 && f === 0;
    const ventaEsperada = suma(c.ingresos, (i) => i.cantidad * Number(i.precio_venta));
    const ganancia = ventaEsperada - Number(c.monto_pagado);
    const diferencia = Number(c.monto_pagado) - Number(c.total);
    ctx.pintar(
      el("a.volver", { href: "#/movimientos/compras" }, icono("atras", "chico"), "Compras"),
      el("div.cabeza",
        el("div",
          el("h1", c.proveedor || "Compra sin proveedor"),
          el("div.renglon-sub", { style: "margin-top:6px" }, el("span.serie", c.numero), c.factura ? el("span", `Factura ${c.factura}`) : null, el("span.tenue", fecha(c.fecha_compra || c.creado_en)))),
        el("div.acciones", el("button.btn.chico", { type: "button", onclick: editar }, icono("editar", "chico"), "Editar"))),
      completa
        ? el("div.franja-estado.vendido", icono("check"), el("div", el("strong", "Compra completa"), el("span", `${c.unidades} prendas registradas en el inventario`)))
        : el("div.franja-estado.pendiente", icono("ingreso"), el("div",
          el("strong", c.prendas_pedidas ? `Faltan ${f} ${f === 1 ? "prenda" : "prendas"} por registrar` : "Registre las prendas de esta compra"),
          el("span", c.prendas_pedidas ? `${c.unidades} de ${c.prendas_pedidas} ya están en el inventario` : `${c.unidades} registradas hasta ahora`))),
      el("div.dos-columnas",
        el("section.panel",
          el("div.panel-titulo", el("h2", "Prendas registradas"), el("a.btn.primario.chico", { href: `#/ingresos?compra=${c.id}` }, icono("mas", "chico"), "Registrar prenda")),
          c.ingresos.length ? el("div.lista", c.ingresos.map((i) => el("button.renglon", { type: "button", onclick: () => abrirFicha(i.producto_id) },
            marcaProducto(i.producto),
            el("div.renglon-cuerpo",
              el("div.renglon-titulo", i.producto?.nombre || "Producto"),
              el("div.renglon-sub", el("span.serie", i.serie), talla(i.producto?.talla), tela(i.producto?.color))),
            el("div.renglon-fin", el("div.num", `${i.cantidad} × ${dinero(i.costo_unitario)}`), el("small", `vende a ${dinero(i.precio_venta)}`)))))
            : vacio("ingreso", "Todavía no hay prendas registradas.", "Toque «Registrar prenda» para meter la primera al inventario.")),
        el("aside.pila",
          el("section.panel",
            el("div.panel-titulo", el("h2", "La compra")),
            el("div.recibo",
              lineaRecibo("Prendas compradas", c.prendas_pedidas || "—"),
              lineaRecibo("Monto pagado", dinero(c.monto_pagado), ".total"),
              lineaRecibo("Registradas", `${c.unidades}${c.prendas_pedidas ? ` de ${c.prendas_pedidas}` : ""}`),
              lineaRecibo("Costo registrado", dinero(c.total)),
              completa && Math.abs(diferencia) >= 1
                ? lineaRecibo(diferencia > 0 ? "Pagado de más" : "Pagado de menos", dinero(Math.abs(diferencia)), ".aviso")
                : null,
              lineaRecibo("Venta esperada", dinero(ventaEsperada)),
              lineaRecibo("Ganancia esperada", dinero(ganancia), ganancia < 0 ? ".urgente" : ".listo")),
            c.nota ? el("p.suave", { style: "margin-top:10px" }, c.nota) : null))));
  };

  function editar() {
    const error = el("div.error-form.oculto");
    const proveedor = el("input", { value: c.proveedor || "" });
    const factura = el("input", { value: c.factura || "" });
    const fechaCompra = el("input", { type: "date", value: String(c.fecha_compra || "").slice(0, 10), max: hoyCR() });
    const prendas = contador({ valor: c.prendas_pedidas || 1, min: 0, max: 9999 });
    const monto = campoDinero({ value: Number(c.monto_pagado) || "" });
    const nota = el("textarea", { value: c.nota || "" });
    const boton = el("button.btn.primario", { type: "button" }, "Guardar");
    const { cerrar } = abrirHoja({
      titulo: `Compra ${c.numero}`,
      cuerpo: el("div.pila.media",
        el("label.campo", el("span", "Proveedor"), proveedor),
        el("div.rejilla.dos", el("label.campo", el("span", "Factura"), factura), el("label.campo", el("span", "Fecha"), fechaCompra)),
        el("div.rejilla.dos.siempre", el("div.campo", el("span", "Prendas compradas"), prendas), el("label.campo", el("span", "Monto pagado"), monto)),
        el("label.campo", el("span", "Nota"), nota),
        error),
      pie: [el("button.btn.fantasma", { type: "button", onclick: () => cerrar() }, "Volver"), boton],
    });
    boton.addEventListener("click", async () => {
      const m = numero(monto.querySelector("input").value || 0);
      if (!(m >= 0)) { error.textContent = "Revise el monto pagado."; error.classList.remove("oculto"); return; }
      try {
        const nuevo = await trabajando(boton, () => datos.editarCompra(c.id, {
          proveedor: proveedor.value.trim() || null, factura: factura.value.trim() || null, nota: nota.value.trim() || null,
          prendas_pedidas: prendas.leer(), monto_pagado: m, fecha_compra: fechaCompra.value || c.fecha_compra,
        }));
        Object.assign(c, nuevo, { ingresos: c.ingresos });
        cerrar();
        pintar();
        avisar("Compra actualizada");
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    });
  }
  pintar();
}
