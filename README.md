# CalicoCutters

**Convierte un SVG o una imagen en un cortador y un sello de galleta listos para imprimir en 3D.**

CalicoCutters es una aplicación local-first: el motor de geometría está escrito en **Python** y se ejecuta en el navegador con **Pyodide/WebAssembly**. No hay servidor, no se suben archivos y no hace falta cuenta.

- Web: `https://dhernandezgit.github.io/CalicoCutters-Tool/web/`
- Repo: `https://github.com/dhernandezgit/CalicoCutters-Tool`
- Formato de salida: **STL** y **3MF**, más el proyecto `.calicocutters` importable
- Modo por defecto: **Stamper + cortador** (2 piezas, sello dentro del cortador)

## Qué hace

- Carga uno o varios SVG, PNG, JPG y WebP; se procesan de uno en uno.
- Vectoriza dibujos de líneas y conserva los detalles interiores para el sello.
- Genera un cortador exterior con cuchilla, base y mango opcional (desactivado por defecto).
- Genera un sello coordinado con respaldo y relieve; en Stamper + cortador se muestra dentro del cortador.
- Menú agrupado por **Galletas, Sellos, Sándwich, Rodillo, Repostería y Cerámica**:
  Stamper + cortador, cortador, impronta, puzzle, set de tamaños, sello, sándwich,
  rodillo de textura, topper, stencil, galleta de práctica, molde cake pop y perfiles de arcilla.
- Vista previa 3D real, vista 2D, selección múltiple y vista de un solo archivo.
- Ajustes básicos rápidos y modo avanzado con impresión, base, barras, color, nombres y coste.
- Comprobaciones de impresión: agua estanco, grosor de pared, filo, holgura, separación entre copias y encaje en cama.
- Exporta STL y 3MF por archivo o por separado, sin ZIP obligatorio, además de un 3MF conjunto opcional.
- Guarda junto a cada exportación el proyecto `.calicocutters` completo, con formas, ajustes, nombres y colores.
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
- Todos los modos, incluyendo stencil, topper, cake pop, práctica y set de cortadores.
- Avisos de imprimibilidad y correcciones aplicables.
- Exportación STL y 3MF con objetos separados y colocación sin solapes.
- Importación de proyectos y normalización de ajustes.

## Impresión

- Perfil por defecto: FDM 0,4 mm, línea 0,40 mm.
- Cuchilla: 0,8 mm = 2 líneas.
- Altura de cuchilla: 12 mm.
- Base: 3,5 mm de alto × 4 mm de ancho.
- Sello: 5,5 mm de respaldo + 3 mm de relieve y 0,8 mm de holgura.
- Stencil: 1,5 mm de lámina y puentes de unión para islas interiores.
- Cake pop: molde con agujero de palito y prensador a juego.
- Cama: 256 × 256 mm.
- Sin soportes; base plana sobre la cama.

La app avisa si bajas de 2 líneas de pared, de una línea de filo, si una copia queda demasiado cerca de otra o si una pieza no cabe en la cama. El slicer sigue siendo la última comprobación.

## Despliegue

GitHub Actions ejecuta los tests, compila la web en `dist/` y publica la rama `gh-pages`.
La fuente de GitHub Pages debe ser **Deploy from a branch → gh-pages / (root)**.
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
