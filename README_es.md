# CI Sound Balancing Tool

Esta herramienta sirve a los portadores de implantes cocleares para medir el volumen y la tonalidad percibidos.
- Sobre la base de los resultados de la medición, pueden reproducirse archivos de audio con un ajuste simulado.
- En cuanto suene bien para usted, puede imprimir un resumen de los cambios deseados para su audiólogo.

Encontrará la herramienta aquí, funciona en línea en el navegador: [CI Sound Balancing Tool](https://mviereck.github.io/ci-sound-balancing/)

También puede utilizar la herramienta sin conexión. [Descargar como archivo ZIP](https://github.com/mviereck/ci-sound-balancing/archive/refs/heads/main.zip). Después de descomprimir, la herramienta se abre en el navegador haciendo doble clic en *index.html*.

La herramienta es compatible con dispositivos de los tres grandes fabricantes: MED-EL, Cochlear y Advanced Bionics.

## Contexto

El objetivo es que todos los electrodos suenen igualmente fuertes ("loudness balancing"), y que las tonalidades a izquierda y derecha se perciban igualmente agudas o graves.

Este equilibrado del volumen de los electrodos (por IC) y de la tonalidad (izquierda/derecha) es la base de una escucha agradable y lo más natural posible.

Los audiólogos normalmente no disponen del tiempo suficiente para realizar estas mediciones con el rigor necesario. Aquí es donde ayuda esta herramienta: usted puede realizar las mediciones por su cuenta en casa, sin presión de tiempo.

A partir de los datos que usted mismo ha medido, el reproductor de audio integrado puede reproducir un ajuste simulado. Así puede valorar de antemano qué le suena mejor.

Además del puro equilibrado de volumen y tonalidad, puede realizar ajustes semiautomáticos para mejorar la comprensión del habla, o por ejemplo realzar graves o agudos. Puede oír el efecto de sus ajustes en vivo si simultáneamente reproduce música o un audiolibro en el reproductor.

Cuando finalmente haya encontrado un ajuste que le parezca bien, puede imprimir los cambios necesarios y entregárselos a su audiólogo.

## Limitación

La herramienta trabaja exclusivamente con señales acústicas. Las señales acústicas también pueden activar electrodos vecinos. Esto hace que la medición sea algo imprecisa. Lo ideal sería una estimulación directa de cada electrodo, pero esa posibilidad queda reservada al audiólogo.

## Recomendación importante: programa de prueba sin filtros

Para que pueda valorar el volumen de cada electrodo lo más fielmente posible, todos los filtros automáticos de procesamiento del sonido en el procesador del IC deberían estar desactivados. Pídale a su audiólogo que le configure un programa de prueba adicional.

Puede usar la siguiente frase (los términos se aplican a MED-EL/MAESTRO; en Cochlear y Advanced Bionics existen filtros equivalentes con otros nombres — el audiólogo sabrá a qué se refiere):

>«Por favor, configúreme en una posición de programa libre un MAP de prueba en el que todos los filtros ASM estén desactivados:
>
>- Microphone Directionality: Omni
>- Adaptive Intelligence: Off
>- Wind Noise Reduction: Off
>- Ambient Noise Reduction: Off
>- Transient Noise Reduction: Off
>
>Compression Ratio y los demás parámetros del map, déjelos sin cambios. Este MAP lo necesito solamente para una medición de volumen en casa.»

### Además: solicitar al audiólogo los datos de su MAP

En la pestaña *Implante* puede introducir numerosos valores técnicos sobre su IC. La herramienta también funciona sin estos valores; con ellos, no obstante, los resultados y las recomendaciones para el audiólogo son más precisos. Usted no puede encontrar estos valores por sí mismo, sino que tiene que pedírselos a su audiólogo.

La siguiente frase puede ayudar:

>«Por favor, imprímame un fitting report (todos los parámetros del map) de mi MAP actual. Necesito los valores para una medición de volumen en casa con el CI Sound Balancing Tool.»

En caso de que pregunten qué valores se necesitan concretamente:

>- Modelo del implante y modelo del procesador de audio
>- Estrategia de codificación y tasa de estimulación
>- FAT (Frequency Allocation Table): frecuencia central en Hz por electrodo
>- THR (T-Level) por electrodo
>- MCL por electrodo
>- MED-EL: MCL en qu
>- Cochlear: C-Level en CL
>- Advanced Bionics: M-Level en CU
>- Estado de cada electrodo (activo / desactivado)
>- MED-EL adicionalmente: MAPLAW c-value
>- Cochlear adicionalmente: IIDR (Instantaneous Input Dynamic Range, en dB)
>- Advanced Bionics adicionalmente: IDR (Input Dynamic Range, en dB)


## Procedimiento:
### Equilibrar el volumen
#### En la pestaña *Implante*:
Datos técnicos básicos sobre su IC.

- Seleccione arriba el lado *IZQUIERDA/DERECHA* en el que lleva el IC.
- Indique al menos el fabricante de su IC; si lo conoce, también el modelo, etc.
- Marque los electrodos desactivados en *ESTADO* como *DESACTIVADO*.
- Pruebe el sonido de cada electrodo. Marque los electrodos llamativos, p. ej. con ruido fuerte, en *ESTADO*.
- Lo ideal es introducir también todos los demás datos y valores que conozca. Puede preguntar estos valores a su audiólogo. También puede usar la herramienta sin estos valores.
- Indique también los datos para el otro oído. Si en ese lado no lleva IC, indique según el caso *oído normal*, *hipoacúsico* o *sordo*.

#### En la pestaña *Medición*
Comparación del volumen de los electrodos.
- Para el lado o los lados con IC, realice primero únicamente la medición *Volumen de los electrodos*.
- En esta medición, todos los electrodos se comparan por pares y usted ajusta el volumen hasta que ambos lados se perciban igualmente fuertes.
- Use a ser posible streaming Bluetooth.
- Ajuste el volumen a unas 3/4 partes percibidas: ni bajo, ni desagradablemente fuerte.
- Control de los tests:
  - Ajuste el volumen con las *teclas de flecha*.
  - Vuelva a reproducir el sonido con la *barra espaciadora*.
  - Una vez que los sonidos suenen igualmente fuertes, confirme con *Intro*.
  - Opcional: seleccionar otro sonido de prueba.
- Procedimiento recomendado:
  - Primero el modo de test *Completo*.
  - Después el modo de test *Convergencia*, las veces que quiera.
  - Opcional: activar *Ajuste fino* y volver a ejecutar *Convergencia*.
- Cada test puede interrumpirse en cualquier momento y reanudarse más tarde en el mismo punto.
- Cada test puede repetirse cuantas veces sea necesario para afinar los resultados.
- Las mediciones *Balance estéreo* y *Coincidencia de frecuencias* déjelas para más adelante.

#### En la pestaña *Resultados*
Visualización del ajuste calculado según sus mediciones.

- En la sub-pestaña *Volumen de los electrodos* verá los cambios recomendados por electrodo presentados en un gráfico.
- Los colores de las barras por electrodo indican lo fiable que es el resultado de la medición:
  - *rojo*: resultado incierto, grandes desviaciones entre las mediciones
  - *amarillo*: resultado utilizable, correcto, ok
  - *verde*: muy buen resultado, fiable
- El valor *Residual* indica la fiabilidad de la medición como valor matemático. Un *Residual* < 1 es muy bueno y se muestra en *verde*. Esto significa que la desviación entre las mediciones es inferior a 1 decibelio.

#### En la pestaña *Player*
Reproduzca un archivo de audio para simular el efecto de sus mediciones.
- El ecualizador incorporado modifica el sonido aproximadamente como sonaría si el audiólogo reajustase su IC según sus mediciones.
- Con el equilibrado del volumen de los electrodos de su IC ya ha creado una base valiosa. Muchas cosas deberían sonar ya más claras que antes.
- Active y desactive el botón *Medición* varias veces para oír la diferencia.

#### En la pestaña *Curvas*

En la pestaña *Curvas* puede modificar el volumen de todos los electrodos en conjunto siguiendo una curva. Hay varias curvas a su disposición.

Recomendaciones:
- Deje sonando un archivo de audio en el *Player*. Use un audiolibro.
- Active *Habla*. Cambie el ajuste con las *teclas de flecha arriba/abajo* y oiga en vivo cómo afecta el cambio a su comprensión del habla.
- Desactive *Habla* y active *Seno*. Deje sonando música en el *Player*. Cambie el valor con las *teclas de flecha arriba/abajo* y oiga en vivo cómo cambian agudos y graves.
- Desactive *Seno* y pruebe también otras curvas.
- Encuentre una curva o una combinación de curvas que le convenza.
- Vaya a la pestaña *Player*, reproduzca algo, y active y desactive el botón *Curvas* varias veces para oír la diferencia.

#### En la pestaña *Cargar/Guardar*
- Guarde sus datos de medición y sus ajustes.

## Para su audiólogo
Impresiones para su audiólogo con los cambios deseados.

- Configure todo en el *Player* tal como desea oír.
  - Tenga en cuenta también el ajuste *IZQUIERDA/DERECHA* así como la casilla *Ambos lados*.
- Vaya a la pestaña *Cargar/Guardar* y pulse *Imprimir*.
- Ajuste el reproductor de modo que solo se aplique el equilibrado del volumen (botón *Medido*). Desactive los botones *Curvas* y *Deslizadores*. Imprima también eso como petición de ajuste para su futuro programa de prueba.
- Lleve las impresiones a su próxima cita con el audiólogo.

### Recomendación para una nueva asignación de programas
- Conserve sin cambios el programa que ya conoce y utiliza en el día a día.
- Asigne una posición de programa como programa de prueba con los electrodos exactamente al mismo volumen y sin filtros. Esta será su base para futuras mediciones y experimentos.
- Asigne una o dos posiciones de programa con los ajustes que usted desee, determinados con la herramienta.

### Limitación
Si en la herramienta ha introducido los valores *MCL* de los electrodos, la herramienta calcula — además de la diferencia en decibelios (dB) — también una diferencia en la unidad del programa del audiólogo. Esto aparece en la impresión. Estos valores calculados aún no han sido verificados en cuanto a su fiabilidad. Además, el oído como órgano puede reaccionar a los ajustes de manera algo distinta a lo que un cálculo puede predecir.

## Otras posibilidades

### *Medición* → *Balance estéreo*
Permite el equilibrado del volumen entre izquierda y derecha.
- (Documentación adicional pendiente.)

### *Medición* → *Coincidencia de frecuencias*
Medición de las diferencias de tonalidad entre izquierda y derecha.
- (Documentación adicional pendiente.)
- (En el *Player* puede reproducirse una simulación de tonalidades modificadas, aunque la calidad de la simulación es todavía modesta.)

### Pestaña *Deslizadores*
Permite la modificación manual del volumen de cada electrodo.
- (Documentación adicional pendiente.)

