# Changelog

## 0.7.10 ? 2026-11-05

3MF de un solo objeto con varios colores y l?nea decorativa del cortador.

### 3MF / Bambu

- La marca de color y el punto se agrupan con su cuerpo dentro de un mismo
  objeto 3MF, usando componentes con materiales distintos. Bambu Studio recibe
  una sola pieza con varias partes de color en lugar de objetos sueltos.
- El dibujo delantero sigue en el color principal; el color secundario queda
  solo en la marca inferior y el punto.
- El punto conserva el hundido visible.

### Cortador

- Nueva opci?n **L?nea decorativa en el cortador**, desactivada por defecto.
- Hunde una l?nea exterior siguiendo el contorno del cortador, centrada en la
  cuchilla y con una banda de aproximadamente el 25 % de la altura.
- La profundidad se limita a una fracci?n del grosor de la cuchilla para no
  debilitar el filo.

### Calidad

- 85 tests, typecheck y build.

## 0.7.9 ? 2026-11-05

Color secundario solo en la parte inferior y punto visible.

### Marca trasera

- El color secundario afecta ?nicamente a la **marca de la cara inferior** y al
  **punto de orientaci?n**; el dibujo delantero conserva el color principal.
- La marca trasera se rellena con el color secundario en lugar de quedar como un
  hundido sin color.
- El punto de orientaci?n se mantiene como un hundido visible: el relleno
  secundario no llega a la superficie.
- Los objetos de color se separan en piezas cerradas para que el 3MF y la vista
  3D no mezclen colores ni generen geometr?a no estanca.
- El 3MF mantiene los dos materiales/extrusores para Bambu Studio.

### Calidad

- 83 tests, typecheck y build.

## 0.7.8 ? 2026-11-05

Marca trasera recuperada para ilustraciones muy detalladas.

### Marca trasera

- Los dibujos de l?nea con m?s de 24 trazos finos ya no pierden la marca
  trasera: se a?ade como una capa exterior elevada, sin operaciones de resta
  fr?giles.
- Con dos colores solo se rellenan la marca trasera y el punto de orientaci?n;
  el dibujo delantero conserva el color principal.
- El punto sigue siendo un hundido visible, aunque el relleno de color est?
  activo.
- La vista 3D conserva el color secundario de la marca y del punto.
- El 3MF incluye esos objetos en el segundo material/extrusor para Bambu Studio.
- El modo impronta sigue protegiendo su fondo rebajado.

### Calidad

- 83 tests, typecheck y build.

## 0.7.7 — 2026-11-05

Carga inicial instantánea, dibujos de línea finos y selector de unidades.

### Carga inicial

- El ejemplo **Corazón** se incluye ya analizado y con su geometría generada en
  el paquete web. Aparece en el visor desde el primer instante, mientras Pyodide
  termina de cargar en segundo plano.
- Se elimina el velo de “Cargando Python” cuando ya hay una geometría válida que
  mostrar.

### Dibujos de línea

- Los trazos finos de ilustraciones raster se engrosan automáticamente hasta una
  anchura imprimible (aprox. 2 líneas) cuando el dibujo se reduce a 60 mm.
- Los dibujos con decenas de trazos sub-milimétricos ya no bloquean la
  generación: la marca trasera se omite de forma controlada y se avisa, en vez
  de provocar un fallo de topología dentro de Pyodide.
- La cara delantera conserva el dibujo completo.

### Interfaz

- Los botones **mm** e **in** ocupan el mismo ancho en el selector de tamaño.
- Los dos segmentados de la fila de tamaño quedan alineados.

### Calidad

- 82 tests, typecheck y build.

## 0.7.6 — 2026-11-05

Relleno a dos colores para sellos e improntas.

### Dos colores

- Nueva opción **Rellenar dibujo, marca y punto en otro color**, desactivada por
  defecto.
- El dibujo delantero, la marca trasera y el punto de orientación se generan como
  piezas sólidas del color secundario.
- Selector de **color del relleno**; el color principal sigue siendo el del
  diseño.
- El 3MF incluye dos objetos/materiales y `Metadata/model_settings.config` con la
  asignación de extrusores para cargarlo en Bambu Studio.
- El relleno trasero ocupa un alojamiento en la pieza principal y queda enrasado;
  el punto de orientación también se rellena en el segundo color.
- En impronta invertida la opción se oculta para no debilitar el fondo rebajado.

### Calidad

- 81 tests, typecheck y build.

## 0.7.5 — 2026-11-05

Dibujo identificativo en la parte de atrás del sello y de la impronta.

### Sello e impronta

- Nueva opción **Marcar el dibujo en la parte de atrás**, activa por defecto.
- Graba un contorno fino del dibujo en la cara inferior del sello o de la base de
  impronta, usando la misma profundidad que el punto de orientación.
- El marcado es superficial: no atraviesa la pieza ni modifica la cara que marca
  la galleta.
- Se aplica a Sello de relieve, Cortador + sello, Cortador con relieve y al sello
  del cortador sándwich. En el modo espejo también se marca la versión espejada.
- La opción se puede desactivar en **Avanzado → Alineación**.

### Calidad

- 80 tests, typecheck y build.

## 0.7.4 — 2026-11-02

Rodillo de textura realmente cilíndrico y con bordes definidos.

### Rodillo de textura

- **Grabado continuo de verdad**: el modo invertido usa una sola manga
  cilíndrica elevada con el motivo recortado como huecos vectoriales. Ya no hay
  parches rectangulares por celda, ni huecos entre ellos, ni planos que rompan la
  silueta circular.
- **Bordes nítidos**: los contornos y detalles se recortan con geometría vectorial,
  no con una máscara de píxeles, por lo que el borde queda limpio y repetible.
- **Silueta circular estable**: la manga, el tubo y los bordes se subdividen de
  forma adaptativa; las zonas grandes se curvan sin multiplicar los detalles
  pequeños y sin perder la forma redonda.
- **Detalles interiores conservados** en silueta grabada, elevados desde el fondo
  del hueco.
- Mejor aprovechamiento de la celda (99 %) para que las repeticiones cierren sin
  dejar franjas vacías.
- El modo normal (relieve elevado) también usa subdivisión adaptativa para evitar
  facetas grandes en el contorno.

### Tamaños rápidos

- Cuatro presets por herramienta: **Mini**, **Estándar**, **Grande** y **Giga**.
  Galletas: 30, 44 (tipo Oreo), 75 y 100 mm. Rodillo, stencil, pinza, topper y
  cake pop tienen dimensiones equivalentes propias. Los campos numéricos siguen
  disponibles para ajustar cualquier medida.

### Vista 3D

- Sombreado con ángulo de corte: las superficies curvas se ven suaves y los
  bordes del rodillo, cortadores y relieves siguen definidos.

### Calidad

- 79 tests, typecheck y build.

## 0.7.3 — 2026-11-01

Revisión de herramientas que no son cortadores y correcciones del rodillo.

### Rodillo de textura

- **Eje 0 = cilindro sólido**, sin agujero mínimo oculto.
- El modo **Dibujo** incluye ahora el contorno exterior y los detalles interiores;
  antes se perdía el contorno.
- **Quitar borde exterior** disponible también en modo Dibujo.
- **Grabado invertido continuo**: la banda de fondo ya no queda cortada en islas
  rectangulares entre celdas.
- Se usa la **altura de borde** configurada, no un valor fijo.
- Mejor aprovechamiento de la celda (94 %) y detalles interiores conservados.
- En silueta grabada, los detalles interiores quedan como islas elevadas dentro del
  hueco en vez de perderse.

### Galleta de práctica

- Los huecos interiores del contorno se rellenan para que sea una superficie sólida
  de práctica, no un anillo.

### Revisión de otras herramientas

- Stencil: conserva contorno y detalles interiores con puentes.
- Sello de relieve: usa el tamaño completo del diseño y no la holgura del cortador.
- Topper, cake pop, bandeja, pinza de página y sándwich: geometría watertight y
  funciones propias verificadas.

### Calidad

- 79 tests, typecheck y build.

## 0.7.2 — 2026-10-27

Perfiles por defecto y detalles finos.

### Ajustes

- **Base rectangular por defecto**; el chaflán y el redondeado siguen disponibles.
- **Perfil del relieve recto por defecto** en sellos e improntas.
- Los perfiles redondeado/chaflán se aplican solo cuando el detalle tiene anchura
  suficiente; en líneas finas se mantiene el perfil recto y la altura completa para
  evitar picos y rebajes extraños.
- El perfil rectangular limita la mitra para no generar puntas en esquinas agudas.

### Calidad

- 77 tests, typecheck y build.

## 0.7.1 — 2026-10-27

Corrección del despliegue automático.

### Calidad

- Añadida `networkx` a las dependencias de test; `trimesh.split()` la necesita para
  comprobar las mallas multiparte en GitHub Actions.
- Tests, typecheck y build pasan en CI; Pages vuelve a desplegar.

## 0.7.0 — 2026-10-27

Ampliación de modos, relieves y previsualización; corrección del cortador + sello
y rediseño de la pinza de página.

### Creación y opciones

- **Unidades** mm/pulgadas para el tamaño del diseño.
- **Multicortador y set de cortadores** reactivados: barras, mango y cuchilla extra;
  set por tamaños o por formas separadas.
- **Impronta**: mango, barras, cuchilla extra, relieve elevado o hundido, solo bordes
  y margen de base.
- **Sello**: grip posterior, respaldo rectangular o contorneado, borde opcional y
  control de altura; en Cortador + sello el borde es bajo para no dejar aros altos.
- **Stencil**: modos cuadrícula, dimensiones y separación calculada; recorta el dibujo
  interior completo y mantiene los puentes.
- **Sándwich**: muescas redondas, triangulares o cuadradas, redondeo y banda hacia
  dentro o hacia fuera.
- **Cake pop**: prensador de una o dos piezas (cara + respaldo).
- **Rodillo**: escala del origen, altura de borde, motivo de dibujo o silueta y
  relieve redondeado por defecto.
- **Pinza de página**: dos placas tipo cake pop, base con dibujo hundido y pivote,
  prensa con dibujo en relieve, sin bisagra, bordes altos ni agujeros.
- **Cámara**: perspectiva o isométrica ortográfica y botón Vista más grande.

### Acabado y escena

- Escena de masa y galleta con formas orgánicas, bisel y **color de masa/galleta
  elegible**.
- Mejoras de estanqueidad, costuras del rodillo, detalles interiores y colocación
  de piezas que no caben anidadas.

### Calidad

- 75 tests, typecheck y build.

## 0.6.1 — 2026-10-26

Barra de vista central reorganizada y jerarquía visual del botón Vista.

### Interfaz

- Barra en tres zonas: cámara a la izquierda, **Vista** destacada en el centro y
  selección/aislamiento a la derecha.
- Botón Vista con color vino, mayor tamaño, sombra y apertura centrada del panel.
- Retirados los atajos duplicados de aristas/malla/centro; siguen disponibles en Vista.
- Comportamiento responsive: una fila en escritorio ancho y dos filas ordenadas en
  ventanas estrechas.

### Calidad

- 57 tests, typecheck y build.

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
