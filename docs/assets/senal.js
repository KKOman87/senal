/* SEÑAL — núcleo compartido: reglas, estado, audio, efectos.
   Sin dependencias. Funciona en file:// y GitHub Pages.
   Las funciones puras (band, isUnlocked, parseVisited, normalizePhrase)
   no tocan el DOM para poder probarse en test.html y en Node. */
var SENAL = (function () {
  'use strict';
  var W = typeof window !== 'undefined' ? window : null;
  var D = typeof document !== 'undefined' ? document : null;

  /* ===================== reglas puras ===================== */

  // franja horaria local
  function band(h) {
    if (h >= 0 && h < 5) return 'madrugada';
    if (h < 12) return 'mañana';
    if (h < 19) return 'tarde';
    return 'noche';
  }

  // visited: Set de números 1..7
  function isUnlocked(ch, date, visited) {
    var h = date.getHours(), m = date.getMinutes();
    switch (ch) {
      case 1: return h >= 5 && h < 19;            // mañana + tarde
      case 2: return h >= 12;                      // tarde + noche
      case 3: return h >= 19 || h < 5;             // noche + madrugada
      case 4: return h < 12;                       // madrugada + mañana
      case 5: return h < 5;                        // madrugada
      case 6: return h === 3 && m <= 33;           // solo 03:00–03:33
      case 7:
        for (var i = 1; i <= 6; i++) if (!visited.has(i)) return false;
        return true;
    }
    return false;
  }

  // el canal 6 ni siquiera figura en la guía fuera de su ventana
  function exists(ch, date) {
    if (ch !== 6) return true;
    return date.getHours() === 3 && date.getMinutes() <= 33;
  }

  function parseVisited(str) {
    var s = new Set();
    String(str || '').split('').forEach(function (c) {
      var n = parseInt(c, 10);
      if (n >= 1 && n <= 7) s.add(n);
    });
    return s;
  }

  function visitedToString(set) {
    return Array.from(set).sort().join('');
  }

  /* ===================== código de transmisión =====================
     El progreso (canales 1–6 vistos) cabe en 6 bits. Lo empaquetamos con
     un dígito de control en un código corto tipo "SEÑAL-7K3" que el
     visitante puede anotar y volver a pegar — así conserva lo abierto sin
     localStorage y puede regresar a su 03:33 local para el canal 6. */
  var CODE_ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

  function maskOf(set) {
    var m = 0;
    for (var c = 1; c <= 6; c++) if (set.has(c)) m |= (1 << (c - 1));
    return m;
  }
  function codeFor(set) {
    var mask = maskOf(set);
    var check = (mask * 5 + 9) & 0x1F;
    var val = (check << 6) | mask;            // 11 bits
    return 'SEÑAL-' +
      CODE_ALPHA[(val >> 10) & 31] +
      CODE_ALPHA[(val >> 5) & 31] +
      CODE_ALPHA[val & 31];
  }
  // devuelve un Set de canales 1..6, o null si el código no valida
  function decodeCode(str) {
    var s = String(str || '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '')
      .replace(/^SENAL/, '')
      .replace(/O/g, '0').replace(/[IL]/g, '1'); // Crockford tolerante
    var chars = s.split('').filter(function (c) { return CODE_ALPHA.indexOf(c) >= 0; });
    if (chars.length < 3) return null;
    chars = chars.slice(-3);
    var val = 0;
    for (var i = 0; i < 3; i++) val = (val << 5) | CODE_ALPHA.indexOf(chars[i]);
    var mask = val & 0x3F, check = (val >> 6) & 0x1F;
    if (((mask * 5 + 9) & 0x1F) !== check) return null;
    var set = new Set();
    for (var c = 1; c <= 6; c++) if (mask & (1 << (c - 1))) set.add(c);
    return set;
  }
  // funde los canales de un código en el estado; true si validó
  function applyCode(str) {
    var set = decodeCode(str);
    if (!set) return false;
    set.forEach(function (c) { state.v.add(c); });
    applyLinks(); syncUrl();
    return true;
  }

  // mayúsculas, sin tildes, solo letras (ñ→n para tolerar teclados)
  function normalizePhrase(s) {
    return String(s || '')
      .toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z]/g, '');
  }

  var PHRASE_KEY = 'LASENALNOTERMINACUANDOTEDUERMES'; // LA SEÑAL NO TERMINA CUANDO TE DUERMES

  var CH = {
    1: { page: 'canal1.html', name: 'Boletín de servicio',
         hint: 'abre con la primera luz. se despide cuando cae el sol.' },
    2: { page: 'canal2.html', name: 'Orientación al ciudadano',
         hint: 'emite desde que el sol está más alto hasta que acaba el día.' },
    3: { page: 'canal3.html', name: 'El concurso',
         hint: 'solo se juega cuando ya está oscuro afuera.' },
    4: { page: 'canal4.html', name: 'Carta de ajuste',
         hint: 'se ajusta mientras la ciudad duerme, y un poco después.' },
    5: { page: 'canal5.html', name: 'Números',
         hint: 'los números solo se leen en la madrugada, cuando nadie suma.' },
    6: { page: 'canal6.html', name: '· · ·',
         hint: 'existe treinta y tres minutos al día. empieza cuando el reloj dice tres y nada más.' },
    7: { page: 'canal7.html', name: 'La respuesta',
         hint: 'no tiene horario. tiene requisitos. abre las otras seis puertas y vuelve.' }
  };

  /* ===================== estado por URL ===================== */
  // sin localStorage: lo visitado y el silencio viajan en los enlaces.
  var state = { v: new Set(), m: false };

  function readState() {
    if (!W) return state;
    // __SENAL_QS: gancho del arnés de QA (qa.html), que carga las páginas
    // por srcdoc y no puede pasar query real
    var q = new URLSearchParams(W.__SENAL_QS != null ? W.__SENAL_QS : W.location.search);
    state.v = parseVisited(q.get('v'));
    state.m = q.get('m') === '1';
    return state;
  }

  function query() {
    var parts = [];
    if (state.v.size) parts.push('v=' + visitedToString(state.v));
    if (state.m) parts.push('m=1');
    return parts.length ? '?' + parts.join('&') : '';
  }

  function href(page) { return page + query(); }

  function applyLinks() {
    if (!D) return;
    var links = D.querySelectorAll('a[data-go]');
    for (var i = 0; i < links.length; i++) {
      links[i].setAttribute('href', href(links[i].getAttribute('data-go')));
    }
  }

  function syncUrl() {
    if (!W || !W.history || !W.history.replaceState) return;
    try { // en file:// algunos navegadores lo prohíben: los enlaces bastan
      W.history.replaceState(null, '', W.location.pathname + query());
    } catch (e) { /* sin drama: el estado viaja en los <a> */ }
  }

  function markVisited(ch) {
    state.v.add(ch);
    applyLinks();
    syncUrl();
  }

  function setMuted(on) {
    state.m = !!on;
    applyLinks();
    syncUrl();
    if (audio.ctx && audio.master) {
      audio.master.gain.setTargetAtTime(on ? 0 : audio.level, audio.ctx.currentTime, 0.2);
    }
  }

  /* ===================== reloj ===================== */
  function two(n) { return String(n).padStart(2, '0'); }

  function startClock(el, withSeconds) {
    function tick() {
      var d = new Date();
      el.textContent = two(d.getHours()) + ':' + two(d.getMinutes()) +
        (withSeconds === false ? '' : ':' + two(d.getSeconds()));
    }
    tick();
    return setInterval(tick, 1000);
  }

  function horaTexto() {
    var d = new Date();
    return two(d.getHours()) + ':' + two(d.getMinutes());
  }

  // zona horaria del aparato del visitante (todo el desbloqueo usa hora local)
  function tz() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; }
    catch (e) { return ''; }
  }

  // firma en la consola: capa escondida para el que abre las herramientas
  var signed = false;
  function consoleSig() {
    if (signed || !W || !W.console) return;
    signed = true;
    var z = tz();
    try {
      console.log('%c S E Ñ A L ', 'background:#07070a;color:#c9923c;font-size:20px;letter-spacing:.4em;padding:6px 10px');
      console.log('%cNo estabas buscando esto. Pero abriste la consola.', 'color:#d8d2c4;font-style:italic');
      console.log('%cEl reloj que te juzga es el tuyo' + (z ? ' (' + z + ')' : '') + '. Por eso el canal 6 es posible donde estés.', 'color:#7e796d');
      console.log('%cLas siete palabras viven en los canales, no aquí. Mira los cuadros que parpadean y las pausas.', 'color:#7e796d');
      console.log('%c· · ·   /humans.txt   ·   dig TXT senal.obsidiandistrict.com   · · ·', 'color:#6e4f1c');
    } catch (e) { /* consolas raras: sin drama */ }
  }

  /* ===================== efectos ===================== */
  var reduce = W && W.matchMedia && W.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function glitch(el) {
    if (reduce || !el) return;
    el.classList.remove('glitch'); void el.offsetWidth; el.classList.add('glitch');
    setTimeout(function () { el.classList.remove('glitch'); }, 320);
  }
  function roll(el) {
    if (reduce || !el) return;
    el.classList.remove('roll'); void el.offsetWidth; el.classList.add('roll');
    setTimeout(function () { el.classList.remove('roll'); }, 520);
  }
  function trackPass(el) {
    if (reduce || !el) return;
    el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  }

  /* estática en canvas. opts:
     intensity 0..1, fps, word (texto escondido), wordEvery ms, wordFor ms */
  function snow(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var sw = 160, sh = 110; // baja resolución, se escala
    canvas.width = sw; canvas.height = sh;
    var img = ctx.createImageData(sw, sh);
    var mask = null;

    if (opts.word) {
      var off = D.createElement('canvas');
      off.width = sw; off.height = sh;
      var octx = off.getContext('2d');
      octx.fillStyle = '#000'; octx.fillRect(0, 0, sw, sh);
      octx.fillStyle = '#fff';
      octx.font = 'bold ' + Math.floor(sh / 2.6) + 'px monospace';
      octx.textAlign = 'center'; octx.textBaseline = 'middle';
      octx.fillText(opts.word, sw / 2, sh / 2);
      mask = octx.getImageData(0, 0, sw, sh).data;
    }

    var t0 = 0, showWord = false;
    function frame(withWord) {
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        var v = (Math.random() * 255) | 0;
        if (withWord && mask && mask[i] > 128) v = Math.min(255, v + 110);
        // tinte hueso/ámbar, no gris puro
        d[i] = v; d[i + 1] = v * 0.96 | 0; d[i + 2] = v * 0.86 | 0;
        d[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }

    canvas.style.opacity = opts.intensity != null ? opts.intensity : 1;
    canvas.style.imageRendering = 'pixelated';

    if (reduce) { // un solo cuadro, con la palabra apenas presente para no perder el ARG
      frame(!!opts.word);
      return { stop: function () {} };
    }
    var fps = opts.fps || 18;
    var wordEvery = opts.wordEvery || 9000;
    var wordFor = opts.wordFor || 1100;
    var iv = setInterval(function () {
      var now = Date.now();
      if (opts.word) {
        if (!showWord && now - t0 > wordEvery) { showWord = true; t0 = now; }
        else if (showWord && now - t0 > wordFor) { showWord = false; t0 = now; }
      }
      frame(showWord);
    }, 1000 / fps);
    return { stop: function () { clearInterval(iv); } };
  }

  /* ===================== audio generado ===================== */
  var audio = { ctx: null, master: null, level: 0.5, stops: [] };

  function buildAudio(cfg) {
    cfg = cfg || {};
    var AC = W.AudioContext || W.webkitAudioContext;
    if (!AC) return;
    if (audio.ctx) return; // una vez por página
    var actx = new AC();
    audio.ctx = actx;
    audio.level = cfg.master != null ? cfg.master : 0.5;
    var master = actx.createGain();
    master.gain.value = 0;
    master.connect(actx.destination);
    audio.master = master;

    // zumbido de red
    (cfg.hum || []).forEach(function (p) {
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = p[0]; g.gain.value = p[1];
      o.connect(g); g.connect(master); o.start();
    });

    // siseo de cinta
    if (cfg.hiss) {
      var buf = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
      var dat = buf.getChannelData(0);
      for (var i = 0; i < dat.length; i++) dat[i] = (Math.random() * 2 - 1) * 0.5;
      var noise = actx.createBufferSource(); noise.buffer = buf; noise.loop = true;
      var hp = actx.createBiquadFilter(); hp.type = 'highpass';
      hp.frequency.value = cfg.hiss.hp || 1100;
      var ng = actx.createGain(); ng.gain.value = cfg.hiss.gain || 0.012;
      noise.connect(hp); hp.connect(ng); ng.connect(master); noise.start();
    }

    // brillo alto casi imperceptible
    if (cfg.shimmer) {
      var sh = actx.createOscillator(), sg = actx.createGain();
      sh.type = 'sine'; sh.frequency.value = cfg.shimmer.freq || 8200;
      sg.gain.value = cfg.shimmer.gain || 0.0022;
      sh.connect(sg); sg.connect(master); sh.start();
    }

    // tono de carta de ajuste, con leve mareo
    if (cfg.tone) {
      var t = actx.createOscillator(), tg = actx.createGain();
      t.type = 'sine'; t.frequency.value = cfg.tone.freq || 440;
      tg.gain.value = cfg.tone.gain || 0.02;
      if (cfg.tone.wobble) {
        var wl = actx.createOscillator(), wg = actx.createGain();
        wl.type = 'sine'; wl.frequency.value = 0.13;
        wg.gain.value = cfg.tone.wobble;
        wl.connect(wg); wg.connect(t.frequency); wl.start();
      }
      t.connect(tg); tg.connect(master); t.start();
    }

    // latido sub-grave: dos pulsos (lub-dub)
    if (cfg.heartbeat) {
      var hb = actx.createOscillator(); hb.type = 'sine'; hb.frequency.value = 47;
      var hg = actx.createGain(); hg.gain.value = 0;
      hb.connect(hg); hg.connect(master); hb.start();
      var beatMs = 60000 / (cfg.heartbeat.bpm || 52);
      var amp = cfg.heartbeat.gain || 0.4;
      function thump(at, a) {
        hg.gain.setValueAtTime(hg.gain.value, at);
        hg.gain.linearRampToValueAtTime(a, at + 0.035);
        hg.gain.exponentialRampToValueAtTime(0.0001, at + 0.30);
      }
      var hbIv = setInterval(function () {
        var n = actx.currentTime;
        thump(n, amp); thump(n + 0.19, amp * 0.6);
      }, beatMs);
      audio.stops.push(function () { clearInterval(hbIv); });
    }

    // voces que casi se forman: sierra grave → formantes en paralelo,
    // filtros que vagan despacio (vocales que no llegan a palabra)
    (cfg.voices || []).forEach(function (v, vi) {
      var vg = actx.createGain(); vg.gain.value = 0;
      vg.connect(master);
      [0, 1].forEach(function (k) {
        var o = actx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = (v.f0 || 110) * (k ? 1.0085 : 1); // desafinada contra sí misma
        var f1 = actx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 720; f1.Q.value = 9;
        var f2 = actx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1180; f2.Q.value = 9;
        o.connect(f1); o.connect(f2); f1.connect(vg); f2.connect(vg);
        // morfología vocálica: LFOs lentos sobre los formantes
        var l1 = actx.createOscillator(), l1g = actx.createGain();
        l1.frequency.value = 0.07 + vi * 0.03; l1g.gain.value = 190;
        l1.connect(l1g); l1g.connect(f1.frequency); l1.start();
        var l2 = actx.createOscillator(), l2g = actx.createGain();
        l2.frequency.value = 0.11 + vi * 0.02; l2g.gain.value = 320;
        l2.connect(l2g); l2g.connect(f2.frequency); l2.start();
        o.start();
      });
      // respiración: aparece y se esconde
      var bl = actx.createOscillator(), blg = actx.createGain();
      bl.type = 'sine'; bl.frequency.value = 0.05 + vi * 0.018;
      blg.gain.value = (v.gain || 0.04) / 2;
      vg.gain.value = (v.gain || 0.04) / 2;
      bl.connect(blg); blg.connect(vg.gain); bl.start();
    });

    // señal de intervalo de onda corta: motivo que se repite y se desafina
    if (cfg.interval) {
      var iv2 = cfg.interval, drift = 0;
      function motif() {
        if (!audio.ctx) return;
        var n = actx.currentTime + 0.05;
        (iv2.notes || [523, 659, 523]).forEach(function (f, k) {
          var o = actx.createOscillator(), g = actx.createGain();
          o.type = 'sine'; o.frequency.value = f;
          o.detune.value = drift;
          var at = n + k * (iv2.dur || 0.5);
          g.gain.setValueAtTime(0, at);
          g.gain.linearRampToValueAtTime(iv2.gain || 0.045, at + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, at + (iv2.dur || 0.5) * 0.92);
          o.connect(g); g.connect(master);
          o.start(at); o.stop(at + (iv2.dur || 0.5));
        });
        drift += (Math.random() - 0.3) * (iv2.detune || 14); // cada vuelta, más torcida
      }
      motif();
      var mIv = setInterval(motif, (iv2.gap || 7) * 1000);
      audio.stops.push(function () { clearInterval(mIv); });
    }

    // risita de niño: ráfagas vocálicas agudas (sawtooth + dos formantes),
    // muy leves y ocasionales, escondidas entre la estática
    if (cfg.laughter) {
      var lf = cfg.laughter;
      var lvol = lf.gain != null ? lf.gain : 0.018;
      function giggle() {
        if (!audio.ctx || state.m) return;
        var syll = 3 + (Math.random() * 4 | 0);                 // 3..6 sílabas
        var base = (lf.f0 || 440) * (0.9 + Math.random() * 0.2); // voz aguda, varía
        var t = actx.currentTime + 0.05;
        for (var s = 0; s < syll; s++) {
          var o = actx.createOscillator(); o.type = 'sawtooth';
          var p = base * (1 - s * 0.02) * (0.98 + Math.random() * 0.08); // tiende a caer
          o.frequency.setValueAtTime(p * 1.08, t);
          o.frequency.exponentialRampToValueAtTime(p, t + 0.06);  // cada "hee" baja un pelín
          var f1 = actx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 700;  f1.Q.value = 6;
          var f2 = actx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 2700; f2.Q.value = 7;
          var g = actx.createGain(); g.gain.value = 0;
          o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(master);
          var dur = 0.09 + Math.random() * 0.05;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(lvol, t + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.start(t); o.stop(t + dur + 0.03);
          t += dur + 0.04 + Math.random() * 0.035;               // huequito entre sílabas
        }
      }
      (function nextGiggle() {
        var gap = (lf.min || 14000) + Math.random() * ((lf.max || 38000) - (lf.min || 14000));
        var to = setTimeout(function () { giggle(); nextGiggle(); }, gap);
        audio.stops.push(function () { clearTimeout(to); });
      })();
    }

    // fundido de entrada (si no está silenciado por URL)
    master.gain.setTargetAtTime(state.m ? 0 : audio.level, actx.currentTime, 0.8);

    // microcortes
    if (cfg.dropouts !== false) {
      var dp = cfg.dropouts || {};
      (function dropout() {
        var t = (dp.min || 2000) + Math.random() * ((dp.max || 8000) - (dp.min || 2000));
        var to = setTimeout(function () {
          if (audio.ctx && !state.m) {
            var n = actx.currentTime;
            master.gain.cancelScheduledValues(n);
            master.gain.setValueAtTime(master.gain.value, n);
            master.gain.linearRampToValueAtTime(audio.level * (dp.depth != null ? dp.depth : 0.08), n + 0.04);
            master.gain.linearRampToValueAtTime(audio.level, n + 0.22);
            if (dp.onDrop) dp.onDrop();
          }
          dropout();
        }, t);
        audio.stops.push(function () { clearTimeout(to); });
      })();
    }
  }

  function killAudio(seconds) {
    if (!audio.ctx) return;
    audio.stops.forEach(function (f) { f(); });
    audio.master.gain.setTargetAtTime(0, audio.ctx.currentTime, seconds || 0.5);
  }

  /* ===================== efectos animatrónicos =====================
     Inspiración: el «algo que te mira desde lo oscuro» de los animatrónicos
     de feria. Arte original (mascota genérica), sin personajes con derechos.
     Todo opt-in por canal vía cfg.fx; respeta prefers-reduced-motion. */

  // mascota original: cara frontal (orejas, ojos ámbar, hocico, dientes)
  var FACE_SVG =
    '<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">' +
    '<g stroke="#3a2f18" stroke-width="2">' +
    '<circle cx="50" cy="46" r="24" fill="#0d0b08"/><circle cx="150" cy="46" r="24" fill="#0d0b08"/>' +
    '<path d="M28 92 Q28 38 100 38 Q172 38 172 92 Q172 172 100 178 Q28 172 28 92 Z" fill="#100d09"/>' +
    '<ellipse cx="100" cy="146" rx="50" ry="32" fill="#16120b"/></g>' +
    '<ellipse cx="72" cy="92" rx="17" ry="19" fill="#070605"/><ellipse cx="128" cy="92" rx="17" ry="19" fill="#070605"/>' +
    '<circle cx="72" cy="92" r="10" fill="#ffd27a"/><circle cx="128" cy="92" r="10" fill="#ffd27a"/>' +
    '<circle cx="72" cy="93" r="4.5" fill="#1a1206"/><circle cx="128" cy="93" r="4.5" fill="#1a1206"/>' +
    '<ellipse cx="100" cy="126" rx="11" ry="8" fill="#070605"/>' +
    '<g fill="#d8d2c4"><rect x="74" y="150" width="9" height="14" rx="1.5"/><rect x="86" y="152" width="9" height="15" rx="1.5"/>' +
    '<rect x="98" y="152" width="9" height="15" rx="1.5"/><rect x="110" y="152" width="9" height="15" rx="1.5"/>' +
    '<rect x="122" y="150" width="9" height="14" rx="1.5"/></g></svg>';

  // misma mascota, de cuerpo entero y en silueta (para la tarima)
  var SILHOUETTE_SVG =
    '<svg viewBox="0 0 200 260" xmlns="http://www.w3.org/2000/svg">' +
    '<g fill="#050505">' +
    '<circle cx="58" cy="40" r="20"/><circle cx="142" cy="40" r="20"/>' +
    '<path d="M40 70 Q40 24 100 24 Q160 24 160 70 Q160 120 100 124 Q40 120 40 70 Z"/>' +
    '<path d="M62 118 Q60 150 56 200 Q54 240 70 250 L130 250 Q146 240 144 200 Q140 150 138 118 Q120 132 100 132 Q80 132 62 118 Z"/>' +
    '<path d="M58 150 Q40 160 38 210 Q37 232 50 236 Q58 230 60 200 Z"/>' +
    '<path d="M142 150 Q160 160 162 210 Q163 232 150 236 Q142 230 140 200 Z"/></g>' +
    '<circle cx="80" cy="74" r="6" fill="#c9923c" opacity="0.85"/><circle cx="120" cy="74" r="6" fill="#c9923c" opacity="0.85"/></svg>';

  // 1) OJOS EN LA ESTÁTICA: un par de ojos emerge del fondo, mira, parpadea, se va
  function eyesFx(tube, o) {
    o = o || {};
    var layer = D.createElement('div');
    layer.className = 'watcher' + (o.color === 'red' ? ' red' : '');
    var e1 = D.createElement('div'), e2 = D.createElement('div');
    e1.className = e2.className = 'eye';
    var sc = o.size || 1;
    e1.style.transform = e2.style.transform = 'scale(' + sc + ')';
    layer.appendChild(e1); layer.appendChild(e2); tube.appendChild(layer);
    function look() {
      var x = 16 + Math.random() * 54, y = 14 + Math.random() * 44, gap = 5 + Math.random() * 2.5;
      e1.style.left = x + '%'; e1.style.top = y + '%';
      e2.style.left = (x + gap) + '%'; e2.style.top = (y + (Math.random() * 1.6 - 0.8)) + '%';
      e1.style.opacity = e2.style.opacity = (o.gain != null ? o.gain : 0.9);
      var hold = 1800 + Math.random() * 2200;
      setTimeout(function () {
        e1.classList.add('blink'); e2.classList.add('blink');
        setTimeout(function () { e1.classList.remove('blink'); e2.classList.remove('blink'); }, 110);
      }, hold * 0.55);
      setTimeout(function () { e1.style.opacity = e2.style.opacity = 0; }, hold);
    }
    var first = true;
    (function next() {
      var g = first ? (o.first != null ? o.first : 2600)
                    : (o.min || 9000) + Math.random() * ((o.max || 26000) - (o.min || 9000));
      first = false;
      setTimeout(function () { look(); next(); }, g);
    })();
  }

  // 2) SILUETA EN LA TARIMA: de pie detrás de la estática, asoma fracciones de segundo
  function silhouetteFx(tube, o) {
    o = o || {};
    var box = D.createElement('div'); box.className = 'standee';
    box.style.setProperty('--op', o.opacity != null ? o.opacity : 0.5);
    box.style.setProperty('--for', (o.for || 620) + 'ms');
    box.innerHTML = SILHOUETTE_SVG; tube.appendChild(box);
    function flash() { box.classList.remove('show'); void box.offsetWidth; box.classList.add('show'); }
    var first = true;
    (function next() {
      var g = first ? (o.first != null ? o.first : 4200)
                    : (o.min || 12000) + Math.random() * ((o.max || 32000) - (o.min || 12000));
      first = false;
      setTimeout(function () { flash(); next(); }, g);
    })();
    return { flash: flash };
  }

  // 3) HUD DE CÁMARA: reencuadre de vigilancia nocturna (tinte verde + CAM + SIGNAL LOST)
  function camFx(tube, o) {
    o = o || {};
    var cast = D.createElement('div'); cast.className = 'camcast'; tube.appendChild(cast);
    var hud = D.createElement('div'); hud.className = 'cam-hud';
    hud.innerHTML =
      '<div class="camid">CAM ' + (o.id || '0X') + '</div>' +
      '<div class="camrec"><b></b>REC</div>' +
      '<div class="lost">▮ SIGNAL LOST</div>' +
      '<div class="bl">' + (o.note || 'NIGHT VISION · AUTO') + '</div>';
    tube.appendChild(hud);
    var lost = hud.querySelector('.lost');
    var first = true;
    (function next() {
      var g = first ? (o.first != null ? o.first : 3000)
                    : (o.min || 6000) + Math.random() * ((o.max || 16000) - (o.min || 6000));
      first = false;
      setTimeout(function () {
        lost.classList.add('on'); glitch(tube);
        setTimeout(function () { lost.classList.remove('on'); }, o.for || 700);
        next();
      }, g);
    })();
  }

  // stinger suave para acompañar el flash de cara (golpe metálico corto, no grito)
  function faceStinger() {
    var c = audio.ctx, m = audio.master; if (!c || !m || state.m) return;
    var n = c.currentTime;
    var buf = c.createBuffer(1, (c.sampleRate * 0.25) | 0, c.sampleRate);
    var dd = buf.getChannelData(0); for (var i = 0; i < dd.length; i++) dd[i] = Math.random() * 2 - 1;
    var src = c.createBufferSource(); src.buffer = buf;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    var g = c.createGain(); g.gain.setValueAtTime(0, n);
    g.gain.linearRampToValueAtTime(0.05, n + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, n + 0.22);
    src.connect(bp); bp.connect(g); g.connect(m); src.start(n); src.stop(n + 0.25);
    var o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, n); o.frequency.exponentialRampToValueAtTime(45, n + 0.18);
    var og = c.createGain(); og.gain.setValueAtTime(0.06, n); og.gain.exponentialRampToValueAtTime(0.0001, n + 0.2);
    o.connect(og); og.connect(m); o.start(n); o.stop(n + 0.22);
  }

  // 4) CARA QUE PARPADEA: la mascota aparece 1-2 cuadros en los glitches fuertes
  function faceFx(tube, o) {
    o = o || {};
    var box = D.createElement('div'); box.className = 'facejump';
    box.style.setProperty('--op', o.opacity != null ? o.opacity : 0.92);
    box.style.setProperty('--for', (o.for || 130) + 'ms');
    box.innerHTML = FACE_SVG; tube.appendChild(box);
    function flash() {
      box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
      if (!o.silent) faceStinger();
    }
    var first = true;
    (function next() {
      var g = first ? (o.first != null ? o.first : 9000)
                    : (o.min || 24000) + Math.random() * ((o.max || 70000) - (o.min || 24000));
      first = false;
      setTimeout(function () { flash(); next(); }, g);
    })();
    return { flash: flash };
  }

  // arranca los efectos opt-in de un canal. force=true ignora prefers-reduced-motion (preview)
  function startFx(tube, fx, force) {
    if (!tube || !fx || (reduce && !force)) return;
    if (fx.eyes) eyesFx(tube, fx.eyes);
    if (fx.silhouette) silhouetteFx(tube, fx.silhouette);
    if (fx.cam) camFx(tube, fx.cam);
    if (fx.face) faceFx(tube, fx.face);
  }

  /* ===================== máquina de escribir ===================== */
  var CURSOR = '<span class="cursor"></span>';
  var GLYPHS = '▓▒█·#%@';

  /* opts: {msgEl, labelEl, guion, corruption 0..1, tube, track, onLine, onDone}
     item del guion: {label, text, ghost:{word,at}, hold} */
  function typer(opts) {
    var line = 0, alive = true;

    function esc(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function speed() { return 34 + Math.random() * 46; }

    function maybeFx() {
      if (Math.random() < 0.10 * (opts.corruption || 0) * 4) glitch(opts.tube);
    }

    function typeItem(item, done) {
      if (opts.labelEl) opts.labelEl.textContent = item.label || '';
      var shown = '';   // texto ya fijado
      var i = 0;
      var c = opts.corruption || 0;

      function put(extra) {
        opts.msgEl.innerHTML = esc(shown + (extra || '')) + CURSOR;
      }

      function step() {
        if (!alive) return;
        // palabra fantasma: se escribe, respira, se borra
        if (item.ghost && i === item.ghost.at && !item._ghostDone) {
          item._ghostDone = true;
          var word = item.ghost.word, gi = 0;
          (function typeGhost() {
            if (!alive) return;
            if (gi <= word.length) {
              put(word.slice(0, gi)); gi++;
              setTimeout(typeGhost, 90); // más lenta: que se pueda leer
            } else {
              setTimeout(function eraseGhost() {
                if (!alive) return;
                if (gi > 0) { gi--; put(word.slice(0, gi)); setTimeout(eraseGhost, 45); }
                else setTimeout(step, 300);
              }, 1400); // la pausa donde vive el fragmento
            }
          })();
          return;
        }
        if (i < item.text.length) {
          // corrupción: caracter equivocado que se corrige, o basura breve
          if (c > 0 && Math.random() < c * 0.18) {
            var bad = GLYPHS[(Math.random() * GLYPHS.length) | 0];
            put(bad); maybeFx();
            setTimeout(function () {
              if (!alive) return;
              shown += item.text[i]; i++; put();
              setTimeout(step, speed() * (1 + c));
            }, 120 + Math.random() * 180);
            return;
          }
          shown += item.text[i]; i++; put(); maybeFx();
          setTimeout(step, speed() * (1 + c * 0.8));
        } else {
          setTimeout(done, item.hold || 2100);
        }
      }
      put(); step();
    }

    function next() {
      if (!alive) return;
      if (line >= opts.guion.length) { if (opts.onDone) opts.onDone(); return; }
      var item = opts.guion[line];
      typeItem(item, function () {
        trackPass(opts.track);
        if (opts.onLine) opts.onLine(line, item);
        line++;
        setTimeout(next, 420);
      });
    }

    next();
    return { stop: function () { alive = false; } };
  }

  /* ===================== arranque estándar de canal ===================== */
  /* cfg: {ch, audio, onLocked, onAir(els)} — decide bloqueado/al aire,
     cablea encendido, reloj, mute y enlaces. */
  function page(cfg) {
    readState();
    applyLinks();
    var els = {
      power: D.getElementById('power'),
      powerBtn: D.getElementById('powerBtn'),
      turnon: D.getElementById('turnon'),
      tube: D.getElementById('tube'),
      msg: D.getElementById('msg'),
      label: D.getElementById('label'),
      clock: D.getElementById('clock'),
      status: D.getElementById('status'),
      mute: D.getElementById('mute'),
      track: D.getElementById('track'),
      snow: D.getElementById('snow'),
      tbody: D.getElementById('tbody')
    };
    if (els.clock) startClock(els.clock);

    if (els.mute) {
      function paintMute() { els.mute.textContent = 'Sonido: ' + (state.m ? 'off' : 'on'); }
      paintMute();
      els.mute.addEventListener('click', function () {
        setMuted(!state.m); paintMute();
      });
    }

    var now = new Date();
    var open = isUnlocked(cfg.ch, now, state.v);

    consoleSig();

    if (!open) {
      // canal muerto: nada de encendido, estática y una pista
      if (els.power) els.power.classList.add('off');
      els.tube.classList.add('on');
      if (els.snow) snow(els.snow, { intensity: 0.45, fps: 16 });
      // el 6 tranquiliza: la ventana es a TU hora local, vuelvas de donde vuelvas
      var extra = '';
      if (cfg.ch === 6) {
        var z = tz();
        extra = '<p class="pista" style="opacity:.6;font-size:.82em">' +
          'la ventana corre por el reloj de tu aparato' + (z ? ' · ' + z : '') +
          '. guarda tu frecuencia y vuelve a tu 03:00.</p>';
      }
      els.tbody.innerHTML =
        '<div class="locked">' +
        '<div class="nosig">Sin señal</div>' +
        '<p class="pista">' + (CH[cfg.ch].hint) + '</p>' + extra +
        '</div>';
      if (els.status) els.status.textContent = 'Canal ' + cfg.ch + ': fuera de emisión';
      if (cfg.onLocked) cfg.onLocked(els);
      return { open: false, els: els };
    }

    markVisited(cfg.ch);
    if (els.powerBtn) {
      els.powerBtn.addEventListener('click', function () {
        buildAudio(cfg.audio || {});
        if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume().catch(function () {});
        els.power.classList.add('off');
        if (!reduce && els.turnon) els.turnon.classList.add('go');
        setTimeout(function () { els.tube.classList.add('on'); }, reduce ? 100 : 650);
        setTimeout(function () {
          if (cfg.onAir) cfg.onAir(els);
          startFx(els.tube, cfg.fx);
        }, reduce ? 700 : 1500);
      });
    }
    return { open: true, els: els };
  }

  /* ===================== api ===================== */
  return {
    band: band,
    isUnlocked: isUnlocked,
    exists: exists,
    parseVisited: parseVisited,
    visitedToString: visitedToString,
    codeFor: codeFor,
    decodeCode: decodeCode,
    applyCode: applyCode,
    tz: tz,
    consoleSig: consoleSig,
    normalizePhrase: normalizePhrase,
    PHRASE_KEY: PHRASE_KEY,
    CH: CH,
    state: state,
    readState: readState,
    href: href,
    applyLinks: applyLinks,
    markVisited: markVisited,
    setMuted: setMuted,
    two: two,
    startClock: startClock,
    horaTexto: horaTexto,
    reduce: reduce,
    glitch: glitch,
    roll: roll,
    trackPass: trackPass,
    snow: snow,
    startFx: startFx,
    buildAudio: buildAudio,
    killAudio: killAudio,
    audio: audio,
    typer: typer,
    page: page
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SENAL;
