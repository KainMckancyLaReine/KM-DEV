/* ==========================================================================
   KM.dev — Motion System
   Loads on every page. Progressive enhancement only: if this file fails,
   the site still renders and works exactly as before.

   1. Nav pod        — the pill morphs while you scroll
   2. Live widgets   — signature micro-visuals per capability
   3. Section accents— sparklines, process thread, staggered reveals
   ========================================================================== */
(function () {
    'use strict';

    var REDUCED = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function $(sel, root) { return (root || document).querySelector(sel); }
    function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
    function el(tag, cls, html) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    }
    function lang() {
        try { return (window.kmLang && window.kmLang.get()) || document.documentElement.lang || 'en'; }
        catch (e) { return 'en'; }
    }
    /* Re-runs i18n over the whole document so freshly injected
       data-en / data-nl nodes pick up the active language. */
    function refreshI18n() {
        try { if (window.kmLang) window.kmLang.set(window.kmLang.get()); } catch (e) {}
    }

    /* ======================================================================
       Shared "in view" observer — everything switches on when it's visible
       and switches off again when it isn't, so nothing animates off-screen.
       ====================================================================== */
    var liveObserver = null;
    function observeLive(node, opts) {
        opts = opts || {};
        if (!('IntersectionObserver' in window)) { node.classList.add('is-live'); return; }
        if (!liveObserver) {
            liveObserver = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) {
                        e.target.classList.add('is-live');
                        if (e.target.__kmOnce) liveObserver.unobserve(e.target);
                    } else if (!e.target.__kmOnce) {
                        e.target.classList.remove('is-live');
                    }
                });
            }, { rootMargin: '0px 0px -10% 0px', threshold: 0 });
        }
        node.__kmOnce = !!opts.once;
        liveObserver.observe(node);
    }

    /* ======================================================================
       0. PRELOADER
       Full play once per session, a clipped version on every page after that,
       so moving between pages never costs the visitor a second.
       ====================================================================== */
    function initPreloader() {
        if (REDUCED) return;
        if (document.querySelector('.km-pre')) return;

        var seen = false;
        try { seen = sessionStorage.getItem('kmPre') === '1'; } catch (e) {}
        var hold = seen ? 420 : 1080;

        var pre = el('div', 'km-pre' + (seen ? ' is-quick' : ''),
            '<div class="km-pre-inner">' +
            '<div class="km-pre-mark">KM<span class="dot"></span>dev</div>' +
            '<div class="km-pre-rail"><i></i><i></i><i></i></div>' +
            '</div>');
        pre.setAttribute('aria-hidden', 'true');
        (document.body || document.documentElement).appendChild(pre);
        try { sessionStorage.setItem('kmPre', '1'); } catch (e) {}

        var done = false;
        function dismiss() {
            if (done) return;
            done = true;
            pre.classList.add('is-out');
            setTimeout(function () { if (pre.parentNode) pre.parentNode.removeChild(pre); }, 900);
        }
        /* leave when the hold has passed AND the page has actually loaded */
        var timer = setTimeout(function () {
            if (document.readyState === 'complete') dismiss();
            else window.addEventListener('load', dismiss);
        }, hold);
        /* hard stop so a stalled image can never trap the visitor */
        setTimeout(function () { clearTimeout(timer); dismiss(); }, hold + 2600);
    }

    /* ======================================================================
       1. NAV POD
       ====================================================================== */
    function initNav() {
        var nav = $('.pill-nav');
        if (!nav || nav.classList.contains('km-nav')) return;
        nav.classList.add('km-nav');

        /* --- "dev" gets its own wrapper so it can fold away --- */
        var logo = $('.pill-logo', nav);
        if (logo && !$('.km-logo-tail', logo)) {
            var dot = $('.dot', logo);
            if (dot && dot.nextSibling && dot.nextSibling.nodeType === 3) {
                var tail = el('span', 'km-logo-tail');
                tail.textContent = dot.nextSibling.textContent;
                logo.replaceChild(tail, dot.nextSibling);
            }
        }

        /* --- context chip: tells you which section you're in --- */
        var ctx = el('div', 'km-nav-ctx',
            '<span class="km-ctx-dot"></span><span class="km-ctx-text"></span>');
        var langToggle = $('.lang-toggle', nav);
        if (langToggle) nav.insertBefore(ctx, langToggle);
        else nav.appendChild(ctx);

        /* --- scroll-progress ring around the hamburger --- */
        var ham = $('.hamburger', nav);
        var ringFg = null;
        if (ham) {
            var wrap = el('div', 'km-ham-wrap');
            ham.parentNode.insertBefore(wrap, ham);
            wrap.appendChild(ham);
            wrap.insertAdjacentHTML('afterbegin',
                '<svg class="km-ring" viewBox="0 0 50 50" aria-hidden="true">' +
                '<circle class="km-ring-bg" cx="25" cy="25" r="22"></circle>' +
                '<circle class="km-ring-fg" cx="25" cy="25" r="22"></circle></svg>');
            ringFg = $('.km-ring-fg', wrap);
        }

        var CIRC = 138.2;
        var lastY = window.scrollY || 0;
        var ticking = false;
        var state = { scrolled: false, hidden: false, hovered: false, menu: false };

        /* GSAP writes `translate:none; scale:none` inline on .pill-nav during
           its intro tween, and inline always beats the stylesheet — so the pod
           transform has to be written inline too. */
        function applyPod() {
            var hide = state.hidden && !state.menu && !REDUCED;
            nav.style.translate = hide ? '0 -175%' : '0 0';
            nav.style.scale = (state.scrolled && !state.hovered && !state.menu) ? '.94' : '1';
        }

        function onScroll() {
            var y = window.scrollY || window.pageYOffset || 0;
            var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
            var p = Math.min(1, Math.max(0, y / max));

            state.scrolled = y > 40;
            nav.classList.toggle('is-scrolled', state.scrolled);

            if (!REDUCED) {
                if (y > lastY + 4 && y > 260) state.hidden = true;
                else if (y < lastY - 4 || y < 120) state.hidden = false;
                nav.classList.toggle('is-hidden', state.hidden && !state.menu);
            }
            if (Math.abs(y - lastY) > 3) lastY = y;

            applyPod();
            nav.classList.toggle('is-near-end', p > 0.72);
            if (ringFg) ringFg.style.strokeDashoffset = String(CIRC - CIRC * p);
            ticking = false;
        }

        nav.addEventListener('mouseenter', function () { state.hovered = true; applyPod(); });
        nav.addEventListener('mouseleave', function () { state.hovered = false; applyPod(); });
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
        }, { passive: true });
        window.addEventListener('resize', onScroll, { passive: true });
        onScroll();

        /* --- never hide the pod while the fullscreen menu is open --- */
        if (ham) {
            var syncMenu = function () {
                state.menu = ham.classList.contains('open');
                nav.classList.toggle('is-menu-open', state.menu);
                if (state.menu) nav.classList.remove('is-hidden');
                applyPod();
            };
            if ('MutationObserver' in window) {
                new MutationObserver(syncMenu).observe(ham, { attributes: true, attributeFilter: ['class'] });
            }
            ham.addEventListener('click', function () { setTimeout(syncMenu, 30); });
        }

        initNavContext(ctx);
    }

    /* --- section labels feeding the nav context chip --- */
    function initNavContext(ctx) {
        var textNode = $('.km-ctx-text', ctx);
        if (!textNode) return;

        var all = $$('section, .cta-band, .footer');
        var sections = all.filter(function (s) { return s.offsetHeight > 120; });
        if (!sections.length) sections = all;
        if (!sections.length) return;

        function labelFor(sec) {
            if (sec.dataset && sec.dataset.kmLabel) return sec.dataset.kmLabel;
            var h = sec.querySelector('.section-head h2 .strong') ||
                sec.querySelector('.section-head h2') ||
                sec.querySelector('h2') || sec.querySelector('h1');
            var t = h ? (h.textContent || '').replace(/\s+/g, ' ').trim() : '';
            if (!t) {
                if (sec.classList.contains('hero')) return lang() === 'nl' ? 'Intro' : 'Intro';
                if (sec.classList.contains('footer')) return lang() === 'nl' ? 'Contact' : 'Contact';
                return '';
            }
            t = t.replace(/[.,–—]+$/, '');
            /* Headings are often two clauses ("One system. One fixed price") —
               the second one is the real label. */
            var clauses = t.split(/\.\s+/);
            if (clauses.length > 1) t = clauses[clauses.length - 1].replace(/[.,]+$/, '');
            var words = t.split(' ');
            if (words.length > 3) t = words.slice(0, 3).join(' ');
            return t.length > 26 ? t.slice(0, 24) + '…' : t;
        }

        var current = '';
        function setLabel(v) {
            if (!v || v === current) return;
            current = v;
            ctx.classList.add('is-swap');
            setTimeout(function () {
                textNode.textContent = v;
                ctx.classList.remove('is-swap');
            }, 200);
        }

        if ('IntersectionObserver' in window) {
            var io = new IntersectionObserver(function (entries) {
                entries.forEach(function (e) {
                    if (e.isIntersecting) setLabel(labelFor(e.target));
                });
            }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
            sections.forEach(function (s) { io.observe(s); });
        }
        textNode.textContent = labelFor(sections[0]);
        current = textNode.textContent;

        document.addEventListener('km:langchange', function () {
            current = '';
        });
    }

    /* ======================================================================
       1b. FULLSCREEN MENU
       ====================================================================== */
    function initMenu() {
        var overlay = $('.menu-overlay');
        if (!overlay || overlay.classList.contains('km-menu')) return;
        overlay.classList.add('km-menu');

        overlay.insertAdjacentHTML('afterbegin',
            '<div class="km-menu-bg"><span class="km-glow-2"></span></div>' +
            '<div class="km-menu-mark" aria-hidden="true">KM<span class="dot">.</span>dev</div>');

        $$('.menu-links a', overlay).forEach(function (a, i) {
            if ($('.km-ml', a)) return;
            var label = a.textContent.trim();
            var num = ('0' + (i + 1)).slice(-2);
            /* the label keeps the data-en/data-nl attrs, so i18n still works */
            var wrap = el('span', 'km-ml');
            wrap.setAttribute('data-en', a.getAttribute('data-en') || label);
            wrap.setAttribute('data-nl', a.getAttribute('data-nl') || label);
            wrap.textContent = label;
            a.removeAttribute('data-en');
            a.removeAttribute('data-nl');
            a.textContent = '';
            a.appendChild(el('span', 'km-mi', num));
            a.appendChild(wrap);
            a.appendChild(el('span', 'km-ma', a.classList.contains('active') ? '●' : '↗'));
        });

        /* small labels above the blocks in the side column */
        var side = $('.menu-side', overlay);
        if (side) {
            var badge = $('.menu-badge', side);
            var cta = $('.menu-cta', side);
            if (badge && !$('.km-side-label', badge.parentNode)) {
                var l1 = el('span', 'km-side-label');
                l1.setAttribute('data-en', 'Availability');
                l1.setAttribute('data-nl', 'Beschikbaarheid');
                l1.textContent = lang() === 'nl' ? 'Beschikbaarheid' : 'Availability';
                badge.parentNode.insertBefore(l1, badge);
            }
            if (cta && !$('.km-side-label', cta)) {
                var l2 = el('span', 'km-side-label');
                l2.setAttribute('data-en', 'Start here');
                l2.setAttribute('data-nl', 'Begin hier');
                l2.textContent = lang() === 'nl' ? 'Begin hier' : 'Start here';
                cta.insertBefore(l2, cta.firstChild);
            }
        }
        refreshI18n();
    }

    /* ======================================================================
       2. SIGNATURE WIDGETS
       ====================================================================== */

    var WIDGETS = {
        strategy: function () {
            return '<div class="kw-grid"></div>' +
                '<div class="kw-axis x"></div><div class="kw-axis y"></div>' +
                '<div class="kw-ghost" style="--x:18%;--y:24%"></div>' +
                '<div class="kw-ghost" style="--x:44%;--y:74%"></div>' +
                '<div class="kw-ghost" style="--x:78%;--y:58%"></div>' +
                '<div class="kw-ghost" style="--x:62%;--y:80%"></div>' +
                '<div class="kw-scan"></div>' +
                '<div class="kw-you"></div>' +
                '<div class="kw-tag">positioning</div>' +
                '<div class="kw-live"><i></i>plot</div>';
        },
        identity: function () {
            return '<div class="kw-mark">' +
                '<span>KM<em>.</em>dev</span><span>KM<em>.</em>dev</span><span>KM<em>.</em>dev</span>' +
                '</div>' +
                '<div class="kw-pal"><i></i><i></i><i></i><i></i><i></i></div>' +
                '<div class="kw-tag">system</div>';
        },
        build: function () {
            return '<div class="kw-browser"><div class="kw-bar"><i></i><i></i><i></i></div>' +
                '<div class="kw-blocks"><b></b><b></b><b></b><b></b><b></b></div></div>' +
                '<div class="kw-tag">ship</div>';
        },
        copy: function () {
            return '<div class="kw-copy"><span class="kw-copy-text"></span><span class="kw-caret"></span></div>' +
                '<div class="kw-meter"><i></i></div>' +
                '<div class="kw-tag">rewrite</div>';
        },
        assets: function () {
            return '<div class="kw-deck"><i>LOGO</i><i>SOCIAL</i><i>DECK</i><i>ICON</i></div>' +
                '<div class="kw-tag">assets</div>';
        }
    };

    function buildWidget(kind) {
        if (!WIDGETS[kind]) return null;
        var w = el('div', 'km-w', WIDGETS[kind]());
        w.setAttribute('data-km-w', kind);
        w.setAttribute('aria-hidden', 'true');
        observeLive(w);
        if (kind === 'copy') initCopyWidget(w);
        return w;
    }

    /* --- the rewriting headline --- */
    var COPY_PHRASES = {
        en: ['We do design.', 'Design that sells.', 'Design that lifts your price.'],
        nl: ['Wij doen design.', 'Design dat verkoopt.', 'Design dat je prijs verhoogt.']
    };
    function initCopyWidget(w) {
        var out = $('.kw-copy-text', w);
        var meter = $('.kw-meter i', w);
        if (!out) return;
        if (REDUCED) {
            out.textContent = COPY_PHRASES[lang() === 'nl' ? 'nl' : 'en'][2];
            if (meter) meter.style.width = '100%';
            return;
        }
        var i = 0, c = 0, erasing = false, timer = null;
        function list() { return COPY_PHRASES[lang() === 'nl' ? 'nl' : 'en']; }
        function step() {
            var phrases = list();
            i = i % phrases.length;
            var full = phrases[i];
            if (!erasing) {
                c++;
                out.textContent = full.slice(0, c);
                if (meter) meter.style.width = (22 + (i * 39)) + '%';
                if (c >= full.length) { erasing = true; timer = setTimeout(step, 1500); return; }
                timer = setTimeout(step, 42);
            } else {
                c--;
                out.textContent = full.slice(0, Math.max(0, c));
                if (c <= 0) { erasing = false; i++; timer = setTimeout(step, 320); return; }
                timer = setTimeout(step, 20);
            }
        }
        step();
        var seenLang = lang();
        document.addEventListener('km:langchange', function () {
            if (lang() === seenLang) return;   /* refreshI18n fires this too */
            seenLang = lang();
            clearTimeout(timer); c = 0; erasing = false; out.textContent = '';
            timer = setTimeout(step, 200);
        });
    }

    /* --- attach widgets to the capability grid --- */
    var CAP_ORDER = ['strategy', 'identity', 'build', 'copy', 'assets'];
    var CAP_NOTES = {
        strategy: { en: 'Where you sit, who you beat, what you charge.', nl: 'Waar je staat, wie je verslaat, wat je vraagt.' },
        identity: { en: 'One mark, one palette, one voice — everywhere.', nl: 'Één merk, één palet, één toon — overal.' },
        build: { en: 'A site that loads fast and converts faster.', nl: 'Een site die snel laadt en sneller converteert.' },
        copy: { en: 'Words that carry the price you want to charge.', nl: 'Woorden die de prijs dragen die je wilt vragen.' },
        assets: { en: 'Every file your team needs, ready to use.', nl: 'Elk bestand dat je team nodig heeft, klaar voor gebruik.' }
    };

    function initCapabilities() {
        var items = $$('.cap-grid .cap-item');
        if (!items.length) return;
        items.forEach(function (item, idx) {
            if (item.dataset.kmDone) return;
            item.dataset.kmDone = '1';

            var kind = item.dataset.kmWidget || CAP_ORDER[idx % CAP_ORDER.length];
            var icon = $('.cap-icon', item);
            var label = $('.cap-label', item);

            /* icon + label sit on one line so the widget owns the card */
            if (icon && label) {
                var head = el('div', 'cap-head');
                item.insertBefore(head, icon);
                head.appendChild(icon);
                head.appendChild(label);
            }

            var note = CAP_NOTES[kind];
            if (note) {
                var n = el('span', 'cap-note');
                n.setAttribute('data-en', note.en);
                n.setAttribute('data-nl', note.nl);
                n.textContent = note[lang() === 'nl' ? 'nl' : 'en'];
                item.appendChild(n);
            }

            var w = buildWidget(kind);
            if (w) item.appendChild(w);
        });
        refreshI18n();
    }

    /* ======================================================================
       3. SECTION ACCENTS
       ====================================================================== */

    /* --- the ridge chart under every stat number ---
       Bar heights follow a rising profile with a little seeded wobble, so the
       four cards each get their own shape instead of the same sparkline. */
    var RIDGE_BARS = 22;
    function initStats() {
        var cards = $$('.stat-card');
        if (!cards.length) return;

        cards.forEach(function (card, ci) {
            if (card.dataset.kmDone) return;
            card.dataset.kmDone = '1';

            var numEl = $('.stat-number', card);
            var pct = numEl ? parseInt(numEl.getAttribute('data-target'), 10) : 0;
            if (!pct || isNaN(pct)) pct = 60;
            var filled = Math.max(1, Math.round(RIDGE_BARS * pct / 100));

            var bars = '', pts = [];
            for (var i = 0; i < RIDGE_BARS; i++) {
                var t = i / (RIDGE_BARS - 1);
                /* a rising curve plus a repeatable wobble unique to each card */
                var wobble = Math.sin((i + ci * 2.7) * 1.15) * 7 + Math.sin((i + ci) * 0.47) * 4;
                var h = Math.round(Math.max(10, Math.min(100, 26 + t * t * 58 + t * 12 + wobble)));
                var cls = i < filled ? (i === filled - 1 ? 'is-on is-edge' : 'is-on') : '';
                bars += '<i class="' + cls + '" style="--h:' + h + '%;--i:' + i + '"></i>';
                /* the hairline runs across the bar tops in a 0–100 box */
                pts.push(((i + 0.5) / RIDGE_BARS * 100).toFixed(2) + ',' + (100 - h).toFixed(2));
            }

            card.insertAdjacentHTML('beforeend',
                '<div class="km-ridge" aria-hidden="true">' +
                '<div class="km-ridge-bars">' + bars + '</div>' +
                '<svg class="km-ridge-line" viewBox="0 0 100 100" preserveAspectRatio="none">' +
                '<polyline points="' + pts.join(' ') + '"></polyline>' +
                '</svg></div>');
            observeLive(card, { once: true });
        });
    }

    /* --- the thread that draws through the process steps ---
       Left/right are measured from the real icon positions rather than
       hardcoded, because the grid is 3 columns on one page and 4 on
       another (and collapses on mobile). --- */
    function initProcess() {
        var grid = $('.process-grid');
        if (!grid || grid.dataset.kmDone) return;
        grid.dataset.kmDone = '1';

        /* number badges need a span so the lime fill can sit behind the text */
        var icons = $$('.process-item .process-icon', grid);
        icons.forEach(function (icon) {
            if ($('span', icon)) return;
            icon.innerHTML = '<span>' + icon.textContent.trim() + '</span>';
        });
        if (icons.length < 2) return;

        var thread = el('div', 'km-thread', '<i></i>');
        thread.style.display = 'none';
        grid.insertBefore(thread, grid.firstChild);

        /* offsetLeft/offsetTop ignore CSS transforms, so the thread lands in the
           right place even while the reveal tweens are still running. */
        function offsetIn(node, ancestor) {
            var x = 0, y = 0, n = node;
            while (n && n !== ancestor) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
            return { x: x, y: y };
        }

        function place() {
            var first = icons[0], last = icons[icons.length - 1];
            var a = offsetIn(first, grid);
            var b = offsetIn(last, grid);
            /* single column (mobile) — the icons stack, so no thread */
            if (Math.abs(a.y - b.y) > 4) { thread.style.display = 'none'; return; }
            thread.style.display = '';
            thread.style.left = (a.x + first.offsetWidth / 2) + 'px';
            thread.style.right = (grid.offsetWidth - b.x - last.offsetWidth / 2) + 'px';
            thread.style.top = (a.y + first.offsetHeight / 2 - 1) + 'px';
        }
        place();
        window.addEventListener('resize', place, { passive: true });
        window.addEventListener('load', function () { setTimeout(place, 300); });
        observeLive(thread, { once: true });
    }

    /* --- eyebrow labels above section headings --- */
    var EYEBROWS = [
        { sel: '.projects .section-head', en: 'Selected work', nl: 'Geselecteerd werk' },
        { sel: '.capabilities .section-head', en: 'What you get', nl: 'Wat je krijgt' },
        { sel: '.stats-section .section-head', en: 'The numbers', nl: 'De cijfers' },
        { sel: '.process-section .section-head', en: 'How it works', nl: 'Hoe het werkt' },
        { sel: '.section-values .section-head', en: 'What we stand for', nl: 'Waar we voor staan' },
        { sel: '.section-process .section-head', en: 'How it works', nl: 'Hoe het werkt' },
        { sel: '.tiers .section-head', en: 'Investment', nl: 'Investering' },
        { sel: '.compare .section-head', en: 'Compare', nl: 'Vergelijk' },
        { sel: '.faq .section-head', en: 'Questions', nl: 'Vragen' }
    ];
    function initEyebrows() {
        EYEBROWS.forEach(function (cfg) {
            $$(cfg.sel).forEach(function (head) {
                if (head.dataset.kmEyebrow) return;
                head.dataset.kmEyebrow = '1';
                var e = el('span', 'km-eyebrow');
                e.setAttribute('data-en', cfg.en);
                e.setAttribute('data-nl', cfg.nl);
                e.textContent = cfg[lang() === 'nl' ? 'nl' : 'en'];
                head.insertBefore(e, head.firstChild);
                observeLive(e, { once: true });
            });
        });
        refreshI18n();
    }

    /* --- hover edge-draw on card-like blocks across every page --- */
    function initEdges() {
        var sels = ['.tier-card', '.value-card', '.proof-item', '.folder-card'];
        sels.forEach(function (s) {
            $$(s).forEach(function (n) { n.classList.add('km-edge'); });
        });
    }

    /* --- reveal only the blocks the per-page GSAP setup misses.
       Keep this list small: pricing's tier cards and every .section-head are
       already tweened by their own page, and doubling up leaves elements
       stuck at opacity 0. --- */
    function initGenericReveals() {
        var sels = ['.proof-strip .proof-item'];
        var seen = [];
        sels.forEach(function (s) {
            $$(s).forEach(function (n) {
                if (n.dataset.kmReveal) return;
                if (n.closest('.km-w')) return;
                n.dataset.kmReveal = '1';
                seen.push(n);
            });
        });
        seen.forEach(function (n, i) {
            n.classList.add('km-r');
            n.style.transitionDelay = Math.min(i % 6, 5) * 0.07 + 's';
            observeLive(n, { once: true });
        });
    }

    /* ======================================================================
       about.html — the compounding curve
       ====================================================================== */
    var COMPOUND_TEXT = {
        en: {
            title: 'Why a brand system compounds and a redesign doesn\'t.',
            flat: 'One-off refresh', curve: 'Brand system',
            tagFlat: 'Flattens by year 2', tagCurve: 'Still climbing', tagDelta: 'The gap',
            foot: [
                ['Compounds over', '3 yrs'],
                ['Gap by year three', '3.4×'],
                ['Time to first result', '6 wks']
            ]
        },
        nl: {
            title: 'Waarom een brand system doorgroeit en een redesign niet.',
            flat: 'Eenmalige restyling', curve: 'Brand system',
            tagFlat: 'Vlakt af in jaar 2', tagCurve: 'Blijft stijgen', tagDelta: 'Het verschil',
            foot: [
                ['Groeit door over', '3 jr'],
                ['Verschil in jaar drie', '3,4×'],
                ['Tot eerste resultaat', '6 wkn']
            ]
        }
    };

    function initCompound() {
        var host = $('.philosophy-grid');
        if (!host || $('.km-compound')) return;
        var t = COMPOUND_TEXT[lang() === 'nl' ? 'nl' : 'en'];

        /* The SVG is stretched to the container (preserveAspectRatio="none"),
           so every stroke carries vector-effect="non-scaling-stroke" — without
           it the line weights get squashed along with the geometry. Axis
           labels, markers and droplines are plain HTML for the same reason. */
        var grid = '', axis = '', dots = '';
        /* the curve's actual y at each year mark (solved off the bezier), so
           the markers sit exactly on the line rather than near it */
        var yearY = [206, 169, 97, 20];
        var flatY = [206, 172, 165, 157];

        for (var i = 0; i <= 3; i++) {
            var x = 20 + i * 253.3;
            var xPct = (x / 800) * 100;
            grid += '<line vector-effect="non-scaling-stroke" x1="' + x + '" y1="8" x2="' + x + '" y2="216"></line>';
            axis += '<span style="left:' + xPct + '%">' +
                (lang() === 'nl' ? 'JR ' : 'YR ') + i + '</span>';
            /* marker on the curve plus a dropline down to the baseline */
            var topPct = (yearY[i] / 224) * 100;
            dots += '<span class="kc-drop" style="left:' + xPct + '%;top:' + topPct +
                '%;height:' + (((216 - yearY[i]) / 224) * 100) + '%;--d:' + (1.05 + i * 0.16) + 's"></span>' +
                '<span class="kc-dot" style="left:' + xPct + '%;top:' + topPct +
                '%;--d:' + (1.15 + i * 0.16) + 's"></span>';
        }
        for (var j = 1; j <= 3; j++) {
            var y = 16 + j * 52;
            grid += '<line vector-effect="non-scaling-stroke" x1="20" y1="' + y + '" x2="780" y2="' + y + '"></line>';
        }

        var flat = 'M20,' + flatY[0] + ' C160,186 300,170 420,165 C540,160 660,158 780,' + flatY[3];
        var curve = 'M20,206 C150,197 260,176 380,141 C500,106 640,62 780,20';

        var wrap = el('section', 'km-compound',
            '<div class="km-compound-head">' +
            '<h3 data-en="' + COMPOUND_TEXT.en.title + '" data-nl="' + COMPOUND_TEXT.nl.title + '">' + t.title + '</h3>' +
            '<div class="km-compound-legend">' +
            '<span class="l1"><i></i><em data-en="' + COMPOUND_TEXT.en.flat + '" data-nl="' + COMPOUND_TEXT.nl.flat + '" style="font-style:normal">' + t.flat + '</em></span>' +
            '<span class="l2"><i></i><em data-en="' + COMPOUND_TEXT.en.curve + '" data-nl="' + COMPOUND_TEXT.nl.curve + '" style="font-style:normal">' + t.curve + '</em></span>' +
            '</div></div>' +

            '<div class="km-compound-chart">' +
            '<svg viewBox="0 0 800 224" preserveAspectRatio="none" aria-hidden="true">' +
            '<defs><linearGradient id="kcGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" stop-color="var(--accent)" stop-opacity=".38"></stop>' +
            '<stop offset="100%" stop-color="var(--accent)" stop-opacity="0"></stop>' +
            '</linearGradient>' +
            '</defs>' +
            '<g class="kc-grid">' + grid + '</g>' +
            '<path class="kc-area" d="' + curve + ' L780,216 L20,216 Z"></path>' +
            '<path class="kc-flat" vector-effect="non-scaling-stroke" d="' + flat + '"></path>' +
            '<path class="kc-glow" vector-effect="non-scaling-stroke" d="' + curve + '"></path>' +
            '<path class="kc-curve" vector-effect="non-scaling-stroke" d="' + curve + '"></path>' +
            '<line class="kc-delta" vector-effect="non-scaling-stroke" x1="742" y1="26" x2="742" y2="152"></line>' +
            '</svg>' +
            dots +
            '<span class="kc-cap" style="left:92.75%;top:11.6%"></span>' +
            '<span class="kc-cap" style="left:92.75%;top:67.8%"></span>' +
            '<div class="km-compound-axis">' + axis + '</div>' +
            '<span class="km-compound-tag t-curve" data-en="' + COMPOUND_TEXT.en.tagCurve + '" data-nl="' + COMPOUND_TEXT.nl.tagCurve + '">' + t.tagCurve + '</span>' +
            '<span class="km-compound-tag t-delta" data-en="' + COMPOUND_TEXT.en.tagDelta + '" data-nl="' + COMPOUND_TEXT.nl.tagDelta + '">' + t.tagDelta + '</span>' +
            '<span class="km-compound-tag t-flat" data-en="' + COMPOUND_TEXT.en.tagFlat + '" data-nl="' + COMPOUND_TEXT.nl.tagFlat + '">' + t.tagFlat + '</span>' +
            '</div>' +

            '<div class="km-compound-foot">' + t.foot.map(function (f, k) {
                return '<div><span data-en="' + COMPOUND_TEXT.en.foot[k][0] + '" data-nl="' + COMPOUND_TEXT.nl.foot[k][0] + '">' + f[0] + '</span>' +
                    '<b data-en="' + COMPOUND_TEXT.en.foot[k][1] + '" data-nl="' + COMPOUND_TEXT.nl.foot[k][1] + '">' + f[1] + '</b></div>';
            }).join('') + '</div>'
        );

        host.parentNode.insertBefore(wrap, host.nextSibling);
        observeLive(wrap, { once: true });
        refreshI18n();
    }

    /* --- about.html: value cards get an index --- */
    function initValueCards() {
        $$('.value-card').forEach(function (card, i) {
            if ($('.km-vnum', card)) return;
            var n = el('span', 'km-vnum', ('0' + (i + 1)).slice(-2));
            n.setAttribute('aria-hidden', 'true');
            card.insertBefore(n, card.firstChild);
        });
    }

    /* --- contact.html: the three pillars orbiting the KM.dev core --- */
    var ORBIT_NODES = [
        { en: 'Strategy', nl: 'Strategie', x: '50%', y: '4%', d: '0s', accent: true },
        { en: 'Identity', nl: 'Identiteit', x: '11%', y: '74%', d: '.5s', accent: false },
        { en: 'Website', nl: 'Website', x: '89%', y: '74%', d: '1s', accent: false }
    ];
    function initOrbit() {
        var host = $('.contact-info');
        if (!host || $('.km-orbit')) return;
        var wrap = el('div', 'km-orbit-wrap');
        var orbit = el('div', 'km-orbit',
            '<div class="ko-ring"></div><div class="ko-ring r2"></div><div class="ko-ring r3"></div>' +
            '<div class="ko-spark"></div>' +
            '<div class="ko-core">KM<span class="dot">.</span>dev</div>' +
            ORBIT_NODES.map(function (n) {
                return '<div class="ko-node' + (n.accent ? ' is-accent' : '') + '"' +
                    ' style="--x:' + n.x + ';--y:' + n.y + ';--d:' + n.d + '"' +
                    ' data-en="' + n.en + '" data-nl="' + n.nl + '">' +
                    n[lang() === 'nl' ? 'nl' : 'en'] + '</div>';
            }).join('')
        );
        orbit.setAttribute('aria-hidden', 'true');
        var cap = el('span', 'km-orbit-cap');
        cap.setAttribute('data-en', 'One system · one team · one price');
        cap.setAttribute('data-nl', 'Eén systeem · één team · één prijs');
        cap.textContent = lang() === 'nl'
            ? 'Eén systeem · één team · één prijs'
            : 'One system · one team · one price';
        wrap.appendChild(orbit);
        wrap.appendChild(cap);
        host.appendChild(wrap);
        observeLive(orbit);
        refreshI18n();
    }

    /* --- count-up for proof numbers (projects.html) --- */
    function initCounters() {
        var nums = $$('.proof-num');
        if (!nums.length || !('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (!e.isIntersecting) return;
                io.unobserve(e.target);
                var node = e.target;
                var raw = (node.textContent || '').trim();
                var m = raw.match(/^(\d+)(.*)$/);
                if (!m) return;
                var target = parseInt(m[1], 10);
                var suffix = m[2] || '';
                if (REDUCED || target === 0) { node.textContent = raw; return; }
                var start = performance.now();
                var dur = 1200;
                (function tick(now) {
                    var t = Math.min(1, (now - start) / dur);
                    var eased = 1 - Math.pow(1 - t, 3);
                    node.textContent = Math.round(target * eased) + suffix;
                    if (t < 1) requestAnimationFrame(tick);
                })(start);
            });
        }, { threshold: 0.4 });
        nums.forEach(function (n) { io.observe(n); });
    }

    /* ======================================================================
       brand-system.html — a live scene on every part of the system
       ====================================================================== */
    /* Each scene runs a four-act loop. A tiny state machine flips data-act on
       the panel and the CSS reacts, which keeps long sequences readable and
       lets every act have its own label and pacing. */
    var BS_ACT_MS = 3400;

    function L() { return lang() === 'nl' ? 'nl' : 'en'; }
    function bilingual(en, nl) {
        return ' data-en="' + en + '" data-nl="' + nl + '">' + (L() === 'nl' ? nl : en);
    }

    var BS_SCENES = {
        strategy: {
            acts: [
                { en: 'Mapping the field', nl: 'Het veld in kaart' },
                { en: 'Finding the gap', nl: 'Het gat vinden' },
                { en: 'Taking the position', nl: 'De positie pakken' },
                { en: 'Pricing to match', nl: 'Prijs erop afstemmen' }
            ],
            html: function () {
                var chips = [
                    { en: 'Generic', nl: 'Generiek', x: '26%', y: '32%', d: '.1s' },
                    { en: 'Cheap', nl: 'Goedkoop', x: '19%', y: '62%', d: '.35s' },
                    { en: 'Crowded', nl: 'Druk', x: '50%', y: '72%', d: '.6s' },
                    { en: 'Copycat', nl: 'Kopie', x: '57%', y: '44%', d: '.85s' }
                ];
                return '<div class="bss-board"><div class="bss-grid"></div>' +
                    '<span class="bss-scan"></span>' +
                    '<span class="bss-axis top"' + bilingual('Premium', 'Premium') + '</span>' +
                    '<span class="bss-axis bottom"' + bilingual('Budget', 'Prijsvechter') + '</span>' +
                    '<span class="bss-gap"></span>' +
                    chips.map(function (c) {
                        return '<span class="bss-chip" style="--x:' + c.x + ';--y:' + c.y + ';--d:' + c.d + '"' +
                            bilingual(c.en, c.nl) + '</span>';
                    }).join('') +
                    '<span class="bss-you"' + bilingual('You', 'Jij') + '</span>' +
                    '<span class="bss-price"><b>€8k</b><em>→</em><b class="up">€12k</b></span>' +
                    '</div>';
            }
        },
        identity: {
            acts: [
                { en: 'Drawing the mark', nl: 'Het beeldmerk tekenen' },
                { en: 'Resolving the palette', nl: 'Het palet bepalen' },
                { en: 'Setting the type scale', nl: 'De typeschaal zetten' },
                { en: 'One sheet, one system', nl: 'Eén sheet, één systeem' }
            ],
            html: function () {
                return '<div class="bss-kit">' +
                    '<div class="bss-mark">' +
                    '<svg class="bss-draw" viewBox="0 0 60 60" aria-hidden="true">' +
                    '<path d="M14 44V16l12 15 12-15v28"></path>' +
                    '</svg>' +
                    '<span>KM<em>.</em></span><span>KM<em>.</em></span><span>KM<em>.</em></span>' +
                    '</div>' +
                    '<div class="bss-right">' +
                    '<div class="bss-swatches"><i></i><i></i><i></i><i></i><i></i></div>' +
                    '<div class="bss-type"><b>Aa</b><b>Aa</b><b>Aa</b></div>' +
                    '<div class="bss-sheet"><u></u><u></u><u></u><u></u><u></u><u></u></div>' +
                    '</div></div>';
            }
        },
        website: {
            acts: [
                { en: 'Laying out the page', nl: 'De opbouw neerzetten' },
                { en: 'Filling in the content', nl: 'De inhoud invullen' },
                { en: 'Tuning performance', nl: 'Performance afstellen' },
                { en: 'Shipping it', nl: 'Live zetten' }
            ],
            html: function () {
                return '<span class="bss-live">LIVE</span>' +
                    '<div class="bss-ship">' +
                    '<div class="bss-wire"><b></b><b></b><b></b><b></b><b></b></div>' +
                    '<div class="bss-score">' +
                    '<svg viewBox="0 0 82 82" aria-hidden="true">' +
                    '<circle class="bg" cx="41" cy="41" r="34"></circle>' +
                    '<circle class="fg" cx="41" cy="41" r="34"></circle></svg>' +
                    '<span><u class="bss-num">0</u><small' + bilingual('SPEED', 'SNELHEID') + '</small></span>' +
                    '</div></div>' +
                    '<div class="bss-log"><span' + bilingual('build passed', 'build geslaagd') + '</span></div>';
            }
        },
        assets: {
            acts: [
                { en: 'Collecting the files', nl: 'Bestanden verzamelen' },
                { en: 'Checking every asset', nl: 'Elke asset controleren' },
                { en: 'Packaging it up', nl: 'Alles inpakken' },
                { en: 'Yours to keep', nl: 'Van jou, voorgoed' }
            ],
            html: function () {
                var files = [
                    ['logo.svg', '24 KB'], ['guidelines.pdf', '4.1 MB'],
                    ['ui-kit.fig', '18 MB'], ['icons.zip', '860 KB']
                ];
                return '<div class="bss-files">' + files.map(function (f, i) {
                    return '<div class="bss-file" style="--i:' + i + '">' +
                        '<span class="tick">✓</span><span>' + f[0] + '</span><span class="sz">' + f[1] + '</span></div>';
                }).join('') + '</div>' +
                    '<div class="bss-zip">km-dev-brand.zip</div>' +
                    '<div class="bss-bar"><i></i></div>';
            }
        }
    };
    var BS_ORDER = ['strategy', 'identity', 'website', 'assets'];

    /* advance data-act while the scene is on screen; pause when it isn't */
    function runScene(scene, kind) {
        var acts = BS_SCENES[kind].acts;
        var label = $('.bss-act', scene);
        var pips = $$('.bss-pip', scene);
        var act = 0, timer = null;

        function paint() {
            scene.setAttribute('data-act', String(act + 1));
            if (label) {
                label.classList.add('is-swap');
                setTimeout(function () {
                    label.setAttribute('data-en', acts[act].en);
                    label.setAttribute('data-nl', acts[act].nl);
                    label.textContent = acts[act][L()];
                    label.classList.remove('is-swap');
                }, 180);
            }
            pips.forEach(function (p, i) { p.classList.toggle('is-on', i === act); });
        }
        /* the performance score ticks up during its own act */
        var num = $('.bss-num', scene);
        var numRaf = null;
        function countTo(target, ms) {
            if (!num) return;
            cancelAnimationFrame(numRaf);
            var from = parseInt(num.textContent, 10) || 0;
            var t0 = performance.now();
            (function step(now) {
                var p = Math.min(1, (now - t0) / ms);
                num.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3)));
                if (p < 1) numRaf = requestAnimationFrame(step);
            })(t0);
        }

        function tick() {
            act = (act + 1) % acts.length;
            paint();
            if (num) {
                if (act === 2) countTo(98, 1900);
                else if (act === 0) { cancelAnimationFrame(numRaf); num.textContent = '0'; }
            }
        }

        function start() {
            if (timer) return;
            paint();
            timer = setInterval(tick, BS_ACT_MS);
        }
        function stop() { clearInterval(timer); timer = null; }

        if ('IntersectionObserver' in window && !REDUCED) {
            new IntersectionObserver(function (entries) {
                entries.forEach(function (e) { e.isIntersecting ? start() : stop(); });
            }, { threshold: 0.25 }).observe(scene);
        } else {
            act = acts.length - 1; paint();
            if (num) num.textContent = '98';
        }
    }

    function initBrandSystem() {
        var sections = $$('.bs-section');
        if (!sections.length) return;

        sections.forEach(function (sec, i) {
            if (sec.dataset.kmDone) return;
            sec.dataset.kmDone = '1';

            var visual = $('.zigzag-visual', sec);
            var kind = sec.id === 'brand-assets' ? 'assets' :
                (BS_SCENES[sec.id] ? sec.id : BS_ORDER[i % BS_ORDER.length]);

            if (visual && BS_SCENES[kind]) {
                var ghost = el('div', 'bs-ghost', ('0' + (i + 1)).slice(-2));
                ghost.setAttribute('aria-hidden', 'true');
                visual.appendChild(ghost);
                observeLive(ghost, { once: true });

                var cfg = BS_SCENES[kind];
                var scene = el('div', 'bs-scene',
                    '<div class="bss-head">' +
                    '<i></i><span class="bss-act">' + cfg.acts[0][L()] + '</span>' +
                    '<span class="bss-pips">' + cfg.acts.map(function () {
                        return '<span class="bss-pip"></span>';
                    }).join('') + '</span>' +
                    '</div>' + cfg.html());
                scene.setAttribute('data-bs-scene', kind);
                scene.setAttribute('data-act', '1');
                scene.setAttribute('aria-hidden', 'true');
                visual.appendChild(scene);
                observeLive(scene);
                runScene(scene, kind);
            }

            /* checklist ticks draw themselves in, one after the other */
            $$('.bs-checklist li', sec).forEach(function (li, j) {
                li.style.transitionDelay = (j * 0.08) + 's';
                $$('.check-icon path', li).forEach(function (p) {
                    p.style.transitionDelay = (j * 0.08 + 0.18) + 's';
                });
                observeLive(li, { once: true });
            });
        });
        refreshI18n();
    }

    /* --- scroll cue under the hero --- */
    function initHeroCue() {
        var hero = $('.hero .hero-text');
        if (!hero || $('.km-cue')) return;
        var next = $('.reveal-block') || $('.projects') || $('section:nth-of-type(2)');
        if (!next) return;
        if (!next.id) next.id = 'km-next';
        var cue = el('a', 'km-cue',
            '<span class="km-cue-rail"></span><span data-en="Scroll" data-nl="Scroll">Scroll</span>');
        cue.href = '#' + next.id;
        hero.appendChild(cue);
    }

    /* ======================================================================
       Boot
       ====================================================================== */
    function boot() {
        try { initPreloader(); } catch (e) {}
        try { initNav(); } catch (e) {}
        try { initMenu(); } catch (e) {}
        try { initBrandSystem(); } catch (e) {}
        try { initCapabilities(); } catch (e) {}
        try { initStats(); } catch (e) {}
        try { initProcess(); } catch (e) {}
        try { initEyebrows(); } catch (e) {}
        try { initEdges(); } catch (e) {}
        try { initGenericReveals(); } catch (e) {}
        try { initCompound(); } catch (e) {}
        try { initValueCards(); } catch (e) {}
        try { initOrbit(); } catch (e) {}
        try { initCounters(); } catch (e) {}
        try { initHeroCue(); } catch (e) {}

        /* Failsafe: nothing this file adds should ever be able to leave content
           permanently invisible. Anything still hidden after 2.5s is revealed. */
        setTimeout(function () {
            $$('.km-r:not(.is-live), .bs-checklist li:not(.is-live), .bs-scene:not(.is-live)')
                .forEach(function (n) {
                    if (n.getBoundingClientRect().top < window.innerHeight * 1.3) n.classList.add('is-live');
                });
        }, 2500);

        /* GSAP owns layout-sensitive triggers on some pages — nudge it. */
        window.addEventListener('load', function () {
            setTimeout(function () {
                if (window.ScrollTrigger && window.ScrollTrigger.refresh) window.ScrollTrigger.refresh();
            }, 400);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
