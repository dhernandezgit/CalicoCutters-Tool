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
- Modos Cortador, Sello, Impronta, Puzzle, Sándwich y Rodillo.
- Vista previa 3D real, vista 2D, selección múltiple y vista de un solo archivo.
- Ajustes básicos rápidos y modo avanzado con impresión, base, barras, color, nombres y coste.
- Comprobaciones de impresión: agua estanco, grosor de pared, filo, holgura y encaje en cama.
- Exporta STL y 3MF por archivo o por separado, sin ZIP obligatorio.
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
- Vectorización de dibujos de líneas.
- Extrusiones y loft watertight.
- Cortador + sello con dos piezas y alturas correctas.
- Avisos de imprimibilidad.
- Exportación STL y 3MF con objetos separados.
- El STL de referencia de Cookiecad como fixture de comparación.

## Impresión

- Perfil por defecto: FDM 0,4 mm, línea 0,40 mm.
- Cuchilla: 0,8 mm = 2 líneas.
- Altura de cuchilla: 12 mm.
- Base: 3,5 mm de alto × 4 mm de ancho.
- Sello: 5,5 mm de respaldo + 3 mm de relieve y 0,8 mm de holgura.
- Cama: 256 × 256 mm.
- Sin soportes; base plana sobre la cama.

La app avisa si bajas de 2 líneas de pared o de una línea de filo. El slicer sigue siendo la última comprobación.

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
