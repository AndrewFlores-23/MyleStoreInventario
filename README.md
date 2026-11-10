# Myle Store · Inventario

Sistema de inventario para una tienda de ropa que vende en línea desde casa. Funciona en el celular y en la compu.

- **Ingresos:** cada entrada de mercadería lleva cantidad, precio de costo y precio de venta final, y recibe un **número de serie único** (`MS-00001`). Sirve para un producto nuevo o para reponer uno que ya existe. Con «Otra talla o color» se registra la misma prenda en otra talla sin volver a escribir todo.
- **Inventario:** las prendas con su talla, color, precio y cuántas quedan disponibles. La ficha de cada una muestra su ganancia, las etiquetas de serie de cada ingreso (se vuelven a ver e imprimir las veces que haga falta) y todo su historial. Si una prenda se registró por error, «Eliminar producto» la borra con sus ingresos y su historial, y la compra a la que pertenecía vuelve a tener esas prendas por registrar; solo se puede si nunca salió en un apartado ni en una factura (en ese caso se registra una salida por ajuste y se oculta).
- **Cómo vamos (Inicio):** vendido hoy y en el mes (facturas de contado), ganancia del mes (vendido menos costo de las prendas y gastos), ganancia estimada del inventario, ganancia esperada de lo ingresado y gastos del mes.
- **Guía:** en *Ajustes → Cómo usar el sistema* hay un recorrido animado de dos minutos (`guia.html`) con datos de ejemplo que explica cada parte; se reproduce solo, se pausa y se salta por escenas.
- **Desde cualquier dispositivo:** todo se guarda en Supabase; en el dispositivo solo queda la sesión y el tema. Con el correo y la contraseña, los mismos datos aparecen en cualquier celular o computadora.
- **Inicio:** arriba va el recorrido de la tienda en cinco pasos (proveedores → compras → inventario → apartados → facturación), cada uno con lo que falta y un enlace a su pantalla.
- **Salidas:** prenda dañada, devolución al proveedor, regalo o ajuste de conteo.
- **Proveedores:** se registran en *Ajustes* (nombre, teléfono, correo, dirección y nota) o desde una compra nueva con «Nuevo»; al crear la compra se elige uno de la lista.
- **Compras de mercadería:** primero se registra la compra al proveedor (`CO-0001`): proveedor elegido de la lista, factura, fecha, cuántas prendas se compraron y cuánto se pagó. Después, desde la compra, se registra prenda por prenda en el inventario con «Registrar prenda»; la compra muestra el avance («3 de 10 registradas · faltan 7») y queda completa al llegar a lo pactado.
- **Movimientos:** el registro de la mercadería en tres pestañas. *Compras*: la lista de compras con su avance y lo pagado. *Salidas*: qué salió, cuándo y por qué, con filtro por motivo. *Todo*: entradas y salidas en orden, con filtro por producto. Todas filtran por mes.
- **Apartados:** el pedido de un cliente que todavía no paga. Al crearlo, las prendas **se restan del inventario disponible** y quedan guardadas para él. No lleva factura: cuando el cliente paga, se pasa a Facturación con un botón. Si no sigue, se anula y las prendas vuelven.
- **Facturación:** la **factura de contado** (`FC-0001`) de una venta ya pagada: directa (las prendas salen del inventario) o desde un apartado (ya salieron). Lleva forma de pago, envío y descuento, sin fotos. Se envía por WhatsApp con un enlace que el cliente abre sin cuenta, se comparte, se imprime o se guarda en PDF las veces que haga falta. Anularla devuelve las prendas.
- **Gastos:** lo que gasta el negocio fuera de la mercadería (`GA-0001`): cinta, bolsas, gasolina, envíos, publicidad. Con categoría, fecha y con qué se pagó; se restan de la ganancia del mes.
- **Sin fotos:** el sistema trabaja solo con lo que se escribe de cada prenda (nombre, talla, color, precios); no se suben imágenes.
- **Entrada:** con «Mantener la sesión iniciada» no hay que volver a escribir la contraseña en ese dispositivo hasta cerrar sesión. La app se puede instalar en la pantalla de inicio del celular (en iPhone: Compartir → «Agregar a inicio»; en Android: menú → «Instalar app»).

Es HTML, CSS y JavaScript sin compilar, con [Supabase](https://supabase.com) como base de datos.

**Diseño:** sigue la marca de Myle Store · Moda & Beauty: rubor y blanco, frambuesa para las acciones, detalles dorados y la letra Bodoni del logo. La factura que recibe el cliente lleva el logo. En *Ajustes* hay un tema oscuro («Noche»).

## Probar sin base de datos

Mientras `js/config.js` no tenga la dirección de Supabase, la app abre en **modo demo**, con datos de ejemplo guardados solo en el navegador. Para verla en la compu:

```bash
python3 -m http.server 8080
```

y abra `http://localhost:8080`.

## Conectar Supabase

1. **Base de datos.** Ya está aplicada en el proyecto de la tienda (`ugbrooifrjpogmtzcjqv`). Para montarla en otro proyecto, abra *SQL Editor* y ejecute en orden los archivos de `supabase/migrations/`. Crean las tablas, las reglas de existencias, los permisos y la carpeta `productos` para las fotos.
2. **Usuario de la dueña.** En *Authentication → Users → Add user*, cree el usuario con correo y contraseña.
3. **Darle acceso.** En *SQL Editor*:
   ```sql
   insert into public.equipo (email, nombre) values ('correo-de-la-duena@ejemplo.com', 'Nombre');
   ```
   Solo los correos de esta tabla pueden ver y cambiar datos.
4. **Cerrar el registro libre.** En *Authentication → Sign In / Providers*, apague «Allow new users to sign up».
5. **Dirección de la app.** En *Authentication → URL Configuration*, ponga en *Site URL* la dirección donde quede publicada la app. Así funciona el enlace de «¿Olvidó la contraseña?».
6. **Llaves.** En *Project Settings → API Keys*, copie la *Project URL* y la llave **publicable** (`sb_publishable_…`) en `js/config.js`. Nunca use la llave secreta.
7. **Datos de la factura.** Entre a la app y complete *Ajustes*: WhatsApp, SINPE Móvil, banco, cuenta IBAN y titular.

## Publicar

Al ser archivos estáticos, se puede publicar en GitHub Pages (*Settings → Pages → Deploy from a branch → main*) o en Cloudflare Pages, sin pasos de compilación.

## Cómo se cuidan los datos

- Las existencias solo cambian con las funciones de la base (`registrar_ingreso`, `registrar_salida`, `crear_apartado`, `anular_apartado`, `crear_factura`, `anular_factura`). Cada una deja su movimiento, así que el inventario siempre cuadra con el historial. Nadie puede cambiar existencias ni borrar movimientos a mano desde la app.
- `eliminar_producto` es la única forma de borrar: quita el producto con sus ingresos y movimientos y descuenta esas prendas de sus compras, y se niega si el producto ya salió en un apartado, una factura o una venta.
- Un apartado o una factura directa revisan primero que alcancen las existencias. Si no alcanzan, no se crean ni gastan número.
- La factura pública solo se abre con su enlace secreto y no muestra costos ni notas internas.
- «Cancelado» en la factura significa pagado, como se usa en Costa Rica. Para dejar sin efecto un apartado o una factura, la app dice «Anular».

## Estructura

```
index.html            app (inventario, ingresos, salidas, apartados, facturación, gastos, ajustes)
guia.html             guía animada de uso con datos de ejemplo (js/guia.js, css/guia.css)
factura.html          factura pública que abre el cliente
css/app.css           estilos (tema de la marca y tema oscuro)
img/                  logo sin fondo, mariposa, foto de perfil, íconos y portada de la entrada
js/config.js          conexión con Supabase
js/datos.js           acceso a Supabase
js/demo.js            modo demo con las mismas reglas
js/vistas/            una vista por sección
js/factura.js         hoja de la factura, mensaje de WhatsApp e impresión
supabase/migrations/  base de datos
```
