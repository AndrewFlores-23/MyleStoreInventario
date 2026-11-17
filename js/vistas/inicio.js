// Inicio: cómo va la tienda, el recorrido, qué falta por facturar y lo último que se movió
import { datos } from "../datos.js";
import { estado, cargarProductos, ponerPendientes } from "../estado.js";
import { el, icono, dinero, fecha, mismoMes, esHoy, nombreMes, talla } from "../util.js";
import { marcaProducto, sellosApartado, cajaDias, renglonMovimiento, unidades, prendasFactura, costoFactura, envioFactura, ventaPrendas, gananciaFactura, vacio } from "../componentes.js";
import { abrirFicha } from "./inventario.js";

const suma = (lista, fn) => lista.reduce((s, x) => s + fn(x), 0);
const facturasTxt = (n) => `${n} factura${n === 1 ? "" : "s"}`;
const prendasTxt = (n) => `${n} prenda${n === 1 ? "" : "s"}`;
const linea = (et, val, clase = "", detalle) =>
  el("div.linea", el("span.et", et), el("span.puntos"), el("span.val" + clase, val, detalle ? el("small", detalle) : null));

export async function vistaInicio(_pagina, ctx) {
  const [apartados, ultimos, compras, proveedores, ingresosMes, facturas, gastos] = await Promise.all([
    datos.apartados(),
    datos.movimientos({ limite: 8 }),
    datos.compras({ limite: 100 }).catch(() => []),
    datos.proveedores().catch(() => []),
    datos.ingresos({ limite: 500 }),
    datos.facturas().catch(() => []),
    datos.gastos().catch(() => []),
    cargarProductos(),
  ]);
  const productos = estado.productos;
  const conExistencias = productos.filter((p) => p.existencias > 0);
  const unidadesDisponibles = suma(productos, (p) => p.existencias);
  const valorCosto = suma(productos, (p) => p.existencias * Number(p.costo));
  const valorVenta = suma(productos, (p) => p.existencias * Number(p.precio_venta));

  const pendientes = apartados.filter((a) => a.estado === "pendiente").sort((a, b) => a.creado_en.localeCompare(b.creado_en));
  const porFacturar = suma(pendientes, (a) => Number(a.total));
  const emitidas = facturas.filter((f) => f.estado === "emitida");

  // Cada grupo de facturas se lee igual: vendido = solo las prendas (ya con el descuento), los envíos van aparte,
  // y la ganancia = vendido − costo de esas prendas. Solo cuentan las facturas emitidas: un apartado no suma hasta facturarse
  const resumir = (lista) => ({
    n: lista.length,
    vendido: suma(lista, ventaPrendas),
    prendas: suma(lista, prendasFactura),
    envios: suma(lista, envioFactura),
    costo: suma(lista, costoFactura),
    ganancia: suma(lista, gananciaFactura),
  });
  const total = resumir(emitidas);
  const mesV = resumir(emitidas.filter((f) => mismoMes(f.creado_en)));
  const hoyV = resumir(emitidas.filter((f) => esHoy(f.creado_en)));
  const conEnvio = emitidas.filter((f) => envioFactura(f) > 0);
  const enDia = (g) => g.fecha + "T12:00:00-06:00";
  const gastosDelMes = gastos.filter((g) => mismoMes(enDia(g))).sort((a, b) => Number(b.monto) - Number(a.monto));
  const gastosMes = suma(gastosDelMes, (g) => Number(g.monto));
  const gastosHoy = suma(gastos.filter((g) => esHoy(enDia(g))), (g) => Number(g.monto));
  // Ganancia del mes: lo que dejaron las prendas, más los envíos cobrados, menos los gastos (ahí van los envíos pagados)
  const gananciaMes = mesV.ganancia + mesV.envios - gastosMes;
  const desde = facturas.length >= 500 ? " (últimas 500 facturas)" : "";
  const delMes = ingresosMes.filter((i) => mismoMes(i.creado_en));
  const invertidoMes = suma(delMes, (i) => i.cantidad * Number(i.costo_unitario));
  const esperadoMes = suma(delMes, (i) => i.cantidad * Number(i.precio_venta));
  const prendasMes = suma(delMes, (i) => i.cantidad);
  ponerPendientes(pendientes.length);

  const agotandose = productos.filter((p) => p.activo && p.existencias <= 2).sort((a, b) => a.existencias - b.existencias).slice(0, 8);
  const mes = nombreMes();
  const hoy = new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Costa_Rica" }).format(new Date());

  // El recorrido de la tienda, de la compra a la entrega: cada paso dice qué sigue y lleva a su pantalla
  const comprasPendientes = compras.filter((c) => (c.prendas_pedidas || 0) > (c.unidades || 0));
  const pasos = [
    {
      icono: "caja", titulo: "Proveedores", href: "#/ajustes",
      hecho: proveedores.length > 0,
      detalle: proveedores.length ? `${proveedores.length} registrado${proveedores.length === 1 ? "" : "s"}` : "Registre a quién le compra",
    },
    {
      icono: "caja", titulo: "Compras", href: comprasPendientes.length ? `#/movimientos/compras/${comprasPendientes[0].id}` : "#/movimientos/compras/nueva",
      hecho: compras.length > 0 && !comprasPendientes.length,
      aviso: comprasPendientes.length > 0,
      detalle: comprasPendientes.length ? `${comprasPendientes.length} por terminar de registrar` : compras.length ? `${compras.length} registrada${compras.length === 1 ? "" : "s"}` : "Anote el pedido al proveedor",
    },
    {
      icono: "percha", titulo: "Inventario", href: "#/inventario",
      hecho: unidadesDisponibles > 0,
      detalle: unidadesDisponibles ? `${unidadesDisponibles} prendas disponibles` : "Registre las prendas con su talla y precio",
    },
    {
      icono: "bolsa", titulo: "Apartados", href: pendientes.length ? "#/apartados" : "#/apartados/nuevo",
      hecho: pendientes.length === 0 && apartados.length > 0,
      aviso: pendientes.length > 0,
      detalle: pendientes.length ? `${pendientes.length} por facturar · ${dinero(porFacturar)}` : "Aparte las prendas de un pedido",
    },
    {
      icono: "billete", titulo: "Facturación", href: pendientes.length ? `#/facturacion/nueva?apartado=${pendientes[0].id}` : "#/facturacion/nueva",
      hecho: emitidas.length > 0,
      detalle: emitidas.length ? `${emitidas.length} factura${emitidas.length === 1 ? "" : "s"} emitida${emitidas.length === 1 ? "" : "s"}` : "Facture cuando el cliente pague",
    },
  ];
  const recorrido = el("div.recorrido", pasos.map((p, i) => el("a.paso" + (p.hecho ? ".hecho" : "") + (p.aviso ? ".aviso" : ""), { href: p.href },
    el("span.paso-num", p.hecho && !p.aviso ? icono("check", "chico") : String(i + 1)),
    el("span.paso-icono", icono(p.icono)),
    el("span.paso-texto", el("strong", p.titulo), el("small", p.detalle)))));

  const cifra = (rotulo, valor, detalle, clase = "") => el("div.cifra" + clase, el("span.cifra-rotulo", rotulo), el("span.cifra-valor", valor), detalle ? el("span.cifra-detalle", detalle) : null);
  const comoVamos = el("section.panel.como-vamos",
    el("div.panel-titulo", el("h2", "Cómo vamos"), el("a", { href: "#/facturacion" }, "Ver ventas →")),
    el("div.cifras",
      cifra("Vendido en total", dinero(total.vendido), total.n
        ? `${prendasTxt(total.prendas)} en ${facturasTxt(total.n)}, sin envíos${desde}`
        : "Todavía no hay facturas", total.vendido > 0 ? ".listo" : ""),
      cifra("Ganancia de lo vendido", dinero(total.ganancia), total.prendas
        ? `Vendido ${dinero(total.vendido)} − costo de las prendas ${dinero(total.costo)}${desde}`
        : "Sale de cada factura: lo vendido menos el costo de las prendas", total.ganancia >= 0 ? ".acento" : ".urgente"),
      cifra("Vendido hoy", dinero(hoyV.vendido), hoyV.n ? `${prendasTxt(hoyV.prendas)} en ${facturasTxt(hoyV.n)}${gastosHoy ? ` · gastos ${dinero(gastosHoy)}` : ""}` : "Todavía nada hoy", hoyV.vendido > 0 ? ".listo" : ""),
      cifra(`Vendido en ${mes}`, dinero(mesV.vendido), mesV.n ? `${prendasTxt(mesV.prendas)} en ${facturasTxt(mesV.n)}, sin envíos` : "Todavía no hay facturas este mes"),
      cifra(`Ganancia de ${mes}`, dinero(gananciaMes), `Prendas ${dinero(mesV.ganancia)}${mesV.envios ? ` + envíos ${dinero(mesV.envios)}` : ""} − gastos ${dinero(gastosMes)}`, gananciaMes >= 0 ? ".acento" : ".urgente"),
      cifra(`Gastos de ${mes}`, dinero(gastosMes), gastosDelMes.length
        ? `${gastosDelMes.length} gasto${gastosDelMes.length === 1 ? "" : "s"}: ${gastosDelMes.slice(0, 3).map((g) => g.descripcion || g.categoria).join(", ")}${gastosDelMes.length > 3 ? "…" : ""}`
        : "Sin gastos este mes", gastosMes > 0 ? ".urgente" : ""),
      cifra("Ganancia del inventario", dinero(valorVenta - valorCosto), unidadesDisponibles
        ? `Si se venden las ${prendasTxt(unidadesDisponibles)} que quedan: ${dinero(valorVenta)} a la venta − ${dinero(valorCosto)} de costo`
        : "No quedan prendas disponibles"),
      cifra(`Invertido en ${mes}`, dinero(invertidoMes), prendasMes
        ? `${prendasTxt(prendasMes)} ingresadas: a la venta ${dinero(esperadoMes)}, ganancia esperada ${dinero(esperadoMes - invertidoMes)}`
        : "Sin mercadería ingresada este mes"),
      // Los envíos, aparte de lo vendido: un botón con cuántos hay que despliega cada uno con su factura
      el("details.cifra.ancha.envios",
        el("summary",
          el("span", icono("entrega", "chico"), el("b", conEnvio.length), ` envío${conEnvio.length === 1 ? "" : "s"} cobrado${conEnvio.length === 1 ? "" : "s"}`),
          icono("atras", "chico flecha")),
        el("div.envios-lista",
          conEnvio.map((f) => el("a.envio-fila", { href: `#/facturacion/${f.id}` },
            el("div",
              el("div.envio-titulo", el("span.mono", f.numero), ` · ${f.cliente_nombre}`),
              el("div.envio-sub", [fecha(f.creado_en), f.forma_pago, f.apartado && `de ${f.apartado.numero}`].filter(Boolean).join(" · "))),
            el("b.num", dinero(envioFactura(f))))),
          conEnvio.length ? el("div.envios-total", el("span", "Total en envíos"), el("b.num", dinero(total.envios))) : null,
          el("p.envios-nota", conEnvio.length
            ? `Solo facturas emitidas${desde}: un envío cuenta hasta que su apartado se factura.`
            : "Todavía no hay envíos facturados. Un envío cuenta hasta que su apartado se factura.")))));

  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Resumen"), el("p", hoy.charAt(0).toUpperCase() + hoy.slice(1)))),
    recorrido,
    comoVamos,
    el("div.atajos",
      el("a.btn.primario", { href: "#/movimientos/compras/nueva" }, icono("caja"), "Nueva compra"),
      el("a.btn", { href: "#/ingresos" }, icono("ingreso"), "Registrar prenda"),
      el("a.btn", { href: "#/facturacion/nueva" }, icono("billete"), "Factura"),
      el("a.btn", { href: "#/apartados/nuevo" }, icono("bolsa"), "Apartado"),
      el("a.btn", { href: "#/gastos" }, icono("gasto"), "Gasto")),
    el("div.resumen-cifras",
      el("section.panel",
        el("div.panel-titulo", el("h2", "Inventario"), el("a", { href: "#/inventario" }, "Ver todo →")),
        el("div.recibo",
          linea("Unidades disponibles", unidadesDisponibles),
          linea("Productos con existencias", conExistencias.length, "", `de ${productos.length}`),
          linea("Valor a precio de venta", dinero(valorVenta)),
          linea("Valor a costo", dinero(valorCosto)),
          linea("Ganancia esperada", dinero(valorVenta - valorCosto), ".acento"))),
      el("section.panel",
        el("div.panel-titulo", el("h2", "Ventas y apartados"), el("a", { href: "#/facturacion" }, "Ver facturas →")),
        el("div.recibo",
          linea("Apartados por facturar", pendientes.length, pendientes.length ? ".aviso" : "", `${dinero(porFacturar)} · ${unidades(pendientes.flatMap((a) => a.articulos))} prendas`),
          linea(`Vendido en ${mes}`, dinero(mesV.vendido), mesV.vendido ? ".listo" : "", facturasTxt(mesV.n)),
          linea(`Envíos en ${mes}`, dinero(mesV.envios)),
          linea(`Gastos en ${mes}`, dinero(gastosMes), gastosMes ? ".urgente" : ""),
          linea(`Ganancia de ${mes}`, dinero(gananciaMes), gananciaMes >= 0 ? ".acento" : ".urgente", null)))),
    el("div.dos-columnas.iguales",
      el("section.panel",
        el("div.panel-titulo", el("h2", "Apartados por facturar"), el("a", { href: "#/apartados/nuevo" }, "+ Nuevo apartado")),
        pendientes.length
          ? el("div.lista", pendientes.slice(0, 6).map((ap) => el("a.renglon", { href: `#/apartados/${ap.id}` },
            cajaDias(ap),
            el("div.renglon-cuerpo",
              el("div.renglon-titulo", ap.cliente_nombre),
              el("div.renglon-sub", el("span.mono.tenue", ap.numero), sellosApartado(ap)[0])),
            el("div.renglon-fin", el("div.num", dinero(ap.total)), el("small", `${unidades(ap.articulos)} prendas`)))))
          : vacio("bolsa", "No hay apartados pendientes.")),
      el("section.panel",
        el("div.panel-titulo", el("h2", "Se están agotando"), el("a", { href: "#/ingresos" }, "+ Ingreso")),
        agotandose.length
          ? el("div.lista", agotandose.map((p) => el("button.renglon", { type: "button", onclick: () => abrirFicha(p.id) },
            marcaProducto(p),
            el("div.renglon-cuerpo", el("div.renglon-titulo", p.nombre), el("div.renglon-sub", talla(p.talla), p.color || "")),
            el("div.renglon-fin",
              p.existencias === 0 ? el("span.sello.agotado", "Agotado") : el("div.num", { style: "color:var(--aviso)" }, `Quedan ${p.existencias}`)))))
          : vacio("percha", "Todo tiene existencias.", "Aquí salen los productos con 2 unidades o menos."))),
    el("section.panel",
      el("div.panel-titulo", el("h2", "Últimos movimientos")),
      ultimos.length
        ? el("div.lista", ultimos.map((m) => renglonMovimiento(m, { alAbrir: (x) => abrirFicha(x.producto_id) })))
        : vacio("caja", "Todavía no hay movimientos.", "Empiece registrando el primer ingreso de mercadería.",
          el("a.btn.primario", { href: "#/ingresos" }, icono("ingreso"), "Registrar ingreso"))),
  );
}
