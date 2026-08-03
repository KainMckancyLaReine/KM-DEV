/* =========================================================
   KM.weather — live weer via Open-Meteo
   Geen API-sleutel nodig, geen account. Antwoorden worden
   20 minuten gecachet in localStorage, dus je stookt de API
   niet op bij elke paginawissel.
   ========================================================= */
(function(global){
'use strict';

var API   = 'https://api.open-meteo.com/v1/forecast';
var GEO   = 'https://geocoding-api.open-meteo.com/v1/search';
var KEY   = 'kmdev_weather';
var PLACE = 'kmdev_weather_place';
var TTL   = 20 * 60 * 1000;

/* ---------------------------------------------------------
   1. WMO-weercodes → groep, omschrijving, kleuren
   --------------------------------------------------------- */
var CODES = {
    0:  ['clear',   'Onbewolkt'],
    1:  ['partly',  'Overwegend zonnig'],
    2:  ['partly',  'Half bewolkt'],
    3:  ['cloudy',  'Bewolkt'],
    45: ['fog',     'Mist'],
    48: ['fog',     'Aanvriezende mist'],
    51: ['drizzle', 'Lichte motregen'],
    53: ['drizzle', 'Motregen'],
    55: ['drizzle', 'Dichte motregen'],
    56: ['drizzle', 'IJzelmotregen'],
    57: ['drizzle', 'Dichte ijzelmotregen'],
    61: ['rain',    'Lichte regen'],
    63: ['rain',    'Regen'],
    65: ['rain',    'Zware regen'],
    66: ['rain',    'IJzel'],
    67: ['rain',    'Zware ijzel'],
    71: ['snow',    'Lichte sneeuw'],
    73: ['snow',    'Sneeuw'],
    75: ['snow',    'Zware sneeuw'],
    77: ['snow',    'Sneeuwkorrels'],
    80: ['shower',  'Lichte buien'],
    81: ['shower',  'Buien'],
    82: ['shower',  'Zware buien'],
    85: ['snow',    'Sneeuwbuien'],
    86: ['snow',    'Zware sneeuwbuien'],
    95: ['storm',   'Onweer'],
    96: ['storm',   'Onweer met hagel'],
    99: ['storm',   'Zwaar onweer met hagel']
};
var GROUPS = {
    clear:   { tint:'#ffb648', glow:'rgba(255,182,72,.30)',  label:'Onbewolkt' },
    partly:  { tint:'#8fc7ff', glow:'rgba(143,199,255,.26)', label:'Half bewolkt' },
    cloudy:  { tint:'#9aa4ae', glow:'rgba(154,164,174,.24)', label:'Bewolkt' },
    fog:     { tint:'#b6b4ac', glow:'rgba(182,180,172,.24)', label:'Mist' },
    drizzle: { tint:'#6fa8dc', glow:'rgba(111,168,220,.26)', label:'Motregen' },
    rain:    { tint:'#4a8fd4', glow:'rgba(74,143,212,.30)',  label:'Regen' },
    shower:  { tint:'#5aa0e0', glow:'rgba(90,160,224,.30)',  label:'Buien' },
    snow:    { tint:'#cfe6ff', glow:'rgba(207,230,255,.34)', label:'Sneeuw' },
    storm:   { tint:'#8b5cf6', glow:'rgba(139,92,246,.30)',  label:'Onweer' }
};
function decode(code, isDay){
    var c = CODES[code] || ['cloudy', 'Onbekend'];
    var g = GROUPS[c[0]] || GROUPS.cloudy;
    return { group:c[0], text:c[1], tint:g.tint, glow:g.glow, day: isDay == null ? 1 : isDay };
}

/* ---------------------------------------------------------
   2. Geanimeerde SVG-iconen
   --------------------------------------------------------- */
function icon(group, day, size){
    size = size || 64;
    var s = '<svg class="wx-ico wx-' + group + '" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" fill="none">';
    var sun = '<g class="wx-sun"><circle cx="24" cy="24" r="10" fill="url(#wxSun)"/>' +
        '<g class="wx-rays" stroke="#ffb648" stroke-width="2.6" stroke-linecap="round">' +
        [0,45,90,135,180,225,270,315].map(function(a){
            var r = a * Math.PI/180;
            return '<line x1="' + (24 + Math.cos(r)*14).toFixed(1) + '" y1="' + (24 + Math.sin(r)*14).toFixed(1) +
                   '" x2="' + (24 + Math.cos(r)*18).toFixed(1) + '" y2="' + (24 + Math.sin(r)*18).toFixed(1) + '"/>';
        }).join('') + '</g></g>';
    var moon = '<g class="wx-moon"><path d="M32 12a15 15 0 1 0 14 20A17 17 0 0 1 32 12Z" fill="url(#wxMoon)"/>' +
        '<circle cx="47" cy="16" r="1.6" fill="#fff" opacity=".8"/><circle cx="53" cy="24" r="1.1" fill="#fff" opacity=".6"/></g>';
    var cloud = function(cls, o, x, y, sc){
        return '<g class="' + cls + '" opacity="' + o + '" transform="translate(' + x + ',' + y + ') scale(' + sc + ')">' +
            '<path d="M18 40a9 9 0 0 1 1.4-17.9 13 13 0 0 1 24.6 3.4A8.5 8.5 0 0 1 44 40Z" fill="url(#wxCloud)"/></g>';
    };
    var drops = function(color, n){
        var out = '<g class="wx-drops" stroke="' + color + '" stroke-width="2.6" stroke-linecap="round">';
        for(var i = 0; i < n; i++){
            out += '<line class="wx-d' + (i%3) + '" x1="' + (20 + i*9) + '" y1="44" x2="' + (17 + i*9) + '" y2="53"/>';
        }
        return out + '</g>';
    };
    var flakes = function(n){
        var out = '<g class="wx-flakes" fill="#e8f4ff">';
        for(var i = 0; i < n; i++) out += '<circle class="wx-f' + (i%3) + '" cx="' + (21 + i*9) + '" cy="48" r="2.4"/>';
        return out + '</g>';
    };

    s += '<defs>' +
        '<radialGradient id="wxSun"><stop offset="0" stop-color="#ffd66b"/><stop offset="1" stop-color="#ff9d2e"/></radialGradient>' +
        '<linearGradient id="wxMoon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f3ef"/><stop offset="1" stop-color="#c8ccd4"/></linearGradient>' +
        '<linearGradient id="wxCloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d2dc"/></linearGradient>' +
        '</defs>';

    if(group === 'clear')       s += day ? sun : moon;
    else if(group === 'partly') s += (day ? sun : moon) + cloud('wx-cloud', .96, 8, 6, .82);
    else if(group === 'cloudy') s += cloud('wx-cloud2', .55, -2, -2, .78) + cloud('wx-cloud', 1, 6, 6, .84);
    else if(group === 'fog'){
        s += cloud('wx-cloud', .9, 6, 2, .84) +
            '<g class="wx-fog" stroke="#c9d2dc" stroke-width="3" stroke-linecap="round">' +
            '<line class="wx-g0" x1="14" y1="46" x2="46" y2="46"/>' +
            '<line class="wx-g1" x1="18" y1="53" x2="50" y2="53"/></g>';
    }
    else if(group === 'drizzle') s += cloud('wx-cloud', 1, 6, 0, .84) + drops('#6fa8dc', 3);
    else if(group === 'rain')    s += cloud('wx-cloud', 1, 6, 0, .84) + drops('#4a8fd4', 4);
    else if(group === 'shower')  s += (day ? '<g class="wx-sun" transform="translate(6,-4) scale(.72)">' + sun.slice(21) : '') +
                                      cloud('wx-cloud', 1, 6, 2, .84) + drops('#5aa0e0', 3);
    else if(group === 'snow')    s += cloud('wx-cloud', 1, 6, 0, .84) + flakes(4);
    else if(group === 'storm')   s += cloud('wx-cloud', 1, 6, 0, .84) +
                                      '<path class="wx-bolt" d="M32 40 26 52h6l-2 10 10-14h-7l3-8Z" fill="#ffd66b"/>';
    else s += cloud('wx-cloud', 1, 6, 4, .86);

    return s + '</svg>';
}

/* ---------------------------------------------------------
   3. Ophalen
   --------------------------------------------------------- */
function cached(){
    try{
        var c = JSON.parse(localStorage.getItem(KEY) || 'null');
        if(c && Date.now() - c.at < TTL) return c;
        return c ? Object.assign({ stale:true }, c) : null;
    }catch(e){ return null; }
}
function place(){
    try{
        return JSON.parse(localStorage.getItem(PLACE) || 'null') ||
               { name:'Amsterdam', lat:52.3676, lon:4.9041 };
    }catch(e){ return { name:'Amsterdam', lat:52.3676, lon:4.9041 }; }
}
function setPlace(p){
    localStorage.setItem(PLACE, JSON.stringify(p));
    localStorage.removeItem(KEY);
}

var CURRENT = 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,is_day';
var HOURLY  = 'temperature_2m,precipitation_probability,weather_code';
var DAILY   = 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max,uv_index_max';

function url(p){
    return API + '?latitude=' + p.lat + '&longitude=' + p.lon +
        '&current=' + CURRENT + '&hourly=' + HOURLY + '&daily=' + DAILY +
        '&timezone=auto&forecast_days=6&wind_speed_unit=kmh';
}

function load(force){
    var p = place();
    var c = cached();
    if(c && !c.stale && !force && c.name === p.name) return Promise.resolve(shape(c.raw, p));

    return fetch(url(p), { cache:'no-store' })
        .then(function(r){ if(!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
        .then(function(j){
            if(j.error) throw new Error(j.reason || 'API-fout');
            try{ localStorage.setItem(KEY, JSON.stringify({ at:Date.now(), name:p.name, raw:j })); }catch(e){}
            return shape(j, p);
        })
        .catch(function(e){
            if(c) return Object.assign(shape(c.raw, p), { stale:true, error:e.message });
            throw e;
        });
}

/* rauwe respons → bruikbaar model */
function shape(j, p){
    if(!j || !j.current) throw new Error('Onbruikbaar antwoord');
    var cur = j.current, d = j.daily || {}, h = j.hourly || {};
    var cond = decode(cur.weather_code, cur.is_day);

    /* het uur waar we nu in zitten */
    var nowISO = (cur.time || '').slice(0, 13);
    var idx = (h.time || []).findIndex(function(t){ return t.slice(0,13) === nowISO; });
    if(idx < 0) idx = 0;

    var hours = [];
    for(var i = idx; i < Math.min(idx + 24, (h.time||[]).length); i++){
        hours.push({
            time: h.time[i],
            hour: +h.time[i].slice(11,13),
            temp: Math.round(h.temperature_2m[i]),
            rain: h.precipitation_probability ? h.precipitation_probability[i] : 0,
            cond: decode(h.weather_code[i], hourIsDay(h.time[i], d))
        });
    }

    var days = (d.time || []).map(function(t, i){
        return {
            date: t,
            dow: ['zo','ma','di','wo','do','vr','za'][new Date(t + 'T12:00:00').getDay()],
            max: Math.round(d.temperature_2m_max[i]),
            min: Math.round(d.temperature_2m_min[i]),
            rain: d.precipitation_probability_max ? d.precipitation_probability_max[i] : 0,
            uv:  d.uv_index_max ? Math.round(d.uv_index_max[i]) : null,
            cond: decode(d.weather_code[i], 1)
        };
    });

    return {
        place: p.name,
        at: cur.time,
        temp: Math.round(cur.temperature_2m),
        feels: Math.round(cur.apparent_temperature),
        humidity: cur.relative_humidity_2m,
        precip: cur.precipitation,
        wind: Math.round(cur.wind_speed_10m),
        windDir: cur.wind_direction_10m,
        isDay: !!cur.is_day,
        cond: cond,
        sunrise: (d.sunrise || [])[0],
        sunset:  (d.sunset  || [])[0],
        uv: d.uv_index_max ? Math.round(d.uv_index_max[0]) : null,
        today: days[0],
        hours: hours,
        days: days,
        units: j.current_units || {}
    };
}
function hourIsDay(t, d){
    if(!d.sunrise || !d.sunset) return 1;
    var day = t.slice(0,10);
    var i = (d.time || []).indexOf(day);
    if(i < 0) return 1;
    return (t >= d.sunrise[i] && t <= d.sunset[i]) ? 1 : 0;
}

/* ---------------------------------------------------------
   4. Plaats zoeken
   --------------------------------------------------------- */
function search(q){
    if(!q || q.length < 2) return Promise.resolve([]);
    return fetch(GEO + '?name=' + encodeURIComponent(q) + '&count=6&language=nl&format=json')
        .then(function(r){ return r.json(); })
        .then(function(j){
            return (j.results || []).map(function(r){
                return {
                    name: r.name,
                    lat: r.latitude, lon: r.longitude,
                    region: [r.admin1, r.country].filter(Boolean).join(', ')
                };
            });
        })
        .catch(function(){ return []; });
}
function locate(){
    return new Promise(function(res, rej){
        if(!navigator.geolocation) return rej(new Error('Geolocatie niet beschikbaar'));
        navigator.geolocation.getCurrentPosition(function(pos){
            res({ name:'Mijn locatie', lat:+pos.coords.latitude.toFixed(4), lon:+pos.coords.longitude.toFixed(4) });
        }, function(e){ rej(new Error(e.code === 1 ? 'Toegang tot locatie geweigerd' : 'Locatie niet gevonden')); },
        { timeout:9000, maximumAge:600000 });
    });
}

/* ---------------------------------------------------------
   5. Zonneboog
   --------------------------------------------------------- */
function sunArc(w, sunrise, sunset, now, opt){
    opt = opt || {};
    var W = opt.w || 320, H = opt.h || 96;
    var rise = new Date(sunrise).getTime(), set = new Date(sunset).getTime();
    var t = now ? now.getTime() : Date.now();
    var p = Math.max(0, Math.min(1, (t - rise) / Math.max(1, set - rise)));
    var pad = 22, R = (W - pad*2) / 2, cx = W/2, cy = H - 14;

    function pt(u){
        var a = Math.PI * (1 - u);
        return [cx + Math.cos(a) * R, cy - Math.sin(a) * R * .86];
    }
    var a0 = pt(0), a1 = pt(1), pos = pt(p);
    var arc = 'M' + a0[0].toFixed(1) + ' ' + a0[1].toFixed(1) +
              ' A' + R + ' ' + (R*.86).toFixed(1) + ' 0 0 1 ' + a1[0].toFixed(1) + ' ' + a1[1].toFixed(1);

    /* voortgang: zelfde boog, afgeknot met dasharray */
    var len = Math.PI * R * .93;
    return '<svg class="wx-arc" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="max-width:' + W + 'px;overflow:visible;">' +
        '<defs><linearGradient id="wxArcG" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#ff9d2e"/><stop offset=".5" stop-color="#ffd66b"/><stop offset="1" stop-color="#ff9d2e"/>' +
        '</linearGradient></defs>' +
        '<path d="' + arc + '" fill="none" stroke="var(--line)" stroke-width="2" stroke-dasharray="3 5"/>' +
        '<path class="wx-arc-p" d="' + arc + '" fill="none" stroke="url(#wxArcG)" stroke-width="2.6" stroke-linecap="round" ' +
            'stroke-dasharray="' + len.toFixed(1) + '" stroke-dashoffset="' + len.toFixed(1) + '" data-off="' + (len * (1 - p)).toFixed(1) + '"/>' +
        '<line x1="' + pad*.6 + '" y1="' + cy + '" x2="' + (W - pad*.6) + '" y2="' + cy + '" stroke="var(--line)" stroke-width="1"/>' +
        (p > 0 && p < 1
            ? '<circle class="wx-sun-dot" cx="' + pos[0].toFixed(1) + '" cy="' + pos[1].toFixed(1) + '" r="7" fill="#ffd66b"/>' +
              '<circle cx="' + pos[0].toFixed(1) + '" cy="' + pos[1].toFixed(1) + '" r="3.4" fill="#fff" opacity=".85"/>'
            : '') +
        '<text x="' + a0[0].toFixed(1) + '" y="' + (cy + 14) + '" text-anchor="middle" font-family="\'Space Mono\',monospace" ' +
            'font-size="9" letter-spacing="1" fill="var(--text-faint)">' + hhmm(sunrise) + '</text>' +
        '<text x="' + a1[0].toFixed(1) + '" y="' + (cy + 14) + '" text-anchor="middle" font-family="\'Space Mono\',monospace" ' +
            'font-size="9" letter-spacing="1" fill="var(--text-faint)">' + hhmm(sunset) + '</text>' +
    '</svg>';
}
function hhmm(iso){ return iso ? iso.slice(11,16) : '--:--'; }

/* ---------------------------------------------------------
   6. Uurcurve met temperatuurlabels
   --------------------------------------------------------- */
function hourly(hours, opt){
    opt = opt || {};
    var n = Math.min(opt.count || 12, hours.length);
    var pts = hours.slice(0, n);
    if(!pts.length) return '';
    var W = opt.w || 620, H = opt.h || 132, pad = 26;
    var temps = pts.map(function(h){ return h.temp; });
    var lo = Math.min.apply(null, temps), hi = Math.max.apply(null, temps);
    if(hi === lo){ hi += 1; lo -= 1; }
    var step = (W - pad*2) / Math.max(1, n - 1);
    var xy = pts.map(function(h, i){
        return [pad + i*step, H - 42 - ((h.temp - lo) / (hi - lo)) * (H - 78)];
    });

    var d = 'M' + xy[0][0].toFixed(1) + ' ' + xy[0][1].toFixed(1);
    for(var i = 0; i < xy.length - 1; i++){
        var p0 = xy[i-1] || xy[i], p1 = xy[i], p2 = xy[i+1], p3 = xy[i+2] || p2;
        var c1 = [p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6];
        var c2 = [p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6];
        d += 'C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ',' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ',' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
    }
    var fill = d + 'L' + xy[xy.length-1][0].toFixed(1) + ' ' + (H-32) + 'L' + xy[0][0].toFixed(1) + ' ' + (H-32) + 'Z';

    var bars = pts.map(function(h, i){
        var bh = (h.rain || 0) / 100 * 22;
        return bh > 1 ? '<rect x="' + (xy[i][0] - 4).toFixed(1) + '" y="' + (H - 32 - bh).toFixed(1) + '" width="8" height="' + bh.toFixed(1) +
            '" rx="2.5" fill="#4a8fd4" opacity=".34"><title>' + h.rain + '% kans op neerslag</title></rect>' : '';
    }).join('');

    var labels = pts.map(function(h, i){
        var showT = n <= 14 || i % 2 === 0;
        return (showT ? '<text x="' + xy[i][0].toFixed(1) + '" y="' + (xy[i][1] - 12).toFixed(1) + '" text-anchor="middle" ' +
            'font-family="\'Space Grotesk\',sans-serif" font-size="11.5" font-weight="600" fill="var(--text)">' + h.temp + '°</text>' : '') +
            '<text x="' + xy[i][0].toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle" ' +
            'font-family="\'Space Mono\',monospace" font-size="9" letter-spacing=".5" fill="var(--text-faint)">' +
            (i === 0 ? 'nu' : String(h.hour).padStart(2,'0')) + '</text>';
    }).join('');

    return '<svg class="wx-hourly" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="overflow:visible;">' +
        '<defs><linearGradient id="wxHg" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="var(--accent)" stop-opacity=".32"/>' +
            '<stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>' +
        bars +
        '<path class="wx-h-fill" d="' + fill + '" fill="url(#wxHg)"/>' +
        '<path class="wx-h-line" d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cx="' + xy[0][0].toFixed(1) + '" cy="' + xy[0][1].toFixed(1) + '" r="4.5" fill="var(--accent)" stroke="var(--paper)" stroke-width="2"/>' +
        labels +
    '</svg>';
}

global.KMweather = {
    load:load, search:search, locate:locate, place:place, setPlace:setPlace,
    decode:decode, icon:icon, sunArc:sunArc, hourly:hourly, hhmm:hhmm,
    GROUPS:GROUPS, CODES:CODES, shape:shape, cached:cached
};

})(window);
