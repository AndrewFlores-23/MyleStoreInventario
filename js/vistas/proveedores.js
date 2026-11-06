// Proveedores: a quién le compra la tienda. Se registran desde Ajustes o desde una compra nueva.
import { datos } from "../datos.js";
import { el, icono, abrirHoja, trabajando, avisar, mensajeError, telefonoBonito, telefonoWa } from "../util.js";
import { vacio } from "../componentes.js";

// Hoja para registrar o editar un proveedor; resuelve con el proveedor guardado (o null si se cerró sin guardar)
export function hojaProveedor(proveedor = null) {
  return new Promise((resolver) => {
    let guardado = null;
    const error = el("div.error-form.oculto");
    const nombre = el("input", { value: proveedor?.nombre || "", placeholder: "Ej.: Mayorista San José", required: true, autocomplete: "off" });
    const telefono = el("input", { type: "tel", inputmode: "tel", value: proveedor?.telefono || "", placeholder: "8888-8888" });
    const correo = el("input", { type: "email", inputmode: "email", value: proveedor?.correo || "", placeholder: "ventas@proveedor.com" });
    const direccion = el("input", { value: proveedor?.direccion || "", placeholder: "Ej.: San José centro, avenida 4" });
    const nota = el("textarea", { value: proveedor?.nota || "", placeholder: "Ej.: pide por catálogo de WhatsApp; entrega en 5 días" });
    const boton = el("button.btn.primario", { type: "submit" }, icono("check"), proveedor ? "Guardar cambios" : "Registrar proveedor");
    const form = el("form.pila.media", {
      onsubmit: async (ev) => {
        ev.preventDefault();
        error.classList.add("oculto");
        if (!nombre.value.trim()) {
          error.textContent = "Escriba el nombre del proveedor.";
          error.classList.remove("oculto");
          return;
        }
        const campos = { nombre: nombre.value.trim(), telefono: telefono.value.trim() || null, correo: correo.value.trim() || null, direccion: direccion.value.trim() || null, nota: nota.value.trim() || null };
        try {
          guardado = await trabajando(boton, () => (proveedor ? datos.editarProveedor(proveedor.id, campos) : datos.crearProveedor(campos)), "Guardando…");
          avisar(proveedor ? "Proveedor actualizado" : `Proveedor ${guardado.nombre} registrado`);
          cerrar();
        } catch (e) {
          error.textContent = /duplicate|ya hay un proveedor/i.test(e?.message || "") ? "Ya hay un proveedor con ese nombre." : mensajeError(e);
          error.classList.remove("oculto");
        }
      },
    },
      el("label.campo", el("span", "Nombre"), nombre),
      el("div.rejilla.dos",
        el("label.campo", el("span", "Teléfono o WhatsApp ", el("em", "(opcional)")), telefono),
        el("label.campo", el("span", "Correo ", el("em", "(opcional)")), correo)),
      el("label.campo", el("span", "Dirección o dónde queda ", el("em", "(opcional)")), direccion),
      el("label.campo", el("span", "Nota ", el("em", "(opcional)")), nota),
      error,
      el("div.acciones-form", boton));
    const { cerrar } = abrirHoja({
      titulo: proveedor ? "Editar proveedor" : "Nuevo proveedor",
      cuerpo: form,
      alCerrar: () => resolver(guardado),
    });
    nombre.focus();
  });
}

// Panel con la lista de proveedores (se usa en Ajustes)
export function panelProveedores() {
  const lista = el("div.lista");
  const panel = el("section.panel",
    el("div.panel-titulo", el("h2", "Proveedores"),
      el("button.btn.primario.chico", { type: "button", onclick: async () => { if (await hojaProveedor()) cargar(); } }, icono("mas", "chico"), "Nuevo proveedor")),
    el("p.tenue", { style: "margin:-6px 0 12px;font-size:13px" }, "A quién le compra la tienda. Al registrar una compra se elige uno de esta lista."),
    lista);

  const fila = (p) => el("button.renglon", { type: "button", onclick: async () => { if (await hojaProveedor(p)) cargar(); } },
    el("span.compra-icono" + (p.activo ? "" : ".pendiente"), icono("caja")),
    el("div.renglon-cuerpo",
      el("div.renglon-titulo", p.nombre, !p.activo ? el("span.sello.anulado", { style: "margin-left:8px;text-decoration:none" }, "Inactivo") : null),
      el("div.renglon-sub", p.telefono ? el("span", telefonoBonito(p.telefono)) : null, p.correo ? el("span", p.correo) : null, p.direccion ? el("span.tenue", p.direccion) : null),
      p.nota ? el("div.renglon-sub.tenue", p.nota) : null),
    p.telefono ? el("a.btn.fantasma.btn-icono", { href: `https://wa.me/${telefonoWa(p.telefono)}`, target: "_blank", rel: "noopener", "aria-label": "Escribir por WhatsApp", onclick: (e) => e.stopPropagation() }, icono("chat")) : null);

  async function cargar() {
    try {
      const proveedores = await datos.proveedores();
      lista.replaceChildren(...(proveedores.length ? proveedores.map(fila)
        : [vacio("caja", "Todavía no hay proveedores.", "Registre a quién le compra para elegirlo al crear una compra.")]));
    } catch (e) {
      lista.replaceChildren(vacio("alerta", "No se pudieron cargar los proveedores.", mensajeError(e)));
    }
  }
  cargar();
  return panel;
}

// Selector de proveedor para la compra: lista desplegable con los registrados y botón para agregar uno nuevo
export function selectorProveedor(proveedores, { alCambiar } = {}) {
  const select = el("select", { "aria-label": "Proveedor" });
  let lista = proveedores.filter((p) => p.activo);
  const pintar = (elegido) => {
    select.replaceChildren(
      el("option", { value: "" }, lista.length ? "Elija el proveedor…" : "No hay proveedores registrados"),
      ...lista.map((p) => el("option", { value: p.id }, p.nombre)));
    if (elegido) select.value = elegido;
    alCambiar?.(select.value);
  };
  select.addEventListener("change", () => alCambiar?.(select.value));
  const nuevo = el("button.btn.chico", { type: "button", onclick: async () => {
    const p = await hojaProveedor();
    if (!p) return;
    lista = [...lista, p].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    pintar(p.id);
  } }, icono("mas", "chico"), "Nuevo");
  pintar();
  const caja = el("div.selector-proveedor", select, nuevo);
  caja.leer = () => select.value || null;
  caja.nombre = () => select.selectedOptions[0]?.textContent || "";
  return caja;
}
