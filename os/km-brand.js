/* =========================================================
   KM.brand — het echte merk in code
   Het KM.dev-mark uit km-dev-mark.svg, de wordmark, en
   squircle app-iconen met een eigen glyph per app.
   ========================================================= */
(function(global){
'use strict';

/* Apple-achtige squircle: superellipse benaderd met bezier.
   r wordt uitgedrukt als fractie van de zijde (0.22 ≈ iOS). */
function squirclePath(size, k){
    var s = size, c = (k == null ? .225 : k) * s;   // hoekradius
    var m = c * .55;                                 // controlepunt-afstand (de "smooth corner")
    return 'M' + c + ' 0' +
        'L' + (s - c) + ' 0' +
        'C' + (s - m) + ' 0 ' + s + ' ' + m + ' ' + s + ' ' + c +
        'L' + s + ' ' + (s - c) +
        'C' + s + ' ' + (s - m) + ' ' + (s - m) + ' ' + s + ' ' + (s - c) + ' ' + s +
        'L' + c + ' ' + s +
        'C' + m + ' ' + s + ' 0 ' + (s - m) + ' 0 ' + (s - c) +
        'L0 ' + c +
        'C0 ' + m + ' ' + m + ' 0 ' + c + ' 0Z';
}

/* ---------------------------------------------------------
   1. Het merk
   --------------------------------------------------------- */
function mark(size, opt){
    size = size || 48; opt = opt || {};
    var id = 'm' + Math.random().toString(36).slice(2,7);
    var bg = opt.bg || '#0d0d0d';
    var fg = opt.fg || '#ffffff';
    var ac = opt.accent || '#c6ff4a';
    return '<svg class="km-mark" viewBox="0 0 200 200" width="' + size + '" height="' + size + '" ' +
            'style="display:block;' + (opt.style || '') + '">' +
        '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="' + lighten(bg, 14) + '"/><stop offset="1" stop-color="' + bg + '"/>' +
        '</linearGradient></defs>' +
        '<path d="' + squirclePath(200, .23) + '" fill="url(#' + id + ')"/>' +
        '<path d="' + squirclePath(200, .23) + '" fill="none" stroke="rgba(255,255,255,.13)" stroke-width="1.5"/>' +
        '<text x="100" y="112" text-anchor="middle" font-family="\'Space Grotesk\', sans-serif" ' +
            'font-weight="700" font-size="78" letter-spacing="-4" fill="' + fg + '">KM</text>' +
        '<rect x="64" y="130" width="72" height="9" rx="4.5" fill="' + ac + '"/>' +
    '</svg>';
}

function wordmark(h, opt){
    h = h || 22; opt = opt || {};
    var ink = opt.ink || 'currentColor';
    return '<svg class="km-word" viewBox="0 0 210 46" height="' + h + '" style="display:block;' + (opt.style||'') + '">' +
        '<text x="0" y="35" font-family="\'Space Grotesk\', sans-serif" font-weight="700" font-size="40" ' +
            'letter-spacing="-2" fill="' + ink + '">KM' +
            '<tspan fill="' + (opt.dot || '#8f9b7a') + '">.</tspan>' +
            '<tspan fill="' + (opt.dev || '#5c8a1f') + '">dev</tspan>' +
        '</text>' +
    '</svg>';
}

/* het mark dat zichzelf opbouwt — voor de boot-animatie */
function markAnimated(size){
    size = size || 120;
    return '<svg class="km-mark km-mark-anim" viewBox="0 0 200 200" width="' + size + '" height="' + size + '">' +
        '<defs><linearGradient id="bmg" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#1e1e1e"/><stop offset="1" stop-color="#0d0d0d"/></linearGradient></defs>' +
        '<path class="bm-plate" d="' + squirclePath(200, .23) + '" fill="url(#bmg)"/>' +
        '<path class="bm-stroke" d="' + squirclePath(200, .23) + '" fill="none" stroke="#c6ff4a" stroke-width="2.5" ' +
            'stroke-dasharray="720" stroke-dashoffset="720"/>' +
        '<text class="bm-txt" x="100" y="112" text-anchor="middle" font-family="\'Space Grotesk\', sans-serif" ' +
            'font-weight="700" font-size="78" letter-spacing="-4" fill="#fff">KM</text>' +
        '<rect class="bm-bar" x="64" y="130" width="72" height="9" rx="4.5" fill="#c6ff4a"/>' +
    '</svg>';
}

/* ---------------------------------------------------------
   2. App-iconen — squircle + gradient + glyph
   --------------------------------------------------------- */
var GLYPHS = {
    home:   '<circle cx="50" cy="50" r="7" fill="currentColor"/>' +
            '<circle cx="50" cy="50" r="19" fill="none" stroke="currentColor" stroke-width="5"/>' +
            '<circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" stroke-width="5" opacity=".45"/>',
    life:   '<path d="M50 22v56M22 50h56" stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity=".4"/>' +
            '<circle cx="50" cy="50" r="24" fill="none" stroke="currentColor" stroke-width="5"/>' +
            '<circle cx="50" cy="50" r="8" fill="currentColor"/>',
    matrix: '<path d="M50 26 26 40v28l24 14 24-14V40Z" fill="none" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/>' +
            '<circle cx="50" cy="26" r="7" fill="currentColor"/><circle cx="26" cy="68" r="7" fill="currentColor"/>' +
            '<circle cx="74" cy="68" r="7" fill="currentColor"/><circle cx="50" cy="54" r="5.5" fill="currentColor" opacity=".6"/>',
    plan:   '<rect x="24" y="28" width="52" height="48" rx="10" fill="none" stroke="currentColor" stroke-width="5"/>' +
            '<path d="M24 44h52M38 22v10M62 22v10" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>' +
            '<rect x="34" y="52" width="14" height="8" rx="3" fill="currentColor"/>' +
            '<rect x="52" y="52" width="14" height="8" rx="3" fill="currentColor" opacity=".5"/>',
    video:  '<rect x="20" y="30" width="60" height="40" rx="11" fill="none" stroke="currentColor" stroke-width="5"/>' +
            '<path d="M44 42v16l15-8Z" fill="currentColor"/>',
    design: '<path d="M50 20l7.5 18.5L76 46l-18.5 7.5L50 72l-7.5-18.5L24 46l18.5-7.5Z" fill="currentColor"/>' +
            '<circle cx="72" cy="26" r="5" fill="currentColor" opacity=".55"/>' +
            '<circle cx="28" cy="72" r="4" fill="currentColor" opacity=".4"/>',
    notes:  '<rect x="26" y="20" width="48" height="60" rx="10" fill="none" stroke="currentColor" stroke-width="5"/>' +
            '<path d="M38 38h24M38 50h24M38 62h14" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>',
    stack:  '<circle cx="50" cy="50" r="12" fill="none" stroke="currentColor" stroke-width="5"/>' +
            '<path d="M50 20v10M50 70v10M20 50h10M70 50h10M29 29l7 7M64 64l7 7M71 29l-7 7M36 64l-7 7" ' +
            'stroke="currentColor" stroke-width="5" stroke-linecap="round"/>'
};

function appIcon(id, size, tint, brand){
    size = size || 56;
    var uid = 'a' + Math.random().toString(36).slice(2,7);
    var c = tint || '#c6ff4a';
    /* een app kan een echt merklogo dragen in plaats van onze eigen glyph */
    var brandSvg = '';
    if(brand && global.KMlogos && KMlogos.has(brand)){
        brandSvg = KMlogos.logo(brand, size * .46, { color: contrast(c), style:'position:absolute;inset:0;margin:auto;' });
    }
    var open_ = brandSvg ? '<span class="km-app-wrap" style="position:relative;display:block;width:' + size + 'px;height:' + size + 'px;">' : '';
    var close_ = brandSvg ? '</span>' : '';
    return open_ + '<svg class="km-app-ico" viewBox="0 0 100 100" width="' + size + '" height="' + size + '" style="display:block;">' +
        '<defs>' +
            '<linearGradient id="' + uid + '" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="' + lighten(c, 26) + '"/>' +
                '<stop offset="1" stop-color="' + darken(c, 12) + '"/>' +
            '</linearGradient>' +
            '<linearGradient id="' + uid + 'g" x1="0" y1="0" x2="0" y2="1">' +
                '<stop offset="0" stop-color="rgba(255,255,255,.42)"/>' +
                '<stop offset=".52" stop-color="rgba(255,255,255,0)"/>' +
            '</linearGradient>' +
        '</defs>' +
        '<path d="' + squirclePath(100, .225) + '" fill="url(#' + uid + ')"/>' +
        '<path d="' + squirclePath(100, .225) + '" fill="url(#' + uid + 'g)"/>' +
        '<path d="' + squirclePath(100, .225) + '" fill="none" stroke="rgba(255,255,255,.30)" stroke-width="1"/>' +
        (brandSvg ? '' : '<g style="color:' + contrast(c) + '">' + (GLYPHS[id] || GLYPHS.home) + '</g>') +
    '</svg>' +
    (brandSvg ? '<span style="position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;">' +
        KMlogos.logo(brand, Math.round(size * .44), { color: contrast(c) }) + '</span>' : '') + close_;
}

/* ---------------------------------------------------------
   3. Kleurhulpjes
   --------------------------------------------------------- */
function hex2rgb(h){
    h = String(h).replace('#','');
    if(h.length === 3) h = h.split('').map(function(c){ return c+c; }).join('');
    var n = parseInt(h, 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
}
function rgb2hex(r,g,b){
    return '#' + [r,g,b].map(function(v){ return Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0'); }).join('');
}
function lighten(h, amt){
    var c = hex2rgb(h);
    return rgb2hex(c[0] + (255-c[0])*amt/100, c[1] + (255-c[1])*amt/100, c[2] + (255-c[2])*amt/100);
}
function darken(h, amt){
    var c = hex2rgb(h);
    return rgb2hex(c[0]*(1-amt/100), c[1]*(1-amt/100), c[2]*(1-amt/100));
}
function luma(h){
    var c = hex2rgb(h);
    return (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255;
}
function contrast(h){ return luma(h) > .58 ? '#0d0d0d' : '#ffffff'; }

global.KMbrand = {
    mark:mark, markAnimated:markAnimated, wordmark:wordmark, appIcon:appIcon,
    squirclePath:squirclePath, lighten:lighten, darken:darken, contrast:contrast, luma:luma, GLYPHS:GLYPHS
};

})(window);
