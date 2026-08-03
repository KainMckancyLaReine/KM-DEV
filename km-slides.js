/* =========================================================
   KM.dev — Slide Scroll engine
   Eén scrollbeweging = één sectie, met slide-overgang.
   Secties die langer zijn dan het scherm scrollen eerst
   normaal door, en springen daarna pas naar de volgende.
   ========================================================= */
(function(){
    'use strict';

    var MIN_W       = 901;   // onder deze breedte: normaal scrollen
    var DURATION    = 780;   // ms per overgang
    var COOLDOWN    = 130;   // ms extra rust na een overgang
    var WHEEL_MIN   = 6;     // negeer micro-scrolls
    var EDGE_SLOP   = 3;     // px speling bij het bepalen van "aan de rand"

    var slides = [], dots = [], idx = 0;
    var animating = false, lastJump = 0, enabled = false;
    var hint, progress, dotsWrap, counter;

    /* ---------- setup ---------- */
    function collect(){
        var out = [];
        var kids = document.body.children;
        for(var i = 0; i < kids.length; i++){
            var el = kids[i];
            var tag = el.tagName;
            if(tag === 'SECTION' || tag === 'FOOTER') out.push(el);
            else if(tag === 'DIV' && el.querySelector(':scope > .cta-band')) out.push(el);
        }
        return out;
    }

    var LABELS = {
        'hero':'Start',
        'reveal-block':'Intro',
        'projects':'Werk',
        'capabilities':'Wat we doen',
        'stats-section':'Resultaten',
        'process-section':'Proces',
        'pricing-section':'Prijzen',
        'faq-section':'FAQ',
        'testimonials':'Reviews'
    };
    function labelFor(el, i){
        for(var c in LABELS){ if(el.classList.contains(c)) return LABELS[c]; }
        if(el.tagName === 'FOOTER') return 'Contact';
        if(el.querySelector(':scope > .container > .cta-band, :scope > .cta-band')) return 'Plan een call';
        var h = el.querySelector('.section-label, .eyebrow, h2, h3');
        var t = h ? h.textContent.replace(/\s+/g, ' ').trim() : '';
        if(t.length > 20) t = t.slice(0, 18).trim() + '…';
        return t || ('Sectie ' + (i + 1));
    }

    // vaste overgang per sectie-type, anders een roterende volgorde
    var FX_BY_CLASS = {
        'hero':1,               // rise
        'reveal-block':2,       // wipe
        'projects':3,           // zoom
        'capabilities':4,       // slide
        'stats-section':5,      // flip
        'process-section':6,    // push
        'pricing-section':3,
        'faq-section':2,
        'testimonials':4
    };
    var FX_CYCLE = [1,3,4,5,2,6,7,8];

    function fxFor(el, i){
        for(var c in FX_BY_CLASS){ if(el.classList.contains(c)) return FX_BY_CLASS[c]; }
        if(el.tagName === 'FOOTER') return 8;                       // cover
        if(el.querySelector(':scope > .container > .cta-band, :scope > .cta-band')) return 7; // drop
        return FX_CYCLE[i % FX_CYCLE.length];
    }

    function build(){
        slides = collect();
        if(slides.length < 3) return false;

        slides.forEach(function(s, i){
            s.classList.add('km-slide', 'km-fx-' + fxFor(s, i));
            s.dataset.kmIndex = i;
            if(s.tagName === 'FOOTER') s.classList.add('km-footer');
        });

        // progressbalk
        progress = document.createElement('div');
        progress.className = 'km-progress';
        document.body.appendChild(progress);

        // dots
        dotsWrap = document.createElement('nav');
        dotsWrap.className = 'km-dots';
        dotsWrap.setAttribute('aria-label', 'Sectienavigatie');
        slides.forEach(function(s, i){
            var b = document.createElement('button');
            b.className = 'km-dot';
            b.type = 'button';
            b.innerHTML = '<i></i><span class="km-dot-label">' + labelFor(s, i) + '</span>';
            b.setAttribute('aria-label', 'Ga naar ' + labelFor(s, i));
            b.addEventListener('click', function(){ goTo(i); });
            dotsWrap.appendChild(b);
            dots.push(b);
        });
        document.body.appendChild(dotsWrap);

        // scroll hint
        hint = document.createElement('div');
        hint.className = 'km-hint';
        hint.innerHTML = '<span class="km-mouse"></span><span>Scroll</span>';
        document.body.appendChild(hint);

        // teller rechtsonder
        counter = document.createElement('div');
        counter.className = 'km-count';
        document.body.appendChild(counter);

        return true;
    }

    /* ---------- afmetingen ---------- */
    function measure(){
        slides.forEach(function(s){
            var tall = s.scrollHeight > window.innerHeight + 8;
            s.classList.toggle('km-tall', tall && !s.classList.contains('km-footer'));
        });
    }

    function topOf(i){
        var s = slides[i];
        if(!s) return 0;
        var t = s.getBoundingClientRect().top + window.pageYOffset;
        var max = document.documentElement.scrollHeight - window.innerHeight;
        return Math.max(0, Math.min(t, max));
    }

    /* ---------- animatie ---------- */
    function ease(t){ return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }

    function animateTo(y, done){
        var start = window.pageYOffset;
        var dist  = y - start;
        if(Math.abs(dist) < 2){ done && done(); return; }
        var t0 = performance.now();
        animating = true;
        (function step(now){
            var p = Math.min(1, (now - t0) / DURATION);
            window.scrollTo(0, start + dist * ease(p));
            if(p < 1) requestAnimationFrame(step);
            else{
                animating = false;
                lastJump = performance.now();
                done && done();
            }
        })(t0);
    }

    function paint(dir){
        slides.forEach(function(s, i){
            s.classList.remove('km-active', 'km-out-up', 'km-out-down');
            if(i === idx) s.classList.add('km-active');
            else if(Math.abs(i - idx) === 1) s.classList.add(i > idx ? 'km-out-up' : 'km-out-down');
        });
        dots.forEach(function(d, i){ d.classList.toggle('on', i === idx); });
        if(progress) progress.style.width = ((idx + 1) / slides.length * 100) + '%';
        if(hint) hint.classList.toggle('hide', idx !== 0);
        // donkere secties → lichte dots
        var s = slides[idx];
        var dark = s && (s.tagName === 'FOOTER' || s.classList.contains('process-section') ||
                         s.classList.contains('stats-section') || !!s.querySelector(':scope > .container > .cta-band'));
        if(dotsWrap) dotsWrap.classList.toggle('on-dark', !!dark);
        if(counter){
            counter.innerHTML = '<b>' + String(idx + 1).padStart(2, '0') + '</b> / ' + String(slides.length).padStart(2, '0');
            counter.classList.toggle('on-dark', !!dark);
        }
    }

    function goTo(i, dir){
        i = Math.max(0, Math.min(slides.length - 1, i));
        if(i === idx && Math.abs(window.pageYOffset - topOf(i)) < 4) return;
        idx = i;
        paint(dir);
        animateTo(topOf(i), function(){
            if(window.ScrollTrigger) window.ScrollTrigger.refresh(true);
        });
    }

    /* ---------- mag de engine nu overnemen? ---------- */
    function blocked(){
        if(!enabled || animating) return true;
        if(performance.now() - lastJump < COOLDOWN) return true;
        var menu = document.getElementById('menuOverlay');
        if(menu && menu.classList.contains('open')) return true;
        var intro = document.getElementById('introOverlay');
        if(intro && intro.style.display !== 'none' && !intro.classList.contains('fade-out')) return true;
        // een geopende modal / booking widget
        if(document.querySelector('.booking-overlay.open, .modal.open, .overlay.open, [data-modal].open')) return true;
        if(document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return true;
        return false;
    }

    // binnen een lange sectie: eerst uitscrollen, dan pas springen
    function canLeave(dir){
        var s = slides[idx];
        if(!s || !s.classList.contains('km-tall')) return true;
        var r = s.getBoundingClientRect();
        if(dir > 0) return r.bottom <= window.innerHeight + EDGE_SLOP;
        return r.top >= -EDGE_SLOP;
    }

    function nearestIndex(){
        var y = window.pageYOffset + window.innerHeight * .35;
        var best = 0;
        for(var i = 0; i < slides.length; i++){
            if(topOf(i) <= y) best = i;
        }
        return best;
    }

    /* ---------- input ---------- */
    function onWheel(e){
        if(!enabled) return;
        if(blocked()){ if(animating) e.preventDefault(); return; }
        var d = e.deltaY;
        if(Math.abs(d) < WHEEL_MIN) return;
        var dir = d > 0 ? 1 : -1;
        if(!canLeave(dir)) return;              // laat native scroll binnen lange sectie
        if(dir > 0 && idx >= slides.length - 1) return;
        if(dir < 0 && idx <= 0) return;
        e.preventDefault();
        goTo(idx + dir, dir);
    }

    var touchY = 0;
    function onTouchStart(e){ touchY = e.touches[0].clientY; }
    function onTouchMove(e){
        if(blocked()) return;
        var dy = touchY - e.touches[0].clientY;
        if(Math.abs(dy) < 46) return;
        var dir = dy > 0 ? 1 : -1;
        if(!canLeave(dir)) return;
        if((dir > 0 && idx >= slides.length - 1) || (dir < 0 && idx <= 0)) return;
        e.preventDefault();
        touchY = e.touches[0].clientY;
        goTo(idx + dir, dir);
    }

    function onKey(e){
        if(blocked()) return;
        var k = e.key;
        if(k === 'PageDown' || (k === ' ' && !e.shiftKey) || k === 'ArrowDown'){
            if(!canLeave(1)) return;
            e.preventDefault(); goTo(idx + 1, 1);
        }else if(k === 'PageUp' || (k === ' ' && e.shiftKey) || k === 'ArrowUp'){
            if(!canLeave(-1)) return;
            e.preventDefault(); goTo(idx - 1, -1);
        }else if(k === 'Home'){ e.preventDefault(); goTo(0, -1); }
        else if(k === 'End'){ e.preventDefault(); goTo(slides.length - 1, 1); }
    }

    /* interne ankerlinks laten meebewegen met de engine */
    function hookAnchors(){
        document.addEventListener('click', function(e){
            var a = e.target.closest && e.target.closest('a[href^="#"]');
            if(!a || !enabled) return;
            var id = a.getAttribute('href').slice(1);
            if(!id) return;
            var t = document.getElementById(id);
            if(!t) return;
            var host = t.closest('.km-slide');
            if(!host) return;
            e.preventDefault();
            goTo(+host.dataset.kmIndex);
        }, true);
    }

    /* ---------- aan/uit ---------- */
    function shouldEnable(){
        if(window.innerWidth < MIN_W) return false;
        if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        if(window.matchMedia('(hover: none)').matches) return false;
        return true;
    }

    function enable(){
        if(enabled) return;
        enabled = true;
        document.documentElement.classList.add('km-slides');
        measure();
        idx = nearestIndex();
        paint(1);
        if(window.ScrollTrigger) setTimeout(function(){ window.ScrollTrigger.refresh(true); }, 60);
    }
    function disable(){
        if(!enabled) return;
        enabled = false;
        document.documentElement.classList.remove('km-slides');
        slides.forEach(function(s){ s.classList.remove('km-active','km-out-up','km-out-down','km-tall'); });
    }

    function sync(){ shouldEnable() ? enable() : disable(); }

    /* ---------- init ---------- */
    function init(){
        if(!build()) return;

        window.addEventListener('wheel', onWheel, { passive:false });
        window.addEventListener('touchstart', onTouchStart, { passive:true });
        window.addEventListener('touchmove', onTouchMove, { passive:false });
        window.addEventListener('keydown', onKey);
        hookAnchors();

        var rt;
        window.addEventListener('resize', function(){
            clearTimeout(rt);
            rt = setTimeout(function(){
                sync();
                if(enabled){ measure(); idx = nearestIndex(); paint(1); }
            }, 180);
        });

        // houd idx in sync als er toch native gescrold wordt (bv. binnen lange sectie)
        var st;
        window.addEventListener('scroll', function(){
            if(!enabled || animating) return;
            clearTimeout(st);
            st = setTimeout(function(){
                var n = nearestIndex();
                if(n !== idx){ idx = n; paint(1); }
            }, 90);
        }, { passive:true });

        sync();

        // na fonts/afbeeldingen opnieuw meten
        window.addEventListener('load', function(){ setTimeout(function(){ if(enabled){ measure(); idx = nearestIndex(); paint(1); } }, 260); });
    }

    // wacht tot de intro-overlay weg is, anders meten we verkeerd
    function boot(){
        var intro = document.getElementById('introOverlay');
        if(intro && intro.style.display !== 'none'){
            var tries = 0;
            var iv = setInterval(function(){
                tries++;
                if(intro.style.display === 'none' || tries > 60){ clearInterval(iv); init(); }
            }, 200);
        }else init();
    }

    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
