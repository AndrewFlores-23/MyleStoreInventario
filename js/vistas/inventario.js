// Inventario: las prendas con su foto, talla, color, precio y cuántas quedan; la ficha de cada una con su historial
import { datos } from "../datos.js";
import { estado, cargarProductos, ir } from "../estado.js";
import { el, icono, dinero, talla, tela, sinTildes, abrirHoja, avisar, mensajeError, trabajando, comprimirFoto, campoDinero, numero, confirmar,
  CATEGORIAS_COMUNES, COLORES_COMUNES } from "../util.js";
import { fotoProducto, renglonMovimiento, botonesFoto, vacio } from "../componentes.js";

const filtro = { texto: "", categoria: "", agotados: true, ocultos: false };

export async function vistaInventario(pagina, ctx) {
  await cargarProductos();
  const rejilla = el("div.prendas");
  const totales = el("div.totales-inventario");
  const chips = el("div.chips");

  const pintarChips = () => {
    const cats = [...new Set(estado.productos.filter((p) => p.activo).map((p) => p.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    if (filtro.categoria && !cats.includes(filtro.categoria)) filtro.categoria = "";
    chips.replaceChildren(...["", ...cats].map((c) => el("button.chip", {
      type: "button",
      "aria-pressed": String(filtro.categoria === c),
      onclick: () => { filtro.categoria = c; pintarChips(); pintar(); },
    }, c || "Todas")));
    chips.classList.toggle("oculto", cats.length === 0);
  };

  const pintar = () => {
    const palabras = sinTildes(filtro.texto).split(/\s+/).filter(Boolean);
    const lista = estado.productos.filter((p) => {
      if (!filtro.ocultos && !p.activo) return false;
      if (filtro.ocultos && p.activo) return false;
      if (!filtro.agotados && p.existencias === 0) return false;
      if (filtro.categoria && p.categoria !== filtro.categoria) return false;
      const texto = sinTildes([p.nombre, p.talla, p.color, p.categoria].join(" "));
      return palabras.every((w) => texto.includes(w));
    }).sort((a, b) => (a.existencias > 0 ? 0 : 1) - (b.existencias > 0 ? 0 : 1));

    const u = lista.reduce((s, p) => s + p.existencias, 0);
    const v = lista.reduce((s, p) => s + p.existencias * Number(p.precio_venta), 0);
    totales.replaceChildren(
      el("span", el("b", lista.length), ` producto${lista.length === 1 ? "" : "s"}`),
      el("span", el("b", u), ` unidad${u === 1 ? "" : "es"} disponible${u === 1 ? "" : "s"}`),
      el("span", "valor de venta ", el("b", dinero(v))));

    if (!estado.productos.length) {
      rejilla.replaceChildren(vacio("percha", "Todavía no hay productos.", "Cada producto entra con su primer ingreso: foto, cantidad y precios.",
        el("a.btn.primario", { href: "#/ingresos" }, icono("ingreso"), "Registrar el primer ingreso")));
      return;
    }
    if (!lista.length) {
      rejilla.replaceChildren(vacio("buscar", filtro.ocultos ? "No hay productos ocultos." : "No hay productos con esa búsqueda."));
      return;
    }
    rejilla.replaceChildren(...lista.map(tarjeta));
  };

  const tarjeta = (p) => {
    const stock = p.existencias === 0 ? ".cero" : p.existencias <= 2 ? ".poco" : "";
    return el("button.prenda" + (p.existencias === 0 ? ".agotada" : ""), { type: "button", onclick: () => abrirFicha(p.id, { alCambiar: () => { pintarChips(); pintar(); } }) },
      el("div.prenda-foto", fotoProducto(p, "foto"), el("span.precio-colgante", dinero(p.precio_venta))),
      el("div.prenda-info",
        el("div.prenda-nombre", p.nombre),
        el("div.prenda-meta", talla(p.talla), tela(p.color)),
        el("div.prenda-stock" + stock,
          p.existencias === 0 ? el("span", "Agotado") : [el("b", p.existencias), el("span", p.existencias === 1 ? "disponible" : "disponibles")])));
  };

  const buscar = el("input", { type: "search", placeholder: "Buscar prenda, talla o color", value: filtro.texto, oninput: (e) => { filtro.texto = e.target.value; pintar(); } });
  const unidadesTotal = estado.productos.reduce((s, p) => s + p.existencias, 0);
  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Inventario"), el("p", `${estado.productos.filter((p) => p.activo).length} productos · ${unidadesTotal} unidades disponibles`)),
      el("div.acciones", el("a.btn.primario", { href: "#/ingresos" }, icono("mas"), "Nuevo ingreso"))),
    el("div.filtros",
      el("div.buscar", icono("buscar"), buscar),
      el("label.interruptor", el("input", { type: "checkbox", checked: filtro.agotados, onchange: (e) => { filtro.agotados = e.target.checked; pintar(); } }), "Mostrar agotados"),
      el("label.interruptor", el("input", { type: "checkbox", checked: filtro.ocultos, onchange: (e) => { filtro.ocultos = e.target.checked; pintar(); } }), "Ver ocultos"),
      chips),
    totales,
    rejilla);
  pintarChips();
  pintar();
}

// ---------- Ficha del producto ----------
export async function abrirFicha(id, { alCambiar } = {}) {
  let p = estado.productos.find((x) => x.id === id);
  if (!p) {
    await cargarProductos();
    p = estado.productos.find((x) => x.id === id);
    if (!p) return avisar("Ese producto ya no existe", "error");
  }
  const cuerpo = el("div");
  const { cerrar } = abrirHoja({ titulo: "Producto", clase: "ancha", cuerpo });
  let movimientos = null;
  let editando = false;

  const refrescar = async () => {
    await cargarProductos();
    p = estado.productos.find((x) => x.id === id) || p;
    alCambiar?.();
    pintar();
  };

  const cambiarFoto = async (archivo) => {
    if (!archivo) return;
    try {
      const ruta = await datos.subirFoto(await comprimirFoto(archivo));
      await datos.guardarProducto(id, { foto_path: ruta });
      avisar("Foto actualizada");
      await refrescar();
    } catch (e) {
      avisar(mensajeError(e), "error");
    }
  };

  const linea = (et, val, clase = "") => el("div.linea", el("span.et", et), el("span.puntos"), el("span.val" + clase, val));

  const pintar = (modo) => {
    if (modo !== undefined) editando = modo;
    const ganancia = Number(p.precio_venta) - Number(p.costo);
    const margen = Number(p.precio_venta) > 0 ? Math.round((ganancia / Number(p.precio_venta)) * 100) : 0;
    const foto = el("label.ficha-foto", { title: "Cambiar foto" },
      fotoProducto(p, "foto"),
      el("input", { type: "file", accept: "image/*", class: "oculto", onchange: (e) => cambiarFoto(e.target.files[0]) }),
      el("span.cambiar-foto", icono("camara", "chico"), "Cambiar foto"));

    const info = editando ? formularioEdicion() : el("div",
      el("div", { style: "display:flex;align-items:flex-start;justify-content:space-between;gap:12px" },
        el("div",
          el("h3", { style: "font-size:20px;line-height:1.25" }, p.nombre),
          el("div.renglon-sub", { style: "margin-top:8px" }, p.categoria ? el("span", p.categoria) : null, tela(p.color), !p.activo ? el("span.sello.anulado", { style: "text-decoration:none" }, "Oculto") : null)),
        talla(p.talla, "grande")),
      el("div.recibo", { style: "margin-top:14px" },
        linea("Disponibles", p.existencias, p.existencias === 0 ? ".urgente" : p.existencias <= 2 ? ".aviso" : ""),
        linea("Precio de venta", dinero(p.precio_venta)),
        linea("Costo (último ingreso)", dinero(p.costo)),
        linea("Ganancia por unidad", `${dinero(ganancia)} · ${margen} %`, ganancia < 0 ? ".urgente" : ""),
        linea("En inventario a precio de venta", dinero(p.existencias * Number(p.precio_venta)))),
      el("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-top:16px" },
        el("button.btn.primario", { type: "button", onclick: () => { cerrar(); ir(`ingresos?producto=${p.id}`); } }, icono("ingreso"), "Ingresar más"),
        el("button.btn", { type: "button", disabled: p.existencias === 0, onclick: () => { cerrar(); ir(`salidas?producto=${p.id}`); } }, icono("salida"), "Registrar salida"),
        el("button.btn.fantasma", { type: "button", onclick: () => pintar(true) }, icono("editar"), "Editar datos"),
        p.activo && p.existencias === 0
          ? el("button.btn.fantasma", { type: "button", onclick: ocultar }, icono("ojo"), "Ocultar del inventario")
          : null,
        !p.activo ? el("button.btn.fantasma", { type: "button", onclick: mostrar }, icono("ojo"), "Volver a mostrar") : null));

    const historial = el("section", { style: "margin-top:22px" },
      el("div.panel-titulo", el("h2", "Historial"), el("span.tenue", { style: "font-size:13px" }, "Entradas con su serie y salidas")),
      movimientos == null ? el("div.cargando", "Cargando…")
        : movimientos.length ? el("div.lista", movimientos.map((m) => renglonMovimiento(m, { mostrarProducto: false })))
          : vacio("caja", "Sin movimientos."));

    cuerpo.replaceChildren(el("div.ficha", el("div.columna-foto", foto, botonesFoto(cambiarFoto, { chico: true })), info), historial);
  };

  const formularioEdicion = () => {
    const error = el("div.error-form.oculto");
    const nombre = el("input", { value: p.nombre, required: true });
    const categoria = el("input", { value: p.categoria || "", list: "lista-categorias-ficha" });
    const tallaIn = el("input", { value: p.talla || "" });
    const color = el("input", { value: p.color || "", list: "lista-colores-ficha" });
    const precio = campoDinero({ value: p.precio_venta });
    const costo = campoDinero({ value: p.costo });
    const boton = el("button.btn.primario", { type: "submit" }, "Guardar");
    const cats = [...new Set([...estado.productos.map((x) => x.categoria).filter(Boolean), ...CATEGORIAS_COMUNES])];
    return el("form", {
      style: "display:flex;flex-direction:column;gap:14px",
      onsubmit: async (ev) => {
        ev.preventDefault();
        error.classList.add("oculto");
        const pv = numero(precio.querySelector("input").value);
        const pc = numero(costo.querySelector("input").value);
        if (!nombre.value.trim()) return mostrarError(error, "Escriba el nombre del producto.");
        if (!(pv >= 0) || !(pc >= 0)) return mostrarError(error, "Revise los precios.");
        try {
          await trabajando(boton, () => datos.guardarProducto(p.id, {
            nombre: nombre.value.trim(), categoria: categoria.value.trim() || null, talla: tallaIn.value.trim() || null,
            color: color.value.trim() || null, precio_venta: pv, costo: pc,
          }));
          avisar("Producto actualizado");
          editando = false;
          await refrescar();
        } catch (e) {
          mostrarError(error, mensajeError(e));
        }
      },
    },
      el("datalist", { id: "lista-categorias-ficha" }, cats.map((c) => el("option", { value: c }))),
      el("datalist", { id: "lista-colores-ficha" }, COLORES_COMUNES.map((c) => el("option", { value: c }))),
      el("label.campo", el("span", "Nombre"), nombre),
      el("div.rejilla.dos", el("label.campo", el("span", "Categoría"), categoria), el("label.campo", el("span", "Talla"), tallaIn)),
      el("label.campo", el("span", "Color"), color),
      el("div.rejilla.dos.siempre", el("label.campo", el("span", "Precio de venta"), precio), el("label.campo", el("span", "Costo"), costo)),
      el("p.tenue", { style: "font-size:13px" }, "Las existencias no se editan aquí: cambian con los ingresos, las salidas y los apartados."),
      error,
      el("div", { style: "display:flex;gap:8px;justify-content:flex-end" },
        el("button.btn.fantasma", { type: "button", onclick: () => pintar(false) }, "Cancelar"), boton));
  };

  const ocultar = async () => {
    if (!(await confirmar("¿Ocultar este producto?", { detalle: "Deja de salir en el inventario y en los buscadores. Su historial se conserva y vuelve a aparecer solo con el próximo ingreso.", si: "Ocultar" }))) return;
    try {
      await datos.guardarProducto(p.id, { activo: false });
      avisar("Producto oculto");
      await refrescar();
    } catch (e) {
      avisar(mensajeError(e), "error");
    }
  };
  const mostrar = async () => {
    try {
      await datos.guardarProducto(p.id, { activo: true });
      avisar("El producto vuelve a salir en el inventario");
      await refrescar();
    } catch (e) {
      avisar(mensajeError(e), "error");
    }
  };

  pintar();
  try {
    movimientos = await datos.movimientos({ productoId: id, limite: 100 });
  } catch (e) {
    movimientos = [];
    avisar(mensajeError(e), "error");
  }
  pintar();
}

function mostrarError(caja, texto) {
  caja.textContent = texto;
  caja.classList.remove("oculto");
}
