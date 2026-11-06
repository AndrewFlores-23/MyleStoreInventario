// Inicio: cómo está el inventario, qué falta por entregar o cobrar y lo último que se movió
import { datos } from "../datos.js";
import { estado, cargarProductos, ponerPendientes } from "../estado.js";
import { el, icono, dinero, mismoMes, esHoy, nombreMes, talla } from "../util.js";
import { fotoProducto, sellosApartado, cajaDias, renglonMovimiento, unidades, vacio } from "../componentes.js";
import { abrirFicha } from "./inventario.js";

const suma = (lista, fn) => lista.reduce((s, x) => s + fn(x), 0);
const linea = (et, val, clase = "", detalle) =>
  el("div.linea", el("span.et", et), el("span.puntos"), el("span.val" + clase, val, detalle ? el("small", detalle) : null));

export async function vistaInicio(_pagina, ctx) {
  const [apartados, salidas, ultimos, compras, proveedores, ingresosMes] = await Promise.all([
    datos.apartados(),
    datos.movimientos({ tipo: "salida", limite: 500 }),
    datos.movimientos({ limite: 8 }),
    datos.compras({ limite: 100 }).catch(() => []),
    datos.proveedores().catch(() => []),
    datos.ingresos({ limite: 500 }),
    cargarProductos(),
  ]);
  const productos = estado.productos;
  const conExistencias = productos.filter((p) => p.existencias > 0);
  const unidadesDisponibles = suma(productos, (p) => p.existencias);
  const valorCosto = suma(productos, (p) => p.existencias * Number(p.costo));
  const valorVenta = suma(productos, (p) => p.existencias * Number(p.precio_venta));

  const vivos = apartados.filter((a) => a.estado !== "anulado");
  const porEntregar = apartados.filter((a) => a.estado === "pendiente").sort((a, b) => a.creado_en.localeCompare(b.creado_en));
  const porCobrar = vivos.filter((a) => !a.pagado);
  const cobradoMes = suma(vivos.filter((a) => a.pagado && mismoMes(a.pagado_en)), (a) => Number(a.total));
  const ventasMes = suma(salidas.filter((m) => m.motivo === "venta" && mismoMes(m.creado_en)), (m) => m.cantidad * Number(m.precio_unitario || 0));

  // Cómo vamos: lo vendido hoy y en el mes (apartados cobrados + ventas directas) y la ganancia de lo ingresado
  const cobradoHoy = suma(vivos.filter((a) => a.pagado && esHoy(a.pagado_en)), (a) => Number(a.total));
  const ventasHoy = suma(salidas.filter((m) => m.motivo === "venta" && esHoy(m.creado_en)), (m) => m.cantidad * Number(m.precio_unitario || 0));
  const apartadosHoy = vivos.filter((a) => a.pagado && esHoy(a.pagado_en)).length + salidas.filter((m) => m.motivo === "venta" && esHoy(m.creado_en)).length;
  const apartadosMes = vivos.filter((a) => a.pagado && mismoMes(a.pagado_en)).length + salidas.filter((m) => m.motivo === "venta" && mismoMes(m.creado_en)).length;
  const delMes = ingresosMes.filter((i) => mismoMes(i.creado_en));
  const invertidoMes = suma(delMes, (i) => i.cantidad * Number(i.costo_unitario));
  const esperadoMes = suma(delMes, (i) => i.cantidad * Number(i.precio_venta));
  const prendasMes = suma(delMes, (i) => i.cantidad);
  ponerPendientes(porEntregar.length);

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
      detalle: unidadesDisponibles ? `${unidadesDisponibles} prendas disponibles` : "Registre las prendas con su foto",
    },
    {
      icono: "bolsa", titulo: "Apartados", href: porEntregar.length ? "#/apartados" : "#/apartados/nuevo",
      hecho: porEntregar.length === 0 && apartados.length > 0,
      aviso: porEntregar.length > 0,
      detalle: porEntregar.length ? `${porEntregar.length} por entregar` : "Arme el pedido y envíe la factura",
    },
    {
      icono: "entrega", titulo: "Entregas y salidas", href: porEntregar.length ? `#/apartados/${porEntregar[0].id}` : "#/salidas",
      hecho: apartados.some((a) => a.estado === "entregado"),
      detalle: porCobrar.length ? `${porCobrar.length} por cobrar` : "Marque pagado y entregado",
    },
  ];
  const recorrido = el("div.recorrido", pasos.map((p, i) => el("a.paso" + (p.hecho ? ".hecho" : "") + (p.aviso ? ".aviso" : ""), { href: p.href },
    el("span.paso-num", p.hecho && !p.aviso ? icono("check", "chico") : String(i + 1)),
    el("span.paso-icono", icono(p.icono)),
    el("span.paso-texto", el("strong", p.titulo), el("small", p.detalle)))));

  const cifra = (rotulo, valor, detalle, clase = "") => el("div.cifra" + clase, el("span.cifra-rotulo", rotulo), el("span.cifra-valor", valor), detalle ? el("span.cifra-detalle", detalle) : null);
  const comoVamos = el("section.panel.como-vamos",
    el("div.panel-titulo", el("h2", "Cómo vamos"), el("a", { href: "#/movimientos/salidas" }, "Ver ventas →")),
    el("div.cifras",
      cifra("Vendido hoy", dinero(cobradoHoy + ventasHoy), apartadosHoy ? `${apartadosHoy} venta${apartadosHoy === 1 ? "" : "s"}` : "Todavía nada hoy", cobradoHoy + ventasHoy > 0 ? ".listo" : ""),
      cifra(`Vendido en ${mes}`, dinero(cobradoMes + ventasMes), `${apartadosMes} venta${apartadosMes === 1 ? "" : "s"} · ${dinero(cobradoMes)} apartados + ${dinero(ventasMes)} directas`),
      cifra("Ganancia del inventario", dinero(valorVenta - valorCosto), `Si se vende todo lo que hay: ${dinero(valorVenta)} a la venta, costó ${dinero(valorCosto)}`, ".acento"),
      cifra(`Ingresado en ${mes}`, dinero(esperadoMes - invertidoMes), prendasMes ? `Ganancia esperada de ${prendasMes} prendas: invertido ${dinero(invertidoMes)}, a la venta ${dinero(esperadoMes)}` : "Sin ingresos este mes")));

  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Resumen"), el("p", hoy.charAt(0).toUpperCase() + hoy.slice(1)))),
    recorrido,
    comoVamos,
    el("div.atajos",
      el("a.btn.primario", { href: "#/movimientos/compras/nueva" }, icono("caja"), "Nueva compra"),
      el("a.btn", { href: "#/ingresos" }, icono("ingreso"), "Registrar prenda"),
      el("a.btn", { href: "#/apartados/nuevo" }, icono("bolsa"), "Nuevo apartado"),
      el("a.btn", { href: "#/salidas" }, icono("salida"), "Salida")),
    el("div.resumen-cifras",
      el("section.panel",
        el("div.panel-titulo", el("h2", "Inventario"), el("a", { href: "#/inventario" }, "Ver todo →")),
        el("div.recibo",
          linea("Unidades disponibles", unidadesDisponibles),
          linea("Productos con existencias", conExistencias.length, "", `de ${productos.length}`),
          linea("Valor a costo", dinero(valorCosto)),
          linea("Valor a precio de venta", dinero(valorVenta)),
          linea("Ganancia esperada", dinero(valorVenta - valorCosto), ".acento"))),
      el("section.panel",
        el("div.panel-titulo", el("h2", "Apartados"), el("a", { href: "#/apartados" }, "Ver todos →")),
        el("div.recibo",
          linea("Por entregar", porEntregar.length, "", `${unidades(porEntregar.flatMap((a) => a.articulos))} prendas`),
          linea("Por cobrar", dinero(suma(porCobrar, (a) => Number(a.total))), porCobrar.length ? ".aviso" : "", `${porCobrar.length} apartado${porCobrar.length === 1 ? "" : "s"}`),
          linea(`Cobrado en ${mes}`, dinero(cobradoMes), cobradoMes ? ".listo" : ""),
          linea(`Ventas directas en ${mes}`, dinero(ventasMes)),
          linea(`Total vendido en ${mes}`, dinero(cobradoMes + ventasMes), "", null)))),
    el("div.dos-columnas.iguales",
      el("section.panel",
        el("div.panel-titulo", el("h2", "Por entregar"), el("a", { href: "#/apartados/nuevo" }, "+ Nuevo apartado")),
        porEntregar.length
          ? el("div.lista", porEntregar.slice(0, 6).map((ap) => el("a.renglon", { href: `#/apartados/${ap.id}` },
            cajaDias(ap),
            el("div.renglon-cuerpo",
              el("div.renglon-titulo", ap.cliente_nombre),
              el("div.renglon-sub", el("span.mono.tenue", ap.numero), sellosApartado(ap)[0])),
            el("div.renglon-fin", el("div.num", dinero(ap.total)), el("small", `${unidades(ap.articulos)} prendas`)))))
          : vacio("bolsa", "No hay apartados por entregar.")),
      el("section.panel",
        el("div.panel-titulo", el("h2", "Se están agotando"), el("a", { href: "#/ingresos" }, "+ Ingreso")),
        agotandose.length
          ? el("div.lista", agotandose.map((p) => el("button.renglon", { type: "button", onclick: () => abrirFicha(p.id) },
            fotoProducto(p),
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
