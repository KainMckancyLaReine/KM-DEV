/* =========================================================
   KM.clock — de tijd als kunstwerk
   Een canvas-stuk dat de tijd niet alleen aflezbaar maakt maar
   ook laat voelen: seconden lopen als een komeet, minuten als
   een vloeiende boog, uren als bloeiende punten, en de kleur
   verschuift met het uur van de dag.
   Drie modi: chrono · orbit · bloom. Klik om te wisselen.
   ========================================================= */
(function(global){
'use strict';

var MODES = ['chrono', 'orbit', 'bloom'];
var TAU = Math.PI * 2;

/* kleur van de dag: nacht → dageraad → dag → schemer → nacht */
var PALETTE = [
    { h:0,  a:'#3b4a7a', b:'#12172e', n:'nacht'    },
    { h:5,  a:'#c47b8a', b:'#43304f', n:'dageraad' },
    { h:8,  a:'#ffb648', b:'#5d4a2a', n:'ochtend'  },
    { h:12, a:'#c6ff4a', b:'#3f5a17', n:'middag'   },
    { h:17, a:'#ff9d5c', b:'#6b3a2a', n:'namiddag' },
    { h:20, a:'#a76bd6', b:'#3a2450', n:'schemer'  },
    { h:23, a:'#3b4a7a', b:'#12172e', n:'nacht'    }
];
function hex2rgb(h){
    h = String(h).replace('#','');
    if(h.length === 3) h = h.split('').map(function(c){ return c+c; }).join('');
    var n = parseInt(h, 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
}
function mixHex(a, b, t){
    var A = hex2rgb(a), B = hex2rgb(b);
    return 'rgb(' + Math.round(A[0]+(B[0]-A[0])*t) + ',' +
                    Math.round(A[1]+(B[1]-A[1])*t) + ',' +
                    Math.round(A[2]+(B[2]-A[2])*t) + ')';
}
function rgba(hex, a){
    var c = hex2rgb(hex);
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
}
function paletteAt(hours){
    for(var i = 0; i < PALETTE.length - 1; i++){
        var p = PALETTE[i], q = PALETTE[i+1];
        if(hours >= p.h && hours <= q.h){
            var t = (hours - p.h) / Math.max(.001, q.h - p.h);
            return { a: mixHex(p.a, q.a, t), b: mixHex(p.b, q.b, t), name: t < .5 ? p.n : q.n,
                     rawA: t < .5 ? p.a : q.a };
        }
    }
    return { a:PALETTE[0].a, b:PALETTE[0].b, name:PALETTE[0].n, rawA:PALETTE[0].a };
}

/* =========================================================
   Instantie
   ========================================================= */
function mount(host, opt){
    opt = opt || {};
    if(!host) return null;

    var size = opt.size || 300;
    var mode = opt.mode || localStorage.getItem('kmdev_clock_mode') || 'chrono';
    if(MODES.indexOf(mode) < 0) mode = 'chrono';

    host.classList.add('kclock');
    host.innerHTML =
        '<canvas class="kc-cv"></canvas>' +
        '<div class="kc-face">' +
            '<div class="kc-digits" aria-live="off">' +
                '<span class="kc-d" data-i="0">0</span>' +
                '<span class="kc-d" data-i="1">0</span>' +
                '<span class="kc-sep">:</span>' +
                '<span class="kc-d" data-i="2">0</span>' +
                '<span class="kc-d" data-i="3">0</span>' +
            '</div>' +
            '<div class="kc-sub"><span class="kc-secs">00</span><span class="kc-dot"></span><span class="kc-part">—</span></div>' +
        '</div>' +
        '<div class="kc-mode"><span></span><span></span><span></span></div>';

    var cv = host.querySelector('.kc-cv');
    var ctx = cv.getContext('2d');
    var digits = [].slice.call(host.querySelectorAll('.kc-d'));
    var secsEl = host.querySelector('.kc-secs');
    var partEl = host.querySelector('.kc-part');
    var modeDots = [].slice.call(host.querySelectorAll('.kc-mode span'));

    var W = size, H = size, dpr = 1;
    var raf = 0, dead = false;
    var last = { d0:'', d1:'', d2:'', d3:'', s:-1 };
    var tilt = { x:0, y:0, tx:0, ty:0 };
    var pops = [];          // seconde-tikken die net "poppen"
    var trail = [];         // sporen voor de orbit-modus
    var sun = null;         // { rise:Date, set:Date }
    var theme = {};

    /* De dagkleur is soms te licht voor een witte achtergrond (lime op de middag).
       Voor lijnen en punten trekken we hem daarom naar ink; de zachte gloed
       gebruikt de rauwe kleur, die mag wel bleek zijn. */
    function ink(hex){ return theme.dark ? hex : mixHex(hex, '#0d0d0d', .45); }

    function readTheme(){
        var cs = getComputedStyle(document.documentElement);
        theme.line = (cs.getPropertyValue('--line') || '#e4e2d9').trim();
        theme.text = (cs.getPropertyValue('--text') || '#0d0d0d').trim();
        theme.faint = (cs.getPropertyValue('--text-faint') || '#b6b4ac').trim();
        theme.paper = (cs.getPropertyValue('--paper') || '#ffffff').trim();
        theme.dark = document.documentElement.dataset.theme === 'dark';
    }
    readTheme();

    function resize(){
        var r = host.getBoundingClientRect();
        size = Math.max(180, Math.min(opt.max || 340, r.width || size));
        W = H = size;
        dpr = Math.min(2, window.devicePixelRatio || 1);
        cv.width = W * dpr; cv.height = H * dpr;
        cv.style.width = W + 'px'; cv.style.height = H + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        host.style.setProperty('--kc-size', W + 'px');
    }

    /* ---------- cijfers met morph ---------- */
    function setDigit(i, val){
        var el = digits[i];
        if(!el || el.textContent === val) return;
        var old = el.cloneNode(true);
        old.classList.add('out');
        el.parentNode.insertBefore(old, el);
        setTimeout(function(){ old.remove(); }, 620);
        el.textContent = val;
        el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
    }

    /* ---------- tekenhulpjes ---------- */
    function ring(cx, cy, r, from, to, w, style, cap){
        ctx.beginPath();
        ctx.arc(cx, cy, r, from, to);
        ctx.lineWidth = w;
        ctx.strokeStyle = style;
        ctx.lineCap = cap || 'round';
        ctx.stroke();
    }
    function dot(x, y, r, style, blur){
        if(blur){ ctx.save(); ctx.shadowColor = style; ctx.shadowBlur = blur; }
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = style; ctx.fill();
        if(blur) ctx.restore();
    }

    /* ---------- de drie modi ---------- */
    function drawChrono(t, pal){
        var cx = W/2, cy = H/2;
        var R = W * .42;
        var sec = t.getSeconds() + t.getMilliseconds()/1000;
        var min = t.getMinutes() + sec/60;
        var hr  = (t.getHours() % 12) + min/60;

        /* zachte gloed in de kleur van het uur */
        var K = ink(pal.rawA);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.25);
        g.addColorStop(0, rgba(pal.rawA, theme.dark ? .16 : .10));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        /* zonneboog: waar staat de zon nu tussen op en onder */
        if(sun){
            var p = (Date.now() - sun.rise) / Math.max(1, sun.set - sun.rise);
            var a0 = -Math.PI * .82, a1 = -Math.PI * .18;
            ring(cx, cy, R * 1.06, a0, a1, 1.5, rgba(K, .26));
            if(p > 0 && p < 1){
                var sa = a0 + (a1 - a0) * p;
                dot(cx + Math.cos(sa) * R * 1.06, cy + Math.sin(sa) * R * 1.06, 3.2, rgba('#ffd66b', .9), 10);
            }
        }

        /* 60 seconde-tikken */
        for(var i = 0; i < 60; i++){
            var a = -Math.PI/2 + i / 60 * TAU;
            var passed = i <= Math.floor(sec);
            var isFive = i % 5 === 0;
            var len = isFive ? R * .085 : R * .045;
            var pop = 0;
            for(var k = 0; k < pops.length; k++) if(pops[k].i === i) pop = pops[k].v;
            var r0 = R - len - pop * 5, r1 = R + pop * 3;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
            ctx.lineWidth = isFive ? 2 : 1.2;
            ctx.strokeStyle = passed
                ? rgba(K, .5 + pop * .5 + (isFive ? .22 : 0))
                : (theme.dark ? 'rgba(255,255,255,.13)' : 'rgba(13,13,13,.16)');
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        /* komeet op de secondering */
        var sa2 = -Math.PI/2 + (sec / 60) * TAU;
        for(var q = 0; q < 22; q++){
            var back = sa2 - q * .022;
            var fade = (1 - q / 22);
            dot(cx + Math.cos(back) * R, cy + Math.sin(back) * R, 1.2 + fade * 2.6,
                rgba(K, fade * .55), 0);
        }
        dot(cx + Math.cos(sa2) * R, cy + Math.sin(sa2) * R, 4.6, rgba(K, 1), 14);

        /* minutenboog met lichte golving */
        var ma = -Math.PI/2 + (min / 60) * TAU;
        var mr = R * .78;
        ctx.beginPath();
        for(var s2 = -Math.PI/2; s2 <= ma; s2 += .012){
            var wob = Math.sin(s2 * 7 + Date.now()/900) * 1.6;
            var x = cx + Math.cos(s2) * (mr + wob), y = cy + Math.sin(s2) * (mr + wob);
            if(s2 === -Math.PI/2) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        var lg = ctx.createLinearGradient(cx - mr, cy - mr, cx + mr, cy + mr);
        lg.addColorStop(0, rgba(K, .95));
        lg.addColorStop(1, rgba(K, .42));
        ctx.strokeStyle = lg; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.stroke();

        /* 12 uur-punten, de huidige bloeit */
        for(var h = 0; h < 12; h++){
            var ha = -Math.PI/2 + h / 12 * TAU;
            var hr2 = R * .58;
            var active = Math.floor(hr) % 12 === h;
            var pulse = active ? 1 + Math.sin(Date.now()/620) * .16 : 1;
            dot(cx + Math.cos(ha) * hr2, cy + Math.sin(ha) * hr2,
                (active ? 5.4 : 2) * pulse,
                active ? rgba(K, 1) : (theme.dark ? 'rgba(255,255,255,.20)' : 'rgba(13,13,13,.20)'),
                active ? 12 : 0);
        }

        /* fijne binnenring die traag draait */
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Date.now() / 26000);
        for(var v = 0; v < 36; v++){
            var va = v / 36 * TAU;
            ctx.beginPath();
            ctx.moveTo(Math.cos(va) * R * .30, Math.sin(va) * R * .30);
            ctx.lineTo(Math.cos(va) * R * .34, Math.sin(va) * R * .34);
            ctx.strokeStyle = theme.dark ? 'rgba(255,255,255,.08)' : 'rgba(13,13,13,.09)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawOrbit(t, pal){
        var cx = W/2, cy = H/2, R = W * .40;
        var sec = t.getSeconds() + t.getMilliseconds()/1000;
        var min = t.getMinutes() + sec/60;
        var hr  = (t.getHours() % 12) + min/60;

        var K = ink(pal.rawA);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3);
        g.addColorStop(0, rgba(pal.rawA, theme.dark ? .14 : .09));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        var bodies = [
            { r:R,        a:sec/60*TAU,  size:5,   tilt:.24,  col:K },
            { r:R * .70,  a:min/60*TAU,  size:7,   tilt:-.18, col:mixHex(K, theme.dark ? '#ffffff' : '#0d0d0d', .22) },
            { r:R * .42,  a:hr/12*TAU,   size:9.5, tilt:.34,  col:mixHex(K, '#0d0d0d', .35) }
        ];

        bodies.forEach(function(b, i){
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(b.tilt);
            ctx.beginPath();
            ctx.ellipse(0, 0, b.r, b.r * .62, 0, 0, TAU);
            ctx.strokeStyle = theme.dark ? 'rgba(255,255,255,.11)' : 'rgba(13,13,13,.13)';
            ctx.lineWidth = 1;
            ctx.stroke();

            var ang = -Math.PI/2 + b.a;
            var x = Math.cos(ang) * b.r, y = Math.sin(ang) * b.r * .62;
            /* staart */
            for(var q = 1; q < 16; q++){
                var aa = ang - q * .035 * (i === 0 ? 1 : .4);
                dot(Math.cos(aa) * b.r, Math.sin(aa) * b.r * .62,
                    b.size * (1 - q/16) * .55, rgba(b.col, (1 - q/16) * .35), 0);
            }
            dot(x, y, b.size, rgba(b.col, 1), 14);
            dot(x - b.size*.3, y - b.size*.3, b.size*.32, 'rgba(255,255,255,.6)', 0);
            ctx.restore();
        });

        dot(cx, cy, 3.4, rgba(K, .6), 10);
    }

    function drawBloom(t, pal){
        var cx = W/2, cy = H/2, R = W * .42;
        var sec = t.getSeconds(), ms = t.getMilliseconds();
        var min = t.getMinutes(), hr = t.getHours() % 12;

        var K = ink(pal.rawA);
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3);
        g.addColorStop(0, rgba(pal.rawA, theme.dark ? .15 : .09));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

        /* buitenring: 60 punten voor seconden */
        for(var i = 0; i < 60; i++){
            var a = -Math.PI/2 + i/60*TAU;
            var on = i <= sec;
            var grow = i === sec ? 1 + (1 - ms/1000) * 1.3 : 1;
            dot(cx + Math.cos(a) * R, cy + Math.sin(a) * R,
                (on ? 2.6 : 1.4) * grow,
                on ? rgba(K, .38 + (i === sec ? .62 : .26)) :
                     (theme.dark ? 'rgba(255,255,255,.13)' : 'rgba(13,13,13,.15)'),
                i === sec ? 14 : 0);
        }
        /* middenring: 60 punten voor minuten */
        for(var m = 0; m < 60; m += 1){
            var ma = -Math.PI/2 + m/60*TAU;
            var mon = m <= min;
            if(!mon && m % 5 !== 0) continue;
            dot(cx + Math.cos(ma) * R * .72, cy + Math.sin(ma) * R * .72,
                mon ? (m === min ? 4.4 : 2.2) : 1.2,
                mon ? rgba(K, m === min ? 1 : .5)
                    : (theme.dark ? 'rgba(255,255,255,.12)' : 'rgba(13,13,13,.13)'),
                m === min ? 12 : 0);
        }
        /* binnenring: 12 bloemblaadjes voor uren */
        for(var h = 0; h < 12; h++){
            var ha = -Math.PI/2 + h/12*TAU;
            var on2 = h <= hr;
            var len = R * (on2 ? .40 : .30);
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(ha + Math.PI/2);
            ctx.beginPath();
            ctx.moveTo(0, -R * .16);
            ctx.quadraticCurveTo(R * .075, -len * .6, 0, -len);
            ctx.quadraticCurveTo(-R * .075, -len * .6, 0, -R * .16);
            ctx.fillStyle = on2 ? rgba(K, h === hr ? .88 : .34)
                                : (theme.dark ? 'rgba(255,255,255,.07)' : 'rgba(13,13,13,.07)');
            ctx.fill();
            ctx.restore();
        }
    }

    /* ---------- lus ---------- */
    function frame(){
        if(dead) return;
        var t = new Date();
        var hours = t.getHours() + t.getMinutes()/60;
        var pal = paletteAt(hours);

        /* seconde-pop bijhouden */
        if(t.getSeconds() !== last.s){
            last.s = t.getSeconds();
            pops.push({ i:last.s, v:1 });
            secsEl.textContent = String(last.s).padStart(2, '0');
        }
        for(var i = pops.length - 1; i >= 0; i--){
            pops[i].v *= .90;
            if(pops[i].v < .02) pops.splice(i, 1);
        }

        var hh = String(t.getHours()).padStart(2, '0');
        var mm = String(t.getMinutes()).padStart(2, '0');
        setDigit(0, hh[0]); setDigit(1, hh[1]);
        setDigit(2, mm[0]); setDigit(3, mm[1]);
        partEl.textContent = pal.name;
        host.style.setProperty('--kc-accent', ink(pal.rawA));

        /* parallax die naloopt */
        tilt.x += (tilt.tx - tilt.x) * .08;
        tilt.y += (tilt.ty - tilt.y) * .08;
        host.style.setProperty('--kc-rx', (tilt.y * -6).toFixed(2) + 'deg');
        host.style.setProperty('--kc-ry', (tilt.x * 6).toFixed(2) + 'deg');

        ctx.clearRect(0, 0, W, H);
        if(mode === 'orbit') drawOrbit(t, pal);
        else if(mode === 'bloom') drawBloom(t, pal);
        else drawChrono(t, pal);

        raf = requestAnimationFrame(frame);
    }

    /* ---------- interactie ---------- */
    function onMove(e){
        var r = host.getBoundingClientRect();
        tilt.tx = ((e.clientX - r.left) / r.width - .5) * 2;
        tilt.ty = ((e.clientY - r.top) / r.height - .5) * 2;
    }
    function onLeave(){ tilt.tx = 0; tilt.ty = 0; }
    function cycle(){
        mode = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
        localStorage.setItem('kmdev_clock_mode', mode);
        paintDots();
        host.classList.remove('kc-swap'); void host.offsetWidth; host.classList.add('kc-swap');
        if(global.KM && KM.track) KM.track('clock_mode', { mode:mode });
    }
    function paintDots(){
        modeDots.forEach(function(d, i){ d.classList.toggle('on', MODES[i] === mode); });
        host.dataset.mode = mode;
    }

    host.addEventListener('mousemove', onMove);
    host.addEventListener('mouseleave', onLeave);
    host.addEventListener('click', cycle);
    host.setAttribute('title', 'Klik om van vorm te wisselen');

    var themeObs = new MutationObserver(readTheme);
    themeObs.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
    var ro = null;
    if(global.ResizeObserver){ ro = new ResizeObserver(resize); ro.observe(host); }
    else window.addEventListener('resize', resize);

    resize(); paintDots(); frame();

    return {
        el: host,
        get mode(){ return mode; },
        setMode: function(m){ if(MODES.indexOf(m) >= 0){ mode = m; localStorage.setItem('kmdev_clock_mode', m); paintDots(); } },
        cycle: cycle,
        setSun: function(rise, set){
            if(!rise || !set) { sun = null; return; }
            sun = { rise:new Date(rise).getTime(), set:new Date(set).getTime() };
        },
        palette: function(){ var t = new Date(); return paletteAt(t.getHours() + t.getMinutes()/60); },
        resize: resize,
        destroy: function(){
            dead = true; cancelAnimationFrame(raf);
            host.removeEventListener('mousemove', onMove);
            host.removeEventListener('mouseleave', onLeave);
            host.removeEventListener('click', cycle);
            themeObs.disconnect(); if(ro) ro.disconnect();
        }
    };
}

global.KMclock = { mount:mount, MODES:MODES, paletteAt:paletteAt, PALETTE:PALETTE, mixHex:mixHex };

})(window);
