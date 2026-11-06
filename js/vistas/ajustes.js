// Ajustes: datos de la tienda y del depósito que salen en cada factura, apariencia y cuenta
import { datos, DEMO } from "../datos.js";
import { estado, cargarAjustes } from "../estado.js";
import { el, icono, trabajando, avisar, mensajeError, confirmar } from "../util.js";
import { panelProveedores } from "./proveedores.js";

const CAMPOS = [
  ["Tienda", [
    ["nombre_tienda", "Nombre de la tienda", "Myle Store"],
    ["whatsapp", "WhatsApp de la tienda", "8888-8888", "tel"],
    ["instagram", "Instagram o página", "@mylestore"],
  ]],
  ["Datos para el depósito", [
    ["sinpe_movil", "SINPE Móvil", "8888-8888", "tel"],
    ["sinpe_a_nombre", "SINPE a nombre de", "Nombre que le aparece al cliente"],
    ["banco", "Banco", "Ej.: Banco Nacional"],
    ["cuenta_iban", "Cuenta IBAN", "CR00 0000 0000 0000 0000 00"],
    ["titular_cuenta", "Titular de la cuenta", "Nombre completo"],
    ["cedula_titular", "Cédula del titular", "0-0000-0000"],
  ]],
];

export async function vistaAjustes(_pagina, ctx) {
  const a = await cargarAjustes();
  const entradas = {};
  const error = el("div.error-form.oculto");
  const boton = el("button.btn.primario.grande", { type: "submit" }, icono("check"), "Guardar cambios");

  const secciones = CAMPOS.map(([titulo, campos]) => el("section.panel",
    el("div.panel-titulo", el("h2", titulo)),
    el("div.rejilla.dos", campos.map(([clave, rotulo, ejemplo, tipo]) => {
      entradas[clave] = el("input", { type: tipo || "text", value: a?.[clave] || "", placeholder: ejemplo, autocomplete: "off" });
      return el("label.campo", el("span", rotulo), entradas[clave]);
    })),
    titulo === "Datos para el depósito" ? el("p.tenue", { style: "margin-top:12px;font-size:13px" }, "Salen en cada factura de apartado y en el mensaje de WhatsApp. Lo que deje vacío no aparece.") : null));

  entradas.nota_factura = el("textarea", { value: a?.nota_factura || "", placeholder: "Ej.: Envíe el comprobante por WhatsApp para confirmar su apartado." });
  entradas.moneda = el("select", { value: a?.moneda || "CRC" }, el("option", { value: "CRC" }, "Colones (₡)"), el("option", { value: "USD" }, "Dólares ($)"));

  const form = el("form", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      const cambios = Object.fromEntries(Object.entries(entradas).map(([k, i]) => [k, i.value.trim() || null]));
      if (!cambios.nombre_tienda) cambios.nombre_tienda = "Myle Store";
      cambios.moneda = cambios.moneda || "CRC";
      try {
        await trabajando(boton, () => datos.guardarAjustes(cambios));
        await cargarAjustes();
        document.querySelectorAll(".nombre-tienda").forEach((n) => { n.textContent = estado.ajustes.nombre_tienda; });
        avisar("Ajustes guardados");
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    },
  },
    ...secciones,
    el("section.panel",
      el("div.panel-titulo", el("h2", "Factura")),
      el("div.pila.media",
        el("label.campo", el("span", "Nota al pie de la factura"), entradas.nota_factura),
        el("label.campo", { style: "max-width:260px" }, el("span", "Moneda"), entradas.moneda))),
    error,
    el("div.guardar-fijo", boton));

  const tema = document.documentElement.dataset.theme === "oscuro" ? "oscuro" : "claro";
  const selectorTema = el("div.selector-modo", { style: "max-width:320px" },
    ...[["claro", "Rosa (claro)"], ["oscuro", "Noche (oscuro)"]].map(([v, t]) => el("button", {
      type: "button", "aria-pressed": String(tema === v),
      onclick: (e) => {
        document.documentElement.dataset.theme = v;
        document.querySelector('meta[name="theme-color"]')?.setAttribute("content", v === "oscuro" ? "#170d12" : "#fcf1ee");
        try { localStorage.setItem("myle-tema", v); } catch { /* sin almacenamiento */ }
        e.currentTarget.parentElement.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === e.currentTarget)));
      },
    }, t)));

  ctx.pintar(el("div.ajustes",
    el("div.cabeza", el("div", el("h1", "Ajustes"), el("p", "Datos de la tienda y de pago que ven los clientes en la factura."))),
    form,
    panelProveedores(),
    el("section.panel",
      el("div.panel-titulo", el("h2", "Apariencia")),
      selectorTema),
    el("section.panel",
      el("div.panel-titulo", el("h2", "Cuenta")),
      DEMO
        ? el("div.entre",
          el("p.suave", "Modo demo: los datos son de ejemplo y viven solo en este navegador."),
          el("button.btn.peligro", {
            type: "button",
            onclick: async () => {
              if (!(await confirmar("¿Volver a los datos de ejemplo?", { detalle: "Se borra todo lo que registró en la demo.", si: "Reiniciar demo", peligro: true }))) return;
              await datos.reiniciarDemo();
              location.hash = "#/inicio";
              location.reload();
            },
          }, "Reiniciar demo"))
        : el("div.entre",
          el("p.suave", `Entró como ${estado.usuario?.email || ""}`),
          el("button.btn", { type: "button", onclick: async () => { await datos.salir(); location.reload(); } }, icono("salir"), "Cerrar sesión")))));
}
