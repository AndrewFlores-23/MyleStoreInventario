// Gastos del negocio: salidas de dinero que no son mercadería (cinta, bolsas, gasolina, envíos, publicidad…).
// Se restan de la ganancia en «Cómo vamos».
import { datos } from "../datos.js";
import { el, icono, dinero, fecha, numero, mismoMes, esHoy, nombreMes, campoDinero, abrirHoja, confirmar, trabajando, avisar, mensajeError } from "../util.js";
import { vacio } from "../componentes.js";

export const CATEGORIAS_GASTO = {
  empaque: "Empaque y etiquetas",
  transporte: "Transporte y gasolina",
  envios: "Envíos y mensajería",
  publicidad: "Publicidad",
  servicios: "Servicios e internet",
  otro: "Otro",
};
const PAGOS = ["Efectivo", "SINPE Móvil", "Tarjeta", "Transferencia"];
const ZONA = "America/Costa_Rica";
const hoyCR = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ZONA }).format(new Date());

const FILTROS = [
  ["mes", "Este mes", (g) => mismoMes(g.fecha + "T12:00:00-06:00")],
  ["todos", "Todos", () => true],
];
let filtroLista = "mes";
let categoriaLista = "";

export async function vistaGastos(_pagina, ctx) {
  let gastos = await datos.gastos();
  const pestanas = el("div.pestanas-filtro");
  const chips = el("div.chips.motivos");
  const resumen = el("div.totales-inventario");
  const lista = el("div.lista");

  const pintar = () => {
    pestanas.replaceChildren(...FILTROS.map(([clave, texto, fn]) => el("button", {
      type: "button", "aria-pressed": String(filtroLista === clave),
      onclick: () => { filtroLista = clave; pintar(); },
    }, texto, el("span.n", gastos.filter(fn).length))));
    chips.replaceChildren(...["", ...Object.keys(CATEGORIAS_GASTO)].map((c) => el("button.chip", {
      type: "button", "aria-pressed": String(categoriaLista === c),
      onclick: () => { categoriaLista = c; pintar(); },
    }, c ? CATEGORIAS_GASTO[c] : "Todas")));
    const [, , condicion] = FILTROS.find(([c]) => c === filtroLista);
    const elegidos = gastos.filter(condicion).filter((g) => !categoriaLista || g.categoria === categoriaLista);
    const total = elegidos.reduce((s, g) => s + Number(g.monto), 0);
    const hoy = gastos.filter((g) => esHoy(g.fecha + "T12:00:00-06:00")).reduce((s, g) => s + Number(g.monto), 0);
    resumen.replaceChildren(
      el("span", el("b", elegidos.length), ` gasto${elegidos.length === 1 ? "" : "s"}`),
      el("span", "total ", el("b", dinero(total))),
      hoy ? el("span", "hoy ", el("b", dinero(hoy))) : null);
    // Agrupados por día
    const grupos = [];
    for (const g of elegidos) {
      const dia = fecha(g.fecha);
      if (!grupos.length || grupos[grupos.length - 1].dia !== dia) grupos.push({ dia, items: [] });
      grupos[grupos.length - 1].items.push(g);
    }
    lista.replaceChildren(...(elegidos.length ? grupos.map((gr) => [el("div.separador-dia", gr.dia), gr.items.map(fila)]).flat(2) : [
      gastos.length
        ? vacio("billete", "No hay gastos con ese filtro.")
        : vacio("billete", "Todavía no hay gastos.", "Anote lo que gasta el negocio fuera de la mercadería: cinta, bolsas, gasolina, envíos…",
          el("button.btn.primario", { type: "button", onclick: () => hojaGasto() }, icono("mas"), "Nuevo gasto")),
    ]));
  };

  const fila = (g) => el("button.renglon", { type: "button", onclick: () => hojaGasto(g) },
    el("span.compra-icono", icono("billete")),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", g.descripcion),
      el("div.renglon-sub", el("span", CATEGORIAS_GASTO[g.categoria] || g.categoria), g.pagado_con ? el("span.tenue", g.pagado_con) : null, el("span.numero", g.numero)),
      g.nota ? el("div.renglon-sub.tenue", g.nota) : null),
    el("div.renglon-fin", el("div.num", { style: "color:var(--urgente)" }, `−${dinero(g.monto)}`)));

  async function recargar() {
    gastos = await datos.gastos();
    pintar();
  }

  // Hoja para registrar o editar un gasto
  function hojaGasto(g = null) {
    const error = el("div.error-form.oculto");
    const descripcion = el("input", { value: g?.descripcion || "", placeholder: "Ej.: cinta y bolsas de empaque", required: true, autocomplete: "off" });
    const monto = campoDinero({ value: g ? Number(g.monto) : "" });
    const fechaIn = el("input", { type: "date", value: g?.fecha ? String(g.fecha).slice(0, 10) : hoyCR(), max: hoyCR() });
    const categoria = el("select", Object.entries(CATEGORIAS_GASTO).map(([k, v]) => el("option", { value: k }, v)));
    categoria.value = g?.categoria || "otro";
    const pagadoCon = el("select", el("option", { value: "" }, "Sin especificar"), PAGOS.map((p) => el("option", { value: p }, p)));
    pagadoCon.value = g?.pagado_con && PAGOS.includes(g.pagado_con) ? g.pagado_con : "";
    const nota = el("textarea", { value: g?.nota || "", placeholder: "Opcional" });
    const boton = el("button.btn.primario", { type: "submit" }, icono("check"), g ? "Guardar cambios" : "Registrar gasto");
    const form = el("form.pila.media", {
      onsubmit: async (ev) => {
        ev.preventDefault();
        error.classList.add("oculto");
        const m = numero(monto.querySelector("input").value);
        const falta = !descripcion.value.trim() ? "Escriba en qué se gastó." : !(m > 0) ? "Escriba el monto del gasto." : null;
        if (falta) { error.textContent = falta; error.classList.remove("oculto"); return; }
        try {
          await trabajando(boton, () => (g
            ? datos.editarGasto(g.id, { descripcion: descripcion.value.trim(), monto: m, fecha: fechaIn.value || g.fecha, categoria: categoria.value, pagado_con: pagadoCon.value || null, nota: nota.value.trim() || null })
            : datos.crearGasto({ descripcion: descripcion.value, monto: m, fecha: fechaIn.value || null, categoria: categoria.value, pagadoCon: pagadoCon.value, nota: nota.value })), "Guardando…");
          avisar(g ? "Gasto actualizado" : "Gasto registrado");
          cerrar();
          recargar();
        } catch (e) {
          error.textContent = mensajeError(e);
          error.classList.remove("oculto");
        }
      },
    },
      el("label.campo", el("span", "En qué se gastó"), descripcion),
      el("div.rejilla.dos.siempre", el("label.campo", el("span", "Monto"), monto), el("label.campo", el("span", "Fecha"), fechaIn)),
      el("div.rejilla.dos", el("label.campo", el("span", "Categoría"), categoria), el("label.campo", el("span", "Pagado con"), pagadoCon)),
      el("label.campo", el("span", "Nota ", el("em", "(opcional)")), nota),
      error,
      el("div.acciones-form",
        g ? el("button.btn.peligro", { type: "button", onclick: async () => {
          if (!(await confirmar("¿Borrar este gasto?", { detalle: `${g.descripcion} · ${dinero(g.monto)}`, si: "Borrar", peligro: true }))) return;
          try { await datos.borrarGasto(g.id); avisar("Gasto borrado"); cerrar(); recargar(); } catch (e) { avisar(mensajeError(e), "error"); }
        } }, "Borrar") : null,
        boton));
    const { cerrar } = abrirHoja({ titulo: g ? `Gasto ${g.numero}` : "Nuevo gasto", cuerpo: form });
    descripcion.focus();
  }

  const mes = nombreMes();
  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", "Gastos"), el("p", `Lo que gasta el negocio fuera de la mercadería. Se resta de la ganancia de ${mes}.`)),
      el("div.acciones", el("button.btn.primario", { type: "button", onclick: () => hojaGasto() }, icono("mas"), "Nuevo gasto"))),
    pestanas,
    el("div.filtros", chips),
    resumen,
    el("section.panel", lista));
  pintar();
}
