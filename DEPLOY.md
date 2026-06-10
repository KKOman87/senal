# SEÑAL — despliegue

## URL en vivo

**https://kkoman87.github.io/senal/**

GitHub Pages sirve únicamente la carpeta **`docs/`** de la rama `main`
(repo público `KKOman87/senal`). Lo público es exactamente:

```
index.html  canal1..7.html  404.html
assets/senal.css  assets/senal.js  assets/og.png  assets/favicon.svg
```

`SOLUTION.md`, `dev/test.html`, `dev/qa.html`, `README.md` y `senal.html`
viven en el repo pero **no se sirven** — sus URLs en el sitio devuelven el
404 propio. Ojo: el repo es público, así que la solución sí es visible *en
github.com* para quien vaya a buscarla al código; leer el fuente se asume
parte del juego. Si algún día quieres ocultarla también ahí, haz el repo
privado y publica con una GitHub Action a la rama `gh-pages`.

## Cómo actualizar

```sh
cd ~/proyectos/senal
# edita docs/ (lo público) o dev/ (las pruebas)
chromium --headless=new --allow-file-access-from-files --mute-audio \
  --autoplay-policy=no-user-gesture-required --virtual-time-budget=200000 \
  --dump-dom file://$PWD/dev/qa.html | grep '<title>'   # QA PASS 17/17
git add -A && git commit -m "..." && git push
```

Pages reconstruye solo en uno o dos minutos. No hay paso de build.

## Dominio propio (opcional): senal.obsidiandistrict.com

1. **En Cloudflare** (zona `obsidiandistrict.com`) crea este registro:

   | Type  | Name    | Target / Content        | Proxy status | TTL  |
   |-------|---------|-------------------------|--------------|------|
   | CNAME | `senal` | `kkoman87.github.io`    | **DNS only** (nube gris) | Auto |

   Déjalo en *DNS only* hasta que GitHub emita el certificado; después
   puedes activar el proxy naranja si quieres.

2. **En el repo**, activa el dominio (esto crea `docs/CNAME` y reconfigura
   Pages; no lo hagas antes de añadir el DNS o el sitio quedará caído):

   ```sh
   echo senal.obsidiandistrict.com > docs/CNAME
   git add docs/CNAME && git commit -m "dominio propio" && git push
   ```

   O desde la web: Settings → Pages → Custom domain →
   `senal.obsidiandistrict.com` → Save, y marca **Enforce HTTPS** cuando
   el check de DNS pase (tarda unos minutos).

3. El sitio queda en `https://senal.obsidiandistrict.com/` y la URL de
   github.io redirige sola. El 404 ya sabe vivir en ambos dominios.

## Verificación tras cada despliegue

- `https://kkoman87.github.io/senal/` carga la guía y el botón **Encender**
  (no hay autoplay: el audio solo arranca con ese gesto).
- Un canal en emisión reproduce; uno fuera de horario muestra estática y pista.
- `assets/og.png` resuelve (tarjeta al compartir el enlace).
- Una ruta inventada (p. ej. `/senal/canal8.html`) muestra el 404 de "canal
  no encontrado".
- `SOLUTION.md`, `test.html`, `qa.html`, `dev/qa.html` → 404 en el sitio.
