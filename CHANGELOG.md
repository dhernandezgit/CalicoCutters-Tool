# Changelog

## 0.1.0 — 2026-10-25

Primera versión estable de CalicoCutters.

### Creación

- Stamper + cortador, cortador, impronta, puzzle, set de cortadores, sellos,
  sándwich, rodillo de textura, topper, stencil, galleta de práctica, molde cake pop,
  marcapáginas y perfiles de arcilla.
- Creación de siluetas desde texto con tipografías del sistema, negrita, cursiva,
  mayúsculas, espaciado y unión de letras.
- Carga múltiple de SVG, PNG, JPG y WebP, con procesado secuencial.
- Todos los tipos de creación están disponibles también en el modo Básico, con los
  grupos plegados salvo Galletas por defecto.
- Preprocesado opcional de trazados: simplificación, redondeo, protección de detalles
  finos y eliminación de elementos minúsculos. Desactivado por defecto para no perder
  líneas finas.
- Sello con borde a ras del relieve, relieve negativo, par espejo y mangos en uno o
  ambos extremos.
- Punto de alineación de 1,8 mm activo por defecto.

### Visualización

- Visor 3D con cama de impresora a escala, cuadrícula de 1 cm y superficies pastel.
- Cama por defecto Bambu Lab P2S de 256 × 256 mm, más de 20 perfiles de impresora y
  dimensiones personalizadas.
- Mostrar u ocultar cama/cuadrícula, sombras, rayos X, giro automático, vista técnica,
  separación de piezas, captura PNG y pantalla completa.
- Acabados de impresión mate, satinado y brillante.

### Datos y exportación

- Proyecto `.calicocutters` importable, con formas, ajustes, nombres y colores.
- Perfiles de fabricación guardables en el navegador.
- Exportación individual, de seleccionados o de todos; STL, 3MF y 3MF conjunto.
- Guardado mediante selector de archivo; los lotes se empaquetan en un ZIP que incluye
  el proyecto por defecto, sin selector de carpeta.
- Peso y coste calculados con precio editable de PLA.

### Calidad

- 51 tests automáticos de geometría, modos, importación raster, exportación 3MF,
  alineación, marcapáginas y comprobaciones de impresión.
- Despliegue automático en GitHub Pages mediante GitHub Actions.
