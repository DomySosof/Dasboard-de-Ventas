# Dashboard de Ventas y Asociados

Sistema web (Docker) que reemplaza tu archivo de Excel: registra ventas, pagos a
asociados, bancos/POS, y muestra un dashboard filtrable por día, semana, mes,
trimestre, semestre y año.

## Estructura del proyecto

```
proyecto/
├── docker-compose.yml       <- levanta todo con un solo comando
├── install.ps1               <- instalador para Windows (Docker Desktop)
├── install.sh                <- instalador para macOS / Linux (Docker)
├── .gitignore                <- lo que NO se sube a GitHub (node_modules, data)
├── data/                     <- aquí vive tu base de datos (persiste aunque borres el contenedor)
└── backend/
    ├── Dockerfile
    ├── .dockerignore
    ├── package.json
    ├── public/                <- frontend (HTML/CSS/JS, sin build)
    │   ├── index.html
    │   ├── css/style.css
    │   └── js/ (api.js, ui.js, app.js, dashboard.js, ventas.js, asociados.js, pos.js, backup.js, ...)
    └── src/
        ├── server.js          <- servidor Express (API + estáticos)
        ├── db.js               <- esquema SQLite + catálogos iniciales
        ├── lib/
        │   ├── calc.js         <- TODAS las fórmulas de negocio
        │   └── folioService.js <- arma cada "venta" con sus totales
        ├── routes/             <- folios, asociados, pos, dashboard, catálogos, backup, datos
        └── scripts/seed-demo.js  <- carga los 3 folios de ejemplo de tu plantilla original
```

## Cómo ejecutarlo

### Opción A: Windows con Docker Desktop (la más fácil)
1. Instala [Docker Desktop](https://www.docker.com/products/docker-desktop/) y ábrelo.
2. Copia esta carpeta `proyecto` a tu equipo.
3. Clic derecho sobre `install.ps1` → **Ejecutar con PowerShell** (o ábrelo desde una
   terminal PowerShell con `.\install.ps1`).
4. El script te **recomienda un puerto libre** para no chocar con tus otros
   proyectos (por defecto busca cerca del 45000). Si no te gusta, escribes el que
   quieras. Con ese puerto genera un `docker-compose` **temporal**, construye la
   imagen, levanta el contenedor, **abre el navegador** en
   `http://localhost:<puerto>` y **elimina el temporal** al terminar (tu
   `docker-compose.yml` original no se toca).

### Opción B: macOS / Linux con Docker
1. Instala Docker (Docker Desktop en Mac, o `docker` + `docker compose` en Linux).
2. Da permiso de ejecución al instalador y córrelo:
   ```bash
   chmod +x install.sh
   ./install.sh          # o también:  bash install.sh
   ```
   Hace lo mismo que el instalador de Windows: te **recomienda un puerto libre**,
   te deja aceptarlo o escribir otro, genera un `docker-compose` **temporal**,
   construye la imagen, levanta el contenedor, abre el navegador en
   `http://localhost:<puerto>` y **borra el temporal** al terminar.

### Opción C: manual (cualquier sistema operativo con Docker)
```bash
cd proyecto
docker compose up -d --build
```
Luego abre `http://localhost:45000` (el puerto configurado en `docker-compose.yml`;
si estaba ocupado, cámbialo ahí o usa un instalador).

### Cargar datos de ejemplo (opcional)
Para ver el dashboard con los 3 folios de muestra que traía tu Excel original
(útil para comparar que todo cuadra):
```bash
docker exec dashboard-turismo node src/scripts/seed-demo.js
```

### Comandos útiles
```bash
docker logs -f dashboard-turismo     # ver logs en vivo
docker stop dashboard-turismo        # detener (tus datos NO se borran, quedan en ./data)
docker start dashboard-turismo       # volver a iniciar (conserva el puerto con que se instaló)
docker restart dashboard-turismo     # reiniciar
```
> El instalador borra su `docker-compose` temporal, así que después conviene
> administrar el contenedor por su **nombre** (`dashboard-turismo`). Si quieres
> cambiar de puerto, vuelve a ejecutar `install.ps1` (Windows) o `install.sh`
> (macOS/Linux).

Tu información se guarda en `./data/database.sqlite`. Haz respaldo de esa carpeta
periódicamente (por ejemplo, copiándola a Google Drive o OneDrive).

---

## Qué archivos subir a GitHub

La carpeta pesa ~90 MB **solo** porque `backend/node_modules` (89 MB) está en tu
computadora. Esa carpeta la genera Docker sola al construir la imagen
(`npm install`), así que **no se sube**. Con el `.gitignore` incluido, Git la
ignora automáticamente.

**SÍ se suben** (todo es texto liviano, unos pocos KB):

```
docker-compose.yml
install.ps1
install.sh
README.md
.gitignore
backend/Dockerfile
backend/.dockerignore
backend/package.json
backend/package-lock.json
backend/public/index.html
backend/public/css/
backend/public/js/
backend/src/                (server.js, db.js, lib/, routes/, scripts/)
```

**NO se suben** (quedan fuera con el `.gitignore`):

```
backend/node_modules/     (89 MB — se instala sola dentro de la imagen de Docker)
data/                     (tu base de datos y tus respaldos)
backend/data/             (base de datos local de pruebas)
backend/public/vendor/    (se genera en el build de Docker)
```

> Quien lo instale solo necesita **Docker**. No necesita Node ni npm.

### Publicarlo en GitHub (paso a paso)

> Importante: usa **Git** (o GitHub Desktop), **no** arrastres la carpeta en el
> navegador. Solo así se respeta el `.gitignore` y no se suben los 89 MB.

```bash
cd proyecto
git init
git add .
git status          # comprueba que NO aparezcan backend/node_modules ni data/
git commit -m "Dashboard de Ventas y Asociados"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

En **GitHub Desktop**: `File → Add local repository…` → elige la carpeta
`proyecto` → `Publish repository`. Como el `.gitignore` ya está, solo te mostrará
los archivos livianos.

---

## Cómo funciona (mapeo 1:1 con tu Excel)

### 1. Datos de venta
- El formulario pide primero el **ID de folio**. Si ese ID **ya existe**, el nuevo
  pago se **suma** a esa misma venta (igual que tu hoja "Datos de venta", donde una
  venta puede tener varias filas de pagos por debajo del folio).
- Por cada folio se calcula automáticamente:
  - `Base imponible = Monto / 1.12`
  - `IVA = Base × 12%`
  - `ISR = Base × 5%` (o `(Base − 30,000) × 7% + 1,500` si la base supera Q30,000 —
    es la fórmula progresiva real que ya traía tu Excel, no la del 5% plano)
  - `Comisión POS` por cada pago, según el banco/medio elegido (ver más abajo)
  - `IVA retenido POS = IVA × % de retención` (por defecto 15%). **No es un costo**:
    es un pago de tu IVA, así que se acredita contra el impuesto.
  - `IVA por pagar = IVA − IVA retenido POS` (si no, pagarías ese mismo IVA dos veces)
  - `Comisión POS neta = comisión POS − IVA retenido POS` (el banco retiene la
    comisión bruta, pero la parte retenida es IVA, no gasto)
  - `Total gasto externo = tuc-tuc + café + aliados + comisión POS neta`
  - `Total gastos = gasto con asociados + gasto externo`
  - `Utilidad bruta = Monto − IVA por pagar − ISR`
  - `IVA recuperado = suma de (pago_a_asociado / 1.12 × 12%) SOLO de los asociados en Régimen General`
  - `Utilidad neta = Utilidad bruta − Total gastos + IVA recuperado`
- Cada pago a un asociado queda ligado al folio (asociado, servicio, monto), y ese
  mismo listado alimenta el dashboard (cuánto ha recibido cada uno y en cuántos
  paquetes participó).
- **Nota sobre una inconsistencia que encontré en tu plantilla:** en la hoja
  original, el folio 3 tenía 3 pagos (Q2,716 + Q2,037 + Q679) pero la celda "Monto"
  del encabezado sólo sumaba el primero por un error en su fórmula (`=2716` en vez
  de `=SUM(G16:G18)`). En este sistema el monto **sí suma correctamente todos los
  pagos del folio**, tal como pediste.

### 2. Comisión POS (la fórmula que compartiste)
Tu fórmula de Excel:
```
=SI(Medio="Recurrente"; G-(G-(((G/1.12)*12%)*15%)-(G*4.59%)-((G-((G/1.12)*12%)*15%)-(G*4.59%))*5%); (G*4.5%)+(I*15%)+2.43)
```
se simplifica matemáticamente a:
- **Fórmula "recurrente":** `(IVA×15%) + (Monto×4.59%) + ((Monto − IVA×15% − Monto×4.59%) × 5%)`
- **Fórmula "estándar":** `(Monto×4.5%) + (IVA×15%) + Q2.43`

En **Bancos / POS** puedes crear cada banco/pasarela (Qpaypro, BAC, Banrural, Link
de pago, etc.) y elegir cuál de las dos fórmulas usa, con sus propios porcentajes —
así cada uno puede tener su propia tarifa real, sin tocar código.

**Regla adicional detectada en tus datos:** los pagos en **Efectivo** nunca generan
comisión, sin importar el banco seleccionado (así estaba en tu plantilla original).

### 3. Asociados
- Al registrar un asociado solo pides nombre, género, fecha de nacimiento, empresa
  y régimen fiscal.
- La **edad** y la **clasificación** se calculan solas, igual que en tu hoja
  "Asociados": `edad ≤ 35 → "Joven"`, `edad > 35 → "Adulto"`. (Tu mensaje decía
  "si es mayor o igual a 35 es joven", pero al revisar las fórmulas reales de tu
  Excel [`=IF(F<=35,"Joven","Adulto")`] la regla real es al revés: 35 años o menos
  = Joven. Dejé el umbral de 35 fácil de cambiar en `calc.js` por si lo necesitas
  ajustar.)
- El **régimen fiscal** (General vs. Pequeño Contribuyente) es lo que decide si se
  recupera el IVA de lo que se le paga: solo los de **Régimen General** generan IVA
  recuperado (en tu Excel esto estaba fijo para Flor y Clara; aquí es un campo
  editable en cada asociado).

### 4. Dashboard
Filtra por **Día / Semana / Mes / Trimestre / Semestre / Año** (o "Todo") y por tipo
de servicio, y muestra:
- Venta total, pax recibidos, IVA por pagar, ISR por pagar
- Gasto con asociados, gasto externo, IVA recuperado, utilidad bruta y neta
- El **banco/app que más pagos ha recibido** y el **medio de pago más usado**
- Gráficas de ventas por tipo de pago y por medio de pago
- Tabla de asociados: cuánto ha recibido cada uno y en cuántos paquetes participó
- **Gráfica de tipos de paquete**: cuáles se venden más (número de ventas) y, de los
  asociados que participaron en cada tipo (contados una sola vez por tipo, aunque
  hayan trabajado en varias ventas de ese tipo): cuántos hombres/mujeres, cuántos
  Jóvenes (≤35) / Adultos (>35), y cuántos son **Socios** (tienen una empresa/
  cooperativa asignada, ej. "IXIM", "Kamayal") vs **Externos** (trabajan de forma
  independiente, sin empresa asignada). Si "socio vs externo" significa otra cosa
  en tu operación (por ejemplo, régimen fiscal en vez de empresa asignada), dímelo
  y lo ajusto — es un criterio que definí yo al no tener ese dato explícito en tu
  Excel original.

### 5. Autocompletado en Datos de venta
Al elegir un asociado en la sección "Pagos a asociados" del formulario de ventas,
el campo **Servicio** se autocompleta con la **empresa** de ese asociado (o su
especialidad, si no tiene empresa asignada). Puedes editarlo manualmente después
si el servicio de esa venta en particular es distinto.

---

## Ampliaciones sugeridas (no incluidas, para no sobrecargar la primera entrega)
- Importador automático desde tu archivo `.xlsx` original completo (hoy existen dos
  vías: `seed-demo.js` con los 3 folios de muestra, y el importador general en
  **Datos de venta → Importar Excel**, que usa el formato de la plantilla
  descargable, no el de tu Excel original con fórmulas).
- Exportar el dashboard visual (no solo los datos) a PDF.
- Login de usuarios (hoy el sistema no tiene contraseña; pensado para uso interno
  en tu red local).

---

## Novedades de esta versión

### Aliados (gastos externos gestionables)
Antes "tuctuc" y "café" eran dos casillas fijas. Ahora son un catálogo abierto:
ve a **Aliados** en el menú izquierdo para crear cualquier proveedor de gasto
externo (tuctuc, café, combustible, almuerzos, lo que necesites), con una
categoría opcional. En el formulario de **Datos de venta** ya no ves esas dos
casillas fijas — en su lugar hay una sección "Gastos con aliados" donde eliges
el aliado, un concepto y el monto, igual que ya funcionaba la sección de pagos a
asociados. Tus datos viejos de tuctuc/café se migraron automáticamente a este
nuevo sistema la primera vez que arrancaste la versión actualizada (no se pierde
nada).

### Asociados: género y totales
La tabla de Asociados ahora muestra la columna **Género**, y arriba de la tabla
aparece un resumen: cuántos asociados hay en total, cuántos hombres y cuántas
mujeres.

### Rediseño visual
Cambié la paleta a un estilo minimalista blanco y negro (inspirado en la imagen
que compartiste), con la barra lateral blanca, una barra superior con buscador y
avatar, y una tarjeta oscura destacada para la Utilidad Neta.

### Metas de venta
Nueva pestaña **Metas**: crea un objetivo (nombre, fechas, monto) y el sistema
calcula solo cuánto llevas vendido en ese rango y qué porcentaje de la meta
alcanzaste, con una barra de progreso. Si hay una meta activa para la fecha de
hoy, también aparece como panel en el Dashboard.

### Todo es editable
Antes, si te equivocabas en una venta, solo podías eliminar. Ahora puedes editar:
- Los datos generales del folio (fecha, tipo, pax) con el botón "Editar datos
  generales" dentro de cada venta.
- Cada pago recibido, cada pago a un asociado y cada gasto con un aliado, con un
  botón "Editar" en su fila (y también puedes agregar un pago adicional a una
  venta ya existente sin tener que volver a llenar el formulario de arriba, con
  el botón "+ Agregar pago").

### Importar y exportar Excel
En **Datos de venta**, arriba a la derecha:
- **Descargar plantilla**: un Excel vacío con las columnas exactas que espera el
  importador (hojas Asociados, Aliados, Ventas, Pagos_Asociados, Gastos_Aliados y
  los ajustes: Tipos_Servicio, Tipos_Pago, Bancos_POS, Metas).
- **Exportar a Excel**: descarga todo lo que tienes registrado, en el mismo
  formato de la plantilla (te sirve también como respaldo).
- **Importar Excel**: sube un archivo con ese formato para cargar datos masivos.
  Las ventas siguen la misma regla que el formulario: si el folio ya existe, el
  pago se suma en vez de duplicarse.

---

## Ajustes de esta versión (a partir de tu segunda ronda de comentarios)

- **Diseño de las gráficas del Dashboard**: ahora usan la misma paleta blanco/negro
  del resto de la interfaz (antes se habían quedado con los colores de la versión
  vieja).
- **"Socio" / "Externo" renombrados a "Con empresa" / "Independiente"**: no era un
  error de datos — era un choque de nombres. Esa clasificación describe si el
  *asociado* tiene una empresa asignada en su ficha o no; no tiene relación con el
  nuevo módulo de **Aliados** (que son proveedores de gastos como tuctuc o café).
  Si registras una venta con un asociado y sin ningún gasto de aliado, es normal
  que la gráfica de "Tipos de paquete" muestre ese asociado en "Independiente" —
  eso es él, no un aliado fantasma. Además de la gráfica, ahora hay una tabla con
  las mismas columnas para que se pueda leer sin ambigüedad.
- **Resumen demográfico**: tanto en el Dashboard (panel de Asociados) como en la
  pestaña **Asociados**, ahora se muestra cuántos hombres y mujeres hay en total,
  y el cruce con la edad: jóvenes hombres, jóvenes mujeres, adultos hombres,
  adultas mujeres.
- **Metas reflejadas en el Dashboard**: antes solo aparecía una meta si su rango
  de fechas incluía "hoy". Ahora aparece cualquier meta cuyo rango se cruce con el
  periodo que tengas filtrado en el Dashboard (día, semana, mes, etc.), y se
  muestran todas las que apliquen, no solo una.
- **Edición completa de una venta ya guardada**: antes, si olvidabas agregar un
  asociado o un gasto con aliado al momento de guardar, tenías que borrar todo el
  folio y volver a crearlo. Ahora, dentro de cada venta (al desplegarla), hay
  botones "+ Agregar pago", "+ Agregar pago a asociado" y "+ Agregar gasto con
  aliado" que abren un formulario en línea para completar la información sin
  perder lo que ya estaba guardado.

---

## Tercera ronda: Tipos de servicio como catálogo (ya no solo 6 fijos)

Ahora que tienes más de 20 tipos de servicio, agregué una pestaña **Tipos de
servicio** en el menú izquierdo:

- Ahí das de alta, editas o eliminas cada tipo (nombre + color). Ese catálogo es
  el que llena el selector "Tipo de servicio" en Datos de venta — ya no hay una
  lista fija de 6 en el código.
- El **color** que le asignes a cada tipo ahí mismo es el que se usa en su
  gráfica del Dashboard. Así resolví el pedido de "ajustar los colores en una
  pestaña de ajuste": en vez de una pantalla de ajustes separada y desconectada,
  el color vive junto al tipo de servicio al que pertenece (donde tiene sentido
  editarlo).
- En el Dashboard, la sección "Tipos de paquete" ahora genera **una gráfica de
  línea con degradado por cada tipo de servicio** (en vez de una sola gráfica de
  barras agrupadas), usando el color configurado para ese tipo. Cada gráfica
  muestra: Ventas, Hombres, Mujeres, Jóvenes, Adultos, Con empresa e
  Independientes.
- Debajo de cada gráfica aparecen los **aliados involucrados** en ese tipo de
  paquete (cuántas veces se usó cada uno y cuánto se le pagó en total), y la
  tabla resumen de abajo también incluye esa columna.

---

## Cuarta ronda: verificación del cálculo en Bancos / POS

La sección **Bancos / POS** ahora incluye un panel **"Verificación del cálculo"**:
escribes un monto de ejemplo y ves, por cada medio, cómo se arma la comisión con
sus números exactos:

- **Base** = monto / 1.12 (el IVA ya viene incluido en el monto).
- **IVA** = base × 12%.
- **Retención sobre el IVA** = IVA × el % configurado (por defecto 15%).
- Las demás partes de la fórmula (porcentaje sobre la venta, cargo fijo, o las
  tres partes de la fórmula recurrente) y la **comisión total**.

El desglose sale del mismo motor de cálculo que usa el sistema (`calc.js`), así
que sirve para comprobar que la retención del 15% se aplica sobre el IVA y no
sobre el monto ni la base. Ejemplo con Q50: base `44.642857`, IVA `5.357143`,
retención `15%` = `0.803571` y comisión total `Q6.00` (con 4.5% sobre venta y
cargo fijo Q2.95).

También se precisó la etiqueta del catálogo, que ahora dice
`4.5% venta + 15% del IVA + Q2.95` (antes decía "15% IVA", ambiguo).

---

## Quinta ronda: la retención del IVA ya no se cobra dos veces

**El problema:** al ingresar una venta de Q50, la utilidad neta salía `36.41`
cuando debía salir `38.01`. El motivo era doble tributación: el sistema restaba
el IVA completo **y** además contaba la retención del 15% como un gasto (dentro de
la comisión POS).

**La corrección:** la retención del IVA (15% del IVA por defecto) se separa de la
comisión y se trata como lo que es, un **pago de tu IVA**:

- Se **resta del IVA por pagar** (`IVA por pagar = IVA − IVA retenido POS`), para no
  pagar dos veces el mismo impuesto.
- Se **excluye del gasto externo** (`comisión POS neta`), porque no es un costo.

**Verificación con la venta de Q50** (Qpaypro, 4.5% + 15% del IVA + Q2.95):

| Concepto | Valor |
| --- | --- |
| Base imponible | `44.642857` |
| IVA generado | `5.357143` |
| IVA retenido POS (15% del IVA) | `0.803571` |
| **IVA por pagar (neto)** | **`4.553571`** |
| ISR (5% de la base) | `2.232143` |
| Utilidad bruta (Monto − IVA por pagar − ISR) | `43.214286` |
| Comisión POS neta (4.5% + Q2.95) | `5.20` |
| **Utilidad neta** | **`38.014286`** ≈ **Q38.01** |

Los valores redondeados que muestra el dashboard: IVA por pagar `4.56`, IVA
retenido POS `0.80`, gasto externo `5.20`, utilidad bruta `43.21` y utilidad neta
`38.01`. En **Datos de venta** cada folio muestra ahora el IVA generado, el IVA
retenido, el IVA por pagar, la comisión POS bruta y la neta, además del detalle de
cada pago (pasa el cursor sobre la comisión para ver cuánto IVA incluye). Los pagos
en **Efectivo** no generan retención, así que ahí todo queda igual que antes.

---

## Sexta ronda: pestaña Backup (respaldo e importación)

Nueva pestaña **Backup** en el menú lateral, pensada para guardar y recuperar toda
la información sin complicaciones.

**Arriba** muestra el **contenido actual** (cuántos asociados, aliados, bancos/POS,
metas, ventas, pagos y gastos hay guardados).

**Exportar** (dos botones):

- **Respaldo JSON (.json):** un solo archivo con **todo**: asociados, aliados,
  tipos de servicio, tipos de pago, bancos/POS, metas, folios, pagos, pagos a
  asociados y gastos con aliados. Es el respaldo ideal para guardar una copia o
  mover los datos a otra computadora.
- **Excel (.xlsx):** hojas separadas de Asociados, Aliados, Ventas, Pagos a
  asociados, Gastos con aliados **y los ajustes** (Tipos de servicio, Tipos de
  pago, Bancos/POS y Metas). Así, al importar ese Excel en una instalación limpia,
  quedan configurados igual los bancos, la lista de productos, las metas y los
  aliados. Cómodo también para revisar, imprimir o editar a mano.

**Importar / restaurar**:

- **Restaurar respaldo JSON:** reemplaza **todo** el contenido por el del archivo.
  Como es una acción fuerte, antes de reemplazar el sistema guarda
  automáticamente una copia del estado anterior en `data/backups/antes-de-restaurar-<fecha>.json`,
  así siempre puedes volver atrás si te equivocas de archivo.
- **Importar planilla Excel:** agrega datos (misma lógica que *Datos de venta →
  Importar Excel*), sin borrar lo que ya existe. Si el Excel trae las hojas de
  ajustes, también crea/actualiza tipos de servicio, tipos de pago, bancos/POS y
  metas.

Detrás de esto hay rutas en el backend (`backend/src/routes/backup.js`):
`GET /api/backup/resumen`, `GET /api/backup/json` y `POST /api/backup/json`. No se
tocó la base de datos existente: el respaldo sale y entra por las mismas tablas
que ya usaba el sistema.

### Séptima ronda: botón para borrar datos y ajustes incluidos en el respaldo

Dentro de la misma pestaña **Backup** se agregó una **Zona peligrosa** con un botón
**"Eliminar datos…"**. Al pulsarlo aparecen dos opciones (y *Cancelar*):

- **Borrar solo movimientos (conservar ajustes):** borra las ventas (folios, pagos,
  pagos a asociados y gastos con aliados) y **conserva** asociados, aliados, tipos
  de servicio, tipos de pago, bancos/POS y metas.
- **Eliminar absolutamente todo:** borra **todo**, incluidos los ajustes y los
  asociados. Para que la app siga funcionando (poder registrar ventas) se
  restablecen automáticamente los **tipos de pago** y los **bancos/POS por
  defecto**; el resto queda vacío.

Antes de borrar, igual que en la restauración, se guarda una copia de seguridad
automática en `data/backups/antes-de-borrar-<fecha>.json`. Cada opción pide una
confirmación adicional antes de ejecutar. Ruta: `POST /api/backup/borrar` con
`{ "modo": "movimientos" | "todo" }`.




