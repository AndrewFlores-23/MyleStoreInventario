// Ingresos: entra mercadería (producto nuevo o reposición) con foto, cantidad, costo y precio de venta.
// Cada ingreso recibe su número de serie único (MS-00001) y queda en el historial.
import { datos } from "../datos.js";
import { estado, cargarProductos } from "../estado.js";
import { el, icono, dinero, numero, fecha, talla, tela, colorTela, comprimirFoto, campoDinero, contador, trabajando, avisar, mensajeError,
  abrirHoja, confirmar, subir, TALLAS_COMUNES, COLORES_COMUNES, CATEGORIAS_COMUNES } from "../util.js";
import { fotoProducto, selectorProducto, productoElegido, botonesFoto, marbete, imprimirEtiqueta, vacio } from "../componentes.js";
import { abrirFicha } from "./inventario.js";

export async function vistaIngresos(_pagina, ctx) {
  // Si se llega desde una compra (#/ingresos?compra=…), cada prenda queda ligada a ella
  const compraId = ctx.consulta.get("compra");
  const [historial, compraInicial] = await Promise.all([datos.ingresos({ limite: 100 }), compraId ? datos.compra(compraId).catch(() => null) : null, cargarProductos()]);

  // ---------- Estado del formulario ----------
  const f = { modo: "nuevo", producto: null, foto: null, fotoUrl: null, fotoRuta: null, compra: compraInicial };
  const preProducto = estado.productos.find((p) => p.id === ctx.consulta.get("producto"));
  if (preProducto) Object.assign(f, { modo: "existente", producto: preProducto });

  const error = el("div.error-form.oculto");
  const nombre = el("input", { required: true, placeholder: "Ej.: Blusa de lino manga corta", list: "lista-nombres", autocomplete: "off" });
  const categoria = el("input", { placeholder: "Ej.: Blusas", list: "lista-categorias", autocomplete: "off" });
  const tallaIn = el("input", { placeholder: "Otra talla (ej.: 10, 32)", autocomplete: "off" });
  const color = el("input", { placeholder: "Ej.: Negro", list: "lista-colores", autocomplete: "off" });
  const muestra = el("span.tela");
  const cantidad = contador({ valor: 1, min: 1, max: 9999, alCambiar: () => calcular() });
  const costo = campoDinero({ required: true, oninput: () => calcular() });
  const precio = campoDinero({ required: true, oninput: () => calcular() });
  const nota = el("input", { placeholder: "Ej.: viene con etiqueta, talla grande" });
  // Compra en curso: se muestra el avance y las prendas van quedando ligadas a ella
  const resumenCompra = el("div.compra-abierta.oculto");
  function pintarCompra() {
    const c = f.compra;
    resumenCompra.classList.toggle("oculto", !c);
    if (!c) return;
    const faltan = Math.max(0, (c.prendas_pedidas || 0) - (c.unidades || 0));
    resumenCompra.replaceChildren(
      icono("caja", "chico"),
      el("div.renglon-cuerpo",
        el("strong", `Compra ${c.numero}${c.proveedor ? ` · ${c.proveedor}` : ""}`),
        el("span", c.prendas_pedidas
          ? (faltan > 0 ? `${c.unidades} de ${c.prendas_pedidas} prendas registradas · faltan ${faltan}` : `Las ${c.prendas_pedidas} prendas ya están registradas`)
          : `${c.unidades} ${c.unidades === 1 ? "prenda registrada" : "prendas registradas"}`)),
      el("a.btn.fantasma.chico", { href: `#/movimientos/compras/${c.id}` }, "Ver compra"));
  }
  const ganancia = el("div.ganancia");
  const boton = el("button.btn.primario.grande", { type: "submit" }, icono("check"), "Registrar ingreso");
  const costoIn = costo.querySelector("input");
  const precioIn = precio.querySelector("input");

  const chipsTalla = el("div.chips", TALLAS_COMUNES.map((t) => el("button.chip.talla-chip", {
    type: "button",
    "data-talla": t,
    onclick: () => { tallaIn.value = tallaIn.value === t ? "" : t; marcarTalla(); },
  }, t)));
  const marcarTalla = () => chipsTalla.querySelectorAll("[data-talla]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.talla === tallaIn.value.trim())));
  tallaIn.addEventListener("input", marcarTalla);
  const pintarMuestra = () => {
    const c = colorTela(color.value);
    muestra.style.setProperty("--tela", c || "transparent");
    muestra.classList.toggle("oculto", !color.value.trim());
  };
  color.addEventListener("input", pintarMuestra);

  function calcular() {
    const c = numero(costoIn.value);
    const v = numero(precioIn.value);
    const n = cantidad.leer();
    if (!(c >= 0) || !(v > 0)) {
      ganancia.replaceChildren(el("span", "Escriba el costo y el precio de venta para ver la ganancia."));
      return;
    }
    const g = v - c;
    ganancia.replaceChildren(
      el("span", "Ganancia por prenda ", el("b." + (g < 0 ? "urgente" : "listo"), `${dinero(g)} · ${Math.round((g / v) * 100)} %`)),
      el("span", "Inversión ", el("b", dinero(c * n))),
      el("span", "Venta esperada ", el("b", dinero(v * n))));
  }

  // ---------- Foto ----------
  const cajaFoto = el("label.subir-foto");
  const entradaFoto = el("input", { type: "file", accept: "image/*", "aria-label": "Foto del producto", onchange: (e) => elegirFoto(e.target.files[0]) });
  function pintarFoto() {
    const actual = f.fotoUrl || (f.modo === "existente" && f.producto ? datos.urlFoto(f.producto.foto_path) : null) || (f.fotoRuta ? datos.urlFoto(f.fotoRuta) : null);
    cajaFoto.replaceChildren(...[
      actual ? el("img", { src: actual, alt: "" }) : el("div.texto", icono("camara"), el("strong", "Tomar o elegir foto"), el("span.tenue", f.modo === "existente" ? "Opcional: cambia la foto del producto" : "Se verá en el inventario y en la factura")),
      actual ? el("span.cambiar", f.foto || f.fotoRuta ? "Cambiar foto" : "Cambiar foto (opcional)") : null,
      entradaFoto].filter(Boolean));
  }
  async function elegirFoto(archivo) {
    if (!archivo) return;
    try {
      f.foto = await comprimirFoto(archivo);
      f.fotoRuta = null;
      if (f.fotoUrl) URL.revokeObjectURL(f.fotoUrl);
      f.fotoUrl = URL.createObjectURL(f.foto);
      pintarFoto();
    } catch (e) {
      avisar(mensajeError(e), "error");
    }
    entradaFoto.value = "";
  }

  // ---------- Modo: producto nuevo o uno que ya existe ----------
  const zonaProducto = el("div.pila");
  const modo = el("div.selector-modo",
    el("button", { type: "button", "data-modo": "nuevo", onclick: () => cambiarModo("nuevo") }, "Producto nuevo"),
    el("button", { type: "button", "data-modo": "existente", onclick: () => cambiarModo("existente") }, "Ya está en inventario"));
  function cambiarModo(m) {
    f.modo = m;
    if (m === "nuevo") f.producto = null;
    pintarModo();
    pintarFoto();
  }
  function elegirProducto(p) {
    f.producto = p;
    costoIn.value = Number(p.costo) || "";
    precioIn.value = Number(p.precio_venta) || "";
    calcular();
    pintarModo();
    pintarFoto();
  }
  function pintarModo() {
    modo.querySelectorAll("[data-modo]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === f.modo)));
    if (f.modo === "nuevo") {
      zonaProducto.replaceChildren(
        el("label.campo", el("span", "Nombre del producto"), nombre),
        el("div.rejilla.dos",
          el("label.campo", el("span", "Categoría ", el("em", "(opcional)")), categoria),
          el("label.campo", el("span", "Color ", muestra), color)),
        el("div.campo", el("span", "Talla"), chipsTalla, tallaIn));
      pintarMuestra();
      marcarTalla();
    } else {
      zonaProducto.replaceChildren(f.producto
        ? el("div.campo", el("span", "Producto"), productoElegido(f.producto, () => { f.producto = null; pintarModo(); pintarFoto(); }))
        : el("div.campo", el("span", "Busque el producto"), selectorProducto({ alElegir: elegirProducto })));
      if (!f.producto) zonaProducto.querySelector("input")?.focus();
    }
  }

  // ---------- Guardar ----------
  const form = el("form.panel", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      const c = numero(costoIn.value);
      const v = numero(precioIn.value);
      const falta = f.modo === "existente" && !f.producto ? "Busque y elija el producto que ingresó."
        : f.modo === "nuevo" && !nombre.value.trim() ? "Escriba el nombre del producto."
          : !(c >= 0) || costoIn.value === "" ? "Escriba el precio de costo de cada prenda."
            : !(v > 0) ? "Escriba el precio de venta final."
              : null;
      if (falta) {
        error.textContent = falta;
        error.classList.remove("oculto");
        return;
      }
      if (v < c && !(await confirmar("El precio de venta es menor que el costo", { detalle: `Vendería cada prenda en ${dinero(v)} y le costó ${dinero(c)}.`, si: "Registrar igual" }))) return;
      try {
        const ingreso = await trabajando(boton, async () => {
          if (f.foto && !f.fotoRuta) f.fotoRuta = await datos.subirFoto(f.foto);
          return datos.registrarIngreso({
            productoId: f.modo === "existente" ? f.producto.id : null,
            nombre: nombre.value, categoria: categoria.value, talla: tallaIn.value, color: color.value,
            fotoPath: f.fotoRuta,
            cantidad: cantidad.leer(), costo: c, precio: v, nota: nota.value, compraId: f.compra?.id || null,
          });
        }, "Registrando…");
        if (f.compra) {
          f.compra.unidades += ingreso.cantidad;
          f.compra.total = Number(f.compra.total) + ingreso.cantidad * Number(ingreso.costo_unitario);
          pintarCompra();
        }
        await cargarProductos();
        confirmarIngreso(ingreso);
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    },
  },
    el("div.formulario-ingreso",
      el("div.columna-foto", cajaFoto, botonesFoto(elegirFoto)),
      el("div.pila",
        resumenCompra,
        modo,
        zonaProducto,
        el("div.rejilla.tres",
          el("div.campo", el("span", "Cantidad que ingresó"), cantidad),
          el("label.campo", el("span", "Precio de costo ", el("em", "(c/u)")), costo),
          el("label.campo", el("span", "Precio de venta final"), precio)),
        ganancia,
        el("label.campo", el("span", "Nota ", el("em", "(opcional)")), nota),
        error,
        el("div.acciones-form", boton))));

  // Marbete con la serie recién asignada
  function confirmarIngreso(ingreso) {
    const p = estado.productos.find((x) => x.id === ingreso.producto_id) || {};
    const eraNuevo = f.modo === "nuevo";
    const fotoUsada = f.fotoRuta || p.foto_path;
    const etiqueta = marbete(ingreso, p);
    const { cerrar } = abrirHoja({
      titulo: "Ingreso registrado",
      clase: "chica",
      cuerpo: el("div",
        etiqueta,
        el("p.tenue", { style: "text-align:center;margin-top:12px;font-size:13px" }, `Quedan ${p.existencias} disponibles. La etiqueta se puede volver a ver e imprimir desde la ficha del producto.`),
        el("div", { style: "display:flex;justify-content:center;margin-top:10px" },
          el("button.btn.chico", { type: "button", onclick: () => imprimirEtiqueta(etiqueta, `Etiqueta ${ingreso.serie}`) }, icono("imprimir", "chico"), "Imprimir etiqueta"))),
      pie: [
        eraNuevo ? el("button.btn", { type: "button", onclick: () => { f.siguiendo = true; cerrar(); otraTalla(fotoUsada); } }, icono("mas"), "Otra talla o color") : null,
        f.compra && faltanDeCompra() > 0 ? el("button.btn.primario", { type: "button", onclick: () => { f.siguiendo = true; cerrar(); otraPrenda(); } }, icono("caja"), `Siguiente prenda (faltan ${faltanDeCompra()})`) : null,
        f.compra ? el("button.btn" + (faltanDeCompra() > 0 ? "" : ".primario"), { type: "button", onclick: () => { f.siguiendo = true; cerrar(); location.hash = `#/movimientos/compras/${f.compra.id}`; } }, faltanDeCompra() > 0 ? "Ver compra" : "Compra completa · ver") : null,
        !f.compra ? el("button.btn.primario", { type: "button", onclick: () => cerrar() }, "Listo") : null,
      ],
      alCerrar: () => { if (!f.siguiendo) limpiar(); f.siguiendo = false; refrescarHistorial(); },
    });
  }
  const faltanDeCompra = () => (f.compra ? Math.max(0, (f.compra.prendas_pedidas || 0) - (f.compra.unidades || 0)) : 0);
  // Mismo producto en otra talla: se queda nombre, categoría, color, foto y precios
  function otraTalla(ruta) {
    f.foto = null;
    if (f.fotoUrl) URL.revokeObjectURL(f.fotoUrl);
    f.fotoUrl = null;
    f.fotoRuta = ruta || null;
    tallaIn.value = "";
    cantidad.poner(1);
    marcarTalla();
    pintarFoto();
    nota.value = "";
    avisar("Elija la otra talla y la cantidad");
    tallaIn.focus();
  }
  function otraPrenda() {
    const compra = f.compra;
    limpiar();
    f.compra = compra;
    pintarCompra();
    (f.modo === "nuevo" ? nombre : zonaProducto.querySelector("input"))?.focus();
  }
  function limpiar() {
    Object.assign(f, { modo: f.modo, producto: null, foto: null, fotoRuta: null });
    pintarCompra();
    if (f.fotoUrl) URL.revokeObjectURL(f.fotoUrl);
    f.fotoUrl = null;
    for (const i of [nombre, categoria, tallaIn, color, nota, costoIn, precioIn]) i.value = "";
    cantidad.poner(1);
    calcular();
    pintarModo();
    pintarFoto();
    subir(true);
  }

  // ---------- Historial ----------
  const lista = el("div.lista");
  const pintarHistorial = (items) => {
    lista.replaceChildren(...(items.length ? items.map((i) => el("button.renglon", { type: "button", onclick: () => abrirFicha(i.producto_id) },
      fotoProducto(i.producto),
      el("div.renglon-cuerpo",
        el("div.renglon-titulo", i.producto?.nombre || "Producto"),
        el("div.renglon-sub", el("span.serie", i.serie), talla(i.producto?.talla), el("span.tenue", fecha(i.creado_en))),
        i.nota ? el("div.renglon-sub.tenue", i.nota) : null),
      el("div.renglon-fin",
        el("div.num", { style: "color:var(--listo)" }, `+${i.cantidad}`),
        el("small", `${dinero(i.costo_unitario)} c/u · ${dinero(i.costo_unitario * i.cantidad)}`))))
      : [vacio("ingreso", "Todavía no hay ingresos.", "Cada ingreso queda aquí con su número de serie.")]));
  };
  async function refrescarHistorial() {
    try { pintarHistorial(await datos.ingresos({ limite: 100 })); } catch (e) { avisar(mensajeError(e), "error"); }
  }

  const nombres = [...new Set(estado.productos.map((p) => p.nombre))];
  const categorias = [...new Set([...estado.productos.map((p) => p.categoria).filter(Boolean), ...CATEGORIAS_COMUNES])];
  ctx.pintar(
    el("div.cabeza",
      el("div", el("h1", f.compra ? "Registrar prenda" : "Ingresos"), el("p", f.compra ? `Prenda por prenda de la compra ${f.compra.numero}. Cada una recibe su número de serie.` : "Registre la mercadería que entra. Cada ingreso recibe su número de serie."))),
    el("datalist", { id: "lista-nombres" }, nombres.map((n) => el("option", { value: n }))),
    el("datalist", { id: "lista-categorias" }, categorias.map((c) => el("option", { value: c }))),
    el("datalist", { id: "lista-colores" }, COLORES_COMUNES.map((c) => el("option", { value: c }))),
    form,
    el("section.panel",
      el("div.panel-titulo", el("h2", "Historial de ingresos"), el("span.tenue", { style: "font-size:13px" }, "Últimos 100")),
      lista));
  pintarModo();
  pintarFoto();
  pintarCompra();
  calcular();
  pintarHistorial(historial);
  if (preProducto) elegirProducto(preProducto);
}
