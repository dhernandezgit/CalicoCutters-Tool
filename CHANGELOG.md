# Changelog

## 0.6.0 — 2026-10-26

Curaduría del menú de creación y aclaración de cada tipo de herramienta.

### Menú final

- Se retiraron del selector **Set de cortadores**, **Multicortador** y los presets de
  Cerámica porque repetían variantes del mismo cortador o solo cambiaban ajustes.
- Los proyectos antiguos con esos modos siguen abriéndose por compatibilidad.
- Se aclararon nombres y descripciones: Cortador + sello, Cortador, Cortador con
  relieve, Sello de relieve, Cortador sándwich, Rodillo de textura, Topper para tarta,
  Plantilla stencil, Galleta de práctica, Molde cake pop y Pinza de página.
- Guía en el selector: elegir por resultado, no por variantes repetidas.

### Calidad

- 57 tests, typecheck y build.

## 0.5.1 — 2026-10-26

Corrección de geometría con ilustraciones multiparte y ajuste del dibujo por tipo.

### Correcciones

- Corregido el error `'MultiPolygon' object has no attribute 'exterior'` en el sellado del cortador de sándwich y en extrusión de geometrías multiparte.
- Los sellos individuales usan el tamaño completo del diseño; la holgura del cortador solo se aplica a Cortador + sello.
- El rodillo conserva los detalles interiores del dibujo además de la silueta.

### Calidad

- 57 tests, typecheck y build.

## 0.5.0 — 2026-10-26

Aplicación pulida: mockups de catálogo, SVG, flujo de revisión y ayuda de preparación.

### Salida y catálogo

- **SVG de contorno** para edición, corte o listings.
- **Mockup PNG 1200 × 1200** con marca, dimensiones, modo y acabado, generado localmente.
- Botones por diseño para STL, OBJ, SVG, 3MF, PDF y PNG.
- Formatos de lote STL / OBJ / SVG / 3MF / PDF / 3MF conjunto.

### Flujo y calidad

- Presets de tamaño recomendado de 3, 3,5 y 4 pulgadas.
- Consejos de imagen para siluetas limpias y detalles imprimibles.
- Revisión preflight con vistas superior, lateral e inferior y exportación directa.
- Checklist de primera impresión y prueba con masa fría.
- Vista inferior de la cámara y ayuda actualizada.

### Calidad

- 54 tests, typecheck y build de producción.

## 0.4.0 — 2026-10-26

Rodillo de textura avanzado, bandeja de cake pop y base para nuevas fases de paridad.

### Rodillo

- Patrones repetido, ladrillo y reflejado.
- Giro del origen 90°, margen vacío, inversión del patrón, grosor posterior y eliminación del borde exterior.
- Curvas de profundidad recta, chaflán y redondeada.
- Hasta 32 repeticiones por eje.

### Cake pop

- Bandeja de soporte opcional con rotación, profundidad, holgura, margen, longitud de apoyo y altura.
- Paso de palito independiente y geometría watertight.

### Calidad

- 54 tests, typecheck y build de producción.

## 0.3.0 — 2026-10-26

Paridad local: exportación PDF/OBJ, modo oscuro, buscador de ajustes y perfiles con
tamaño final y escena.

### Exportación

- PDF de contorno imprimible en A4, a escala 1:1 cuando cabe, con cotas y detalles.
- OBJ agrupado por piezas, conservando los desplazamientos de la vista previa.
- Selector de formato STL / OBJ / 3MF / PDF / 3MF conjunto y botones por diseño.

### Editor y perfiles

- Modo oscuro manual y siguiendo la preferencia del sistema.
- Buscador de ajustes por título y contenido de cada sección.
- Perfiles con opción de incluir el tamaño final y guardar la escena de vista previa.
- Textos de ayuda y descargas actualizados.

### Calidad

- 52 tests, comprobación de tipos y build de producción.

## 0.2.0 — 2026-10-26

Nueva visualización 3D de escena, superficies y materiales, multicortador de placa
compartida, pinza de página plana y perfiles de relieve decorativos.

### Visualización

- 14 superficies de color, mármol claro/oscuro, madera y color personalizado.
- Materiales de previsualización sólido, bicolor, degradado, glitter y seda.
- Escena de masa con galleta recortada, pieza suelta, regla y moneda de escala.
- Medidas 3D con líneas y etiquetas de ancho, fondo y alto.
- Centro de giro movible: clic en la pieza o en la masa; desplazamiento con botón derecho.

### Creación y decoración

- **Pinza de página plana**: dos placas rectangulares con tres bisagras vivas, pestaña
  de apertura, agarre y dibujo calado. Impresión tumbada, sin soportes ni montaje.
- **Multicortador** de placa compartida: varias copias comparten una base de presión
  con agujeros de desmolde, en lugar de cortadores sueltos.
- **Perfil del relieve del sello** recto, chaflán o redondeado, con engrosado de líneas.
- Forma del mango de presión redonda, redondeada o rectangular.
- Punto de alineación superficial en la cara inferior, sin atravesar la pieza.

### Calidad

- 52 tests automáticos, comprobación de tipos y build de producción.

## 0.1.1 — 2026-10-25

Corrección de la pinza de página, exportación sin ZIP y conservación de detalles.

### Correcciones

- La pinza de página sustituye al marcapáginas plano: agarra el papel por ambos lados,
  tiene ranura de entrada, guía superior, puente flexible y dibujo opcional.
- Los archivos de exportación ya no se empaquetan en ZIP. Se guardan uno a uno y el
  navegador propone la misma carpeta que el primer archivo; el proyecto se guarda allí.
- Cortador y sello se combinan en un único STL o 3MF.
- El preprocesado agresivo queda desactivado por defecto para conservar detalles finos.
- El punto de alineación es un hundido superficial, no un agujero pasante.
- Todos los tipos de creación están disponibles en Básico.

## 0.1.0 — 2026-10-25

Primera versión estable de CalicoCutters.

### Creación

- Stamper + cortador, cortador, impronta, multicortador, set de cortadores, sellos,
  sándwich, rodillo de textura, topper, stencil, galleta de práctica, molde cake pop,
  pinza de página y perfiles de arcilla.
- Pinza de página de una pieza que agarra el papel por ambos lados, con ranura,
  puente flexible y dibujo opcional.
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
- Cortador y sello combinados en el mismo STL o 3MF. El navegador propone la misma
  carpeta para el resto de archivos y para el proyecto, sin ZIP ni selector de carpeta.
- Peso y coste calculados con precio editable de PLA.

### Calidad

- 51 tests automáticos de geometría, modos, importación raster, exportación 3MF,
  alineación, pinza de página y comprobaciones de impresión.
- Despliegue automático en GitHub Pages mediante GitHub Actions.
