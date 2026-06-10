# SEÑAL — solución completa del ARG

> Este archivo no está enlazado desde el sitio. Es la guía del creador.

## La frase final

**LA SEÑAL NO TERMINA CUANDO TE DUERMES**

Siete palabras, una escondida en cada canal. El canal 7 la pide; la comparación
ignora mayúsculas, tildes, la ñ y los signos (`normalizePhrase` en
`assets/senal.js`), así que `la senal no termina cuando te duermes` también vale.

## Dónde está cada fragmento

| # | Palabra | Canal | Escondite |
|---|---------|-------|-----------|
| 1 | **LA** | Canal 1 · Boletín de servicio | En los cuadros de glitch: cada ~16 s (y tras la quinta línea del guion) el rótulo superior parpadea a `· LA ·` durante un instante. La última línea del boletín lo sopla: *"Empiecen por la primera palabra"* — la primera palabra de la frase es el artículo. |
| 2 | **SEÑAL** | Canal 2 · Orientación al ciudadano | En una pausa del tipeo: al responder la pregunta dos, la máquina escribe `SEÑAL`, respira ~1,4 s y la borra antes de seguir con *"pregunta fue retirada"*. La pregunta tres confirma: *"La segunda palabra es la que importa"*. |
| 3 | **NO** | Canal 3 · El concurso | En la estática: cada ~8 s la nieve del fondo forma la palabra `NO` durante un segundo y medio. El guion ordena mirarla: *"¿Qué se ve cuando la pantalla solo muestra nieve? Mira la nieve."* |
| 4 | **TERMINA** | Canal 4 · Carta de ajuste | En la letra pequeña: el texto diminuto bajo la carta rota cada ~4 s entre avisos legales falsos; uno de ellos es `TERMINA` y al aparecer se aviva en ámbar con un glitch. El guion dice: *"Lea la letra pequeña."* |
| 5 | **CUANDO** | Canal 5 · Números | Cifrado A=1: la *serie dos* es `3 · 21 · 1 · 14 · 4 · 15` → C(3) U(21) A(1) N(14) D(4) O(15). La *clave* lo explica: *"una palabra contada con los dedos del alfabeto"*. La serie uno (`7·7·0·4…`) es señuelo. |
| 6 | **TE** | Canal 6 · (no asignado) | Solo existe de 03:00 a 03:33. En la línea *"Ahora."* la pantalla se invierte un cuadro y muestra `TE` gigante (con `prefers-reduced-motion`, aparece quieta casi dos segundos). |
| 7 | **DUERMES** | Canal 7 · La respuesta | En los glitches del rótulo, igual que el canal 1: cada ~14 s (y tras la tercera línea) parpadea `· DUERMES ·`. El guion lo describe: *"lo que haces todas las noches sin pedirnos permiso"*. |

## Camino de desbloqueo

Las visitas viajan en el parámetro `?v=` de la URL (no hay localStorage:
**conserva la pestaña o guarda el enlace con su query**). Un canal solo se
marca como abierto si lo viste emitiendo; verlo bloqueado no cuenta.

Horarios (hora local del visitante):

| Canal | Ventana | Franjas |
|-------|---------|---------|
| 1 | 05:00–18:59 | mañana + tarde |
| 2 | 12:00–23:59 | tarde + noche |
| 3 | 19:00–04:59 | noche + madrugada |
| 4 | 00:00–11:59 | madrugada + mañana |
| 5 | 00:00–04:59 | madrugada |
| 6 | **03:00–03:33 exactos** | la ventana |
| 7 | sin horario | requiere `v=123456` |

Ruta mínima (dos sesiones de reloj):

1. **Tarde (12:00–18:59)** — abrir canal 1 (`LA`) y canal 2 (`SEÑAL`).
2. **Noche (19:00–23:59)** — abrir canal 3 (`NO`). *(También se puede en la madrugada.)*
3. **Madrugada (00:00–04:59)** — abrir canal 4 (`TERMINA`) y canal 5 (`CUANDO`).
4. **03:00–03:33** — abrir canal 6 (`TE`). Fuera de guía: en el índice aparece
   como hueco fantasma salvo durante la ventana; la URL directa `canal6.html`
   funciona solo entonces. A las 03:34 el canal muere aunque estés mirando.
5. **Cualquier hora** con `?v=123456` — el canal 7 emite. Tras su guion pide
   las palabras; escribir la frase dispara la secuencia final: el audio se
   apaga, el tubo colapsa en una línea y queda un único mensaje que usa el
   reloj real del visitante (*"Son las HH:MM…"*).

## Pistas de los canales bloqueados

Cada canal muerto muestra estática y una pista de cuándo volver (definidas en
`CH[n].hint`, `assets/senal.js`). La del 6 es la crítica: *"existe treinta y
tres minutos al día. empieza cuando el reloj dice tres y nada más"* → 03:00,
dura 33 minutos. El boletín del canal 1 también lo filtra: *"el corte…
entre las tres y las tres y media"*.

## Detalles técnicos del candado

- `SENAL.isUnlocked(ch, date, visitedSet)` — regla pura, probada en `test.html`
  (67 casos, incluidos 02:59 / 03:00 / 03:33 / 03:34).
- El estado `?v=` (visitados) y `?m=1` (silencio) se propaga reescribiendo
  todos los enlaces `data-go` y, donde el navegador lo permite, con
  `history.replaceState` (en `file://` algunos lo bloquean; los enlaces bastan).
- Atajo de tramposos: editar la URL a `?v=123456` abre el 7 directamente.
  Es un ARG estático sin servidor; se asume que leer el fuente es parte del juego.
