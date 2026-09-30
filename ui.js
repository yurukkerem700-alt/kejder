// Börü: Son Kral — mobil tuş düzeni: her tuşu sürükleyip yerleştir, boyutunu ve saydamlığını ayarla.
(function () {
    'use strict';
    const KEY = 'boruLayoutV1';
    const ITEMS = [
        ['fireBtn', '🔥 Ateş'], ['roarBtn', '📢 Kükre'], ['ghostBtn', '👻 Hayalet'], ['plasmaBtnM', '⚛️ Plazma'],
        ['sanctuaryBtn', '🏰 Sığınak'], ['potionBar', '🧪 İksirler'], ['minimapCanvas', '🗺️ Mini harita']
    ];
    const DEF = () => ({ g: { s: 1, o: 1, j: 1 }, it: {} });
    let L = DEF(), sel = null, editing = false;
    try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.g && o.it) L = o; } catch (e) {}
    const $ = (id) => document.getElementById(id);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(L)); } catch (e) {} };
    const st = (id) => L.it[id] || (L.it[id] = { x: 0, y: 0, s: 1 });

    const css = document.createElement('style');
    css.textContent = `
    body.m #joystickZone { width: calc(120px * var(--ljoy, 1)) !important; height: calc(120px * var(--ljoy, 1)) !important; }
    body.m #joystickKnob { width: calc(52px * var(--ljoy, 1)) !important; height: calc(52px * var(--ljoy, 1)) !important; }
    #layoutSec, #layoutRow { display: none; } body.m #layoutSec { display: block; } body.m #layoutRow { display: block; }
    body.layout-edit #pxModal, body.layout-edit #startScreen, body.layout-edit #pauseMenu, body.layout-edit #settingsModal, body.layout-edit #mpRoot { visibility: hidden !important; pointer-events: none !important; }
    body.m.layout-edit:not(.in-game) #mobileControls, body.m.layout-edit #mobileControls { display: block !important; z-index: 900 !important; }
    body.layout-edit #joyArea { pointer-events: none !important; }
    body.layout-edit #sanctuaryBtn { display: block !important; }
    body.layout-edit #potionBar { min-width: 46px; min-height: 46px; background: rgba(255,255,255,0.08); border: 1.5px dashed #aaa; border-radius: 10px; }
    body.layout-edit #potionBar:empty::before, body.layout-edit #potionBar::before { content: '🧪'; font-size: 22px; align-self: center; padding: 0 8px; }
    body.layout-edit #potionBar .potion-slot.empty { display: none; }
    body.layout-edit #minimapCanvas { display: block !important; }
    body.layout-edit .lay-item { outline: 2px dashed #00ffcc; outline-offset: 3px; touch-action: none !important; pointer-events: auto !important; z-index: 910 !important; cursor: move; }
    body.layout-edit .lay-item.lay-sel { outline: 3px solid #ffd24a; }
    #layPanel { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 960; width: min(300px, 70vw); background: rgba(8,10,16,0.94); border: 2px solid #00ffcc; border-radius: 14px; padding: 12px; color: #fff; text-align: center; display: none; font-size: 13px; }
    body.layout-edit #layPanel { display: block; }
    #layPanel b { color: #00ffcc; } #layPanel .lp-h { font-weight: 900; letter-spacing: 2px; font-size: 14px; color: #ffd24a; margin-bottom: 4px; }
    #layPanel input[type=range] { width: 100%; touch-action: none; accent-color: #00ffcc; }
    #layPanel .lp-b { display: flex; gap: 6px; margin-top: 8px; } #layPanel button { flex: 1; padding: 10px 4px; border-radius: 10px; border: 1.5px solid #00ffcc; background: rgba(0,255,204,0.1); color: #00ffcc; font-weight: bold; font-size: 12px; cursor: pointer; }
    #layPanel button.ok { background: #00ffcc; color: #001a14; }`;
    document.head.appendChild(css);

    function apply() {
        const b = document.body; if (!b.classList.contains('m')) return;
        b.style.setProperty('--ljoy', L.g.j);
        for (const [id] of ITEMS) {
            const el = $(id); if (!el) continue; const s = L.it[id];
            el.style.translate = s ? `${s.x}px ${s.y}px` : '';
            const sc = (s ? s.s : 1) * L.g.s; el.style.scale = sc === 1 ? '' : String(sc);
            el.style.opacity = (id === 'minimapCanvas' || L.g.o === 1) ? '' : String(L.g.o);
        }
    }
    function fit(el, s) { // tuş ekran dışına çıkmasın
        const r = el.getBoundingClientRect(), W = innerWidth, H = innerHeight;
        if (r.left < 0) s.x += -r.left; if (r.top < 0) s.y += -r.top;
        if (r.right > W) s.x -= r.right - W; if (r.bottom > H) s.y -= r.bottom - H;
        el.style.translate = `${s.x}px ${s.y}px`;
    }
    function panel() {
        let p = $('layPanel');
        if (!p) { p = document.createElement('div'); p.id = 'layPanel'; document.body.appendChild(p); }
        const name = sel ? ITEMS.find(i => i[0] === sel)[1] : null;
        p.innerHTML = `<div class="lp-h">🎛️ TUŞ DÜZENİ</div>
        <div>${name ? '<b>' + name + '</b> seçili — sürükleyerek taşı' : 'Bir tuşa dokun, sürükleyip istediğin yere bırak'}</div>
        ${name ? `<div style="margin-top:8px">Boyut <b id="lpV">${st(sel).s.toFixed(2)}x</b></div><input type="range" id="lpS" min="0.5" max="2" step="0.05" value="${st(sel).s}">` : ''}
        <div class="lp-b"><button id="lpR">↺ Bunu sıfırla</button><button id="lpA">↺ Hepsini</button><button class="ok" id="lpD">✔ BİTTİ</button></div>`;
        const sl = $('lpS'); if (sl) sl.oninput = () => { st(sel).s = +sl.value; $('lpV').textContent = (+sl.value).toFixed(2) + 'x'; apply(); save(); };
        $('lpR').onclick = () => { if (sel) { delete L.it[sel]; apply(); panel(); save(); } };
        $('lpA').onclick = () => { L.it = {}; apply(); panel(); save(); };
        $('lpD').onclick = () => finish();
    }
    function start() {
        if (!document.body.classList.contains('m')) return;
        editing = true; sel = null; document.body.classList.add('layout-edit');
        ITEMS.forEach(([id]) => { const el = $(id); if (el) el.classList.add('lay-item'); });
        panel();
    }
    function finish() {
        editing = false; document.body.classList.remove('layout-edit');
        ITEMS.forEach(([id]) => { const el = $(id); if (el) el.classList.remove('lay-item', 'lay-sel'); });
        const p = $('layPanel'); if (p) p.remove();
        save(); apply();
        if (window.openSettingsModal) window.openSettingsModal();
    }
    // Düzenleme sırasında tuşlar oyunu tetiklemesin
    ['touchstart', 'touchend', 'touchcancel', 'mousedown', 'mouseup', 'click'].forEach(ev => document.addEventListener(ev, (e) => {
        if (!editing) return; const t = e.target.closest && e.target.closest('.lay-item'); if (t) { e.stopPropagation(); if (e.cancelable && ev !== 'click') e.preventDefault(); if (ev === 'click') e.preventDefault(); }
    }, true));
    let drag = null;
    document.addEventListener('pointerdown', (e) => {
        if (!editing) return; const el = e.target.closest && e.target.closest('.lay-item'); if (!el) return;
        e.preventDefault(); e.stopPropagation();
        if (sel !== el.id) { sel = el.id; ITEMS.forEach(([id]) => { const x = $(id); if (x) x.classList.toggle('lay-sel', id === sel); }); panel(); }
        const s = st(sel); drag = { id: e.pointerId, px: e.clientX, py: e.clientY, x: s.x, y: s.y, el };
        try { el.setPointerCapture(e.pointerId); } catch (_) {}
    }, true);
    document.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return; const s = st(sel);
        s.x = Math.round(drag.x + e.clientX - drag.px); s.y = Math.round(drag.y + e.clientY - drag.py);
        drag.el.style.translate = `${s.x}px ${s.y}px`;
    }, true);
    const up = (e) => { if (!drag || e.pointerId !== drag.id) return; fit(drag.el, st(sel)); drag = null; save(); };
    document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);

    function inject() {
        const secs = document.querySelectorAll('.settings-section'); let anchor = null;
        secs.forEach(s => { if (s.textContent.includes('HEDİYE KODU')) anchor = s; }); if (!anchor || $('layoutSec')) return;
        const h = document.createElement('div');
        h.innerHTML = `<div class="settings-section" id="layoutSec">📱 MOBİL TUŞ DÜZENİ</div>
        <div class="settings-row" id="layoutRow">
            <label>Tuş Boyutu <span class="val" id="lyS"></span></label><input type="range" class="settings-slider" id="lySl" min="0.6" max="1.6" step="0.05">
            <label style="margin-top:12px">Joystick Boyutu <span class="val" id="lyJ"></span></label><input type="range" class="settings-slider" id="lyJs" min="0.6" max="1.8" step="0.05">
            <label style="margin-top:12px">Tuş Saydamlığı <span class="val" id="lyO"></span></label><input type="range" class="settings-slider" id="lyOs" min="0.3" max="1" step="0.05">
            <div class="opt-group" style="margin-top:12px"><button class="opt-btn" id="lyEdit">✋ TUŞLARI YERLEŞTİR</button><button class="opt-btn" id="lyReset">↺ VARSAYILAN</button></div>
            <div class="settings-hint">Ateş, kükreme, hayalet, plazma, sığınak, iksir ve mini harita tuşlarını sürükleyip istediğin yere koy; her birinin boyutunu ayrı ayarla. Joystick parmağını koyduğun yerde açılır.</div>
        </div>`;
        while (h.firstChild) anchor.parentNode.insertBefore(h.firstChild, anchor);
        const bind = (id, vId, key, fmt) => { const sl = $(id); sl.value = L.g[key]; $(vId).textContent = fmt(L.g[key]);
            sl.oninput = () => { L.g[key] = +sl.value; $(vId).textContent = fmt(+sl.value); apply(); save(); }; };
        const x = v => v.toFixed(2) + 'x', pc = v => Math.round(v * 100) + '%';
        bind('lySl', 'lyS', 's', x); bind('lyJs', 'lyJ', 'j', x); bind('lyOs', 'lyO', 'o', pc);
        $('lyEdit').onclick = () => { $('settingsModal').style.display = 'none'; start(); };
        $('lyReset').onclick = () => { L = DEF(); ['lySl', 'lyJs', 'lyOs'].forEach((id, i) => { const k = ['s', 'j', 'o'][i]; $(id).value = 1; $(['lyS', 'lyJ', 'lyO'][i]).textContent = i === 2 ? '100%' : '1.00x'; }); apply(); save(); };
    }
    function init() { inject(); apply(); window.addEventListener('resize', () => { if (!editing) apply(); }); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
    window.BoruLayout = { apply, start };
})();
