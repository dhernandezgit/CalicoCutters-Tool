# CalicoCutters

**Versión 0.6.1** · Convierte un SVG o una imagen en un cortador y un sello de galleta listos para imprimir en 3D.

CalicoCutters es una aplicación local-first: el motor de geometría está escrito en **Python** y se ejecuta en el navegador con **Pyodide/WebAssembly**. No hay servidor, no se suben archivos y no hace falta cuenta.

- Web: `https://dhernandezgit.github.io/CalicoCutters-Tool/web/`
- Repo: `https://github.com/dhernandezgit/CalicoCutters-Tool`
- Formatos de salida: **STL**, **OBJ**, **SVG**, **3MF**, **PDF de contorno** y **mockup PNG**, más el proyecto `.calicocutters` importable
- Modo por defecto: **Cortador + sello** (2 piezas, sello dentro del cortador)

## Qué hace

- Carga uno o varios SVG, PNG, JPG y WebP; se procesan de uno en uno.
- Crea siluetas desde texto con tipografía, espaciado, mayúsculas y unión por la base.
- Vectoriza dibujos de líneas y conserva los detalles interiores para el sello.
- Genera un cortador exterior con cuchilla, base y mango opcional (desactivado por defecto).
- Genera un sello coordinado con respaldo y relieve; en Cortador + sello se muestra dentro del cortador.
- Relieve positivo, relieve negativo hundido, borde a ras del dibujo, par espejo y mangos en uno o ambos extremos.
- Menú agrupado y plegable por **Galletas, Lotes, Sellos, Sándwich, Rodillo, Repostería y Papelería**:
  Cortador + sello, cortador, cortador con relieve, multicortador, set de cortadores, sello,
  sándwich (cortador y/o sellador), rodillo de textura, topper, stencil, galleta de práctica,
  molde cake pop y pinza de página.
  Todos los tipos están disponibles también en Básico.
- **Pinza de página**: dos placas planas tipo cake pop. La base lleva el dibujo hundido y un pivote central; la prensa lleva el dibujo en relieve y el pivote a juego. Sin bisagra, sin bordes altos y sin agujeros; ambas caras exteriores llevan un bajorrelieve decorativo.
- **Visualización 3D tipo CookieCAD V8**: 14 superficies de color, mármol, madera o color propio; materiales sólido, bicolor, degradado, glitter y seda; masa, galleta suelta, regla y moneda.
- **Cámara en perspectiva o isométrica** desde la barra del visor, con botón **Vista** grande para abrir el panel de escena, materiales y cámara.
- **Centro de giro movible**: haz clic en cualquier punto del modelo o de la masa para orbitar alrededor de ese punto; también puedes desplazar con el botón derecho.
- **Medidas 3D** con líneas y cotas de ancho, fondo y alto.
- **Unidades**: selector mm/pulgadas para el tamaño del diseño.
- **Modo oscuro** manual; la app arranca en claro por defecto.
- **Buscador de ajustes** por nombre y contenido de cada sección.
- **Flujo guiado**: presets de 3–4 pulgadas, consejos de imagen, revisión superior/lateral/inferior y checklist de primera impresión.
- **Mockup PNG** para catálogo o redes y **SVG** de contorno para edición o listings.
- **Rodillo de textura avanzado**: patrones repetido, ladrillo y reflejado, con cierre automático de la costura; motivo de dibujo (contorno + detalles, como un sello) o silueta rellena; escala del origen, giro, margen, inversión, grosor posterior, borde exterior con altura y curvas redondeadas por defecto. El dibujo se subdivide antes de envolverlo para que la forma se vea completa y sin facetas grandes.
- **Multicortador y set de cortadores**: multicortador con barras, mango y cuchilla extra; set por tamaños o por formas separadas.
- **Impronta**: mango, barras, cuchilla extra, relieve elevado o hundido, solo bordes y margen de base.
- **Sello**: grip posterior, respaldo rectangular o contorneado, relieve negativo y borde perimetral.
- **Cortador sándwich**: cortador con banda de sellado integrada y sello central separado (o solo una de las piezas), con muescas redondas, triangulares o cuadradas, redondeo y banda hacia dentro o hacia fuera.
- **Topper para tarta**: relieve con curva recta, chaflán o redondeada y pin estrechado para clavar con facilidad.
- **Molde cake pop**: prensador con cara de relieve, solo contorno o lisa, además de molde, bandeja y palito.
- **Bandeja de cake pop** opcional: hueco girado y dimensionable, holgura, margen, longitud de apoyo y altura.
- Perfiles guardables de fabricación y preprocesado; opción de incluir el tamaño final y la escena de la vista previa.
- Vista previa 3D real, vista 2D, selección múltiple y vista de un solo archivo.
- Ajustes básicos rápidos y modo avanzado con impresión, base, barras, color, nombres y coste.
- **Perfil del relieve del sello** (recto, chaflán o redondeado) y engrosado de líneas finas para decorar sin perder detalle.
- **Forma del mango de presión**: redonda, redondeada o rectangular.
- Comprobaciones de impresión: agua estanco, grosor de pared, filo, holgura, separación entre copias y encaje en cama.
- Exporta STL, OBJ y 3MF de forma individual, de los seleccionados o de todos; incluye SVG y PDF de contorno y un mockup PNG por diseño. Cortador y sello van juntos en el mismo archivo.
- Se pide una ubicación por archivo y el navegador propone la misma carpeta que el primer archivo; el proyecto `.calicocutters` se guarda también allí. También hay 3MF conjunto.
- Base 3D con cama realista (256 × 256 de Bambu Lab P2S por defecto), cuadrícula de 1 cm, muchos perfiles de impresora y dimensiones personalizadas.
- Preprocesado avanzado: simplificado, suavizado, protección de esquinas y eliminación de detalles minúsculos.
- Punto de alineación superficial opcional (activo por defecto) en la cara inferior del cortador y del sello, sin agujero pasante.
- El botón **Importar** recupera el proyecto en otro PC sin instalar nada.
- Peso y coste estimado con precio editable del PLA (14 €/kg por defecto).

## Por qué Python

Toda la geometría vive en el paquete `calicocutters/`:

- `shape.py`: parseo SVG, transformaciones, trazado raster y normalización.
- `mesh.py`: extrusión, loft de anillos, triangulación con earcut, STL y 3MF.
- `engine.py`: cortador, sello, impronta, comprobaciones y disposición.
- `webapi.py`: puente JSON que usa el worker de Pyodide.

El frontend React solo se encarga de la interfaz y de mostrar los STL que devuelve Python.

## Desarrollo

Requisitos: Node 22+, Python 3.12+.

```bash
python -m pip install -r requirements-dev.txt
npm install
python scripts/build_python_zip.py
npm run dev
```

Abre `http://127.0.0.1:5173/`.

### Tests

```bash
python -m pytest -q
npm run build
```

Los tests comprueban:

- Parseo y normalización de SVG, huecos y transforms.
- Vectorización de dibujos de líneas, PNG transparente y arte coloreado sobre blanco.
- Extrusiones y loft watertight.
- Todos los modos actuales y compatibilidad de lectura con modos antiguos.
- Avisos de imprimibilidad y correcciones aplicables.
- Exportación STL y 3MF con objetos separados y colocación sin solapes.
- Importación de proyectos y normalización de ajustes.

## Impresión

- Perfil por defecto: FDM 0,4 mm, línea 0,40 mm.
- Cuchilla: 0,8 mm = 2 líneas.
- Altura de cuchilla: 12 mm.
- Base: 3,5 mm de alto × 4 mm de ancho.
- Sello: 5,5 mm de respaldo + 3 mm de relieve y 0,8 mm de holgura. El borde, si está activo, queda a la misma altura que el relieve; sin borde, la zona exterior queda a la altura de la base.
- Punto de alineación superficial de 1,8 mm en la cara inferior del cortador y del sello (activo por defecto); no atraviesa la pieza.
- Pinza de página: dos placas planas de 50 × 150 × 2,4 mm; base con dibujo hundido y pivote, prensa con dibujo en relieve y pivote; sin bisagra, bordes altos ni agujeros. Se imprime plana, sin soportes; usa PETG o PP para muchas aperturas.
- Stencil: 1,5 mm de lámina, una forma a tamaño completo o patrón repetido. Modos de cuadrícula, dimensiones y separación calculada; si el dibujo tiene detalles interiores, recorta el dibujo completo.
- Cake pop: molde con agujero de palito, prensador de una o dos piezas (cara + respaldo) con relieve, contorno o liso, y bandeja de soporte opcional.
- Cama: 256 × 256 mm.
- Sin soportes; base plana sobre la cama.

La app avisa si bajas de 2 líneas de pared, de una línea de filo, si una copia queda demasiado cerca de otra o si una pieza no cabe en la cama. El slicer sigue siendo la última comprobación.

## Despliegue

GitHub Actions ejecuta los tests, compila la web en `dist/` y la publica con **GitHub Pages → Source: GitHub Actions**.
La app queda en `https://dhernandezgit.github.io/CalicoCutters-Tool/web/`.

## Bambu Studio

El 3MF se descarga y se abre con doble clic o arrastrándolo a Bambu Studio. Bambu mantiene el cortador y el sello como objetos separados.

No hay botón de apertura directa: Bambu Studio bloquea las URLs de dominios de terceros, así que CalicoCutters no promete una integración que no funciona. Descarga el 3MF, ábrelo y lamina desde Bambu Studio.

## Créditos y licencias

- Código: MIT.
- Inspiración visual y de producto: CryCat Tool, BakePress y Cookiecad. No se han copiado assets ni código propietario.
- `svg.path`: MIT, vendorizado en `calicocutters/vendor/svg/path`.
- `earcut` (port de Python): ISC, vendorizado en `calicocutters/vendor/earcut.py`.
- Pyodide, NumPy, Pillow, Shapely, OpenCV, SciPy y React/Three.js conservan sus licencias.

Hecho con cariño para que una idea se convierta en galletas.
