# Myle Store · Inventario

Sistema de inventario para una tienda de ropa que vende en línea desde casa. Funciona en el celular y en la compu.

- **Ingresos:** cada entrada de mercadería lleva foto, cantidad, precio de costo y precio de venta final, y recibe un **número de serie único** (`MS-00001`). Sirve para un producto nuevo o para reponer uno que ya existe. Con «Otra talla o color» se registra la misma prenda en otra talla sin volver a escribir todo.
- **Inventario:** las prendas con su foto, talla, color, precio y cuántas quedan disponibles. La ficha de cada una muestra su ganancia, las etiquetas de serie de cada ingreso (se vuelven a ver e imprimir las veces que haga falta) y todo su historial.
- **Cómo vamos (Inicio):** vendido hoy y en el mes (apartados cobrados + ventas directas), ganancia estimada de lo que hay en inventario y ganancia esperada de lo ingresado en el mes.
- **Guía:** en *Ajustes → Cómo usar el sistema* hay un recorrido animado de dos minutos (`guia.html`) con datos de ejemplo que explica cada parte; se reproduce solo, se pausa y se salta por escenas.
- **Desde cualquier dispositivo:** todo se guarda en Supabase; en el dispositivo solo queda la sesión y el tema. Con el correo y la contraseña, los mismos datos aparecen en cualquier celular o computadora.
- **Inicio:** arriba va el recorrido de la tienda en cinco pasos (proveedores → compras → inventario → apartados → entregas), cada uno con lo que falta y un enlace a su pantalla.
- **Salidas:** venta directa, prenda dañada, devolución al proveedor, regalo o ajuste de conteo.
- **Proveedores:** se registran en *Ajustes* (nombre, teléfono, correo, dirección y nota) o desde una compra nueva con «Nuevo»; al crear la compra se elige uno de la lista.
- **Compras de mercadería:** primero se registra la compra al proveedor (`CO-0001`): proveedor elegido de la lista, factura, fecha, cuántas prendas se compraron y cuánto se pagó. Después, desde la compra, se registra prenda por prenda en el inventario con «Registrar prenda»; la compra muestra el avance («3 de 10 registradas · faltan 7») y queda completa al llegar a lo pactado.
- **Movimientos:** el registro de la mercadería en tres pestañas. *Compras*: la lista de compras con su avance y lo pagado. *Salidas*: qué salió, cuándo y por qué, con filtro por motivo. *Todo*: entradas y salidas en orden, con filtro por producto. Todas filtran por mes.
- **Apartados:** el pedido armado para un cliente que todavía no se entrega. Al crearlo, las prendas **se restan del inventario disponible** y se genera la **factura** con los datos del cliente, el total de artículos, el envío, el monto total y los datos de depósito (SINPE Móvil y cuenta IBAN). Después se marca como **pagado (cancelado)** y como **entregado**. Si el cliente no sigue, se anula y las prendas vuelven al inventario.
- **Factura:** se envía por WhatsApp con un enlace que el cliente abre sin cuenta, o se imprime o se guarda en PDF.
- **Fotos:** en el celular, «Tomar foto» abre directo la cámara de atrás y «Galería» elige una foto guardada.
- **Entrada:** con «Mantener la sesión iniciada» no hay que volver a escribir la contraseña en ese dispositivo hasta cerrar sesión. La app se puede instalar en la pantalla de inicio del celular (en iPhone: Compartir → «Agregar a inicio»; en Android: menú → «Instalar app»).

Es HTML, CSS y JavaScript sin compilar, con [Supabase](https://supabase.com) como base de datos y lugar para las fotos.

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

- Las existencias solo cambian con las funciones de la base (`registrar_ingreso`, `registrar_salida`, `crear_apartado`, `anular_apartado`). Cada una deja su movimiento, así que el inventario siempre cuadra con el historial. Nadie puede cambiar existencias ni borrar movimientos a mano desde la app.
- Un apartado revisa primero que alcancen las existencias. Si no alcanzan, no se crea ni gasta número de factura.
- La factura pública solo se abre con su enlace secreto y no muestra costos ni notas internas.
- «Cancelado» en la factura significa pagado, como se usa en Costa Rica. Para dejar sin efecto un apartado, la app dice «Anular».

## Estructura

```
index.html            app (inventario, ingresos, salidas, apartados, ajustes)
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
