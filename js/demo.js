// Modo demo: las mismas funciones y reglas que la base de Supabase, con datos de ejemplo guardados en este navegador.
// Sirve para probar la app y mostrarla antes de conectar la base. Los datos de depósito son de mentira a propósito.

const CLAVE = "myle-demo-v3";
const PREFIJO_FOTO = "myle-demo-foto:";
const EMAIL = "demo@mylestore";
const memoria = { db: null, fotos: {} };

const uuid = () => crypto.randomUUID();
const ahora = () => new Date().toISOString();
const copia = (x) => (x == null ? x : JSON.parse(JSON.stringify(x)));
const pad = (n, largo) => String(n).padStart(largo, "0");
const limpio = (t) => (t == null ? null : String(t).trim() || null);
const falla = (m) => { throw new Error(m); };
const espera = () => new Promise((r) => setTimeout(r, 120));

function leer() {
  if (memoria.db) return memoria.db;
  try {
    const t = localStorage.getItem(CLAVE);
    if (t) memoria.db = JSON.parse(t);
  } catch { /* sin almacenamiento: queda en memoria */ }
  if (!memoria.db) {
    memoria.db = sembrar();
    guardar();
  }
  return memoria.db;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(memoria.db)); } catch { /* queda en memoria mientras la pestaña esté abierta */ }
}
// Cada cambio trabaja sobre una copia: si algo falla a la mitad, no queda nada a medias (como una transacción)
async function cambiar(fn) {
  await espera();
  const db = copia(leer());
  const resultado = fn(db);
  memoria.db = db;
  guardar();
  return copia(resultado);
}
async function consultar(fn) {
  await espera();
  return copia(fn(leer()));
}

const siguiente = (db, k) => (db.seq[k] = (db.seq[k] || 0) + 1);
function mover(db, m, cuando) {
  const mov = { id: siguiente(db, "movimiento"), ingreso_id: null, apartado_id: null, referencia: null, precio_unitario: null, nota: null, ...m, creado_en: cuando, creado_por: EMAIL };
  db.movimientos.push(mov);
  return mov;
}
const producto = (db, id) => db.productos.find((p) => p.id === id);
const apartadoCon = (db, ap) => ({ ...ap, articulos: db.articulos.filter((a) => a.apartado_id === ap.id) });
const total = (ap) => Number(ap.subtotal) + Number(ap.envio);

// ---------- Reglas (las mismas de la migración) ----------
function ingresar(db, d, cuando = ahora()) {
  const cantidad = Number(d.cantidad);
  if (!(cantidad > 0)) falla("La cantidad debe ser mayor que cero");
  if (!(Number(d.costo) >= 0)) falla("Revise el precio de costo");
  if (!(Number(d.precio) >= 0)) falla("Revise el precio de venta");
  let p;
  if (!d.productoId) {
    if (!limpio(d.nombre)) falla("Escriba el nombre del producto");
    p = {
      id: uuid(), nombre: limpio(d.nombre), categoria: limpio(d.categoria), talla: limpio(d.talla), color: limpio(d.color),
      foto_path: d.fotoPath || null, precio_venta: Number(d.precio), costo: Number(d.costo), existencias: cantidad, activo: true,
      creado_en: cuando, actualizado_en: cuando,
    };
    db.productos.push(p);
  } else {
    p = producto(db, d.productoId) || falla("El producto ya no existe");
    Object.assign(p, {
      existencias: p.existencias + cantidad, precio_venta: Number(d.precio), costo: Number(d.costo),
      foto_path: d.fotoPath || p.foto_path, activo: true, actualizado_en: cuando,
    });
  }
  const compra = d.compraId ? (db.compras || []).find((c) => c.id === d.compraId) || falla("La compra no existe") : null;
  const ing = {
    id: uuid(), serie: "MS-" + pad(siguiente(db, "ingreso"), 5), producto_id: p.id, cantidad,
    costo_unitario: Number(d.costo), precio_venta: Number(d.precio), nota: limpio(d.nota), creado_en: cuando, creado_por: EMAIL,
    compra_id: compra ? compra.id : null,
  };
  db.ingresos.push(ing);
  if (compra) { compra.total += cantidad * Number(d.costo); compra.unidades += cantidad; }
  mover(db, { producto_id: p.id, tipo: "entrada", motivo: "ingreso", cantidad, existencias_despues: p.existencias, precio_unitario: ing.costo_unitario, referencia: ing.serie, ingreso_id: ing.id, nota: ing.nota }, cuando);
  return ing;
}

function nuevoProveedor(db, d, cuando = ahora()) {
  if (!limpio(d.nombre)) falla("Escriba el nombre del proveedor");
  if ((db.proveedores || []).some((p) => p.nombre.toLowerCase() === d.nombre.trim().toLowerCase())) falla("Ya hay un proveedor con ese nombre");
  const p = { id: uuid(), nombre: d.nombre.trim(), telefono: limpio(d.telefono), correo: limpio(d.correo), direccion: limpio(d.direccion), nota: limpio(d.nota), activo: true, creado_en: cuando, actualizado_en: cuando };
  (db.proveedores ||= []).push(p);
  return p;
}

function abrirCompra(db, d, cuando = ahora()) {
  if (Number(d.prendasPedidas || 0) < 0) falla("Revise la cantidad de prendas");
  if (Number(d.montoPagado || 0) < 0) falla("Revise el monto pagado");
  let nombre = limpio(d.proveedor);
  if (d.proveedorId) nombre = ((db.proveedores || []).find((p) => p.id === d.proveedorId) || falla("El proveedor no existe")).nombre;
  const c = {
    id: uuid(), numero: "CO-" + pad(siguiente(db, "compra"), 4), proveedor: nombre, proveedor_id: d.proveedorId || null, factura: limpio(d.factura),
    nota: limpio(d.nota), total: 0, unidades: 0, prendas_pedidas: Number(d.prendasPedidas || 0), monto_pagado: Number(d.montoPagado || 0),
    fecha_compra: d.fechaCompra || cuando.slice(0, 10), creado_en: cuando, creado_por: EMAIL,
  };
  (db.compras ||= []).push(c);
  return c;
}

// Eliminar una compra abierta por error: solo si no tiene prendas registradas
function eliminarCompra(db, id) {
  const c = (db.compras || []).find((x) => x.id === id) || falla("La compra ya no existe");
  const n = db.ingresos.filter((i) => i.compra_id === id).reduce((s, i) => s + i.cantidad, 0);
  if (n > 0) falla(`No se puede eliminar la compra ${c.numero}: tiene ${n} ${n === 1 ? "prenda registrada" : "prendas registradas"} en el inventario. Si se registraron por error, elimine primero esas prendas desde su ficha.`);
  db.compras = db.compras.filter((x) => x.id !== id);
  return { numero: c.numero, proveedor: c.proveedor, factura: c.factura };
}

function sacar(db, d, cuando = ahora()) {
  const cantidad = Number(d.cantidad);
  if (!["venta", "danado", "devolucion", "regalo", "ajuste"].includes(d.motivo)) falla("Elija el motivo de la salida");
  if (!(cantidad > 0)) falla("La cantidad debe ser mayor que cero");
  if (d.precio != null && Number(d.precio) < 0) falla("Revise el precio");
  const p = producto(db, d.productoId) || falla("El producto ya no existe");
  if (p.existencias < cantidad) falla(`Solo quedan ${p.existencias} de «${p.nombre}»`);
  p.existencias -= cantidad;
  p.actualizado_en = cuando;
  return mover(db, {
    producto_id: p.id, tipo: "salida", motivo: d.motivo, cantidad, existencias_despues: p.existencias,
    precio_unitario: d.motivo === "venta" ? Number(d.precio ?? p.precio_venta) : null, nota: limpio(d.nota),
  }, cuando);
}

// Eliminar un producto registrado por error: se va con sus ingresos y su historial, y las compras recuperan esas prendas.
// Solo si nunca salió en un apartado, una factura o una venta.
function eliminar(db, id) {
  const p = producto(db, id) || falla("El producto ya no existe");
  const aviso = " Si sobran unidades, registre una salida por ajuste de conteo y ocúltelo.";
  const art = db.articulos.find((a) => a.producto_id === id);
  if (art) falla(`No se puede eliminar «${p.nombre}»: ya salió en el apartado ${db.apartados.find((a) => a.id === art.apartado_id)?.numero}.${aviso}`);
  const fart = (db.facturaArticulos || []).find((a) => a.producto_id === id);
  if (fart) falla(`No se puede eliminar «${p.nombre}»: ya salió en la factura ${(db.facturas || []).find((f) => f.id === fart.factura_id)?.numero}.${aviso}`);
  if (db.movimientos.some((m) => m.producto_id === id && (m.motivo === "venta" || m.apartado_id || m.factura_id))) falla(`No se puede eliminar «${p.nombre}»: ya tiene ventas registradas.${aviso}`);
  const ingresos = db.ingresos.filter((i) => i.producto_id === id);
  const compras = [];
  for (const i of ingresos) {
    const c = i.compra_id && (db.compras || []).find((x) => x.id === i.compra_id);
    if (!c) continue;
    c.unidades = Math.max(0, c.unidades - i.cantidad);
    c.total = Math.max(0, Number(c.total) - i.cantidad * Number(i.costo_unitario));
    if (!compras.includes(c)) compras.push(c);
  }
  db.movimientos = db.movimientos.filter((m) => m.producto_id !== id);
  db.ingresos = db.ingresos.filter((i) => i.producto_id !== id);
  db.productos = db.productos.filter((x) => x.id !== id);
  return {
    nombre: p.nombre, talla: p.talla, color: p.color, existencias: p.existencias, foto_path: p.foto_path, ingresos: ingresos.length,
    compras: compras.map((c) => ({ id: c.id, numero: c.numero, faltan: Math.max(0, (c.prendas_pedidas || 0) - c.unidades) })).sort((a, b) => a.numero.localeCompare(b.numero)),
  };
}

function apartar(db, d, cuando = ahora()) {
  if (!limpio(d.clienteNombre)) falla("Escriba el nombre del cliente");
  const articulos = d.articulos || [];
  if (!articulos.length) falla("Agregue al menos un artículo");
  if (Number(d.envio || 0) < 0) falla("Revise el monto del envío");
  if (articulos.some((a) => !(Number(a.cantidad) > 0) || Number(a.precio_unitario) < 0)) falla("Revise las cantidades y los precios del apartado");
  const suma = {};
  for (const a of articulos) suma[a.producto_id] = (suma[a.producto_id] || 0) + Number(a.cantidad);
  for (const [id, cant] of Object.entries(suma)) {
    const p = producto(db, id) || falla("Uno de los artículos ya no existe");
    if (p.existencias < cant) falla(`Solo quedan ${p.existencias} de «${p.nombre}»${p.talla ? " talla " + p.talla : ""}`);
  }
  const ap = {
    id: uuid(), numero: "AP-" + pad(siguiente(db, "apartado"), 4), token: uuid(), cliente_nombre: limpio(d.clienteNombre),
    cliente_telefono: limpio(d.clienteTelefono), cliente_direccion: limpio(d.clienteDireccion), notas: limpio(d.notas),
    subtotal: 0, envio: Number(d.envio || 0), total: 0, estado: "pendiente", factura_id: null, facturado_en: null,
    anulado_en: null, motivo_anulacion: null, creado_en: cuando, creado_por: EMAIL,
  };
  db.apartados.push(ap);
  for (const a of articulos) {
    const p = producto(db, a.producto_id);
    const cantidad = Number(a.cantidad);
    const precio = a.precio_unitario != null ? Number(a.precio_unitario) : p.precio_venta;
    p.existencias -= cantidad;
    p.actualizado_en = cuando;
    db.articulos.push({
      id: uuid(), apartado_id: ap.id, producto_id: p.id, nombre: p.nombre, talla: p.talla, color: p.color, foto_path: p.foto_path,
      cantidad, precio_unitario: precio, costo_unitario: p.costo, subtotal: cantidad * precio,
    });
    mover(db, { producto_id: p.id, tipo: "salida", motivo: "apartado", cantidad, existencias_despues: p.existencias, precio_unitario: precio, referencia: ap.numero, apartado_id: ap.id }, cuando);
    ap.subtotal += cantidad * precio;
  }
  ap.total = total(ap);
  return apartadoCon(db, ap);
}

function buscarApartado(db, id) {
  const ap = db.apartados.find((a) => a.id === id) || falla("El apartado no existe");
  return ap;
}
// Factura de contado: directa (resta del inventario) o desde un apartado (ya restó al apartarse)
const facturaCon = (db, f) => ({ ...f, articulos: db.facturaArticulos.filter((a) => a.factura_id === f.id), apartado: f.apartado_id ? (() => { const ap = db.apartados.find((a) => a.id === f.apartado_id); return ap ? { id: ap.id, numero: ap.numero } : null; })() : null });
function facturar(db, d, cuando = ahora()) {
  if (!limpio(d.clienteNombre)) falla("Escriba el nombre del cliente");
  if (Number(d.envio || 0) < 0) falla("Revise el monto del envío");
  if (Number(d.descuento || 0) < 0) falla("Revise el descuento");
  db.facturas ||= []; db.facturaArticulos ||= [];
  let ap = null;
  const articulos = d.articulos || [];
  if (d.apartadoId) {
    ap = buscarApartado(db, d.apartadoId);
    if (ap.estado !== "pendiente") falla(`Ese apartado ya está ${ap.estado}`);
  } else {
    if (!articulos.length) falla("Agregue al menos un artículo");
    if (articulos.some((a) => !(Number(a.cantidad) > 0) || Number(a.precio_unitario) < 0)) falla("Revise las cantidades y los precios");
    const suma = {};
    for (const a of articulos) suma[a.producto_id] = (suma[a.producto_id] || 0) + Number(a.cantidad);
    for (const [id, cant] of Object.entries(suma)) {
      const p = producto(db, id) || falla("Uno de los artículos ya no existe");
      if (p.existencias < cant) falla(`Solo quedan ${p.existencias} de «${p.nombre}»${p.talla ? " talla " + p.talla : ""}`);
    }
  }
  const f = {
    id: uuid(), numero: "FC-" + pad(siguiente(db, "factura"), 4), token: uuid(), apartado_id: ap ? ap.id : null,
    cliente_nombre: limpio(d.clienteNombre), cliente_telefono: limpio(d.clienteTelefono), cliente_direccion: limpio(d.clienteDireccion), notas: limpio(d.notas),
    subtotal: 0, envio: Number(d.envio || 0), descuento: Number(d.descuento || 0), total: 0, forma_pago: limpio(d.formaPago), referencia_pago: limpio(d.referenciaPago),
    estado: "emitida", anulada_en: null, motivo_anulacion: null, creado_en: cuando, creado_por: EMAIL,
  };
  db.facturas.push(f);
  if (ap) {
    for (const a of db.articulos.filter((x) => x.apartado_id === ap.id)) {
      db.facturaArticulos.push({ id: uuid(), factura_id: f.id, producto_id: a.producto_id, nombre: a.nombre, talla: a.talla, color: a.color, cantidad: a.cantidad, precio_unitario: a.precio_unitario, costo_unitario: a.costo_unitario, subtotal: a.cantidad * a.precio_unitario });
      f.subtotal += a.cantidad * a.precio_unitario;
    }
    Object.assign(ap, { estado: "facturado", factura_id: f.id, facturado_en: cuando });
    db.movimientos.filter((m) => m.apartado_id === ap.id && m.motivo === "apartado").forEach((m) => { m.factura_id = f.id; });
  } else {
    for (const a of articulos) {
      const p = producto(db, a.producto_id);
      const cantidad = Number(a.cantidad);
      const precio = a.precio_unitario != null ? Number(a.precio_unitario) : p.precio_venta;
      p.existencias -= cantidad; p.actualizado_en = cuando;
      db.facturaArticulos.push({ id: uuid(), factura_id: f.id, producto_id: p.id, nombre: p.nombre, talla: p.talla, color: p.color, cantidad, precio_unitario: precio, costo_unitario: p.costo, subtotal: cantidad * precio });
      mover(db, { producto_id: p.id, tipo: "salida", motivo: "factura", cantidad, existencias_despues: p.existencias, precio_unitario: precio, referencia: f.numero, factura_id: f.id }, cuando);
      f.subtotal += cantidad * precio;
    }
  }
  f.total = f.subtotal + f.envio - f.descuento;
  return facturaCon(db, f);
}
function anularFactura(db, id, motivo, cuando = ahora()) {
  const f = (db.facturas || []).find((x) => x.id === id) || falla("La factura no existe");
  if (f.estado === "anulada") falla("La factura ya estaba anulada");
  for (const a of db.facturaArticulos.filter((x) => x.factura_id === id)) {
    const p = producto(db, a.producto_id);
    p.existencias += a.cantidad; p.activo = true;
    mover(db, { producto_id: p.id, tipo: "entrada", motivo: "anulacion", cantidad: a.cantidad, existencias_despues: p.existencias, precio_unitario: a.precio_unitario, referencia: f.numero, factura_id: f.id, nota: limpio(motivo) }, cuando);
  }
  if (f.apartado_id) {
    const ap = db.apartados.find((x) => x.id === f.apartado_id);
    if (ap) Object.assign(ap, { estado: "anulado", anulado_en: cuando, motivo_anulacion: limpio(motivo) || "Factura anulada" });
  }
  Object.assign(f, { estado: "anulada", anulada_en: cuando, motivo_anulacion: limpio(motivo) });
  return facturaCon(db, f);
}
function nuevoGasto(db, d, cuando = ahora()) {
  if (!limpio(d.descripcion)) falla("Escriba en qué se gastó");
  if (!(Number(d.monto) > 0)) falla("Escriba el monto del gasto");
  const g = { id: uuid(), numero: "GA-" + pad(siguiente(db, "gasto"), 4), fecha: d.fecha || cuando.slice(0, 10), categoria: d.categoria || "otro", descripcion: d.descripcion.trim(), monto: Number(d.monto), pagado_con: limpio(d.pagadoCon), nota: limpio(d.nota), creado_en: cuando, creado_por: EMAIL };
  (db.gastos ||= []).push(g);
  return g;
}
function anular(db, id, motivo, cuando = ahora()) {
  const ap = buscarApartado(db, id);
  if (ap.estado === "anulado") falla("El apartado ya estaba anulado");
  if (ap.estado === "facturado") falla("El apartado ya se facturó; anule la factura si hace falta");
  for (const a of db.articulos.filter((x) => x.apartado_id === id)) {
    const p = producto(db, a.producto_id);
    p.existencias += a.cantidad;
    p.activo = true;
    mover(db, { producto_id: p.id, tipo: "entrada", motivo: "anulacion", cantidad: a.cantidad, existencias_despues: p.existencias, precio_unitario: a.precio_unitario, referencia: ap.numero, apartado_id: ap.id, nota: limpio(motivo) }, cuando);
  }
  Object.assign(ap, { estado: "anulado", anulado_en: cuando, motivo_anulacion: limpio(motivo) });
  return apartadoCon(db, ap);
}

// ---------- Datos de ejemplo ----------
function sembrar() {
  const db = {
    seq: {}, productos: [], ingresos: [], apartados: [], articulos: [], movimientos: [], compras: [], proveedores: [], facturas: [], facturaArticulos: [], gastos: [],
    ajustes: {
      id: 1, nombre_tienda: "Myle Store", whatsapp: "8000-0000", instagram: "", sinpe_movil: "8000-0000",
      sinpe_a_nombre: "Nombre de la dueña", banco: "Banco de ejemplo", cuenta_iban: "CR00 0000 0000 0000 0000 00",
      titular_cuenta: "Nombre de la dueña", cedula_titular: "0-0000-0000",
      nota_factura: "Envíe el comprobante por WhatsApp para confirmar su apartado.", moneda: "CRC", actualizado_en: ahora(),
    },
  };
  const dia = (n, h = 10) => {
    const d = new Date(Date.now() - n * 86400000);
    d.setHours(h, 15, 0, 0);
    return d.toISOString();
  };
  const ingreso = (d, n) => ingresar(db, d, dia(n, 9));
  const prov1 = nuevoProveedor(db, { nombre: "Mayorista San José", telefono: "2222-0000", direccion: "San José centro, avenida 4" }, dia(30));
  const prov2 = nuevoProveedor(db, { nombre: "Importadora Luna", telefono: "8800-5566", correo: "ventas@importadoraluna.cr", nota: "Pide por catálogo de WhatsApp; entrega en 5 días" }, dia(28));
  const compra1 = abrirCompra(db, { proveedorId: prov1.id, factura: "F-20451", prendasPedidas: 7, montoPagado: 45500 }, dia(21, 9));
  const blusaM = ingreso({ nombre: "Blusa de lino manga corta", categoria: "Blusas", talla: "M", color: "Blanco", cantidad: 4, costo: 6500, precio: 14900, compraId: compra1.id }, 21);
  const blusaS = ingreso({ nombre: "Blusa de lino manga corta", categoria: "Blusas", talla: "S", color: "Blanco", cantidad: 3, costo: 6500, precio: 14900, compraId: compra1.id }, 21);
  const compra2 = abrirCompra(db, { proveedorId: prov2.id, factura: "A-0088", nota: "Pedido por catálogo", prendasPedidas: 10, montoPagado: 98000 }, dia(19, 9));
  const vestido = ingreso({ nombre: "Vestido midi floral", categoria: "Vestidos", talla: "M", color: "Estampado", cantidad: 3, costo: 11000, precio: 24900, compraId: compra2.id }, 19);
  const jeans = ingreso({ nombre: "Jeans tiro alto", categoria: "Jeans", talla: "10", color: "Mezclilla", cantidad: 5, costo: 9500, precio: 19900, compraId: compra2.id }, 19);
  const top = ingreso({ nombre: "Top de tirantes", categoria: "Tops", talla: "Única", color: "Negro", cantidad: 6, costo: 3000, precio: 7900 }, 16);
  const enagua = ingreso({ nombre: "Enagua plisada", categoria: "Enaguas", talla: "S", color: "Beige", cantidad: 2, costo: 7000, precio: 16500 }, 14);
  const conjunto = ingreso({ nombre: "Conjunto deportivo", categoria: "Ropa deportiva", talla: "M", color: "Gris", cantidad: 2, costo: 10000, precio: 22000 }, 12);
  const camisa = ingreso({ nombre: "Camisa oversize", categoria: "Camisas", talla: "L", color: "Celeste", cantidad: 3, costo: 6000, precio: 13900 }, 10);
  ingreso({ nombre: "Vestido de lino", categoria: "Vestidos", talla: "S", color: "Vino", cantidad: 2, costo: 12000, precio: 26900 }, 6);
  ingreso({ productoId: top.producto_id, cantidad: 4, costo: 3000, precio: 7900, nota: "Reposición" }, 3);

  const ap1 = apartar(db, { clienteNombre: "Sofía Jiménez", clienteTelefono: "88001122", clienteDireccion: "Retira en casa", articulos: [{ producto_id: conjunto.producto_id, cantidad: 2 }] }, dia(9, 15));
  facturar(db, { clienteNombre: "Sofía Jiménez", clienteTelefono: "88001122", clienteDireccion: "Retira en casa", apartadoId: ap1.id, formaPago: "SINPE Móvil", referenciaPago: "4471" }, dia(7, 17));
  facturar(db, { clienteNombre: "Carolina Mena", clienteTelefono: "86001010", articulos: [{ producto_id: camisa.producto_id, cantidad: 1 }], formaPago: "Efectivo" }, dia(1, 11));
  nuevoGasto(db, { descripcion: "Cinta y bolsas de empaque", monto: 4500, categoria: "empaque", pagadoCon: "Efectivo" }, dia(6, 10));
  nuevoGasto(db, { descripcion: "Gasolina para entregas", monto: 8000, categoria: "transporte", pagadoCon: "SINPE Móvil" }, dia(2, 18));
  const ap2 = apartar(db, { clienteNombre: "Daniela Vargas", clienteTelefono: "87654321", clienteDireccion: "Alajuela centro · envío por Correos", envio: 2500, articulos: [{ producto_id: jeans.producto_id, cantidad: 1 }, { producto_id: blusaS.producto_id, cantidad: 1 }] }, dia(5, 13));
  sacar(db, { productoId: camisa.producto_id, cantidad: 1, motivo: "regalo", nota: "Regalo de cumpleaños" }, dia(4, 16));
  sacar(db, { productoId: blusaM.producto_id, cantidad: 1, motivo: "danado", nota: "Mancha en la manga" }, dia(3, 10));
  const ap3 = apartar(db, { clienteNombre: "María Fernanda Rojas", clienteTelefono: "88881234", clienteDireccion: "Heredia, San Pablo · mensajero", envio: 2000, articulos: [{ producto_id: vestido.producto_id, cantidad: 1 }, { producto_id: top.producto_id, cantidad: 2, precio_unitario: 7000 }] }, dia(2, 19));
  apartar(db, { clienteNombre: "Valeria Mora", clienteTelefono: "60123456", articulos: [{ producto_id: blusaM.producto_id, cantidad: 1 }, { producto_id: enagua.producto_id, cantidad: 1 }] }, dia(0, 9));
  return db;
}

// Las fotos de la demo se guardan chiquitas para que quepan en el navegador
async function fotoChica(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const escala = Math.min(1, 520 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * escala);
    c.height = Math.round(img.naturalHeight * escala);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.78);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const datosDemo = {
  usuario: async () => ({ email: EMAIL }),
  alCambiarSesion() {},
  async entrar() {},
  async salir() {},
  async recuperar() {},
  async nuevaClave() {},
  esEquipo: async () => true,

  ajustes: () => consultar((db) => db.ajustes),
  guardarAjustes: (cambios) => cambiar((db) => Object.assign(db.ajustes, cambios, { actualizado_en: ahora() })),

  productos: () => consultar((db) => db.productos),
  guardarProducto: (id, cambios) => cambiar((db) => {
    const p = producto(db, id) || falla("El producto ya no existe");
    if (cambios.nombre !== undefined && !limpio(cambios.nombre)) falla("Escriba el nombre del producto");
    if ((cambios.precio_venta !== undefined && Number(cambios.precio_venta) < 0) || (cambios.costo !== undefined && Number(cambios.costo) < 0)) falla("Revise los precios");
    return Object.assign(p, cambios, { actualizado_en: ahora() });
  }),
  eliminarProducto: (id) => cambiar((db) => eliminar(db, id)),
  async subirFoto(blob) {
    const ruta = `demo/${uuid()}.jpg`;
    const dato = await fotoChica(blob);
    memoria.fotos[ruta] = dato;
    try { localStorage.setItem(PREFIJO_FOTO + ruta, dato); } catch { /* lleno: queda en memoria */ }
    return ruta;
  },
  urlFoto(ruta) {
    if (!ruta) return null;
    if (/^https?:|^data:/.test(ruta)) return ruta;
    if (!memoria.fotos[ruta]) {
      try { memoria.fotos[ruta] = localStorage.getItem(PREFIJO_FOTO + ruta); } catch { /* sin almacenamiento */ }
    }
    return memoria.fotos[ruta] || null;
  },

  registrarIngreso: (d) => cambiar((db) => ingresar(db, d)),
  crearCompra: (d) => cambiar((db) => abrirCompra(db, d)),
  proveedores: () => consultar((db) => (db.proveedores || []).slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))),
  crearProveedor: (d) => cambiar((db) => nuevoProveedor(db, d)),
  editarProveedor: (id, cambios) => cambiar((db) => {
    const p = (db.proveedores || []).find((x) => x.id === id) || falla("El proveedor no existe");
    if (cambios.nombre !== undefined && !limpio(cambios.nombre)) falla("Escriba el nombre del proveedor");
    return Object.assign(p, cambios, { actualizado_en: ahora() });
  }),
  compras: ({ limite = 300 } = {}) => consultar((db) => (db.compras || []).slice().sort((a, b) => b.creado_en.localeCompare(a.creado_en)).slice(0, limite)
    .map((c) => ({ ...c, ingresos: db.ingresos.filter((i) => i.compra_id === c.id).map((i) => ({ ...i, producto: producto(db, i.producto_id) })) }))),
  compra: (id) => consultar((db) => {
    const c = (db.compras || []).find((x) => x.id === id);
    return c ? { ...c, ingresos: db.ingresos.filter((i) => i.compra_id === c.id).map((i) => ({ ...i, producto: producto(db, i.producto_id) })) } : null;
  }),
  editarCompra: (id, cambios) => cambiar((db) => {
    const c = (db.compras || []).find((x) => x.id === id) || falla("La compra no existe");
    const nuevo = { proveedor: limpio(cambios.proveedor), factura: limpio(cambios.factura), nota: limpio(cambios.nota) };
    if (cambios.prendas_pedidas !== undefined) nuevo.prendas_pedidas = Number(cambios.prendas_pedidas);
    if (cambios.monto_pagado !== undefined) nuevo.monto_pagado = Number(cambios.monto_pagado);
    if (cambios.fecha_compra) nuevo.fecha_compra = cambios.fecha_compra;
    return Object.assign(c, nuevo);
  }),
  eliminarCompra: (id) => cambiar((db) => eliminarCompra(db, id)),
  ingresos: ({ productoId, limite = 200 } = {}) => consultar((db) => db.ingresos
    .filter((i) => !productoId || i.producto_id === productoId)
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
    .slice(0, limite)
    .map((i) => ({ ...i, producto: producto(db, i.producto_id) }))),
  registrarSalida: (d) => cambiar((db) => sacar(db, d)),
  movimientos: ({ tipo, productoId, limite = 200 } = {}) => consultar((db) => db.movimientos
    .filter((m) => (!tipo || m.tipo === tipo) && (!productoId || m.producto_id === productoId))
    .sort((a, b) => b.creado_en.localeCompare(a.creado_en) || b.id - a.id)
    .slice(0, limite)
    .map((m) => {
      const ap = m.apartado_id && db.apartados.find((a) => a.id === m.apartado_id);
      return { ...m, producto: producto(db, m.producto_id), apartado: ap ? { id: ap.id, numero: ap.numero, estado: ap.estado, cliente_nombre: ap.cliente_nombre } : null };
    })),

  apartados: () => consultar((db) => db.apartados.slice().sort((a, b) => b.creado_en.localeCompare(a.creado_en)).map((ap) => apartadoCon(db, ap))),
  apartado: (id) => consultar((db) => {
    const ap = db.apartados.find((a) => a.id === id);
    return ap ? apartadoCon(db, ap) : null;
  }),
  crearApartado: (d) => cambiar((db) => apartar(db, d)),
  anularApartado: (id, motivo) => cambiar((db) => anular(db, id, motivo)),
  facturas: () => consultar((db) => (db.facturas || []).slice().sort((a, b) => b.creado_en.localeCompare(a.creado_en)).map((f) => facturaCon(db, f))),
  factura: (id) => consultar((db) => { const f = (db.facturas || []).find((x) => x.id === id); return f ? facturaCon(db, f) : null; }),
  crearFactura: (d) => cambiar((db) => facturar(db, d)),
  anularFactura: (id, motivo) => cambiar((db) => anularFactura(db, id, motivo)),
  editarFactura: (id, cambios) => cambiar((db) => {
    const f = (db.facturas || []).find((x) => x.id === id) || falla("La factura no existe");
    if (cambios.cliente_nombre !== undefined && !limpio(cambios.cliente_nombre)) falla("Escriba el nombre del cliente");
    return facturaCon(db, Object.assign(f, cambios));
  }),
  gastos: () => consultar((db) => (db.gastos || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en))),
  crearGasto: (d) => cambiar((db) => nuevoGasto(db, d)),
  editarGasto: (id, cambios) => cambiar((db) => {
    const g = (db.gastos || []).find((x) => x.id === id) || falla("El gasto no existe");
    if (cambios.monto !== undefined && !(Number(cambios.monto) > 0)) falla("Escriba el monto del gasto");
    return Object.assign(g, cambios, cambios.monto !== undefined ? { monto: Number(cambios.monto) } : {});
  }),
  borrarGasto: (id) => cambiar((db) => { db.gastos = (db.gastos || []).filter((x) => x.id !== id); return true; }),
  editarApartado: (id, cambios) => cambiar((db) => {
    const ap = buscarApartado(db, id);
    if (cambios.cliente_nombre !== undefined && !limpio(cambios.cliente_nombre)) falla("Escriba el nombre del cliente");
    if (cambios.envio !== undefined && Number(cambios.envio) < 0) falla("Revise el monto del envío");
    Object.assign(ap, cambios);
    ap.total = total(ap);
    return apartadoCon(db, ap);
  }),
  facturaPublica: (token) => consultar((db) => {
    const f = (db.facturas || []).find((x) => x.token === token);
    if (!f) return null;
    const { id, ...tienda } = db.ajustes;
    return {
      tienda,
      factura: { numero: f.numero, cliente_nombre: f.cliente_nombre, cliente_telefono: f.cliente_telefono, cliente_direccion: f.cliente_direccion, subtotal: f.subtotal, envio: f.envio, descuento: f.descuento, total: f.total, forma_pago: f.forma_pago, estado: f.estado, creado_en: f.creado_en },
      articulos: db.facturaArticulos.filter((a) => a.factura_id === f.id).map(({ nombre, talla, color, cantidad, precio_unitario, subtotal }) => ({ nombre, talla, color, cantidad, precio_unitario, subtotal })),
    };
  }),

  // Solo en demo: volver a los datos de ejemplo
  async reiniciarDemo() {
    try {
      Object.keys(localStorage).filter((k) => k === CLAVE || k.startsWith(PREFIJO_FOTO)).forEach((k) => localStorage.removeItem(k));
    } catch { /* sin almacenamiento */ }
    memoria.db = null;
    memoria.fotos = {};
  },
};
