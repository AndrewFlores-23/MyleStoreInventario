// Myle Store · entrada, marco de la app (menú lateral en compu, pestañas en el celular) y rutas
import { iniciarDatos, datos, DEMO } from "./datos.js";
import { estado, cargarAjustes, cargarProductos, ponerPendientes } from "./estado.js";
import { $, el, icono, adorno, mensajeError, trabajando, avisar } from "./util.js";
import { vistaInicio } from "./vistas/inicio.js";
import { vistaInventario } from "./vistas/inventario.js";
import { vistaIngresos } from "./vistas/ingresos.js";
import { vistaSalidas } from "./vistas/salidas.js";
import { vistaApartados } from "./vistas/apartados.js";
import { vistaAjustes } from "./vistas/ajustes.js";

// El tipo de enlace (recuperar contraseña) se lee antes de que Supabase limpie la dirección
const hashInicial = new URLSearchParams(location.hash.slice(1));
const tipoEnlace = hashInicial.get("type");
const errorEnlace = hashInicial.get("error_description");

const SECCIONES = [
  { ruta: "inicio", titulo: "Inicio", icono: "inicio", vista: vistaInicio },
  { ruta: "inventario", titulo: "Inventario", icono: "percha", vista: vistaInventario },
  { ruta: "ingresos", titulo: "Ingresos", icono: "ingreso", vista: vistaIngresos },
  { ruta: "salidas", titulo: "Salidas", icono: "salida", vista: vistaSalidas },
  { ruta: "apartados", titulo: "Apartados", icono: "bolsa", vista: vistaApartados },
  { ruta: "ajustes", titulo: "Ajustes", icono: "ajustes", vista: vistaAjustes, soloLateral: true },
];

const app = $("#app");
let turnoRuta = 0;

// Pantallas de entrada: en la compu, la portada de la tienda a la izquierda; en el celular, el logo arriba
function acceso(...contenido) {
  return el("main.acceso",
    el("div.acceso-arte", { role: "img", "aria-label": "Myle Store · Moda & Beauty" }),
    el("div.acceso-lado", el("div.acceso-caja",
      el("img.logo-acceso", { src: "img/logo.webp", alt: "Myle Store · Moda & Beauty", width: 640, height: 527 }),
      el("div.acceso-titulo", el("h1", "Bienvenida"), el("p", "Inventario y apartados")),
      adorno(),
      ...contenido)));
}

// ---------- Entrada ----------
function pantallaEntrada(mensaje) {
  const error = el("div.error-form" + (mensaje ? "" : ".oculto"), mensaje || "");
  const correo = el("input", { type: "email", autocomplete: "username", required: true, placeholder: "correo@ejemplo.com", inputmode: "email" });
  const clave = el("input", { type: "password", autocomplete: "current-password", required: true });
  const boton = el("button.btn.primario.grande", { type: "submit" }, "Entrar");
  const form = el("form", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      error.classList.add("oculto");
      try {
        await trabajando(boton, () => datos.entrar(correo.value.trim(), clave.value), "Entrando…");
        await entrarApp(await datos.usuario());
      } catch (e) {
        error.textContent = mensajeError(e);
        error.classList.remove("oculto");
      }
    },
  },
    el("label.campo", el("span", "Correo"), correo),
    el("label.campo", el("span", "Contraseña"), clave),
    error,
    boton);
  app.replaceChildren(acceso(form,
    el("div.enlace", el("button.enlace-btn", { type: "button", onclick: () => pantallaRecuperar(correo.value.trim()) }, "¿Olvidó la contraseña?"))));
  correo.focus();
}

function pantallaRecuperar(correoAntes = "") {
  const aviso = el("div.error-form.oculto");
  const correo = el("input", { type: "email", required: true, value: correoAntes, placeholder: "correo@ejemplo.com" });
  const boton = el("button.btn.primario.grande", { type: "submit" }, "Enviar enlace");
  const form = el("form", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      aviso.classList.add("oculto");
      try {
        await trabajando(boton, () => datos.recuperar(correo.value.trim()), "Enviando…");
        form.replaceChildren(el("p", "Listo. Si el correo tiene acceso, le llegará un enlace para poner una contraseña nueva."), el("p.tenue", "Revise también la carpeta de spam."));
      } catch (e) {
        aviso.textContent = mensajeError(e);
        aviso.classList.remove("oculto");
      }
    },
  },
    el("p.suave", "Le enviamos un enlace al correo para crear una contraseña nueva."),
    el("label.campo", el("span", "Correo"), correo), aviso, boton);
  app.replaceChildren(acceso(form,
    el("div.enlace", el("button.enlace-btn", { type: "button", onclick: () => pantallaEntrada() }, "Volver a entrar"))));
}

function pantallaNuevaClave() {
  const aviso = el("div.error-form.oculto");
  const clave = el("input", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
  const otra = el("input", { type: "password", autocomplete: "new-password", required: true, minlength: 8 });
  const boton = el("button.btn.primario.grande", { type: "submit" }, "Guardar contraseña");
  const form = el("form", {
    onsubmit: async (ev) => {
      ev.preventDefault();
      aviso.classList.add("oculto");
      if (clave.value !== otra.value) {
        aviso.textContent = "Las dos contraseñas no coinciden.";
        aviso.classList.remove("oculto");
        return;
      }
      try {
        await trabajando(boton, () => datos.nuevaClave(clave.value));
        avisar("Contraseña nueva guardada");
        history.replaceState(null, "", location.pathname + location.search + "#/inicio");
        await entrarApp(await datos.usuario());
      } catch (e) {
        aviso.textContent = mensajeError(e);
        aviso.classList.remove("oculto");
      }
    },
  },
    el("p.suave", "Escriba la contraseña nueva (mínimo 8 caracteres)."),
    el("label.campo", el("span", "Contraseña nueva"), clave),
    el("label.campo", el("span", "Repítala"), otra), aviso, boton);
  app.replaceChildren(acceso(form));
}

function pantallaSinAcceso(usuario) {
  app.replaceChildren(acceso(
    el("div.panel", { style: "margin-top:18px" },
      el("p", `La cuenta ${usuario.email} todavía no tiene acceso a la tienda.`),
      el("p.suave", { style: "margin-top:8px" }, "Pídale a quien administra el sistema que agregue este correo al equipo."),
      el("button.btn.ancho", { type: "button", style: "margin-top:16px", onclick: async () => { await datos.salir(); pantallaEntrada(); } }, icono("salir"), "Salir"))));
}

// ---------- Marco ----------
function armarMarco() {
  const nombre = estado.ajustes?.nombre_tienda || "Myle Store";
  const marca = () => el("a.marca", { href: "#/inicio" },
    el("img.marca-foto", { src: "img/perfil.jpg", alt: "", width: 44, height: 44 }),
    el("span.marca-nombre", el("span.nombre-tienda", nombre), el("small", "Moda & Beauty")));
  const enlace = (s, movil) => el("a", { href: "#/" + s.ruta, "data-ruta": s.ruta },
    icono(s.icono),
    el("span", s.titulo),
    s.ruta === "apartados" ? el(movil ? "span.punto.oculto" : "span.conteo.oculto", { "data-insignia": "apartados", title: "Apartados por entregar" }) : null);
  app.replaceChildren(el("div.marco",
    el("aside.lateral",
      marca(),
      el("nav.nav", SECCIONES.map((s) => enlace(s))),
      el("div.lateral-pie", DEMO ? "Modo demo" : estado.usuario?.email || "")),
    el("div.principal",
      el("header.barra-movil",
        el("div.fila-marca", marca(),
          el("a.btn.fantasma.btn-icono", { href: "#/ajustes", "aria-label": "Ajustes", "data-ruta": "ajustes" }, icono("ajustes"))),
        el("nav.pestanas", SECCIONES.filter((s) => !s.soloLateral).map((s) => enlace(s, true)))),
      DEMO ? el("div.aviso-demo", "Modo demo: los datos son de ejemplo y se guardan solo en este navegador.") : null,
      el("main.pagina"))));
}

function enrutar() {
  const [camino, consulta = ""] = location.hash.replace(/^#\/?/, "").split("?");
  const partes = camino.split("/").filter(Boolean);
  const seccion = SECCIONES.find((s) => s.ruta === partes[0]);
  if (!seccion) {
    location.replace("#/inicio");
    return;
  }
  document.querySelectorAll("dialog[open]").forEach((d) => d.close());
  document.querySelectorAll("[data-ruta]").forEach((a) => {
    if (a.dataset.ruta === seccion.ruta) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${seccion.titulo} · ${estado.ajustes?.nombre_tienda || "Myle Store"}`;
  const pagina = $(".pagina");
  pagina.replaceChildren(el("div.cargando", "Cargando…"));
  const turno = ++turnoRuta;
  const ctx = {
    partes: partes.slice(1),
    consulta: new URLSearchParams(consulta),
    vigente: () => turno === turnoRuta,
    pintar: (...nodos) => { if (turno === turnoRuta) pagina.replaceChildren(...nodos.filter(Boolean)); },
  };
  window.scrollTo(0, 0);
  Promise.resolve(seccion.vista(pagina, ctx)).catch((e) => {
    console.error(e);
    ctx.pintar(el("div.vacio", icono("alerta"), el("p", "No se pudo cargar esta sección."), el("p", mensajeError(e)),
      el("button.btn", { type: "button", onclick: enrutar }, "Intentar de nuevo")));
  });
}

async function contarPendientes() {
  try {
    const lista = await datos.apartados();
    ponerPendientes(lista.filter((a) => a.estado === "pendiente").length);
  } catch { /* la insignia es solo una ayuda */ }
}

let enMarcha = false;
async function entrarApp(usuario) {
  estado.usuario = usuario;
  if (!(await datos.esEquipo())) {
    pantallaSinAcceso(usuario);
    return;
  }
  await Promise.all([cargarAjustes(), cargarProductos()]);
  armarMarco();
  if (!enMarcha) {
    enMarcha = true;
    window.addEventListener("hashchange", enrutar);
    datos.alCambiarSesion((evento) => { if (evento === "SIGNED_OUT") location.reload(); });
  }
  enrutar();
  contarPendientes();
}

async function arrancar() {
  try {
    await iniciarDatos();
  } catch (e) {
    app.replaceChildren(acceso(
      el("div.error-form", { style: "margin-top:18px" }, "No se pudo conectar. Revise el internet y recargue la página.")));
    console.error(e);
    return;
  }
  const usuario = await datos.usuario();
  if (tipoEnlace === "recovery" && usuario) return pantallaNuevaClave();
  if (!usuario) return pantallaEntrada(errorEnlace ? "El enlace ya venció o no es válido. Pida uno nuevo." : "");
  try {
    await entrarApp(usuario);
  } catch (e) {
    console.error(e);
    pantallaEntrada(mensajeError(e));
  }
}

arrancar();
