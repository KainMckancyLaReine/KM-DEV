/* =========================================================
   KM.OS — gedeelde kern
   Auth, opslag, datamodel, shell, sync, analytics, AI-proxy.
   Elke app in /os laadt dit als eerste script.
   ========================================================= */
(function(global){
'use strict';

/* ---------------------------------------------------------
   0. Auth
   --------------------------------------------------------- */
function guard(){
    try{
        var s = JSON.parse(localStorage.getItem('kmdev_session') || 'null');
        if(!s || s.exp < Date.now()){ localStorage.removeItem('kmdev_session'); location.replace('../login.html'); return false; }
    }catch(e){ location.replace('../login.html'); return false; }
    return true;
}

/* ---------------------------------------------------------
   1. Basis
   --------------------------------------------------------- */
var $  = function(s, r){ return (r||document).querySelector(s); };
var $$ = function(s, r){ return [].slice.call((r||document).querySelectorAll(s)); };
var uid = function(){ return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-3); };
var esc = function(s){ return String(s==null?'':s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };

var MONTHS = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
var DOW    = ['ma','di','wo','do','vr','za','zo'];
var DOW_LONG = ['maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag','zondag'];

function iso(d){ d = d || new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function parseISO(s){ return s ? new Date(s + 'T00:00:00') : null; }
function addDays(d, n){ var x = new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfWeek(d){ d = new Date(d||new Date()); var w = (d.getDay()+6)%7; return addDays(d, -w); }
function fmtDate(s){
    var d = parseISO(s); if(!d || isNaN(d)) return s || '';
    var t = new Date(); t.setHours(0,0,0,0);
    var diff = Math.round((d - t) / 864e5);
    if(diff === 0) return 'vandaag';
    if(diff === 1) return 'morgen';
    if(diff === -1) return 'gisteren';
    if(diff > 1 && diff < 7) return 'over ' + diff + ' dagen';
    if(diff < -1 && diff > -7) return diff*-1 + ' dagen te laat';
    return d.getDate() + ' ' + MONTHS[d.getMonth()].slice(0,3);
}
function dayDiff(s){
    var d = parseISO(s); if(!d) return null;
    var t = new Date(); t.setHours(0,0,0,0);
    return Math.round((d - t) / 864e5);
}
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

/* ---------------------------------------------------------
   2. Opslag
   --------------------------------------------------------- */
function Store(key, seedFn){
    this.key = key; this.seedFn = seedFn; this.data = null; this._t = null; this._subs = [];
}
Store.prototype.load = function(){
    try{ this.data = JSON.parse(localStorage.getItem(this.key) || 'null'); }catch(e){ this.data = null; }
    if(!this.data && this.seedFn){ this.data = this.seedFn(); this.saveNow(); }
    return this.data;
};
Store.prototype.save = function(){
    var self = this;
    clearTimeout(this._t);
    this._t = setTimeout(function(){ self.saveNow(); }, 200);
};
Store.prototype.saveNow = function(){
    clearTimeout(this._t);
    try{
        if(this.data) this.data.updatedAt = Date.now();
        localStorage.setItem(this.key, JSON.stringify(this.data));
        this._subs.forEach(function(f){ try{ f(); }catch(e){} });
        if(KM.sync.auto()) KM.sync.push(true);
    }catch(e){ KM.toast('Opslaan mislukt — opslag vol?', 'err'); }
};
Store.prototype.on = function(fn){ this._subs.push(fn); };

/* ---------------------------------------------------------
   3. Life OS datamodel
   --------------------------------------------------------- */
var AREAS = [
    { id:'work',   name:'Werk & Carrière', icon:'💼', color:'var(--a-work)',   hex:'#2383e2' },
    { id:'health', name:'Gezondheid',      icon:'🌱', color:'var(--a-health)', hex:'#3f8f5c' },
    { id:'mind',   name:'Groei & Leren',   icon:'🧠', color:'var(--a-mind)',   hex:'#8b5cf6' },
    { id:'money',  name:'Financiën',       icon:'💎', color:'var(--a-money)',  hex:'#e8a33d' },
    { id:'social', name:'Relaties',        icon:'❤️', color:'var(--a-social)', hex:'#e0568a' },
    { id:'play',   name:'Plezier & Rust',  icon:'🎧', color:'var(--a-play)',   hex:'#e8632d' }
];
var areaOf = function(id){ return AREAS.filter(function(a){ return a.id === id; })[0] || AREAS[0]; };

var HORIZONS = [
    { id:'life',    name:'Levensdoel', span:'10 jaar' },
    { id:'year',    name:'Dit jaar',   span:'12 maanden' },
    { id:'quarter', name:'Dit kwartaal', span:'90 dagen' }
];
var PRIOS  = [
    { id:'p1', name:'Kritiek', color:'#d1503f' },
    { id:'p2', name:'Hoog',    color:'#e8a33d' },
    { id:'p3', name:'Normaal', color:'#2383e2' },
    { id:'p4', name:'Laag',    color:'#8f8d85' }
];
var ENERGY = [
    { id:'deep',    name:'Diep werk', icon:'🔮', mins:90 },
    { id:'focus',   name:'Focus',     icon:'⚡', mins:50 },
    { id:'shallow', name:'Licht',     icon:'🍃', mins:25 },
    { id:'admin',   name:'Admin',     icon:'📋', mins:20 }
];

function seedOS(){
    var d = function(n){ return iso(addDays(new Date(), n)); };
    var g1 = { id:uid(), title:'KM.dev naar €10k per maand', why:'Vrijheid om te kiezen aan welke projecten ik werk.', area:'work',   horizon:'year',    due:d(150), status:'active', icon:'🚀', created:Date.now() };
    var g2 = { id:uid(), title:'Sterkste versie van mezelf',  why:'Energie is de basis onder al het andere.',           area:'health', horizon:'year',    due:d(300), status:'active', icon:'🌱', created:Date.now() };
    var g3 = { id:uid(), title:'Elke maand iets nieuws bouwen', why:'Blijven maken is blijven groeien.',                area:'mind',   horizon:'quarter', due:d(60),  status:'active', icon:'🧠', created:Date.now() };

    var p1 = { id:uid(), title:'Website redesign afronden', goalId:g1.id, area:'work',   status:'doing', due:d(12), icon:'🎨' };
    var p2 = { id:uid(), title:'Nieuwe pricing lanceren',   goalId:g1.id, area:'work',   status:'todo',  due:d(30), icon:'💎' };
    var p3 = { id:uid(), title:'Trainingsschema 12 weken',  goalId:g2.id, area:'health', status:'doing', due:d(84), icon:'🏔️' };
    var p4 = { id:uid(), title:'Life OS bouwen',            goalId:g3.id, area:'mind',   status:'doing', due:d(7),  icon:'🧩' };

    var T = function(title, pid, st, dd, prio, en, tags){
        var pr = [p1,p2,p3,p4].filter(function(x){ return x.id === pid; })[0];
        return { id:uid(), title:title, projectId:pid, goalId: pr ? pr.goalId : null, area: pr ? pr.area : 'work',
                 status:st, due:dd==null?'':d(dd), prio:prio, energy:en, tags:tags||[], created:Date.now(), doneAt:st==='done'?Date.now():null };
    };
    var tasks = [
        T('Hero-animatie fixen',        p1.id, 'doing', 0,  'p1', 'deep',    ['code']),
        T('Cover-galerij afmaken',      p1.id, 'todo',  1,  'p2', 'deep',    ['code']),
        T('Mobiele check alle pagina\'s',p1.id,'todo',  2,  'p2', 'focus',   ['qa']),
        T('Prijstabel herschrijven',    p2.id, 'todo',  9,  'p3', 'focus',   ['copy']),
        T('Stripe-koppeling testen',    p2.id, 'todo',  14, 'p3', 'deep',    ['code']),
        T('Weekschema opstellen',       p3.id, 'done',  -2, 'p3', 'shallow', ['plan']),
        T('Boodschappen meal prep',     p3.id, 'todo',  0,  'p4', 'admin',   ['huis']),
        T('Mind Matrix uittekenen',     p4.id, 'doing', 0,  'p1', 'deep',    ['design']),
        T('Scheduler-algoritme',        p4.id, 'todo',  3,  'p2', 'deep',    ['code']),
        T('Facturen versturen',         null,  'todo',  1,  'p2', 'admin',   ['admin'])
    ];

    var H = function(t, ic, col){ return { id:uid(), title:t, icon:ic, color:col, log:{}, created:Date.now() }; };
    var habits = [ H('Bewegen','🏃','#3f8f5c'), H('Lezen 20 min','📖','#8b5cf6'), H('Diep werk blok','🔮','#2383e2'), H('Geen schermen na 22u','🌙','#e0568a') ];
    // wat historie zodat de heatmap meteen leeft
    habits.forEach(function(h, i){
        for(var k = 1; k <= 26; k++){
            if((k + i) % 3 !== 0) h.log[iso(addDays(new Date(), -k))] = true;
        }
    });

    return {
        v:1,
        goals:[g1,g2,g3],
        projects:[p1,p2,p3,p4],
        tasks:tasks,
        habits:habits,
        notes:[{ id:uid(), title:'Waarom dit systeem', body:'Alles wat ik wil, wat ik doe en wat ik denk op één plek — en zichtbaar hoe het samenhangt.', links:{goals:[g3.id]}, created:Date.now() }],
        reviews:[],
        plan:{},          // { '2026-08-03': [ {taskId, start, mins} ] }
        scenes:[],        // video studio
        designs:[],       // design studio
        updatedAt:Date.now()
    };
}

var OS = new Store('kmdev_os_v1', seedOS);

/* afgeleide helpers */
var osq = {
    task:    function(id){ return OS.data.tasks.filter(function(t){ return t.id === id; })[0]; },
    project: function(id){ return OS.data.projects.filter(function(p){ return p.id === id; })[0]; },
    goal:    function(id){ return OS.data.goals.filter(function(g){ return g.id === id; })[0]; },
    tasksOfProject: function(id){ return OS.data.tasks.filter(function(t){ return t.projectId === id; }); },
    tasksOfGoal:    function(id){ return OS.data.tasks.filter(function(t){ return t.goalId === id; }); },
    projectsOfGoal: function(id){ return OS.data.projects.filter(function(p){ return p.goalId === id; }); },
    open:    function(){ return OS.data.tasks.filter(function(t){ return t.status !== 'done'; }); },
    today:   function(){
        return OS.data.tasks.filter(function(t){
            if(t.status === 'done') return false;
            var dd = dayDiff(t.due);
            return dd !== null && dd <= 0;
        });
    },
    progress: function(goalId){
        var ts = osq.tasksOfGoal(goalId);
        if(!ts.length) return 0;
        return Math.round(ts.filter(function(t){ return t.status === 'done'; }).length / ts.length * 100);
    },
    projectProgress: function(pid){
        var ts = osq.tasksOfProject(pid);
        if(!ts.length) return 0;
        return Math.round(ts.filter(function(t){ return t.status === 'done'; }).length / ts.length * 100);
    },
    streak: function(habit){
        var n = 0, d = new Date();
        if(!habit.log[iso(d)]) d = addDays(d, -1);
        while(habit.log[iso(d)]){ n++; d = addDays(d, -1); }
        return n;
    },
    momentum: function(){
        // % van de laatste 7 dagen met minstens één afgeronde taak of gewoonte
        var hit = 0;
        for(var i = 0; i < 7; i++){
            var day = iso(addDays(new Date(), -i));
            var t = OS.data.tasks.some(function(x){ return x.doneAt && iso(new Date(x.doneAt)) === day; });
            var h = OS.data.habits.some(function(x){ return x.log[day]; });
            if(t || h) hit++;
        }
        return Math.round(hit / 7 * 100);
    }
};

/* ---------------------------------------------------------
   4. Instellingen (integraties)
   --------------------------------------------------------- */
var SET = new Store('kmdev_os_settings', function(){
    return {
        theme:'light',
        supabase:{ url:'', key:'', table:'km_workspace', auto:false, lastPush:0, lastPull:0 },
        posthog:{ key:'', host:'https://eu.i.posthog.com', on:false },
        ai:{ endpoint:'/api/ai', on:false },
        vercel:{ token:'', project:'' }
    };
});

/* ---------------------------------------------------------
   5. Supabase-sync
   --------------------------------------------------------- */
var supa = null;
var sync = {
    configured: function(){ var s = SET.data.supabase; return !!(s.url && s.key); },
    auto: function(){ return sync.configured() && SET.data.supabase.auto; },
    client: function(){
        if(supa) return Promise.resolve(supa);
        if(!sync.configured()) return Promise.reject(new Error('Supabase niet ingesteld'));
        return import('https://esm.sh/@supabase/supabase-js@2').then(function(m){
            supa = m.createClient(SET.data.supabase.url, SET.data.supabase.key);
            return supa;
        });
    },
    payload: function(){
        return {
            id: 'kain',
            os: OS.data,
            notion: JSON.parse(localStorage.getItem('kmdev_workspace_v1') || 'null'),
            updated_at: new Date().toISOString()
        };
    },
    push: function(silent){
        if(!sync.configured()){ if(!silent) KM.toast('Stel Supabase eerst in', 'err'); return Promise.resolve(false); }
        clearTimeout(sync._t);
        return new Promise(function(res){
            sync._t = setTimeout(function(){
                sync.client().then(function(c){
                    return c.from(SET.data.supabase.table).upsert(sync.payload()).select();
                }).then(function(r){
                    if(r.error) throw r.error;
                    SET.data.supabase.lastPush = Date.now(); SET.saveNow();
                    if(!silent) KM.toast('Gesynchroniseerd naar Supabase');
                    res(true);
                }).catch(function(e){
                    if(!silent) KM.toast('Sync mislukt: ' + e.message, 'err');
                    res(false);
                });
            }, silent ? 1200 : 0);
        });
    },
    pull: function(){
        if(!sync.configured()){ KM.toast('Stel Supabase eerst in', 'err'); return Promise.resolve(false); }
        return sync.client().then(function(c){
            return c.from(SET.data.supabase.table).select('*').eq('id','kain').maybeSingle();
        }).then(function(r){
            if(r.error) throw r.error;
            if(!r.data){ KM.toast('Nog niets in de cloud gevonden', 'err'); return false; }
            if(r.data.os){ OS.data = r.data.os; OS.saveNow(); }
            if(r.data.notion) localStorage.setItem('kmdev_workspace_v1', JSON.stringify(r.data.notion));
            SET.data.supabase.lastPull = Date.now(); SET.saveNow();
            KM.toast('Opgehaald uit Supabase');
            return true;
        }).catch(function(e){ KM.toast('Ophalen mislukt: ' + e.message, 'err'); return false; });
    },
    test: function(){
        return sync.client().then(function(c){
            return c.from(SET.data.supabase.table).select('id').limit(1);
        }).then(function(r){
            if(r.error) throw r.error;
            return { ok:true, msg:'Verbonden — tabel "' + SET.data.supabase.table + '" gevonden' };
        }).catch(function(e){ return { ok:false, msg:e.message }; });
    }
};

/* ---------------------------------------------------------
   6. PostHog
   --------------------------------------------------------- */
var ph = { ready:false, queue:[] };
function initAnalytics(){
    var p = SET.data.posthog;
    if(!p.on || !p.key || ph.ready) return;
    var s = document.createElement('script');
    s.src = (p.host.replace(/\/$/,'')) + '/static/array.js';
    s.async = true;
    s.onload = function(){
        if(!global.posthog) return;
        global.posthog.init(p.key, { api_host:p.host, person_profiles:'identified_only', capture_pageview:false });
        global.posthog.identify('kain');
        ph.ready = true;
        ph.queue.forEach(function(q){ global.posthog.capture(q[0], q[1]); });
        ph.queue = [];
        track('app_open', { app: document.body.dataset.app || 'os' });
    };
    s.onerror = function(){ console.warn('PostHog kon niet laden'); };
    document.head.appendChild(s);
}
function track(ev, props){
    if(!SET.data.posthog.on) return;
    if(ph.ready && global.posthog) global.posthog.capture(ev, props);
    else ph.queue.push([ev, props]);
}

/* ---------------------------------------------------------
   7. AI-proxy  (serverless functie op Vercel: /api/ai)
   --------------------------------------------------------- */
var ai = {
    on: function(){ return !!SET.data.ai.on; },
    call: function(kind, payload){
        if(!ai.on()) return Promise.reject(new Error('AI staat uit — zet hem aan bij Integraties'));
        return fetch(SET.data.ai.endpoint, {
            method:'POST',
            headers:{ 'Content-Type':'application/json' },
            body: JSON.stringify(Object.assign({ kind:kind }, payload))
        }).then(function(r){
            if(!r.ok) return r.text().then(function(t){ throw new Error('AI ' + r.status + ': ' + t.slice(0,160)); });
            return r.json();
        });
    },
    text:  function(prompt, system){ return ai.call('text',  { prompt:prompt, system:system }); },
    image: function(prompt, opts){   return ai.call('image', Object.assign({ prompt:prompt }, opts||{})); },
    video: function(prompt, opts){   return ai.call('video', Object.assign({ prompt:prompt }, opts||{})); }
};

/* ---------------------------------------------------------
   8. Apps
   --------------------------------------------------------- */
var APPS = [
    { id:'home',    name:'Launcher',     file:'index.html',        icon:'◈', desc:'Alle apps op één plek',                     tint:'#0d0d0d' },
    { id:'life',    name:'Life OS',      file:'life-os.html',      icon:'◎', desc:'Doelen, projecten, taken en gewoontes',     tint:'#c6ff4a' },
    { id:'matrix',  name:'Mind Matrix',  file:'matrix.html',       icon:'⬡', desc:'Zie hoe alles met elkaar verbonden is',     tint:'#8b5cf6' },
    { id:'plan',    name:'AI Scheduling',file:'schedule.html',     icon:'◷', desc:'Je week automatisch ingepland',             tint:'#2383e2' },
    { id:'video',   name:'Video Studio', file:'video.html',        icon:'▶', desc:'Storyboards en AI-video',                   tint:'#e0568a' },
    { id:'design',  name:'Design Studio',file:'design.html',       icon:'✦', desc:'On-brand visuals in seconden',              tint:'#e8a33d' },
    { id:'notes',   name:'Notities',     file:'../dashboard.html', icon:'✎', desc:'Je eigen Notion-werkruimte',                tint:'#3f8f5c' },
    { id:'stack',   name:'Integraties',  file:'integrations.html', icon:'⚙', desc:'Supabase, PostHog en Vercel',               tint:'#6f6d66' }
];

/* ---------------------------------------------------------
   9. Shell
   --------------------------------------------------------- */
function shell(opt){
    var app = APPS.filter(function(a){ return a.id === opt.app; })[0] || APPS[0];
    document.body.dataset.app = app.id;
    document.title = app.name + ' — KM.OS';

    var tabs = (opt.tabs || []).map(function(t){
        return '<button class="os-tab' + (t.on ? ' on' : '') + '" data-tab="' + t.id + '">' + esc(t.name) + '</button>';
    }).join('');

    var bar = document.createElement('div');
    bar.className = 'os-bar';
    bar.innerHTML =
        '<a class="os-home" href="index.html" title="Naar de launcher">' +
            '<span class="os-mark">K</span>' +
            '<span class="os-title"><span class="ico">' + app.icon + '</span>' + esc(app.name) + '</span>' +
        '</a>' +
        (tabs ? '<span class="os-sep"></span><div class="os-tabs" id="osTabs">' + tabs + '</div>' : '<div style="flex:1"></div>') +
        '<div class="os-actions" id="osActions">' +
            (opt.actionsHTML || '') +
            '<button class="iconbtn" id="osSwitch" title="Wissel van app">' +
                '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>' +
            '</button>' +
            '<button class="iconbtn" id="osTheme" title="Thema"></button>' +
            '<button class="iconbtn" id="osOut" title="Uitloggen">' +
                '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5V4a1.5 1.5 0 0 0-1.5-1.5h-8A1.5 1.5 0 0 0 4 4v16a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 15 20v-1"/><path d="M19.5 12H9m10.5 0-3.3-3.3M19.5 12l-3.3 3.3"/></svg>' +
            '</button>' +
        '</div>';

    var root = $('.os');
    root.insertBefore(bar, root.firstChild);

    $('#osOut').onclick = function(){ localStorage.removeItem('kmdev_session'); location.href = '../login.html'; };
    $('#osTheme').onclick = toggleTheme;
    $('#osSwitch').onclick = appSwitcher;
    if(tabs){
        $('#osTabs').addEventListener('click', function(e){
            var b = e.target.closest('.os-tab'); if(!b) return;
            $$('#osTabs .os-tab').forEach(function(x){ x.classList.toggle('on', x === b); });
            opt.onTab && opt.onTab(b.dataset.tab);
            track('tab', { app:app.id, tab:b.dataset.tab });
        });
    }
    syncThemeIcon();
    return bar;
}

function appSwitcher(){
    modal({
        title:'Apps',
        wide:true,
        body:'<div class="grid g3">' + APPS.filter(function(a){ return a.id !== 'home'; }).map(function(a){
            return '<a class="card hover rise" href="' + a.file + '" style="text-decoration:none;color:inherit;display:block;">' +
                '<div style="font-size:26px;color:' + a.tint + ';margin-bottom:10px;">' + a.icon + '</div>' +
                '<b class="grotesk" style="display:block;font-size:15.5px;">' + esc(a.name) + '</b>' +
                '<span style="font-size:12.5px;color:var(--text-faint);">' + esc(a.desc) + '</span>' +
            '</a>';
        }).join('') + '</div>',
        actions:[{ label:'Sluiten', ghost:true }]
    });
}

function toggleTheme(){
    SET.data.theme = SET.data.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = SET.data.theme;
    SET.saveNow(); syncThemeIcon();
}
function syncThemeIcon(){
    var b = $('#osTheme'); if(!b) return;
    var dark = document.documentElement.dataset.theme === 'dark';
    b.innerHTML = dark
        ? '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13.2A8.5 8.5 0 0 1 10.8 3 8.5 8.5 0 1 0 21 13.2Z"/></svg>';
}

/* ---------------------------------------------------------
   10. UI-helpers
   --------------------------------------------------------- */
var _toastT;
function toast(msg, kind, actionLabel, action){
    var t = $('#osToast');
    if(!t){
        t = document.createElement('div'); t.id = 'osToast'; t.className = 'toast';
        t.innerHTML = '<span></span>'; document.body.appendChild(t);
    }
    t.className = 'toast' + (kind === 'err' ? ' err' : '');
    t.querySelector('span').textContent = msg;
    $$('button', t).forEach(function(b){ b.remove(); });
    if(actionLabel){
        var b = document.createElement('button'); b.textContent = actionLabel;
        b.onclick = function(){ action && action(); t.classList.remove('on'); };
        t.appendChild(b);
    }
    t.classList.add('on');
    clearTimeout(_toastT);
    _toastT = setTimeout(function(){ t.classList.remove('on'); }, actionLabel ? 6000 : 2600);
}

function modal(opt){
    var ov = document.createElement('div');
    ov.className = 'ov';
    var acts = (opt.actions || []).map(function(a, i){
        return '<button class="btn' + (a.ghost ? ' ghost' : (a.accent ? ' accent' : '')) + '" data-a="' + i + '">' + esc(a.label) + '</button>';
    }).join('');
    ov.innerHTML =
        '<div class="modal' + (opt.wide ? ' wide' : '') + '">' +
            '<div class="modal-head"><h3 class="grotesk">' + esc(opt.title || '') + '</h3>' +
                '<button class="iconbtn" data-close><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>' +
            '<div class="modal-body">' + (opt.body || '') + '</div>' +
            (acts ? '<div class="modal-foot">' + acts + '</div>' : '') +
        '</div>';
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add('on'); });

    function close(){ ov.classList.remove('on'); setTimeout(function(){ ov.remove(); }, 220); document.removeEventListener('keydown', onKey); }
    function onKey(e){ if(e.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
    $('[data-close]', ov).onclick = close;
    $$('[data-a]', ov).forEach(function(b){
        b.onclick = function(){
            var a = opt.actions[+b.dataset.a];
            if(a.run){ if(a.run(ov, close) === false) return; }
            close();
        };
    });
    opt.mounted && opt.mounted(ov, close);
    return { el:ov, close:close };
}

function confirmBox(title, text, onYes){
    modal({
        title:title,
        body:'<p style="color:var(--text-soft);line-height:1.65;">' + esc(text) + '</p>',
        actions:[
            { label:'Annuleren', ghost:true },
            { label:'Ja, doorgaan', accent:true, run:onYes }
        ]
    });
}

function ring(pct, size, stroke){
    size = size || 54; stroke = stroke || 5;
    var r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return '<svg class="ring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '">' +
        '<circle class="track" cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" stroke-width="' + stroke + '"/>' +
        '<circle class="val" cx="' + size/2 + '" cy="' + size/2 + '" r="' + r + '" stroke-width="' + stroke + '" ' +
            'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + (c * (1 - pct/100)).toFixed(1) + '"/></svg>';
}

function download(name, content, type){
    var blob = new Blob([content], { type: type || 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1500);
}
function copy(text){
    if(navigator.clipboard) navigator.clipboard.writeText(text).then(function(){ toast('Gekopieerd'); });
    else toast('Kopiëren niet ondersteund', 'err');
}

/* ---------------------------------------------------------
   11. Boot
   --------------------------------------------------------- */
var KM = {
    $:$, $$:$$, uid:uid, esc:esc, clamp:clamp,
    iso:iso, parseISO:parseISO, addDays:addDays, startOfWeek:startOfWeek,
    fmtDate:fmtDate, dayDiff:dayDiff, MONTHS:MONTHS, DOW:DOW, DOW_LONG:DOW_LONG,
    AREAS:AREAS, areaOf:areaOf, HORIZONS:HORIZONS, PRIOS:PRIOS, ENERGY:ENERGY, APPS:APPS,
    OS:OS, SET:SET, q:osq,
    sync:sync, track:track, ai:ai,
    shell:shell, toast:toast, modal:modal, confirm:confirmBox, ring:ring,
    download:download, copy:copy, theme:toggleTheme,
    boot: function(){
        if(!guard()) return false;
        SET.load(); OS.load();
        document.documentElement.dataset.theme = SET.data.theme || 'light';
        initAnalytics();
        return true;
    }
};
global.KM = KM;

})(window);
