/* =========================================================
   KM.dev — Slide Scroll engine
   Desktop : één scrollbeweging = één sectie, elke sectie
             met zijn eigen overgangsanimatie.
   Mobiel  : geen scroll-hijack (voelt slecht op touch), wél
             dezelfde entree-animaties terwijl je scrolt.
   ========================================================= */
(function(){
    'use strict';

    /* ---------- instellingen ---------- */
    var MIN_W      = 861;   // onder deze breedte: mobiele modus
    var DURATION   = 900;   // ms per overgang
    var GESTURE_END= 200;   // ms stilte voordat een nieuwe scrollbeweging telt
    var WHEEL_MIN  = 4;     // negeer micro-scrolls
    var EDGE_SLOP  = 4;     // px speling bij "aan de rand van een lange sectie"
    var SWIPE_MIN  = 60;    // px voor een swipe op tablet

    /* ---------- state ---------- */
    var slides = [], dots = [], tops = [], darkFlags = [];
    var idx = 0, mode = 'off';          // 'off' | 'slides' | 'reveal'
    var animating = false, armed = true, gestureTimer = null, rafScroll = 0;
    var hint, progress, dotsWrap, counter, observer = null;

    /* =====================================================
       1. Opbouw
       ===================================================== */
    function collect(){
        var out = [], kids = document.body.children;
        for(var i = 0; i < kids.length; i++){
            var el = kids[i], tag = el.tagName;
            if(tag === 'SECTION' || tag === 'FOOTER') out.push(el);
            else if(tag === 'DIV' && el.querySelector(':scope > .cta-band')) out.push(el);
        }
        return out;
    }

    var LABELS = {
        'hero':'Start', 'reveal-block':'Intro', 'projects':'Werk',
        'capabilities':'Wat we doen', 'stats-section':'Resultaten',
        'process-section':'Proces', 'pricing-section':'Prijzen',
        'faq-section':'FAQ', 'testimonials':'Reviews'
    };
    var FX_BY_CLASS = {
        'hero':1, 'reveal-block':2, 'projects':3, 'capabilities':4,
        'stats-section':5, 'process-section':6,
        'pricing-section':3, 'faq-section':2, 'testimonials':4
    };
    var FX_CYCLE = [1,3,4,5,2,6,7,8];

    function isCta(el){ return !!el.querySelector(':scope > .container > .cta-band, :scope > .cta-band'); }

    function labelFor(el, i){
        for(var c in LABELS){ if(el.classList.contains(c)) return LABELS[c]; }
        if(el.tagName === 'FOOTER') return 'Contact';
        if(isCta(el)) return 'Plan een call';
        var h = el.querySelector('.section-label, .eyebrow, h2, h3');
        var t = h ? h.textContent.replace(/\s+/g,' ').trim() : '';
        if(t.length > 20) t = t.slice(0,18).trim() + '…';
        return t || ('Sectie ' + (i+1));
    }
    function fxFor(el, i){
        for(var c in FX_BY_CLASS){ if(el.classList.contains(c)) return FX_BY_CLASS[c]; }
        if(el.tagName === 'FOOTER') return 8;
        if(isCta(el)) return 7;
        return FX_CYCLE[i % FX_CYCLE.length];
    }

    function build(){
        slides = collect();
        if(slides.length < 3) return false;

        slides.forEach(function(s, i){
            s.classList.add('km-slide', 'km-fx-' + fxFor(s, i));
            s.dataset.kmIndex = i;
            if(s.tagName === 'FOOTER') s.classList.add('km-footer');
            // donker/licht vooraf bepalen — scheelt DOM-werk tijdens het scrollen
            darkFlags[i] = s.tagName === 'FOOTER' ||
                           s.classList.contains('process-section') ||
                           s.classList.contains('stats-section') ||
                           isCta(s);
        });

        progress = el('div','km-progress');
        dotsWrap = el('nav','km-dots');
        dotsWrap.setAttribute('aria-label','Sectienavigatie');
        slides.forEach(function(s, i){
            var lbl = labelFor(s, i);
            var b = document.createElement('button');
            b.className = 'km-dot'; b.type = 'button';
            b.innerHTML = '<i></i><span class="km-dot-label">' + lbl + '</span>';
            b.setAttribute('aria-label','Ga naar ' + lbl);
            b.addEventListener('click', function(){ goTo(i); });
            dotsWrap.appendChild(b); dots.push(b);
        });
        hint = el('div','km-hint');
        hint.innerHTML = '<span class="km-mouse"></span><span>Scroll</span>';
        counter = el('div','km-count');

        [progress, dotsWrap, hint, counter].forEach(function(n){ document.body.appendChild(n); });
        return true;
    }
    function el(tag, cls){ var n = document.createElement(tag); n.className = cls; return n; }

    /* =====================================================
       2. Meten — één keer, daarna uit cache
       ===================================================== */
    function measure(){
        var vh = window.innerHeight;
        var y  = window.pageYOffset;
        var maxTop = document.documentElement.scrollHeight - vh;
        tops = slides.map(function(s){
            var t = s.getBoundingClientRect().top + y;
            return Math.max(0, Math.min(Math.round(t), maxTop));
        });
        slides.forEach(function(s){
            var tall = s.scrollHeight > vh + 8;
            s.classList.toggle('km-tall', tall && !s.classList.contains('km-footer'));
        });
    }

    /* =====================================================
       3. Animatie — zelfde bezier als de CSS-overgangen
          cubic-bezier(.16, 1, .3, 1)
       ===================================================== */
    function bezier(t){
        // Newton-Raphson op de x-component, daarna y uitrekenen
        var x1 = .16, y1 = 1, x2 = .3, y2 = 1;
        var cx = 3*x1, bx = 3*(x2-x1) - cx, ax = 1 - cx - bx;
        var cy = 3*y1, by = 3*(y2-y1) - cy, ay = 1 - cy - by;
        var u = t, i, d;
        for(i = 0; i < 5; i++){
            var x = ((ax*u + bx)*u + cx)*u - t;
            if(Math.abs(x) < 1e-5) break;
            d = (3*ax*u + 2*bx)*u + cx;
            if(Math.abs(d) < 1e-6) break;
            u -= x/d;
        }
        return ((ay*u + by)*u + cy)*u;
    }

    var rafId = 0;
    function animateTo(y){
        var start = window.pageYOffset;
        var dist  = y - start;
        if(Math.abs(dist) < 2){ animating = false; return; }
        var t0 = 0;
        animating = true;
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function step(now){
            if(!t0) t0 = now;
            var p = Math.min(1, (now - t0) / DURATION);
            window.scrollTo(0, start + dist * bezier(p));
            if(p < 1) rafId = requestAnimationFrame(step);
            else animating = false;
        });
    }

    /* =====================================================
       4. Weergave
       ===================================================== */
    function paint(){
        for(var i = 0; i < slides.length; i++){
            var s = slides[i], c = s.classList;
            if(i === idx){ c.add('km-active'); c.remove('km-out-up','km-out-down'); }
            else if(i === idx + 1){ c.remove('km-active','km-out-down'); c.add('km-out-up'); }
            else if(i === idx - 1){ c.remove('km-active','km-out-up'); c.add('km-out-down'); }
            else c.remove('km-active','km-out-up','km-out-down');
        }
        for(var j = 0; j < dots.length; j++) dots[j].classList.toggle('on', j === idx);

        var dark = !!darkFlags[idx];
        if(progress) progress.style.width = ((idx + 1) / slides.length * 100) + '%';
        if(hint) hint.classList.toggle('hide', idx !== 0);
        if(dotsWrap) dotsWrap.classList.toggle('on-dark', dark);
        if(counter){
            counter.innerHTML = '<b>' + pad(idx + 1) + '</b> / ' + pad(slides.length);
            counter.classList.toggle('on-dark', dark);
        }
    }
    function pad(n){ return n < 10 ? '0' + n : '' + n; }

    function goTo(i){
        i = Math.max(0, Math.min(slides.length - 1, i));
        if(i === idx && Math.abs(window.pageYOffset - tops[i]) < 4) return;
        idx = i;
        paint();
        animateTo(tops[i]);
    }

    function nearestIndex(){
        var y = window.pageYOffset + window.innerHeight * .34, best = 0;
        for(var i = 0; i < tops.length; i++) if(tops[i] <= y) best = i;
        return best;
    }

    /* =====================================================
       5. Mag de engine nu overnemen?
       ===================================================== */
    function blocked(){
        if(mode !== 'slides') return true;
        var menu = document.getElementById('menuOverlay');
        if(menu && menu.classList.contains('open')) return true;
        var intro = document.getElementById('introOverlay');
        if(intro && intro.style.display !== 'none' && !intro.classList.contains('fade-out')) return true;
        if(document.querySelector('.booking-overlay.open, .modal.open, .overlay.on, .overlay.open, [data-modal].open')) return true;
        var a = document.activeElement;
        if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) return true;
        return false;
    }
    function canLeave(dir){
        var s = slides[idx];
        if(!s || !s.classList.contains('km-tall')) return true;
        var r = s.getBoundingClientRect();
        return dir > 0 ? r.bottom <= window.innerHeight + EDGE_SLOP
                       : r.top    >= -EDGE_SLOP;
    }

    /* =====================================================
       6. Invoer
       ===================================================== */
    function onWheel(e){
        if(mode !== 'slides') return;

        // elke wheel-event verlengt de "gesture"; pas na stilte is er
        // weer een nieuwe intentie. Dit filtert trackpad-momentum weg.
        clearTimeout(gestureTimer);
        gestureTimer = setTimeout(function(){ armed = true; }, GESTURE_END);

        if(blocked()) return;

        var d = e.deltaY;
        if(Math.abs(d) < WHEEL_MIN) return;
        var dir = d > 0 ? 1 : -1;

        if(animating){ e.preventDefault(); return; }
        if(!canLeave(dir)) return;                       // lange sectie: native scroll
        if(dir > 0 && idx >= slides.length - 1) return;
        if(dir < 0 && idx <= 0) return;

        e.preventDefault();
        if(!armed) return;                               // nog in de uitloop van de vorige beweging
        armed = false;
        goTo(idx + dir);
    }

    var tY = 0, tX = 0, tMoved = false;
    function onTouchStart(e){ tY = e.touches[0].clientY; tX = e.touches[0].clientX; tMoved = false; }
    function onTouchMove(e){
        if(mode !== 'slides' || blocked() || tMoved) return;
        var dy = tY - e.touches[0].clientY;
        var dx = tX - e.touches[0].clientX;
        if(Math.abs(dy) < SWIPE_MIN || Math.abs(dx) > Math.abs(dy)) return;
        var dir = dy > 0 ? 1 : -1;
        if(!canLeave(dir)) return;
        if((dir > 0 && idx >= slides.length - 1) || (dir < 0 && idx <= 0)) return;
        e.preventDefault();
        tMoved = true;
        goTo(idx + dir);
    }

    function onKey(e){
        if(mode !== 'slides' || blocked()) return;
        var k = e.key;
        if(k === 'PageDown' || k === 'ArrowDown' || (k === ' ' && !e.shiftKey)){
            if(!canLeave(1)) return; e.preventDefault(); goTo(idx + 1);
        }else if(k === 'PageUp' || k === 'ArrowUp' || (k === ' ' && e.shiftKey)){
            if(!canLeave(-1)) return; e.preventDefault(); goTo(idx - 1);
        }else if(k === 'Home'){ e.preventDefault(); goTo(0); }
        else if(k === 'End'){ e.preventDefault(); goTo(slides.length - 1); }
    }

    function hookAnchors(){
        document.addEventListener('click', function(e){
            if(mode !== 'slides') return;
            var a = e.target.closest && e.target.closest('a[href^="#"]');
            if(!a) return;
            var id = a.getAttribute('href').slice(1);
            if(!id) return;
            var t = document.getElementById(id);
            var host = t && t.closest('.km-slide');
            if(!host) return;
            e.preventDefault();
            goTo(+host.dataset.kmIndex);
        }, true);
    }

    /* =====================================================
       7. Mobiele modus — geen hijack, wél de animaties
       ===================================================== */
    function startReveal(){
        if(observer) return;
        if(!('IntersectionObserver' in window)){
            slides.forEach(function(s){ s.classList.add('km-active'); });
            return;
        }
        observer = new IntersectionObserver(function(entries){
            entries.forEach(function(en){
                if(en.isIntersecting){
                    en.target.classList.add('km-active');
                    en.target.classList.remove('km-out-up','km-out-down');
                }
            });
        }, { rootMargin:'0px 0px -12% 0px', threshold:.12 });

        slides.forEach(function(s, i){
            if(i === 0) s.classList.add('km-active');
            else s.classList.add('km-out-up');
            observer.observe(s);
        });
    }
    function stopReveal(){
        if(!observer) return;
        observer.disconnect(); observer = null;
    }

    /* =====================================================
       8. Modus bepalen
       ===================================================== */
    function wanted(){
        if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'off';
        if(window.innerWidth < MIN_W) return 'reveal';
        if(window.matchMedia('(hover: none)').matches) return 'reveal';  // touch-tablet
        return 'slides';
    }

    function setMode(next){
        if(next === mode) return;
        // opruimen
        document.documentElement.classList.remove('km-slides','km-reveal');
        stopReveal();
        slides.forEach(function(s){ s.classList.remove('km-active','km-out-up','km-out-down','km-tall'); });

        mode = next;
        if(mode === 'slides'){
            document.documentElement.classList.add('km-slides');
            measure();
            idx = nearestIndex();
            armed = true;
            paint();
        }else if(mode === 'reveal'){
            document.documentElement.classList.add('km-reveal');
            startReveal();
        }
    }

    /* =====================================================
       9. Init
       ===================================================== */
    function init(){
        if(!build()) return;

        window.addEventListener('wheel', onWheel, { passive:false });
        window.addEventListener('touchstart', onTouchStart, { passive:true });
        window.addEventListener('touchmove', onTouchMove, { passive:false });
        window.addEventListener('keydown', onKey);
        hookAnchors();

        // scroll: rAF-getemperd, alleen index bijhouden — geen layout-reads
        window.addEventListener('scroll', function(){
            if(mode !== 'slides' || animating || rafScroll) return;
            rafScroll = requestAnimationFrame(function(){
                rafScroll = 0;
                var n = nearestIndex();
                if(n !== idx){ idx = n; paint(); }
            });
        }, { passive:true });

        var rt;
        window.addEventListener('resize', function(){
            clearTimeout(rt);
            rt = setTimeout(function(){
                setMode(wanted());
                if(mode === 'slides'){ measure(); idx = nearestIndex(); paint(); }
                if(window.ScrollTrigger) window.ScrollTrigger.refresh();
            }, 200);
        }, { passive:true });

        window.addEventListener('orientationchange', function(){
            setTimeout(function(){
                setMode(wanted());
                if(mode === 'slides'){ measure(); idx = nearestIndex(); paint(); }
            }, 320);
        });

        setMode(wanted());

        // hermeten zodra fonts/afbeeldingen binnen zijn
        window.addEventListener('load', function(){
            setTimeout(function(){
                if(mode === 'slides'){ measure(); idx = nearestIndex(); paint(); }
            }, 300);
        });
        if(document.fonts && document.fonts.ready){
            document.fonts.ready.then(function(){
                setTimeout(function(){ if(mode === 'slides') measure(); }, 60);
            });
        }
    }

    // wachten tot de intro-overlay weg is, anders meten we verkeerd
    function boot(){
        var intro = document.getElementById('introOverlay');
        if(intro && intro.style.display !== 'none'){
            var n = 0;
            var iv = setInterval(function(){
                if(intro.style.display === 'none' || ++n > 60){ clearInterval(iv); init(); }
            }, 200);
        }else init();
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
