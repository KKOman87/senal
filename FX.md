# SEÑAL — capas de cursor, audio y efectos animatrónicos

_Sesión 2026-06-23. Todo en `docs/` (lo público). Motor compartido: `docs/assets/senal.js` + `docs/assets/senal.css`._

## 0) Recordatorio de despliegue
- Solo se sirve `docs/`. Editar `senal.html` de la raíz NO cambia nada en vivo.
- Look/feel global y efectos viven en **`docs/assets/senal.css`** + **`docs/assets/senal.js`**.
- Nada sale en vivo hasta `git add/commit/push` a `main`; Pages reconstruye en 1-2 min; hard-refresh (`Ctrl+Shift+R`) por caché.

## 1) Cursor custom (retícula de sintonía)
En `docs/assets/senal.css`:
- Cursor global: retícula ámbar (`#dba74e`) — círculo + cruz + punto central, SVG inline data-URI, hotspot `14 14`, fallback `crosshair`.
- Clickeables: variable `--reticle-lock` (retícula hueso con punto rojo), aplicada en `.power button`, `.btn`, `.aviso button`. `.btn[disabled]` queda `default`.

## 2) Risita de niño sintetizada (audio)
En `buildAudio()` (`senal.js`), bloque `cfg.laughter` — sawtooth + dos formantes (~700/2700 Hz), 3-6 sílabas "hee-hee" que caen de tono, **leve y ocasional**, enterrada en la estática. Respeta el mute. 100% sintetizado, sin archivos.
- Parámetros por canal: `gain` (volumen), `f0` (agudo), `min`/`max` (ms entre risas).
- Activa en: **canal 1** (`f0:480, gain:0.012`, 22-55s) · **canal 3** (`f0:470, gain:0.014`, 13-34s) · **canal 4** (`f0:455, gain:0.016`, 16-42s).
- Para sumar a otro canal: añadir línea `laughter:{...}` en el `audio:{}` de su `S.page(...)`.

## 3) Jerarquía visual (CSS)
Tres tiers claros en `senal.css`:
- **Tier 1 — héroe:** `.msg` más grande (hasta 46px), `font-weight:600`, interlineado 1.26, el más brillante.
- **Tier 2 — kicker:** `.label` chico, tabulado, con viñeta `▸` (`::before`).
- **Tier 3 — chrome:** `.head` y `.foot` atenuados (más tracking, menor tamaño/opacidad).
- **Foco de escenario:** `.tbody::before` = halo radial ámbar suave detrás del texto.

## 4) Efectos animatrónicos (arte ORIGINAL, sin IP de FNAF)
Mascota genérica (cabeza redonda + orejas + ojos brillantes + dientes). Dos SVG inline en `senal.js`: `FACE_SVG` (cara frontal) y `SILHOUETTE_SVG` (cuerpo entero en silueta).

Sistema **opt-in por canal** vía `cfg.fx` en `S.page(...)`. `startFx(tube, fx, force)` arranca con el on-air; respeta `prefers-reduced-motion` (salvo `force=true`, que usa el preview). Cada efecto hace un **primer disparo temprano** (~3-9s) y luego cae a cadencia aleatoria `min`/`max`.

| Efecto | Función | Capa CSS | Z | Canales |
|---|---|---|---|---|
| Ojos en la estática | `eyesFx` | `.watcher .eye` | 5 (tras el texto) | 1,2,3,4,5,7 (rojos en 4,5,7) |
| Silueta en la tarima | `silhouetteFx` | `.standee` | 3 (bajo la nieve) | 4,6,7 |
| HUD cámara vigilancia | `camFx` | `.camcast` + `.cam-hud` | 6/10 | 6 |
| Cara que parpadea + stinger | `faceFx` / `faceStinger` | `.facejump` | 12 | 3,7 |

Parámetros comunes: `min`/`max` (frecuencia ms), `first` (primer disparo), `gain`/`opacity` (intensidad), `for` (duración), `color:'red'` (ojos), `size` (ojos), `id`/`note` (cam), `silent:true` (cara sin stinger).

## 5) Preview (clave para ver sin esperar horario)
**`docs/preview-fx.html`** (`noindex`, NO enlazado desde la guía): enciende un tubo y dispara los 4 efectos con botones (Ojos/Silueta/Cámara/Cara/Todo). URL en vivo: `senal.obsidiandistrict.com/preview-fx.html`.
- ⚠ Es público (reachable por URL). Si se quiere ARG 100% limpio, borrar `docs/preview-fx.html` cuando ya no se use.
- **Recordatorio de horario:** a media tarde solo canales 1 y 2 están abiertos (`isUnlocked` en `senal.js`); 3-7 son nocturnos/madrugada. Por eso "no se ve nada" no es bug — usar el preview o el canal correcto.

## Commits de la sesión
- `22950fe` cursor retícula · `f0bef17` risita (3,4) · `f5672a6` risita (1) ·
  `8e6b952` jerarquía + 4 efectos animatrónicos · `aa210af` primer disparo temprano + ojos visibles + preview.

## Verificación
`node --check docs/assets/senal.js` · QA `dev/qa.html` → **QA PASS 18/18** · smoke test headless de `startFx` (los 4 crean DOM, 0 errores de consola).
