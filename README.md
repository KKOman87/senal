# SEÑAL — transmisión sin origen

Horror analógico como sitio estático: siete canales de una repetidora pirata
que emite según tu reloj. Sin backend, sin build, sin dependencias — HTML, CSS
y JS planos que funcionan igual desde `file://` que desde GitHub Pages.

> No leas `SOLUTION.md` si piensas jugarlo.

## Cómo se juega

Abre `index.html`. La guía muestra qué canales están **en emisión** según tu
hora local; los muertos enseñan estática y una pista de cuándo volver. Cada
canal esconde una palabra. El canal 7 sabe qué hacer con ellas.

El progreso vive **en la URL** (parámetro `?v=`), no hay cookies ni
localStorage: navega siempre por los enlaces del sitio y no pierdas la query.
`?m=1` silencia el audio en todas las páginas (botón *Sonido* en el pie).

## Horario de emisión

| Canal | Nombre | Ventana (hora local) |
|-------|--------|----------------------|
| 01 | Boletín de servicio | 05:00–18:59 (mañana + tarde) |
| 02 | Orientación al ciudadano | 12:00–23:59 (tarde + noche) |
| 03 | El concurso | 19:00–04:59 (noche + madrugada) |
| 04 | Carta de ajuste | 00:00–11:59 (madrugada + mañana) |
| 05 | Números | 00:00–04:59 (madrugada) |
| ·6· | — | 03:00–03:33, exactos. Fuera de eso no existe. |
| 07 | La respuesta | Sin horario: exige haber visto los otros seis en emisión. |

Franjas: madrugada 00–05 · mañana 05–12 · tarde 12–19 · noche 19–24.

## Estructura

```
docs/                  ← lo único que se publica (GitHub Pages sirve esta carpeta)
  index.html           guía de programación (parrilla, barras de señal, reloj)
  canal1..7.html       los siete canales
  404.html             frecuencia inexistente (autosuficiente)
  assets/senal.css     chrome CRT compartido (paleta ámbar/hueso, scanlines, ruido)
  assets/senal.js      núcleo: reglas de desbloqueo, estado por URL, audio WebAudio,
                       máquina de escribir, estática en canvas
  assets/og.png        tarjeta para compartir (1200×630)
  assets/favicon.svg   el punto REC
dev/                   ← NUNCA se sirve
  test.html            pruebas de las reglas (67 casos, relojes simulados)
  qa.html              arnés: carga cada página con reloj falso y caza errores
                       (chromium con --allow-file-access-from-files)
senal.html             pieza original de referencia (independiente del juego)
SOLUTION.md            solución completa — spoilers, nunca se sirve
DEPLOY.md              URL en vivo, DNS del dominio propio, cómo actualizar
```

## Audio

Todo el sonido se genera con WebAudio al pulsar *Sintonizar* (no hay archivos
de audio): zumbido de red, siseo de cinta, microcortes; en los canales altos,
voces que casi se forman (sierras desafinadas a través de formantes que
deambulan), latido sub-grave y señales de intervalo de onda corta que se
destemplan con cada repetición. El tono de 440 Hz del canal 4 se marea a
propósito.

## Accesibilidad

`prefers-reduced-motion` se respeta en todas las páginas: sin parpadeos, sin
rodillos verticales, sin estroboscopio (la palabra del canal 6 aparece quieta),
y la estática es un cuadro fijo. Los fragmentos siguen siendo encontrables.

## Pruebas

- `dev/test.html` — ábrelo en cualquier navegador: simula relojes y verifica
  cada regla, incluidos los bordes 02:59 / 03:00 / 03:33 / 03:34 del canal 6 y
  los requisitos del 7. El título de la pestaña dice PASS/FAIL.
- `dev/qa.html` — recorre las 17 combinaciones página×estado (al aire,
  bloqueada, final del 7) con relojes simulados y reporta errores de consola:

```sh
chromium --headless=new --allow-file-access-from-files --mute-audio \
  --autoplay-policy=no-user-gesture-required --virtual-time-budget=200000 \
  --dump-dom file://$PWD/dev/qa.html | grep '<title>'
```

## Desplegar en GitHub Pages

El sitio publicado es **solo `docs/`** — `SOLUTION.md`, `dev/` y este README
quedan en el repo pero nunca se sirven. En GitHub:
**Settings → Pages → Source: Deploy from a branch**, rama `main`,
carpeta `/docs`. Ver `DEPLOY.md` para la URL en vivo y el dominio propio.

También corre local sin servidor (doble clic en `docs/index.html`) o con
`python3 -m http.server` si prefieres `http://`.

Nota: el desbloqueo usa la hora **del visitante**, así que cada huso horario
vive su propia madrugada.
