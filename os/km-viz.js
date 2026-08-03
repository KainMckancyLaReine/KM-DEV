/* =========================================================
   KM.viz — SVG-visuals voor KM.OS
   Alles geeft een SVG-string terug. Animaties starten vanzelf
   zodra het element in de DOM staat (CSS-transitions op een
   klasse die in de volgende frame wordt gezet).
   ========================================================= */
(function(global){
'use strict';

var uid = function(){ return 'v' + Math.random().toString(36).slice(2,8); };
var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var num = function(n){ return Math.round(n * 100) / 100; };

/* polar helper */
function pol(cx, cy, r, deg){
    var a = (deg - 90) * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
/* gladde curve door punten (Catmull-Rom → bezier) */
function smooth(pts, close){
    if(pts.length < 2) return '';
    var d = 'M' + num(pts[0][0]) + ' ' + num(pts[0][1]);
    for(var i = 0; i < pts.length - 1; i++){
        var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
        var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
        var c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        d += 'C' + num(c1[0]) + ' ' + num(c1[1]) + ',' + num(c2[0]) + ' ' + num(c2[1]) + ',' + num(p2[0]) + ' ' + num(p2[1]);
    }
    return d + (close ? 'Z' : '');
}

/* =========================================================
   1. RADAR — levensbalans
   ========================================================= */
function radar(o){
    var axes = o.axes || [], n = axes.length;
    if(n < 3) return '<div class="viz-empty">Te weinig assen</div>';
    var S = o.size || 260, cx = S/2, cy = S/2, R = S/2 - (o.pad == null ? 34 : o.pad);
    var id = uid(), rings = o.rings || 4;
    var svg = '<svg class="viz viz-radar" viewBox="0 0 ' + S + ' ' + S + '" width="100%" style="max-width:' + S + 'px;overflow:visible;">';

    svg += '<defs><radialGradient id="' + id + 'g"><stop offset="0" stop-color="var(--accent)" stop-opacity=".42"/>' +
           '<stop offset="1" stop-color="var(--accent)" stop-opacity=".08"/></radialGradient></defs>';

    /* raster */
    for(var r = 1; r <= rings; r++){
        var pts = [];
        for(var i = 0; i < n; i++) pts.push(pol(cx, cy, R * r / rings, i * 360 / n));
        svg += '<polygon points="' + pts.map(function(p){ return num(p[0]) + ',' + num(p[1]); }).join(' ') +
               '" fill="none" stroke="var(--line)" stroke-width="1"' + (r === rings ? '' : ' stroke-dasharray="2 4"') + '/>';
    }
    for(var j = 0; j < n; j++){
        var e = pol(cx, cy, R, j * 360 / n);
        svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + num(e[0]) + '" y2="' + num(e[1]) + '" stroke="var(--line)" stroke-width="1"/>';
    }

    /* waarde-polygoon */
    var vp = axes.map(function(a, i){ return pol(cx, cy, R * Math.max(.04, Math.min(1, a.value)), i * 360 / n); });
    var zp = axes.map(function(a, i){ return pol(cx, cy, 0.001, i * 360 / n); });
    svg += '<polygon class="viz-shape" points="' + zp.map(function(p){ return num(p[0]) + ',' + num(p[1]); }).join(' ') +
           '" data-to="' + vp.map(function(p){ return num(p[0]) + ',' + num(p[1]); }).join(' ') +
           '" fill="url(#' + id + 'g)" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>';

    /* punten + labels */
    axes.forEach(function(a, i){
        var p = vp[i], l = pol(cx, cy, R + 19, i * 360 / n);
        svg += '<circle class="viz-dot" cx="' + num(p[0]) + '" cy="' + num(p[1]) + '" r="4.5" fill="' + (a.color || 'var(--accent)') +
               '" stroke="var(--paper)" stroke-width="2" style="transition-delay:' + (.25 + i*.06) + 's"/>';
        var anchor = Math.abs(l[0] - cx) < 6 ? 'middle' : (l[0] > cx ? 'start' : 'end');
        svg += '<text x="' + num(l[0]) + '" y="' + num(l[1] + 4) + '" text-anchor="' + anchor + '" ' +
               'font-family="\'Space Mono\', monospace" font-size="9" letter-spacing="1.2" ' +
               'fill="var(--text-faint)">' + esc((a.label || '').toUpperCase().slice(0,12)) + '</text>';
        if(a.icon) svg += '<text x="' + num(l[0]) + '" y="' + num(l[1] - 10) + '" text-anchor="' + anchor + '" font-size="13">' + a.icon + '</text>';
    });
    return svg + '</svg>';
}

/* =========================================================
   2. DONUT
   ========================================================= */
function donut(o){
    var slices = (o.slices || []).filter(function(s){ return s.value > 0; });
    var S = o.size || 180, cx = S/2, cy = S/2;
    var th = o.thickness || 18, R = S/2 - th/2 - 2;
    var total = slices.reduce(function(a,s){ return a + s.value; }, 0) || 1;
    var C = 2 * Math.PI * R, off = 0;
    var svg = '<svg class="viz viz-donut" viewBox="0 0 ' + S + ' ' + S + '" width="100%" style="max-width:' + S + 'px;">';
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + num(R) + '" fill="none" stroke="var(--line)" stroke-width="' + th + '"/>';
    svg += '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">';
    slices.forEach(function(s, i){
        var frac = s.value / total, len = C * frac;
        svg += '<circle class="viz-arc" cx="' + cx + '" cy="' + cy + '" r="' + num(R) + '" fill="none" ' +
            'stroke="' + s.color + '" stroke-width="' + th + '" stroke-linecap="butt" ' +
            'stroke-dasharray="' + num(len - 2) + ' ' + num(C) + '" ' +
            'stroke-dashoffset="' + num(-off) + '" ' +
            'data-len="' + num(len - 2) + '" ' +
            'style="stroke-dasharray:0 ' + num(C) + ';transition-delay:' + (i * .09) + 's"><title>' + esc(s.label) + ': ' + s.value + '</title></circle>';
        off += len;
    });
    svg += '</g>';
    if(o.center){
        svg += '<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" font-family="\'Space Grotesk\', sans-serif" ' +
            'font-size="' + (o.centerSize || 26) + '" font-weight="700" fill="var(--text)">' + esc(o.center.big) + '</text>';
        if(o.center.small) svg += '<text x="' + cx + '" y="' + (cy + 15) + '" text-anchor="middle" ' +
            'font-family="\'Space Mono\', monospace" font-size="8.5" letter-spacing="1.4" fill="var(--text-faint)">' +
            esc(String(o.center.small).toUpperCase()) + '</text>';
    }
    return svg + '</svg>';
}

/* =========================================================
   3. AREA / LIJN
   ========================================================= */
function area(o){
    var pts = o.points || [];
    if(!pts.length) return '<div class="viz-empty">Geen data</div>';
    var W = o.w || 560, H = o.h || 150, pad = o.pad || 6;
    var max = o.max != null ? o.max : Math.max.apply(null, pts.concat([1]));
    var id = uid();
    var step = pts.length > 1 ? (W - pad*2) / (pts.length - 1) : 0;
    var xy = pts.map(function(v, i){ return [pad + i*step, H - pad - (v / max) * (H - pad*2)]; });
    var line = smooth(xy);
    var fill = line + 'L' + num(xy[xy.length-1][0]) + ' ' + (H-pad) + 'L' + num(xy[0][0]) + ' ' + (H-pad) + 'Z';
    var col = o.color || 'var(--accent)';

    var svg = '<svg class="viz viz-area" viewBox="0 0 ' + W + ' ' + H + '" width="100%" preserveAspectRatio="none" style="height:' + H + 'px;">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="' + col + '" stop-opacity=".38"/>' +
        '<stop offset="1" stop-color="' + col + '" stop-opacity="0"/></linearGradient></defs>';

    /* horizontale hulplijnen */
    for(var g = 1; g <= 3; g++){
        var y = pad + (H - pad*2) * g / 4;
        svg += '<line x1="0" y1="' + num(y) + '" x2="' + W + '" y2="' + num(y) + '" stroke="var(--line)" stroke-width="1" stroke-dasharray="2 5"/>';
    }
    svg += '<path class="viz-fill" d="' + fill + '" fill="url(#' + id + ')"/>';
    svg += '<path class="viz-line" d="' + line + '" fill="none" stroke="' + col + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';

    if(o.dots !== false){
        xy.forEach(function(p, i){
            if(pts.length > 40 && i % 3) return;
            svg += '<circle class="viz-dot" cx="' + num(p[0]) + '" cy="' + num(p[1]) + '" r="' + (i === xy.length-1 ? 4.5 : 2.6) + '" ' +
                'fill="' + (i === xy.length-1 ? col : 'var(--paper)') + '" stroke="' + col + '" stroke-width="1.8" ' +
                'style="transition-delay:' + (.3 + i*.012) + 's"><title>' + (o.labels ? esc(o.labels[i]) + ': ' : '') + pts[i] + '</title></circle>';
        });
    }
    return svg + '</svg>';
}

/* =========================================================
   4. STAAFDIAGRAM
   ========================================================= */
function bars(o){
    var items = o.items || [];
    if(!items.length) return '<div class="viz-empty">Geen data</div>';
    var max = Math.max.apply(null, items.map(function(i){ return i.value; }).concat([1]));
    return '<div class="viz-bars" style="--h:' + (o.h || 130) + 'px">' + items.map(function(it, i){
        var pct = Math.max(2, it.value / max * 100);
        return '<div class="vb" style="--d:' + (i * .05) + 's"><span class="vb-v">' + (it.value || '') + '</span>' +
            '<i class="vb-bar" data-h="' + num(pct) + '" style="background:' + (it.color || 'var(--accent)') + '"></i>' +
            '<span class="vb-l">' + esc(it.label) + '</span></div>';
    }).join('') + '</div>';
}

/* =========================================================
   5. HEATMAP (GitHub-stijl)
   ========================================================= */
function heatmap(o){
    var days = o.days || {};                    // { '2026-08-03': 3 }
    var weeks = o.weeks || 17;
    var col = o.color || '#c6ff4a';
    var end = o.end ? new Date(o.end) : new Date();
    end.setHours(0,0,0,0);
    // het raster loopt tot en met het einde van de huidige week,
    // zodat "vandaag" niet in de laatste kolom vastgeplakt zit
    var endDow = (end.getDay() + 6) % 7;
    var start = new Date(end);
    start.setDate(start.getDate() + (6 - endDow) - (weeks * 7 - 1));
    var max = Math.max.apply(null, Object.keys(days).map(function(k){ return days[k]; }).concat([1]));

    var cells = '', months = [], lastM = -1, i = 0;
    for(var wi = 0; wi < weeks; wi++){
        for(var di = 0; di < 7; di++){
            var d = new Date(start); d.setDate(start.getDate() + wi*7 + di);
            var key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
            var v = days[key] || 0;
            var lvl = v === 0 ? 0 : Math.min(4, Math.ceil(v / max * 4));
            var future = d > end;
            cells += '<i class="hm-c hm-' + lvl + (future ? ' hm-f' : '') + '" data-d="' + key + '" ' +
                'style="--c:' + col + ';--d:' + (i * .0035) + 's" title="' + key + ': ' + v + '"></i>';
            i++;
            if(di === 0){
                if(d.getMonth() !== lastM){ lastM = d.getMonth(); months.push({ w:wi, m:d.getMonth() }); }
            }
        }
    }
    var MON = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
    var head = months.map(function(m){ return '<span style="grid-column:' + (m.w+1) + '">' + MON[m.m] + '</span>'; }).join('');

    return '<div class="viz-heat">' +
        '<div class="hm-months" style="grid-template-columns:repeat(' + weeks + ',1fr)">' + head + '</div>' +
        '<div class="hm-grid" style="grid-template-columns:repeat(' + weeks + ',1fr)">' + cells + '</div>' +
        '<div class="hm-legend"><span>minder</span><i class="hm-c hm-0"></i><i class="hm-c hm-1" style="--c:' + col + '"></i>' +
        '<i class="hm-c hm-2" style="--c:' + col + '"></i><i class="hm-c hm-3" style="--c:' + col + '"></i>' +
        '<i class="hm-c hm-4" style="--c:' + col + '"></i><span>meer</span></div>' +
    '</div>';
}

/* =========================================================
   5b. STACK — gestapelde capsule (vervangt de donut)
   ========================================================= */
function stack(o){
    var items = (o.items || []).filter(function(x){ return x.value > 0; });
    var total = items.reduce(function(a,x){ return a + x.value; }, 0);
    var h = o.h || 14;
    if(!total) return '<div class="viz-empty">Nog niets te verdelen</div>';

    var bar = '<div class="viz-stack" style="--h:' + h + 'px">' + items.map(function(x, i){
        var pct = x.value / total * 100;
        return '<i data-w="' + pct.toFixed(2) + '" style="background:' + x.color + ';--d:' + (i*.07) + 's" ' +
               'title="' + esc(x.label) + ': ' + x.value + '"></i>';
    }).join('') + '</div>';

    var key = o.key === false ? '' : '<div class="viz-key stack-key">' + items.map(function(x){
        return '<div class="k"><i style="background:' + x.color + '"></i>' + esc(x.label) +
               '<b>' + x.value + (o.suffix || '') + '</b></div>';
    }).join('') + '</div>';

    var head = o.head === false ? '' :
        '<div class="stack-head"><b>' + esc(o.big != null ? o.big : total) + '</b>' +
        (o.small ? '<span>' + esc(o.small) + '</span>' : '') + '</div>';

    return '<div class="viz viz-stackwrap" style="width:100%">' + head + bar + key + '</div>';
}

/* =========================================================
   6. GAUGE — halve ring
   ========================================================= */
function gauge(o){
    var v = Math.max(0, Math.min(1, o.value || 0));
    var S = o.size || 150, cx = S/2, cy = S*.62, R = S/2 - 14, th = o.thickness || 11;
    var arc = Math.PI * R;
    var col = o.color || 'var(--accent)';
    var gid = uid();
    var d = 'M' + (cx - R) + ' ' + cy + ' A' + R + ' ' + R + ' 0 0 1 ' + (cx + R) + ' ' + cy;
    return '<svg class="viz viz-gauge" viewBox="0 0 ' + S + ' ' + (S*.76) + '" width="100%" style="max-width:' + S + 'px;">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#c6ff4a"/><stop offset="1" stop-color="#3f5a17"/></linearGradient></defs>' +
        '<path d="' + d + '" fill="none" stroke="var(--line)" stroke-width="' + th + '" stroke-linecap="round"/>' +
        '<path class="viz-arc" d="' + d + '" fill="none" stroke="' + (col === 'var(--accent)' ? 'url(#' + gid + ')' : col) + '" stroke-width="' + th + '" stroke-linecap="round" ' +
            'stroke-dasharray="' + num(arc) + '" stroke-dashoffset="' + num(arc) + '" data-off="' + num(arc * (1 - v)) + '"/>' +
        '<text x="' + cx + '" y="' + (cy - 6) + '" text-anchor="middle" font-family="\'Space Grotesk\', sans-serif" ' +
            'font-size="' + (o.big || 24) + '" font-weight="700" fill="var(--text)">' + esc(o.label || Math.round(v*100) + '%') + '</text>' +
        (o.sub ? '<text x="' + cx + '" y="' + (cy + 12) + '" text-anchor="middle" font-family="\'Space Mono\', monospace" ' +
            'font-size="8" letter-spacing="1.3" fill="var(--text-faint)">' + esc(String(o.sub).toUpperCase()) + '</text>' : '') +
    '</svg>';
}

/* =========================================================
   7. SPARKLINE
   ========================================================= */
function spark(o){
    var pts = o.points || [];
    if(!pts.length) return '';
    var W = o.w || 120, H = o.h || 34;
    var max = Math.max.apply(null, pts.concat([1]));
    var step = pts.length > 1 ? W / (pts.length - 1) : 0;
    var xy = pts.map(function(v, i){ return [i*step, H - (v/max) * (H - 4) - 2]; });
    return '<svg class="viz viz-spark" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" preserveAspectRatio="none">' +
        '<path class="viz-line" d="' + smooth(xy) + '" fill="none" stroke="' + (o.color || 'var(--accent)') + '" stroke-width="2" stroke-linecap="round"/>' +
        '<circle cx="' + num(xy[xy.length-1][0]) + '" cy="' + num(xy[xy.length-1][1]) + '" r="2.8" fill="' + (o.color || 'var(--accent)') + '"/>' +
    '</svg>';
}

/* =========================================================
   8. RING (voortgang) — compact
   ========================================================= */
function ring(pct, size, stroke, color, label){
    size = size || 54; stroke = stroke || Math.max(3, size * .085);
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, id = uid();
    var col = color || 'var(--accent)';
    var grad = col.charAt(0) === '#';
    return '<div class="viz-ringwrap" style="width:' + size + 'px;height:' + size + 'px;position:relative;flex:0 0 auto;">' +
        '<svg class="viz viz-ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="transform:rotate(-90deg)">' +
        (grad ? '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="' + col + '"/><stop offset="1" stop-color="' + col + '" stop-opacity=".55"/></linearGradient></defs>' : '') +
        '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + num(r) + '" fill="none" stroke="var(--line)" stroke-width="' + stroke + '"/>' +
        '<circle class="viz-arc" cx="' + size/2 + '" cy="' + size/2 + '" r="' + num(r) + '" fill="none" ' +
            'stroke="' + (grad ? 'url(#' + id + ')' : col) + '" ' +
            'stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + num(c) + '" ' +
            'stroke-dashoffset="' + num(c) + '" data-off="' + num(c * (1 - Math.max(0,Math.min(100,pct))/100)) + '"/></svg>' +
        (label ? '<span class="ring-lbl" style="font-size:' + Math.round(size*.26) + 'px">' + esc(label) + '</span>' : '') +
    '</div>';
}

/* =========================================================
   9. Animaties activeren
   ========================================================= */
function animate(root){
    root = root || document;
    requestAnimationFrame(function(){
        requestAnimationFrame(function(){
            [].forEach.call(root.querySelectorAll('.viz-arc[data-off]'), function(el){
                el.style.strokeDashoffset = el.dataset.off;
            });
            [].forEach.call(root.querySelectorAll('.viz-arc[data-len]'), function(el){
                var da = el.getAttribute('stroke-dasharray').split(' ');
                el.style.strokeDasharray = el.dataset.len + ' ' + da[1];
            });
            [].forEach.call(root.querySelectorAll('.viz-shape[data-to]'), function(el){
                el.setAttribute('points', el.dataset.to);
            });
            [].forEach.call(root.querySelectorAll('.vb-bar[data-h]'), function(el){
                el.style.height = el.dataset.h + '%';
            });
            [].forEach.call(root.querySelectorAll('.viz-stack i[data-w]'), function(el){
                el.style.width = el.dataset.w + '%';
            });
            [].forEach.call(root.querySelectorAll('.viz'), function(el){ el.classList.add('viz-in'); });
            [].forEach.call(root.querySelectorAll('.viz-heat, .viz-bars'), function(el){ el.classList.add('viz-in'); });
        });
    });
}

/* tellers laten oplopen */
function count(el, to, dur, suffix){
    if(!el) return;
    var from = parseFloat(el.dataset.v || '0') || 0;
    dur = dur || 900;
    var t0 = performance.now();
    el.dataset.v = to;
    (function step(now){
        var p = Math.min(1, (now - t0) / dur);
        var e = 1 - Math.pow(1 - p, 3);
        var val = from + (to - from) * e;
        el.textContent = (Math.abs(to) < 10 && to % 1 !== 0 ? val.toFixed(1) : Math.round(val)) + (suffix || '');
        if(p < 1) requestAnimationFrame(step);
    })(t0);
}

global.KMviz = { radar:radar, donut:donut, stack:stack, area:area, bars:bars, heatmap:heatmap,
                 gauge:gauge, spark:spark, ring:ring, animate:animate, count:count, smooth:smooth };

})(window);
