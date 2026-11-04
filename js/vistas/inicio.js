// Inicio: cómo está el inventario, qué falta por entregar o cobrar y lo último que se movió
import { datos } from "../datos.js";
import { estado, cargarProductos, ponerPendientes } from "../estado.js";
import { el, icono, dinero, mismoMes, nombreMes, talla } from "../util.js";
import { fotoProducto, sellosApartado, cajaDias, renglonMovimiento, unidades, vacio } from "../componentes.js";
import { abrirFicha } from "./inventario.js";

const suma = (lista, fn) => lista.reduce((s, x) => s + fn(x), 0);
const linea = (et, val, clase = "", detalle) =>
  el("div.linea", el("span.et", et), el("span.puntos"), el("span.val" + clase, val, detalle ? el("small", detalle) : null));

export async function vistaInicio(_pagina, ctx) {
  const [apartados, salidas, ultimos] = await Promise.all([
    datos.apartados(),
    datos.movimientos({ tipo: "salida", limite: 500 }),
    datos.movimientos({ limite: 8 }),
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
  ponerPendientes(porEntregar.length);

  const agotandose = productos.filter((p) => p.activo && p.existencias <= 2).sort((a, b) => a.existencias - b.existencias).slice(0, 8);
  const mes = nombreMes();
  const hoy = new Intl.DateTimeFormat("es-CR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Costa_Rica" }).format(new Date());

  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Resumen"), el("p", hoy.charAt(0).toUpperCase() + hoy.slice(1)))),
    el("div.atajos",
      el("a.btn.primario", { href: "#/ingresos" }, icono("ingreso"), "Nuevo ingreso"),
      el("a.btn", { href: "#/apartados/nuevo" }, icono("bolsa"), "Nuevo apartado"),
      el("a.btn", { href: "#/salidas" }, icono("salida"), "Registrar salida")),
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
