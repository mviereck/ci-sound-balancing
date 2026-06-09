# CImbel - CI Sound Balancing Tool

<img src="assets/images/CImbel_logo.png" alt="CImbel — CI sound balancing" width="200">

Esta herramienta está pensada para portadores de implante coclear para medir las intensidades sonoras y las alturas tonales que perciben.
- Sobre la base de los resultados de medición se pueden reproducir archivos de audio con una adaptación simulada.
- En cuanto eso le suene bien, puede imprimir un resumen de los cambios deseados para su audiólogo.

Encontrará la herramienta aquí, funciona en línea en el navegador: [CI Sound Balancing Tool](https://mviereck.github.io/ci-sound-balancing/)

También puede utilizar la herramienta sin conexión. [Descargar como archivo ZIP](https://github.com/mviereck/ci-sound-balancing/archive/refs/heads/main.zip). Tras descomprimirlo, la herramienta se abre en el navegador con un doble clic sobre *index.html*.

La herramienta es compatible con dispositivos de los tres grandes fabricantes: MED-EL, Cochlear y Advanced Bionics.

## Contexto

El objetivo es que todos los electrodos suenen igual de fuertes («loudness balancing») y que las alturas tonales izquierda y derecha se perciban iguales de agudas o graves.

Este equilibrado de la sonoridad de los electrodos (por cada IC) y de las alturas tonales (izquierda/derecha) es la base para una audición agradable y lo más natural posible.

Los audiólogos por lo general no disponen de tiempo suficiente para realizar estas mediciones con la minuciosidad necesaria. Ahí ayuda esta herramienta: puede realizar las mediciones usted mismo en casa, sin ninguna presión de tiempo.

Sobre la base de estos datos de medición obtenidos por usted mismo, en el reproductor de audio integrado puede reproducirse una adaptación simulada. Así puede valorar de antemano qué le suena mejor.

Además del mero equilibrado de sonoridad y altura tonal, puede realizar ajustes semiautomáticos para mejorar la comprensión del habla o, por ejemplo, realzar graves o agudos. Puede oír el efecto de sus ajustes en directo si reproduce simultáneamente música o un audiolibro en el reproductor de audio.

Cuando finalmente haya encontrado un ajuste que le parezca bueno, puede imprimir los cambios necesarios para ello y entregárselos a su audiólogo.

## Limitación

La herramienta trabaja exclusivamente con señales acústicas. Las señales acústicas pueden activar también electrodos vecinos. Eso hace que la medición sea hasta cierto punto imprecisa. Lo ideal sería una estimulación directa de cada electrodo, pero esa posibilidad está reservada al audiólogo.

## Recomendación importante: programa de prueba sin filtros

Para que pueda valorar la sonoridad de cada electrodo de la forma menos distorsionada posible, todos los filtros automáticos de procesamiento de sonido del procesador del IC deben estar desactivados. Pida a su audiólogo que le configure para ello un programa de prueba adicional.

Puede utilizar para ello la siguiente frase (los términos corresponden a MED-EL/MAESTRO; en Cochlear y Advanced Bionics existen los filtros correspondientes con otros nombres, el audiólogo sabe a qué se refieren):

>«Por favor, configúreme en una posición de programa libre una MAP de prueba en la que todos los filtros ASM estén desactivados:
>
>- Microphone Directionality: Omni
>- Adaptive Intelligence: Off
>- Wind Noise Reduction: Off
>- Ambient Noise Reduction: Off
>- Transient Noise Reduction: Off
>
>Compression Ratio y los demás parámetros del MAP por favor déjelos sin cambios. Esta MAP solo la necesito para una medición de sonoridad en casa.»

### Adicionalmente: solicite al audiólogo los datos de su MAP

En la pestaña Implante puede introducir numerosos valores técnicos de su IC. La herramienta también funciona sin estos valores; con ellos, los resultados y las recomendaciones para el audiólogo se vuelven más precisos. Estos valores no los encontrará usted mismo, debe solicitárselos al audiólogo.

La siguiente frase ayuda:

>«Por favor, imprímame un informe de fitting (todos los parámetros del MAP) de mi MAP actual. Necesito los valores para una medición de sonoridad en casa con el CI Sound Balancing Tool.»

Si surgen preguntas sobre qué valores concretos se refieren:

>- Modelo de implante y modelo de procesador de audio
>- Estrategia de codificación y tasa de estimulación
>- FAT (Frequency Allocation Table): frecuencia central por electrodo en Hz
>- THR (T-Level) por electrodo
>- MCL por electrodo
>- MED-EL: MCL en qu
>- Cochlear: C-Level en CL
>- Advanced Bionics: M-Level en CU
>- Estado de cada electrodo (activo / desactivado)
>- MED-EL adicionalmente: valor c de MAPLAW
>- Cochlear adicionalmente: IIDR (Instantaneous Input Dynamic Range, en dB)
>- Advanced Bionics adicionalmente: IDR (Input Dynamic Range, en dB)


## Procedimiento:
### Equilibrar el volumen
#### En la pestaña *Implante*:
Datos técnicos básicos sobre su IC.

- Seleccione arriba el lado *IZQUIERDA/DERECHA* en el que lleva el IC.
- Introduzca al menos su fabricante de IC; si lo conoce, también modelo, etc.
- Marque los electrodos desactivados en *ACTIVO* como *DESACTIVADO* (quite la marca).
- Pruebe el tono de cada electrodo. Marque en *ESTADO* los electrodos llamativos, p. ej. con ruido fuerte.
- Idealmente introduzca también todos los demás datos y valores que conozca, si los conoce. Puede solicitar los valores a su audiólogo. Pero también puede usar la herramienta sin estos valores.
- Realice todos los datos también para el otro oído. Indique también, en su caso, *audición normal*, *hipoacúsico* o *sordo* si en ese lado no lleva IC.

#### En la pestaña *Mediciones* -> *Volumen de electrodos*
Comparación del volumen de los electrodos.
- Para el lado o lados con IC realice de momento solo la medición *Volumen de electrodos*.
- En esta medición se comparan todos los electrodos por pares entre sí, y usted ajusta el volumen hasta que ambos electrodos suenen igual de fuertes.
- A ser posible, utilice Bluetooth para el streaming.
- Ajuste el volumen de su ordenador (o smartphone) a una sensación de 3/4, ni bajo ni todavía incómodamente alto.
- Control de las pruebas:
  - Ajuste el volumen con las *teclas de flecha*.
  - Con la *barra espaciadora*, reproducir el tono de nuevo.
  - En cuanto los tonos suenen igual de fuertes, confirme con *Enter*.
  - Opcional: seleccionar otro tono para probar.
    - Nota: hay varios tonos disponibles.
      - El seno es el estándar; el complejo también es muy bueno.
      - El ruido de banda estrecha puede llevar a desviaciones sorprendentemente grandes en la medición.
        Use este tono al principio solo de forma experimental, o como una serie de pruebas independiente de una medición con tono senoidal.
- Procedimiento recomendado:
  - Primero el procedimiento *Completo*.
  - Después el procedimiento *Convergencia*, idealmente varias veces.
  - Bajo el deslizador se muestra una marca con el valor estimado calculado y un rango de imprecisión. No es algo en lo que se pueda confiar plenamente, pero puede ofrecer una orientación.
- Cada prueba puede interrumpirse en cualquier momento y continuarse más tarde en el mismo punto.
- Cada prueba puede repetirse cuantas veces se desee, para afinar los resultados.
- Las mediciones *Balance estéreo* y *Ajuste de frecuencia* déjelas de momento de lado.

#### En la pestaña *Resultados de medición* -> *Volumen de electrodos*
Visualización del ajuste calculado según sus mediciones.

- En la subpestaña *Volumen de electrodos* ve los cambios recomendados por electrodo representados en un gráfico.
- Los colores de las barras por electrodo indican qué tan segura es la valoración del resultado de la medición:
  - *rojo*: resultado incierto, grandes desviaciones en las mediciones
  - *amarillo*: resultado utilizable, bueno, ok
  - *verde*: resultado muy bueno, fiable
- El valor *Residuo* muestra la fiabilidad de la medición como valor matemático. Un *Residuo* <1 es muy bueno y se muestra en *verde*. Es decir, la desviación de las mediciones está por debajo de 1 decibelio.

#### En la pestaña *Reproductor*
Reproduzca un archivo de audio para simular el efecto de sus mediciones.
- El ecualizador incorporado modifica el sonido aproximadamente como sonaría si el audiólogo reajustara su IC según sus mediciones.
- Con el equilibrado del volumen de los electrodos de su IC ha creado una base valiosa. Con ello, ya debería sonar todo bastante más claro que antes.
- Encienda y apague el botón *Mediciones* varias veces para oír la diferencia.

#### En la pestaña *Curvas*

En la pestaña *Curvas* puede modificar el volumen de todos los electrodos siguiendo conjuntamente una curva. Para ello hay disponibles distintos cálculos de curva.

Recomendaciones:
- Deje un archivo de audio reproduciéndose en el *Reproductor*. Tome un audiolibro.
- Active *Habla*. Cambie el ajuste con las *teclas de flecha arriba/abajo* y oiga en directo cómo afecta el cambio a su comprensión del habla.
- Desactive *Habla* y active *Seno*. Deje sonar música en el *Reproductor*. Modifique con las *teclas de flecha arriba/abajo* el valor y oiga en directo cómo cambian agudos y graves.
- Desactive *Seno* y pruebe también otras curvas.
- Encuentre una curva o combinación de curvas que le convenza.
- Vaya a la pestaña *Reproductor*, reproduzca algo y encienda y apague el botón *Curvas* varias veces para oír la diferencia.

#### En la pestaña *Cargar/Guardar*
- Guarde sus datos de medición y sus ajustes.

## Para su audiólogo
Impresiones para su audiólogo con los cambios deseados.

- Configure todo en el *Reproductor* tal como desea oír.
  - Tenga en cuenta también el ajuste *IZQUIERDA/DERECHA* así como la casilla *Ambos lados*.
- Vaya a la pestaña *Cargar/Guardar* y haga clic en *Imprimir*.
- Configure el reproductor de modo que solo se aplique el balance de volumen (botón *Medido*). Desactive los botones *Curvas* y *Deslizadores*. Imprima también eso como deseo de ajuste para su futuro programa de prueba.
- Lleve las impresiones a su próxima cita con el audiólogo.

### Recomendación para nueva asignación de programas
- Conserve sin cambios el programa al que está acostumbrado y que utiliza en el día a día.
- Asigne una posición de programa como programa de prueba con electrodos exactamente igual de fuertes y sin filtros. Esa será su base para mediciones y experimentos futuros.
  - Este programa de prueba también podría convertirse en un programa favorito para música o sonidos de la naturaleza.
- Asigne una o dos posiciones de programa con los ajustes deseados que haya obtenido con ayuda de la herramienta.

### Limitación
Si en la herramienta ha introducido los valores *MCL* de los electrodos, además de la diferencia en decibelios (dB) la herramienta calcula también una diferencia en la unidad del programa del audiólogo. Esto se imprime también. Estos valores calculados aún no se han comprobado en cuanto a fiabilidad. A esto se añade que el oído como órgano podría reaccionar a los ajustes algo distinto de lo que un cálculo pueda predecir.

## Otras mediciones

### Pestaña *Mediciones* -> *Balance estéreo*
Comparación de volumen izquierda y derecha.
- Antes de esta medición debería haberse realizado ya la medición *Volumen de electrodos*.
- A partir de la medición se calcula un valor medio, que se recomienda como aumento o disminución de volumen para un lado.
- La compensación puede activarse en el reproductor mediante un botón.

### Pestaña *Mediciones* -> *Latencia*
Medir el desfase temporal entre izquierda y derecha.
- Con provisión auditiva distinta a izquierda y derecha, los tonos pueden llegar con desfase.
- Con esta prueba puede medir esa latencia. Según el dispositivo, el audiólogo o el acústico pueden realizar una corrección.
- Si el volumen izquierda y derecha está muy bien equilibrado, también puede orientarse por «dónde» oye el tono: más a la izquierda, a la derecha o centrado en la cabeza.
- En el reproductor se puede activar una compensación.

Este procedimiento de medición es aún algo rudimentario y se afinará en versiones futuras.

### Pestaña *Mediciones* -> *Ajuste de frecuencia*
Medición de las diferencias de altura tonal entre izquierda y derecha.
- Es ventajoso haber realizado ya antes de esta medición *Volumen de electrodos* y *Balance estéreo*.

El procedimiento se divide en 2 pruebas. La primera prueba con deslizador sirve únicamente para obtener buenos valores iniciales para la segunda prueba, que requiere mucho tiempo.
#### Prueba 1: pre-estimación (deslizador)
- Por electrodo se reproduce el mismo tono a la izquierda y a la derecha. Corrija con el deslizador / con las teclas de flecha hasta que los tonos de izquierda y derecha se oigan igual de agudos o graves.
#### Prueba 2: adaptativa
- Se reproducen secuencias de tonos y, para cada secuencia, indica si el segundo tono era más agudo o más grave que el primero.
- En algún momento llegará a un punto en el que apenas o ya no pueda distinguirlos. Responda entonces de forma intuitiva, incluso aunque la razón ya no reconozca ninguna diferencia.
#### Reproductor
- En el *Reproductor*, dentro de *Experimental*, puede reproducirse una simulación de alturas tonales modificadas, aunque la calidad de la simulación todavía es modesta. Puede dar, no obstante, una idea de cómo podría actuar el cambio.
#### Indicación sobre audífonos:
- Si en el otro oído oye de forma natural pero es hipoacúsico, puede ayudar hacer que le ajusten el audífono para la prueba de modo que no realice desplazamiento de frecuencia, sino que solo mejore el volumen.
- Si en el otro oído lleva un audífono que realiza desplazamiento de frecuencia, p. ej. reproduciendo tonos agudos como tonos más graves, no es adecuado para la prueba. Estaría probando con las frecuencias desplazadas.

### Pestaña *Deslizadores*
Permite cambiar manualmente el volumen de electrodos individuales.
- Esta función no la necesitará por regla general. Le da libertad para experimentar.
- Existe un modo *relativo* y otro *absoluto*. El modo *absoluto* solo puede utilizarse si en la pestaña *Implante* se han introducido los valores MCL.
- Puede mostrar también el cambio por *Volumen de electrodos* y *Curvas*.
- Puede oír los cambios en directo en el reproductor.
