/* =========================================================
   KM.live — de levende laag van KM.OS
   Klok, focus-timer, cross-tab sync, activiteitenlog,
   netwerkstatus en een tick-registry voor alles wat meeloopt.
   Laadt na km-os.js, vóór de app zelf.
   ========================================================= */
(function(global){
'use strict';

var $ = function(s, r){ return (r||document).querySelector(s); };
var $$ = function(s, r){ return [].slice.call((r||document).querySelectorAll(s)); };

/* ---------------------------------------------------------
   1. Tick-registry — één interval voor alles
   --------------------------------------------------------- */
var ticks = [], timer = null;
function every(sec, fn){
    var entry = { sec:sec, fn:fn, last:0 };
    ticks.push(entry);
    try{ fn(); }catch(e){}
    if(!timer) timer = setInterval(pump, 1000);
    return function(){ var i = ticks.indexOf(entry); if(i >= 0) ticks.splice(i,1); };
}
function pump(){
    var now = Date.now();
    ticks.forEach(function(t){
        if(now - t.last >= t.sec * 1000){ t.last = now; try{ t.fn(); }catch(e){} }
    });
}
document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible'){ ticks.forEach(function(t){ t.last = 0; }); pump(); }
});

/* ---------------------------------------------------------
   2. Gebeurtenissen
   --------------------------------------------------------- */
var subs = {};
function on(ev, fn){ (subs[ev] = subs[ev] || []).push(fn); return function(){ var a = subs[ev], i = a.indexOf(fn); if(i>=0) a.splice(i,1); }; }
function emit(ev, data){ (subs[ev] || []).forEach(function(f){ try{ f(data); }catch(e){} }); }

/* ---------------------------------------------------------
   3. Activiteitenlog
   --------------------------------------------------------- */
var ICONS = {
    task_done:'✓', task_new:'＋', task_del:'✕', goal:'◎', project:'▣', habit:'◆',
    plan:'◷', design:'✦', video:'▶', sync:'☁', note:'✎', review:'❋', system:'⚙'
};
function log(kind, text, meta){
    var D = global.KM && KM.OS.data; if(!D) return;
    D.activity = D.activity || [];
    var last = D.activity[0];
    // identieke gebeurtenis binnen 3 seconden niet dubbel loggen
    if(last && last.kind === kind && last.text === text && Date.now() - last.at < 3000) return;
    D.activity.unshift({ id:Math.random().toString(36).slice(2,8), kind:kind, text:text, at:Date.now(), meta:meta||null });
    if(D.activity.length > 80) D.activity.length = 80;
    KM.OS.save();
    emit('activity', D.activity[0]);
}
function activity(n){
    var D = global.KM && KM.OS.data;
    return ((D && D.activity) || []).slice(0, n || 12);
}
function ago(ts){
    var s = Math.floor((Date.now() - ts) / 1000);
    if(s < 10) return 'nu';
    if(s < 60) return s + 's';
    if(s < 3600) return Math.floor(s/60) + 'm';
    if(s < 86400) return Math.floor(s/3600) + 'u';
    return Math.floor(s/86400) + 'd';
}

/* ---------------------------------------------------------
   4. Cross-tab sync
   --------------------------------------------------------- */
function watchTabs(){
    window.addEventListener('storage', function(e){
        if(e.key === 'kmdev_os_v1' && e.newValue){
            try{
                var fresh = JSON.parse(e.newValue);
                if(!fresh || fresh.updatedAt === KM.OS.data.updatedAt) return;
                KM.OS.data = fresh;
                emit('data', fresh);
                emit('tab-sync', fresh);
            }catch(err){}
        }
        if(e.key === 'kmdev_os_settings' && e.newValue){
            try{
                KM.SET.data = JSON.parse(e.newValue);
                document.documentElement.dataset.theme = KM.SET.data.theme || 'light';
                emit('settings', KM.SET.data);
            }catch(err){}
        }
        if(e.key === TIMER_KEY){ readTimer(); paintTimer(); }
        if(e.key === 'kmdev_session' && !e.newValue) location.href = '../login.html';
    });
}

/* ---------------------------------------------------------
   5. Focus-timer — loopt door over alle apps heen
   --------------------------------------------------------- */
var TIMER_KEY = 'kmdev_focus_timer';
var T = null;   // { startedAt, mins, taskId, pausedAt, spent }

function readTimer(){
    try{ T = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null'); }catch(e){ T = null; }
    return T;
}
function writeTimer(){
    if(T) localStorage.setItem(TIMER_KEY, JSON.stringify(T));
    else localStorage.removeItem(TIMER_KEY);
    emit('timer', T);
}
function timerStart(mins, taskId, title){
    T = { startedAt:Date.now(), mins:mins || 25, taskId:taskId || null, title:title || 'Focusblok', pausedAt:null, spent:0 };
    writeTimer(); paintTimer();
    log('plan', 'Focusblok gestart — ' + T.title, { mins:T.mins });
    KM.track('timer_start', { mins:T.mins });
}
function timerElapsed(){
    if(!T) return 0;
    var base = T.spent || 0;
    if(T.pausedAt) return base;
    return base + (Date.now() - T.startedAt);
}
function timerLeft(){ return Math.max(0, T ? T.mins*60000 - timerElapsed() : 0); }
function timerToggle(){
    if(!T) return;
    if(T.pausedAt){ T.startedAt = Date.now(); T.pausedAt = null; }
    else { T.spent = timerElapsed(); T.pausedAt = Date.now(); }
    writeTimer(); paintTimer();
}
function timerStop(done){
    if(!T) return;
    var mins = Math.round(timerElapsed() / 60000);
    if(done && T.taskId){
        var task = KM.q.task(T.taskId);
        if(task && task.status !== 'done'){ task.status = 'done'; task.doneAt = Date.now(); KM.OS.save(); }
    }
    log('plan', (done ? 'Focusblok afgerond' : 'Focusblok gestopt') + ' — ' + mins + ' min', { mins:mins });
    KM.track('timer_stop', { mins:mins, done:!!done });
    T = null; writeTimer(); paintTimer();
    emit('data', KM.OS.data);
}
function fmtMs(ms){
    var s = Math.ceil(ms / 1000);
    return String(Math.floor(s/60)).padStart(2,'0') + ':' + String(s%60).padStart(2,'0');
}
function paintTimer(){
    var chip = $('#osTimer'), bar = $('#osTimerBar');
    if(!chip) return;
    if(!T){ chip.classList.remove('on'); if(bar) bar.style.width = '0'; return; }
    var left = timerLeft();
    chip.classList.add('on');
    chip.classList.toggle('paused', !!T.pausedAt);
    $('.tv', chip).textContent = fmtMs(left);
    $('.tp', chip).textContent = T.pausedAt ? '▶' : '❚❚';
    if(bar) bar.style.width = (100 - left / (T.mins*60000) * 100) + '%';
    if(left <= 0){
        var done = T;
        timerStop(true);
        KM.toast('Focusblok klaar — ' + done.title, null, 'Nog een ronde', function(){ timerStart(done.mins, done.taskId, done.title); });
        ping();
    }
}
function ping(){
    try{
        var A = window.AudioContext || window.webkitAudioContext; if(!A) return;
        var ctx = new A(), o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 660; g.gain.value = .0001;
        g.gain.exponentialRampToValueAtTime(.18, ctx.currentTime + .02);
        g.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .9);
        o.start(); o.stop(ctx.currentTime + .95);
    }catch(e){}
}

/* ---------------------------------------------------------
   6. Shell-onderdelen injecteren
   --------------------------------------------------------- */
function mount(){
    var acts = $('#osActions');
    if(!acts) return;

    var bar = document.createElement('div');
    bar.className = 'timer-ring'; bar.id = 'osTimerBar'; bar.style.width = '0';
    document.body.appendChild(bar);

    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    wrap.innerHTML =
        '<div class="timer-chip" id="osTimer" title="Focusblok">' +
            '<span class="tv">25:00</span>' +
            '<button class="tp" title="Pauze / hervat">❚❚</button>' +
            '<button class="tx" title="Stoppen">✕</button>' +
        '</div>' +
        '<div class="live-clock" id="osClock">' +
            '<span class="live-net" id="osNet"></span>' +
            '<span class="date" id="osDate"></span>' +
            '<b class="hm">--:--</b><span class="sec">:--</span>' +
        '</div>';
    acts.insertBefore(wrap, acts.firstChild);

    $('.tp', wrap).onclick = timerToggle;
    $('.tx', wrap).onclick = function(){ timerStop(false); };
    $('#osClock').onclick = function(e){
        if(e.target.closest('.timer-chip')) return;
        if(T) return;
        focusModal();
    };
    $('#osClock').style.cursor = 'pointer';
    $('#osClock').title = 'Klik om een focusblok te starten';

    /* klok */
    every(1, function(){
        var d = new Date();
        var c = $('#osClock'); if(!c) return;
        $('.hm', c).textContent = String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        $('.sec', c).textContent = ':' + String(d.getSeconds()).padStart(2,'0');
        var dt = $('#osDate', c);
        if(dt) dt.textContent = KM.DOW[(d.getDay()+6)%7] + ' ' + d.getDate() + ' ' + KM.MONTHS[d.getMonth()].slice(0,3);
        if(T) paintTimer();
    });

    /* netwerk */
    function net(){
        var n = $('#osNet'); if(!n) return;
        n.classList.toggle('off', !navigator.onLine);
        n.title = navigator.onLine ? 'Online' : 'Offline — wijzigingen blijven lokaal';
    }
    window.addEventListener('online', net);
    window.addEventListener('offline', net);
    net();

    on('sync-state', function(s){
        var n = $('#osNet'); if(!n) return;
        n.classList.toggle('busy', s === 'busy');
    });

    readTimer(); paintTimer();
    watchTabs();
}

function focusModal(){
    var open = KM.q.open().sort(function(a,b){ return (a.prio||'p3').localeCompare(b.prio||'p3'); }).slice(0, 12);
    KM.modal({
        title:'Focusblok starten',
        body:'<div class="field"><label>Hoe lang?</label>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;" id="fmMins">' +
                    [15,25,45,60,90].map(function(m, i){
                        return '<button class="chip' + (m === 25 ? ' on' : '') + '" data-m="' + m + '">' + m + ' min</button>';
                    }).join('') +
                '</div></div>' +
             '<div class="field"><label>Waaraan werk je?</label>' +
                '<select class="inp" id="fmTask"><option value="">— vrij focusblok —</option>' +
                open.map(function(t){ return '<option value="' + t.id + '">' + KM.esc(t.title) + '</option>'; }).join('') +
                '</select></div>' +
             '<p style="font-size:13px;color:var(--text-faint);line-height:1.6;">' +
                'De timer loopt door als je naar een andere app gaat, en zelfs als je de tab sluit en terugkomt. ' +
                'Rond je hem af, dan wordt de gekozen taak automatisch afgevinkt.</p>',
        actions:[
            { label:'Annuleren', ghost:true },
            { label:'Start', accent:true, run:function(ov){
                var m = +($('.chip.on', $('#fmMins', ov)) || {}).dataset.m || 25;
                var id = $('#fmTask', ov).value;
                var t = id ? KM.q.task(id) : null;
                timerStart(m, id || null, t ? t.title : 'Vrij focusblok');
            }}
        ],
        mounted:function(ov){
            $$('[data-m]', ov).forEach(function(b){
                b.onclick = function(){ $$('[data-m]', ov).forEach(function(x){ x.classList.toggle('on', x === b); }); };
            });
        }
    });
}

/* ---------------------------------------------------------
   7. Live feed-component
   --------------------------------------------------------- */
function feed(host, n){
    if(!host) return;
    var items = activity(n || 10);
    if(!items.length){
        host.innerHTML = '<div class="empty">Nog geen activiteit — leg iets vast en het verschijnt hier</div>';
        return;
    }
    host.innerHTML = items.map(function(a, i){
        return '<div class="feed-item' + (i === 0 && Date.now() - a.at < 8000 ? ' fresh' : '') + '" data-at="' + a.at + '">' +
            '<span class="fi">' + (ICONS[a.kind] || '•') + '</span>' +
            '<span class="ft">' + KM.esc(a.text) + '</span>' +
            '<span class="fa">' + ago(a.at) + '</span>' +
        '</div>';
    }).join('');
}
function refreshAgo(root){
    $$('[data-at]', root || document).forEach(function(el){
        var s = el.querySelector('.fa'); if(s) s.textContent = ago(+el.dataset.at);
    });
}

/* ---------------------------------------------------------
   8. Auto-sync-status meesturen
   --------------------------------------------------------- */
function hookSync(){
    if(!global.KM || !KM.sync) return;
    var push = KM.sync.push;
    KM.sync.push = function(silent){
        emit('sync-state', 'busy');
        return push.call(KM.sync, silent).then(function(ok){
            emit('sync-state', ok ? 'ok' : 'err');
            if(ok && !silent) log('sync', 'Gesynchroniseerd met Supabase');
            return ok;
        });
    };
}

global.KMlive = {
    every:every, on:on, emit:emit,
    log:log, activity:activity, ago:ago, feed:feed, refreshAgo:refreshAgo, ICONS:ICONS,
    timer:{ start:timerStart, stop:timerStop, toggle:timerToggle, state:function(){ return T; },
            left:timerLeft, elapsed:timerElapsed, read:readTimer, paint:paintTimer, modal:focusModal },
    mount:mount, hookSync:hookSync
};

/* automatisch aanhaken zodra de shell er staat */
document.addEventListener('DOMContentLoaded', function(){ setTimeout(boot, 0); });
if(document.readyState !== 'loading') setTimeout(boot, 0);
var booted = false;
function boot(){
    if(booted || !global.KM || !KM.OS.data) return;
    booted = true;
    hookSync();
    if($('#osActions')) mount();
    else {
        var tries = 0;
        var iv = setInterval(function(){
            if($('#osActions') || ++tries > 40){ clearInterval(iv); if($('#osActions')) mount(); }
        }, 50);
    }
}

})(window);
