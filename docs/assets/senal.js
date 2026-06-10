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

    if (!open) {
      // canal muerto: nada de encendido, estática y una pista
      if (els.power) els.power.classList.add('off');
      els.tube.classList.add('on');
      if (els.snow) snow(els.snow, { intensity: 0.45, fps: 16 });
      els.tbody.innerHTML =
        '<div class="locked">' +
        '<div class="nosig">Sin señal</div>' +
        '<p class="pista">' + (CH[cfg.ch].hint) + '</p>' +
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
        setTimeout(function () { if (cfg.onAir) cfg.onAir(els); }, reduce ? 700 : 1500);
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
    buildAudio: buildAudio,
    killAudio: killAudio,
    audio: audio,
    typer: typer,
    page: page
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = SENAL;
