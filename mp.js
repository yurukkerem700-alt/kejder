// =====================================================================
// BÖRÜ: SON KRAL — ÇOK OYUNCULU
// Lobi ve oyuncu listesi: Supabase Realtime (ücretsiz katman)
// Oyun verisi + sesli sohbet: WebRTC, oyuncular arasında doğrudan (sunucu masrafı yok)
// Profil, ID ve skorlar: Supabase veritabanı
// Test: ?mptest=1 ile aynı tarayıcıdaki sekmeler arasında Supabase olmadan çalışır.
// =====================================================================
(function () {
    'use strict';
    const SB_URL = 'https://rgikdorrzksidkvdsyfn.supabase.co';
    const SB_KEY = 'sb_publishable_ChOS06DqAyESAxdAvVThmw_Br5pSuQS';
    const TEST = new URLSearchParams(location.search).has('mptest');
    const MAX_PLAYERS = 6;
    // STUN: çoğu ev interneti için yeterli. TURN: mobil veri / sıkı NAT arkasındaki oyuncular doğrudan bağlanamazsa
    // yedek olarak kullanılır (yoksa oyun yavaş sunucu aktarımına düşer, takılır ve SES HİÇ GİTMEZ).
    // Eski sabit "openrelayproject" şifresi artık kabul edilmiyor. Open Relay'in paylaşılan-sır (static auth) sunucusu
    // için süreli kullanıcı adı/şifre tarayıcıda HMAC-SHA1 ile üretilir (kayıt ve API anahtarı gerekmez).
    const ICE = [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }
    ];
    const TURN_HOST = 'staticauth.openrelay.metered.ca', TURN_SECRET = 'openrelayprojectsecret';
    let turnReady = null;
    function prepTurn() {
        if (turnReady) return turnReady;
        turnReady = (async () => {
            try {
                const user = (Math.floor(Date.now() / 1000) + 24 * 3600) + ':boru' + me.id.slice(0, 6);
                const enc = new TextEncoder();
                const key = await crypto.subtle.importKey('raw', enc.encode(TURN_SECRET), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
                const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(user)));
                let bin = ''; for (let i = 0; i < sig.length; i++) bin += String.fromCharCode(sig[i]);
                ICE.push({ urls: ['turn:' + TURN_HOST + ':80', 'turn:' + TURN_HOST + ':80?transport=tcp', 'turn:' + TURN_HOST + ':443', 'turns:' + TURN_HOST + ':443?transport=tcp'], username: user, credential: btoa(bin) });
            } catch (e) { console.warn('TURN hazırlanamadı', e); }
        })();
        return turnReady;
    }
    const MODES = {
        coop: { name: 'Birlikte', icon: '🤝', tag: 'Ekip · PvE', desc: 'Müttefiksiniz, birbirinize hasar veremezsiniz. Fethedilen kovanlar ORTAK sayılır, kara deliğe hep birlikte girip aynı bossla savaşırsınız. Köle ve asker yok. Düşen 2 dk sonra sığınakta dirilir.',
            tags: ['<span class="mp-tag p">🕳️ Kara delik: toplam 50 kovan</span>', '<span class="mp-tag g">🐉 Tüm kostümler açık · güç vermez</span>', '<span class="mp-tag">✨ 2 dk sonra diriliş</span>'] },
        ffa: { name: 'Herkes Tek', icon: '⚔️', tag: 'Serbest PvP', desc: 'Herkes herkese karşı. Kendi askerlerin kovanlardan çıkar. Düşen elenir, sona kalan kazanır.',
            tags: ['<span class="mp-tag p">🕳️ Kara delik: toplam 50 kovan</span>', '<span class="mp-tag">💀 Düşen elenir</span>'] },
        team: { name: 'Takım Savaşı', icon: '🛡️', tag: 'Kızıl vs Mavi', desc: 'Kızıl ve Mavi takım (2v2, 3v3...). Takım arkadaşına hasar yok. Son ayakta kalan takım kazanır.',
            tags: ['<span class="mp-tag p">🕳️ Kara delik: takımın toplamı 50 kovan</span>', '<span class="mp-tag">🛡️ Dost ateşi yok</span>'] }
    };
    const TEAMS = [{ name: 'Kızıl', color: '#ff4a3a' }, { name: 'Mavi', color: '#3aa8ff' }];
    const $ = (s, r) => (r || document).querySelector(s);
    const esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
    const fmtTime = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

    // ------------------------------------------------------------------ PROFİL
    const LS = TEST ? sessionStorage : localStorage;
    const me = {
        id: LS.getItem('boruMpId') || uid(),
        secret: LS.getItem('boruMpSecret') || (uid() + uid()).replace(/-/g, ''),
        code: LS.getItem('boruMpCode') || '',
        name: LS.getItem('boruMpName') || '',
        skin: LS.getItem('boruMpSkin') || ''
    };
    LS.setItem('boruMpId', me.id); LS.setItem('boruMpSecret', me.secret);

    let sb = null, sbLoading = null;
    function loadSb() {
        if (TEST) return Promise.resolve(null);
        if (sb) return Promise.resolve(sb);
        if (sbLoading) return sbLoading;
        const urls = ['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js', 'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js'];
        sbLoading = new Promise((res, rej) => {
            let i = 0;
            const next = () => {
                if (i >= urls.length) { sbLoading = null; return rej(new Error('İnternet bağlantını kontrol et (sunucu kütüphanesi yüklenemedi).')); }
                const s = document.createElement('script'); s.src = urls[i++];
                s.onload = () => { try { sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); res(sb); } catch (e) { next(); } };
                s.onerror = next; document.head.appendChild(s);
            };
            next();
        });
        return sbLoading;
    }
    async function saveProfile() {
        LS.setItem('boruMpName', me.name); LS.setItem('boruMpSkin', me.skin);
        if (TEST) { if (!me.code) me.code = 'TEST-' + me.id.slice(0, 4).toUpperCase(); return; }
        try {
            await loadSb();
            const { data, error } = await sb.rpc('boru_upsert_profile', { p_id: me.id, p_secret: me.secret, p_name: me.name, p_dragon: me.skin });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (row) { me.code = row.code; LS.setItem('boruMpCode', me.code); S.profiles[me.id] = row; if (+row.play_seconds > PF.play) PF.play = +row.play_seconds; if (row.avatar && !LS.getItem('boruProfX')) { PF.avatar = row.avatar; PF.frame = FRAMES[row.frame] ? row.frame : PF.frame; PF.bio = row.bio || ''; } renderMenuProfile(); }
            syncExtras(true);
        } catch (e) { console.warn('Profil kaydedilemedi', e); }
    }
    const PROFILE_COLS = 'id,code,name,dragon,matches,wins,kills,boss_kills,hives,damage,play_seconds,avatar,frame,max_level,bio';
    async function fetchProfiles(ids) {
        if (TEST || !ids.length) return;
        try { await loadSb(); const { data } = await sb.from('boru_profiles').select(PROFILE_COLS).in('id', ids); (data || []).forEach(r => { S.profiles[r.id] = r; }); render(); } catch (e) {}
    }
    async function findProfileByCode(code) {
        if (TEST) return null;
        await loadSb(); const { data } = await sb.from('boru_profiles').select(PROFILE_COLS).eq('code', code).limit(1);
        return data && data[0];
    }
    async function fetchLastMatch(room) {
        if (TEST) return;
        try { await loadSb(); const { data } = await sb.from('boru_matches').select('mode,duration_s,winner,results,created_at').eq('room', room).order('created_at', { ascending: false }).limit(1); S.lastMatch = data && data[0]; render(); } catch (e) {}
    }

    // ------------------------------------------------------------------ PROFİL EKSTRALARI + OYNAMA SÜRESİ
    // Süre yalnızca oyun gerçekten oynanırken (ekran açık, oyun duraklatılmamış) sayılır; tek oyunculu + çok oyunculu birlikte.
    const AVATARS = ['🐉', '🐲', '🔥', '❄️', '🐍', '⚡', '🌑', '💀', '👑', '🦇', '🌋', '🌪️', '☄️', '🗡️', '🛡️', '🐺', '🦅', '🌙', '🧿', '👁️', '🦂', '🕷️', '🌊', '🪐'];
    const FRAMES = {
        ates: { name: 'Kor', a: '#ff7a00', b: '#ff2200', h: 0 },
        buz: { name: 'Buzul', a: '#9ff3ff', b: '#0077ff', h: 1 },
        zehir: { name: 'Zehir', a: '#b6ff3a', b: '#118800', h: 3 },
        kan: { name: 'Kan Ayı', a: '#ff4466', b: '#5a0010', h: 6 },
        altin: { name: 'Altın Taht', a: '#fff1a0', b: '#c98a00', h: 12 },
        hiclik: { name: 'Hiçlik', a: '#d08bff', b: '#2a0066', h: 25 },
        gokkusak: { name: 'Ejder Işığı', a: '#ff3c3c', b: '#3cf0ff', h: 50, rb: 1 }
    };
    const RANKS = [
        { h: 0, name: 'Yumurta', ic: '🥚' }, { h: 1, name: 'Yavru Ejder', ic: '🐣' }, { h: 3, name: 'Genç Ejder', ic: '🦎' },
        { h: 8, name: 'Savaşçı Ejder', ic: '🐉' }, { h: 20, name: 'Kadim Ejder', ic: '🐲' }, { h: 50, name: 'Ejder Lordu', ic: '🔥' }, { h: 100, name: 'SON KRAL', ic: '👑' }
    ];
    const PF = (() => { let o = {}; try { o = JSON.parse(LS.getItem('boruProfX') || '{}') || {}; } catch (e) {} return { avatar: o.avatar || '🐉', frame: FRAMES[o.frame] ? o.frame : 'ates', bio: o.bio || '', play: Math.max(0, +o.play || 0), sess: 0, days: o.days || {} }; })();
    function savePF() { try { LS.setItem('boruProfX', JSON.stringify({ avatar: PF.avatar, frame: PF.frame, bio: PF.bio, play: Math.floor(PF.play), days: PF.days })); } catch (e) {} }
    const hoursOf = (s) => s / 3600;
    function rankOf(s) { const h = hoursOf(s); let r = RANKS[0], nx = null; for (let i = 0; i < RANKS.length; i++) { if (h >= RANKS[i].h) { r = RANKS[i]; nx = RANKS[i + 1] || null; } } return { r, nx, p: nx ? Math.min(1, (h - r.h) / (nx.h - r.h)) : 1 }; }
    function frameOk(id, s) { const f = FRAMES[id]; return !!f && hoursOf(s) >= f.h; }
    function fmtPlay(s) { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); if (!h) return m ? m + ' dk' : (s % 60) + ' sn'; return h + ' sa ' + m + ' dk'; }
    function fmtPlayBig(s) { s = Math.max(0, Math.floor(s || 0)); return { h: Math.floor(s / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 }; }
    const todayKey = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
    function myPlay() { const p = S.profiles[me.id]; return Math.max(PF.play, (p && +p.play_seconds) || 0); }
    function isPlaying() {
        if (document.visibilityState !== 'visible') return false;
        if (S.match && !S.match.over && S.screen === 'hud') return true;
        try { const st = window.BORU && BORU.playState && BORU.playState(); return !!(st && st.active && !st.paused); } catch (e) { return false; }
    }
    let lastTick = performance.now(), saveCnt = 0;
    setInterval(() => {
        const now = performance.now(), dt = Math.min(5, (now - lastTick) / 1000); lastTick = now;
        if (!isPlaying()) return;
        const before = rankOf(PF.play).r;
        PF.play += dt; PF.sess += dt;
        const k = todayKey(); PF.days[k] = (PF.days[k] || 0) + dt;
        const ks = Object.keys(PF.days); if (ks.length > 14) delete PF.days[ks[0]];
        if (rankOf(PF.play).r !== before) { const r = rankOf(PF.play).r; toast(r.ic + ' Yeni rütbe: ' + r.name + '!', '#ffd24a'); }
        if (++saveCnt % 10 === 0) savePF();
        if (saveCnt % 120 === 0) syncExtras();
        if (saveCnt % 30 === 0) renderMenuProfile();
    }, 1000);
    document.addEventListener('visibilitychange', () => { lastTick = performance.now(); if (document.visibilityState === 'hidden') { savePF(); syncExtras(true); } });
    window.addEventListener('pagehide', savePF);
    let syncT = 0, syncing = false;
    async function syncExtras(force) {
        savePF();
        if (TEST || !me.code || syncing) return;
        if (!force && Date.now() - syncT < 60000) return;
        syncT = Date.now(); syncing = true;
        let lvl = 1; try { lvl = BORU.profileStats().maxLevel || 1; } catch (e) {}
        try {
            await loadSb();
            await sb.rpc('boru_sync_profile', { p_id: me.id, p_secret: me.secret, p_play_seconds: Math.floor(PF.play), p_avatar: PF.avatar, p_frame: PF.frame, p_level: lvl, p_bio: PF.bio });
            const p = S.profiles[me.id]; if (p) { p.play_seconds = Math.max(+p.play_seconds || 0, Math.floor(PF.play)); p.avatar = PF.avatar; p.frame = PF.frame; p.bio = PF.bio; p.max_level = Math.max(p.max_level || 1, lvl); }
        } catch (e) { console.warn('Profil eşitlenemedi', e); }
        syncing = false;
    }
    // Profil satırı yoksa (test modu / henüz kayıt yok) yerel değerlerle göster
    function localProfile() {
        const p = S.profiles[me.id] || {}; let st = {}; try { st = BORU.profileStats(); } catch (e) {}
        return Object.assign({ matches: 0, wins: 0, kills: 0, boss_kills: 0, hives: 0, damage: 0 }, p, {
            id: me.id, name: me.name || p.name || 'İsimsiz Ejder', code: me.code || p.code || '', avatar: PF.avatar, frame: PF.frame, bio: PF.bio,
            play_seconds: myPlay(), max_level: Math.max(p.max_level || 1, st.maxLevel || 1)
        });
    }
    function avatarHtml(av, fr, size, extra) {
        const f = FRAMES[fr] || FRAMES.ates;
        return `<span class="mp-av ${f.rb ? 'rb' : ''} ${extra || ''}" style="--fa:${f.a};--fb:${f.b};--sz:${size || 44}px"><i>${esc(av || '🐉')}</i></span>`;
    }
    function renderMenuProfile() {
        const el = document.getElementById('menuProfile'); if (!el) return;
        const p = localProfile(), rk = rankOf(p.play_seconds);
        el.style.display = 'flex';
        el.innerHTML = `${avatarHtml(p.avatar, p.frame, 46)}<div><div class="nm">${esc(p.name)}</div><div class="sb">${rk.r.ic} ${rk.r.name} · ⏱ ${fmtPlay(p.play_seconds)}</div></div><span class="go">PROFİL ›</span>`;
    }
    window.BORU_PLAY = { total: () => myPlay(), fmt: fmtPlay };

    // ------------------------------------------------------------------ ODA BAĞLANTISI (lobi + sinyal)
    class SbRoom {
        constructor(code, chan) { this.code = code; this.chan = chan; }
        async join(meta, onMsg, onSync, noTrack) {
            await loadSb();
            this.ch = sb.channel(this.chan || ('boru-oda-' + this.code), { config: { presence: { key: me.id }, broadcast: { self: false, ack: false } } });
            this.ch.on('presence', { event: 'sync' }, () => onSync(this.members()));
            this.ch.on('broadcast', { event: 'm' }, (e) => onMsg(e.payload));
            await new Promise((res, rej) => {
                const to = setTimeout(() => rej(new Error('Odaya bağlanılamadı (zaman aşımı).')), 15000);
                this.ch.subscribe((st) => {
                    if (st === 'SUBSCRIBED') { clearTimeout(to); res(); }
                    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error('Odaya bağlanılamadı (' + st + ').')); }
                });
            });
            if (!noTrack) await this.ch.track(meta);
        }
        members() { const st = this.ch.presenceState(), out = []; for (const k in st) { const a = st[k]; if (a && a.length) out.push(a[a.length - 1]); } return out; }
        track(meta) { try { return this.ch.track(meta); } catch (e) {} }
        send(p) { try { this.ch.send({ type: 'broadcast', event: 'm', payload: p }); } catch (e) {} }
        leave() { try { this.ch.untrack(); sb.removeChannel(this.ch); } catch (e) {} }
    }
    class TestRoom {
        constructor(code) { this.code = code; this.peers = new Map(); }
        async join(meta, onMsg, onSync) {
            this.meta = meta; this.onSync = onSync; this.bc = new BroadcastChannel('boru-test-' + this.code);
            this.bc.onmessage = (e) => {
                const m = e.data;
                if (m && m.__p) {
                    if (m.bye) this.peers.delete(m.id); else { this.peers.set(m.id, { meta: m.meta, t: Date.now() }); if (m.ask) this.pub(); }
                    this.onSync(this.members()); return;
                }
                onMsg(m);
            };
            this.pub(true);
            this.iv = setInterval(() => { this.pub(); const now = Date.now(); let ch = false; for (const [k, v] of this.peers) if (now - v.t > 5000) { this.peers.delete(k); ch = true; } if (ch) this.onSync(this.members()); }, 1000);
            onSync(this.members());
        }
        pub(ask) { this.bc.postMessage({ __p: 1, id: me.id, meta: this.meta, ask: !!ask }); }
        members() { return [this.meta, ...[...this.peers.values()].map(v => v.meta)]; }
        track(meta) { this.meta = meta; this.pub(); this.onSync(this.members()); }
        send(p) { try { this.bc.postMessage(p); } catch (e) {} }
        leave() { clearInterval(this.iv); try { this.bc.postMessage({ __p: 1, id: me.id, bye: 1 }); this.bc.close(); } catch (e) {} }
    }

    // ------------------------------------------------------------------ AÇIK LOBİ LİSTESİ
    // Herkese açık lobiler tek bir Supabase Realtime "presence" kanalında duyurulur (veritabanı yok, ücretsiz).
    // Lobiyi yalnızca oda sahibi duyurur; oda kapanınca / sahibi çıkınca liste kendiliğinden temizlenir.
    const DIR = { ch: null, ready: false, list: [], last: null, opening: null };
    function dirFlatten(st) { const out = []; for (const k in st) { const a = st[k]; if (a && a.length) { const v = a[a.length - 1]; if (v && v.code) out.push(v); } } return out; }
    function dirSet(list) {
        DIR.list = list.filter(l => l && l.code && l.code !== S.code).sort((a, b) => (a.phase === 'playing') - (b.phase === 'playing') || (b.n - a.n) || (b.t - a.t));
        if (S.screen === 'home') render();
    }
    function dirOpen() {
        if (DIR.ch || DIR.opening) return DIR.opening;
        if (TEST) {
            const bc = new BroadcastChannel('boru-test-dir'), seen = new Map();
            const pub = () => { if (DIR.mine) bc.postMessage({ id: me.id, info: DIR.mine }); };
            bc.onmessage = (e) => { const m = e.data; if (!m || !m.id) return; if (m.bye || !m.info) seen.delete(m.id); else seen.set(m.id, { info: m.info, t: Date.now() }); dirSet([...seen.values()].map(v => v.info)); };
            setInterval(() => { pub(); const now = Date.now(); let ch = false; for (const [k, v] of seen) if (now - v.t > 4000) { seen.delete(k); ch = true; } if (ch) dirSet([...seen.values()].map(v => v.info)); }, 1000);
            DIR.ch = { track(i) { DIR.mine = i; pub(); }, untrack() { DIR.mine = null; bc.postMessage({ id: me.id, bye: 1 }); } };
            DIR.ready = true; dirUpdate(); return Promise.resolve();
        }
        DIR.opening = (async () => {
            try {
                await loadSb();
                const ch = sb.channel('boru-lobiler', { config: { presence: { key: me.id } } });
                ch.on('presence', { event: 'sync' }, () => dirSet(dirFlatten(ch.presenceState())));
                DIR.ch = ch;
                ch.subscribe((st) => { if (st === 'SUBSCRIBED') { DIR.ready = true; DIR.last = null; dirUpdate(); dirSet(dirFlatten(ch.presenceState())); } });
            } catch (e) { DIR.opening = null; }
        })();
        return DIR.opening;
    }
    function dirUpdate() {
        if (!DIR.ch || !DIR.ready) { if (S.room && S.pub && isHost()) dirOpen(); return; }
        const want = S.room && S.pub && isHost() && S.members.length > 0;
        if (want) {
            const info = { code: S.code, lname: S.lname || ((me.name || 'Ejderha') + "'in lobisi"), mode: S.mode, n: S.members.length, max: MAX_PLAYERS, host: me.name, av: PF.avatar, fr: PF.frame,
                phase: S.match && !S.match.over ? 'playing' : 'lobby', t: S.joinedAt || Date.now() };
            const k = JSON.stringify(info); if (k === DIR.last) return; DIR.last = k;
            try { DIR.ch.track(info); } catch (e) {}
        } else if (DIR.last) { DIR.last = null; try { DIR.ch.untrack(); } catch (e) {} }
    }
    function quickJoin() {
        const l = DIR.list.find(x => x.phase !== 'playing' && x.n < (x.max || MAX_PLAYERS));
        if (l) joinRoom(l.code, false); else { S.create = true; S.err = 'Şu an boş yeri olan açık lobi yok — hemen bir tane kur, başkaları da katılsın!'; render(); }
    }

    // ------------------------------------------------------------------ DURUM
    const S = {
        screen: 'home', room: null, code: '', members: [], hostId: null, mode: 'coop', ready: false, team: 0, joinedAt: 0,
        profiles: {}, lastMatch: null, err: '', busy: false, match: null, lookup: null, seenEid: new Set(), pub: true, lname: '', chat: [], create: false, cMode: 'coop', cPriv: false, viewId: null, back: 'home'
    };
    const peers = new Map();
    const isHost = () => S.hostId === me.id;
    const member = (id) => S.members.find(m => m.id === id);
    const nameOf = (id) => { if (id === me.id) return me.name; const r = S.match && S.match.roster.get(id); if (r) return r.name; const m = member(id); return m ? m.name : 'Ejderha'; };
    function myMeta() {
        return { id: me.id, code: me.code, name: me.name, skin: me.skin, ready: S.ready, team: S.team, joinedAt: S.joinedAt, mode: S.mode,
            phase: S.match && !S.match.over ? 'playing' : 'lobby', mic: voice.on ? 1 : 0, rm: S.rmVote ? 1 : 0,
            pub: S.pub ? 1 : 0, lname: S.lname || '', av: PF.avatar, fr: PF.frame, ps: Math.floor(myPlay()) };
    }
    let trackT = null;
    function pushMeta() { clearTimeout(trackT); trackT = setTimeout(() => { if (S.room) S.room.track(myMeta()); dirUpdate(); }, 60); }

    // ------------------------------------------------------------------ SES
    // İki yol: (1) doğrudan WebRTC ses kanalı (en iyi kalite, en az gecikme). (2) Doğrudan bağlantı kurulamayan
    // oyunculara YEDEK SES: mikrofon 8 kHz'e indirilip μ-law ile sıkıştırılır, oda sunucusu üzerinden gider.
    // Böylece mobil veri / sıkı NAT arkasında bile birbirinizi duyarsınız.
    const voice = { track: null, stream: null, on: false, els: new Map(), muted: new Set(), ac: null, speaking: new Set(), talk: false, talkT: 0,
        an: null, buf: null, proc: null, relSeq: 0, relBuf: [], relLen: 0, play: new Map(), heard: new Map() };
    function getAC() {
        if (!voice.ac) { try { voice.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { voice.ac = null; } }
        return voice.ac;
    }
    async function toggleMic() {
        if (!voice.track) {
            try {
                if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('desteklenmiyor');
                const st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
                voice.stream = st; voice.track = st.getAudioTracks()[0];
                voice.track.onended = () => { voice.track = null; voice.stream = null; voice.on = false; pushMeta(); render(); toast('🎤 Mikrofon kapandı (başka uygulama kullanıyor olabilir).', '#ffaa33'); };
                startLocalAudio();
            } catch (e) {
                const msg = location.protocol !== 'https:' && location.hostname !== 'localhost' ? '🎤 Mikrofon yalnızca https adresinde çalışır.' : '🎤 Mikrofon izni verilmedi. Tarayıcı/uygulama ayarlarından mikrofona izin ver.';
                toast(msg, '#ff5555'); return;
            }
            for (const p of peers.values()) p.setTrack(voice.track);
        }
        voice.on = !voice.on; voice.track.enabled = voice.on; unlockAudio(); pushMeta(); render();
        toast(voice.on ? '🎤 Mikrofon açık — konuşabilirsin' : '🔇 Mikrofon kapalı', voice.on ? '#33ff99' : '#aaaaaa');
    }
    // Kendi mikrofonumuz: konuşma algılama + (gerekirse) sunucu üzerinden yedek ses gönderimi
    function startLocalAudio() {
        const ac = getAC(); if (!ac || !voice.stream) return;
        try {
            const src = ac.createMediaStreamSource(voice.stream);
            const an = ac.createAnalyser(); an.fftSize = 512; src.connect(an); voice.an = an; voice.buf = new Uint8Array(an.fftSize);
            if (ac.createScriptProcessor) {
                const proc = ac.createScriptProcessor(4096, 1, 1), sink = ac.createGain(); sink.gain.value = 0;
                src.connect(proc); proc.connect(sink); sink.connect(ac.destination); voice.proc = proc;
                proc.onaudioprocess = (e) => relayCapture(e.inputBuffer.getChannelData(0), ac.sampleRate);
            }
        } catch (e) { console.warn('Ses işleme kurulamadı', e); }
    }
    // μ-law (telefon kalitesi, 8 bit) kodlama
    const MU_DEC = new Float32Array(256);
    (function () { for (let u = 0; u < 256; u++) { const v = ~u & 0xFF, sign = v & 0x80, ex = (v >> 4) & 7, man = v & 0x0F; let x = ((man << 3) + 0x84) << ex; x -= 0x84; MU_DEC[u] = (sign ? -x : x) / 32768; } })();
    function muEnc(f) {
        let x = Math.max(-1, Math.min(1, f)) * 32767 | 0; const sign = x < 0 ? 0x80 : 0; if (sign) x = -x; if (x > 32635) x = 32635; x += 0x84;
        let ex = 7; for (let m = 0x4000; (x & m) === 0 && ex > 0; ex--, m >>= 1);
        return ~(sign | (ex << 4) | ((x >> (ex + 3)) & 0x0F)) & 0xFF;
    }
    function relayTargets() {
        const out = [];
        for (const m of S.members) {
            if (m.id === me.id) continue;
            const p = peers.get(m.id); const st = p && p.pc ? p.pc.connectionState : 'none';
            if (st !== 'connected') out.push(m.id);
        }
        return out;
    }
    function relayCapture(inp, rate) {
        if (!voice.on || !voice.talk || !S.room) { voice.relLen = 0; voice.relBuf.length = 0; return; }
        const ratio = rate / 8000, n = Math.floor(inp.length / ratio), out = new Uint8Array(n);
        for (let i = 0; i < n; i++) { const a = Math.floor(i * ratio), b = Math.min(inp.length, Math.floor((i + 1) * ratio)); let sum = 0; for (let k = a; k < b; k++) sum += inp[k]; out[i] = muEnc(sum / Math.max(1, b - a) * 1.4); }
        voice.relBuf.push(out); voice.relLen += n;
        if (voice.relLen < 1600) return; // ~200 ms'lik paket
        const tos = relayTargets(); const all = new Uint8Array(voice.relLen); let o = 0; for (const c of voice.relBuf) { all.set(c, o); o += c.length; }
        voice.relBuf.length = 0; voice.relLen = 0;
        if (!tos.length) return;
        let bin = ''; for (let i = 0; i < all.length; i++) bin += String.fromCharCode(all[i]);
        S.room.send({ t: 'vc', from: me.id, tos, d: btoa(bin), q: ++voice.relSeq });
    }
    function playRelay(id, b64) {
        if (voice.muted.has(id)) return;
        const ac = getAC(); if (!ac) return; if (ac.state === 'suspended') { try { ac.resume(); } catch (e) {} }
        let bin; try { bin = atob(b64); } catch (e) { return; }
        let pl = voice.play.get(id);
        if (!pl) { const g = ac.createGain(); g.gain.value = 1.6; g.connect(ac.destination); pl = { g, t: 0, prev: 0 }; voice.play.set(id, pl); }
        const n = bin.length, up = 3, buf = ac.createBuffer(1, n * up, 24000), ch = buf.getChannelData(0);
        let prev = pl.prev; for (let i = 0; i < n; i++) { const v = MU_DEC[bin.charCodeAt(i)]; for (let k = 0; k < up; k++) ch[i * up + k] = prev + (v - prev) * (k + 1) / up; prev = v; }
        pl.prev = prev;
        const src = ac.createBufferSource(); src.buffer = buf; src.connect(pl.g);
        const now = ac.currentTime; if (pl.t < now + 0.04 || pl.t > now + 1.2) pl.t = now + 0.16;
        src.start(pl.t); pl.t += buf.duration;
        voice.heard.set(id, performance.now());
    }
    function attachAudio(id, stream) {
        let el = voice.els.get(id);
        if (!el) { el = document.createElement('audio'); el.autoplay = true; el.setAttribute('playsinline', ''); el.setAttribute('webkit-playsinline', ''); $('#mpAudio').appendChild(el); voice.els.set(id, el); }
        if (el.srcObject !== stream) el.srcObject = stream;
        el.muted = voice.muted.has(id); el.volume = 1; el.play().catch(() => {});
        render();
    }
    function unlockAudio() { for (const el of voice.els.values()) if (el.paused) el.play().catch(() => {}); try { const ac = getAC(); if (ac && ac.state === 'suspended') ac.resume(); } catch (e) {} }
    // Konuşma algılama: kendi sesimizi ölçeriz; karşı tarafın konuştuğunu kendi paketindeki "sp" bayrağı söyler.
    // (Uzak sesi ayrıca analiz etmek iPhone'da sesi kısabiliyordu, o yüzden kaldırıldı.)
    setInterval(() => {
        let ch = false;
        if (voice.an && voice.buf) {
            voice.an.getByteTimeDomainData(voice.buf); let m = 0; for (let i = 0; i < voice.buf.length; i++) m = Math.max(m, Math.abs(voice.buf[i] - 128));
            const now = performance.now();
            if (voice.on && m > 7) voice.talkT = now;
            const talk = voice.on && now - voice.talkT < 450;
            if (talk !== voice.talk) {
                voice.talk = talk; ch = true; if (talk) voice.speaking.add(me.id); else voice.speaking.delete(me.id);
                const msg = '{"t":"vs","on":' + (talk ? 1 : 0) + '}'; for (const p of peers.values()) if (p.okS()) { try { p.dcS.send(msg); } catch (e) {} }
            }
        }
        // Yedek sesle gelen konuşma göstergesi
        const now = performance.now();
        for (const [id, t] of voice.heard) { const on = now - t < 500 && !voice.muted.has(id); if (on !== voice.speaking.has(id)) { ch = true; if (on) voice.speaking.add(id); else voice.speaking.delete(id); } }
        if (ch) { renderChips(); if (S.screen === 'lobby') render(); }
    }, 100);
    function setRemoteSpeaking(id, on) {
        on = !!on && !voice.muted.has(id);
        if (!on && voice.heard.has(id) && performance.now() - voice.heard.get(id) < 500) return;
        if (on !== voice.speaking.has(id)) { if (on) voice.speaking.add(id); else voice.speaking.delete(id); renderChips(); }
    }
    function toggleMute(id) { if (voice.muted.has(id)) voice.muted.delete(id); else voice.muted.add(id); const el = voice.els.get(id); if (el) el.muted = voice.muted.has(id); toast(voice.muted.has(id) ? '🔇 ' + nameOf(id) + ' sessize alındı' : '🔈 ' + nameOf(id) + ' duyuluyor'); renderChips.last = ''; render(); }

    // ------------------------------------------------------------------ WEBRTC EŞLERİ
    class Peer {
        constructor(id) { this.id = id; this.offerer = me.id < id; this.sid = null; this.queue = []; this.pending = {}; this.born = 0; this.pc = null; this.rtt = 0; this.badSince = 0; if (this.offerer) this.create(); }
        create(sid) {
            this.close();
            this.sid = sid || uid().slice(0, 8); this.queue = (this.pending[this.sid] || []).slice(); this.pending = {}; this.born = performance.now();
            const pc = this.pc = new RTCPeerConnection({ iceServers: ICE });
            this.dcS = pc.createDataChannel('s', { negotiated: true, id: 0, ordered: false, maxRetransmits: 0 });
            this.dcR = pc.createDataChannel('r', { negotiated: true, id: 1, ordered: true });
            const onData = (e) => { let m; try { m = JSON.parse(e.data); } catch (er) { return; } m.from = this.id; handle(m); };
            this.dcS.onmessage = onData; this.dcR.onmessage = onData;
            this.dcR.onopen = () => { render(); }; this.dcR.onclose = () => render();
            pc.onicecandidate = (e) => { if (e.candidate) signal(this.id, { sid: this.sid, c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
            pc.ontrack = (e) => attachAudio(this.id, e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]));
            pc.onconnectionstatechange = () => { const st = pc.connectionState; if (st === 'connected') this.badSince = 0; else if (!this.badSince) this.badSince = performance.now(); render(); };
            if (this.offerer) {
                this.tx = pc.addTransceiver('audio', { direction: 'sendrecv' });
                if (voice.track) this.tx.sender.replaceTrack(voice.track).catch(() => {});
                (async () => {
                    try { const o = await pc.createOffer(); await pc.setLocalDescription(o); signal(this.id, { sid: this.sid, sdp: { type: 'offer', sdp: pc.localDescription.sdp } }); }
                    catch (e) { console.warn('Teklif oluşturulamadı', e); }
                })();
            }
        }
        setTrack(t) { if (this.tx) this.tx.sender.replaceTrack(t).catch(() => {}); }
        async onSignal(d) {
            try {
                if (d.sdp && d.sdp.type === 'offer') {
                    if (this.offerer) return;
                    if (d.sid !== this.sid || !this.pc) this.create(d.sid);
                    const pc = this.pc;
                    await pc.setRemoteDescription(d.sdp);
                    this.tx = pc.getTransceivers().find(t => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio');
                    if (this.tx) { this.tx.direction = 'sendrecv'; if (voice.track) await this.tx.sender.replaceTrack(voice.track); }
                    const a = await pc.createAnswer(); await pc.setLocalDescription(a);
                    signal(this.id, { sid: this.sid, sdp: { type: 'answer', sdp: pc.localDescription.sdp } });
                    this.flush();
                } else if (d.sdp && d.sdp.type === 'answer') {
                    if (!this.offerer || d.sid !== this.sid || !this.pc || this.pc.signalingState !== 'have-local-offer') return;
                    await this.pc.setRemoteDescription(d.sdp); this.flush();
                } else if (d.c) {
                    if (d.sid !== this.sid || !this.pc) { (this.pending[d.sid] = this.pending[d.sid] || []).push(d.c); return; }
                    if (this.pc.remoteDescription) this.pc.addIceCandidate(d.c).catch(() => {}); else this.queue.push(d.c);
                }
            } catch (e) { console.warn('Sinyal hatası', e); }
        }
        flush() { const q = this.queue; this.queue = []; for (const c of q) this.pc.addIceCandidate(c).catch(() => {}); }
        ok() { return this.dcR && this.dcR.readyState === 'open'; }
        okS() { return this.dcS && this.dcS.readyState === 'open'; }
        close() { try { if (this.pc) this.pc.close(); } catch (e) {} this.pc = null; this.tx = null; }
    }
    function signal(to, data) { if (S.room) S.room.send({ t: 'sig', from: me.id, to, d: data }); }
    function syncPeers() {
        const ids = new Set(S.members.map(m => m.id).filter(id => id !== me.id));
        for (const id of ids) if (!peers.has(id)) peers.set(id, new Peer(id));
        for (const [id, p] of peers) if (!ids.has(id)) { p.close(); peers.delete(id); const el = voice.els.get(id); if (el) { el.remove(); voice.els.delete(id); } voice.play.delete(id); voice.heard.delete(id); voice.speaking.delete(id); }
    }
    // Bağlanamayan eşleri yeniden dene
    setInterval(() => {
        for (const p of peers.values()) {
            if (!p.offerer) continue;
            const st = p.pc ? p.pc.connectionState : 'none';
            const now = performance.now();
            // 'disconnected' çoğu zaman birkaç saniyede kendiliğinden düzelir: bağlantıyı hemen yıkma, 7 sn bekle
            if (st === 'failed' || st === 'closed' || st === 'none' || (st === 'disconnected' && p.badSince && now - p.badSince > 7000) || ((st === 'new' || st === 'connecting') && now - p.born > 12000)) p.create();
        }
    }, 4000);

    // Gecikme (ping) ölçümü: HUD'da her oyuncunun bağlantı kalitesi görünsün
    setInterval(() => { const ts = Math.round(performance.now()); for (const p of peers.values()) if (p.okS()) { try { p.dcS.send('{"t":"pg","ts":' + ts + '}'); } catch (e) {} } }, 2000);

    // ------------------------------------------------------------------ MESAJLAŞMA
    function sendTo(id, msg) {
        const p = peers.get(id);
        if (p && p.ok()) { try { p.dcR.send(JSON.stringify(msg)); return; } catch (e) {} }
        if (S.room) S.room.send(Object.assign({ from: me.id, to: id }, msg));
    }
    function sendAll(msg) {
        msg.eid = msg.eid || uid().slice(0, 12);
        let fallback = false; const str = JSON.stringify(msg);
        for (const m of S.members) {
            if (m.id === me.id) continue; const p = peers.get(m.id);
            if (p && p.ok()) { try { p.dcR.send(str); continue; } catch (e) {} }
            fallback = true;
        }
        if (fallback && S.room) S.room.send(Object.assign({ from: me.id }, msg));
    }
    function hostCast(msg) { msg.eid = msg.eid || uid().slice(0, 12); if (S.room) S.room.send(Object.assign({ from: me.id }, msg)); sendAll(msg); handle(Object.assign({ from: me.id }, msg)); }
    function onRoomMsg(m) {
        if (!m || m.from === me.id) return;
        if (m.to && m.to !== me.id) return;
        if (m.tos && !m.tos.includes(me.id)) return;
        if (m.t === 'sig') { let p = peers.get(m.from); if (!p) { p = new Peer(m.from); peers.set(m.from, p); } p.onSignal(m.d); return; }
        handle(m);
    }
    function handle(m) {
        if (m.eid) { if (S.seenEid.has(m.eid)) return; S.seenEid.add(m.eid); if (S.seenEid.size > 800) S.seenEid = new Set([...S.seenEid].slice(-400)); }
        const M = S.match;
        switch (m.t) {
            case 'st': if (M && M.roster.has(m.from)) onState(m.from, m.s); break;
            case 'pg': { const p = peers.get(m.from); if (p && p.okS()) { try { p.dcS.send('{"t":"po","ts":' + m.ts + '}'); } catch (e) {} } break; }
            case 'po': { const p = peers.get(m.from); if (p) { const r = performance.now() - m.ts; p.rtt = p.rtt ? p.rtt * 0.6 + r * 0.4 : r; } break; }
            case 'hit': if (M && !M.over && (!m.to || m.to === me.id) && window.BORU && hostileTo(m.from)) BORU.applyHit(m.d, m.from); break;
            case 'dead': if (M) onRemoteDeath(m.from, m.by); break;
            case 'rev': if (M) { M.dead.delete(m.from); feed('✨ ' + nameOf(m.from) + ' yeniden doğdu', '#66ffcc'); } break;
            case 'note': if (M) feed(m.txt, m.c); break;
            case 'pin': if (M && window.boruPins && isFinite(m.x) && isFinite(m.y)) window.boruPins.add({ id: String(m.id).slice(0, 24), x: +m.x, y: +m.y, k: m.k | 0, c: /^#[0-9a-f]{6}$/i.test(m.c) ? m.c : '#ffd24a', who: nameOf(m.from), from: m.from }); break;
            case 'pind': if (window.boruPins) window.boruPins.del(String(m.id), m.from); break;
            case 'start': onStart(m); break;
            case 'end': onEnd(m); break;
            case 'vs': setRemoteSpeaking(m.from, m.on); break;
            case 'vc': playRelay(m.from, m.d); break;
            // Ortak veri (Birlikte modu)
            case 'hv': if (M && window.BORU && M.roster.has(m.from)) { if (M.mode === 'coop' && m.id) BORU.allyCapturedHive(m.id); if (poolsWith(m.from)) BORU.setAllyHives(m.from, m.n); } break;
            case 'bhgo': if (M && M.mode === 'coop' && window.BORU && M.startedAt && !M.over) { feed('🕳️ ' + nameOf(m.from) + ' kara deliğe girdi — herkes içeri çekiliyor!', '#b77bff'); BORU.netEnterBH(m.lvl); } break;
            case 'bhwin': if (M && M.mode === 'coop' && window.BORU) { feed('🏆 Kara delik bossu yenildi!', '#ffd24a'); BORU.netBhWin(m.lvl); } break;
            case 'bd': if (M && M.mode === 'coop' && window.BORU && BORU.bhIsAuth()) BORU.bossDamageIn(m.d); break;
            case 'chat': addChat(m.from, m.txt); break;
            case 'rm': if (M && M.over) { M.rm.add(m.from); if (isHost()) toast('🔁 ' + nameOf(m.from) + ' yeniden oynamak istiyor', '#ffd24a'); render(); checkRematchVotes(); } break;
        }
    }

    // ------------------------------------------------------------------ ODA GİRİŞ / ÇIKIŞ
    const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function newCode() { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; }
    async function joinRoom(code, creating, opts) {
        code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (code.length < 4) { S.err = 'Oda kodu en az 4 karakter olmalı.'; render(); return; }
        if (!me.name.trim()) { S.err = 'Önce ejderhana bir isim ver.'; render(); return; }
        S.err = ''; S.busy = true; render();
        try {
            await Promise.all([saveProfile(), prepTurn()]);
            const room = TEST ? new TestRoom(code) : new SbRoom(code);
            S.code = code; S.joinedAt = Date.now(); S.ready = false; S.mode = opts && opts.mode && MODES[opts.mode] ? opts.mode : 'coop'; S.team = 0;
            if (creating) { S.pub = !(opts && opts.priv); S.lname = ((opts && opts.lname) || '').slice(0, 24); try { sessionStorage.setItem('boruLobby_' + code, JSON.stringify({ pub: S.pub, lname: S.lname })); } catch (e) {} }
            else { let o = null; try { o = JSON.parse(sessionStorage.getItem('boruLobby_' + code) || 'null'); } catch (e) {} S.pub = !!(o && o.pub); S.lname = (o && o.lname) || ''; }
            S.chat = [];
            S.room = room;
            let first = true;
            await room.join(myMeta(), onRoomMsg, (members) => {
                onSync(members);
                if (first && !creating) {
                    first = false;
                    const others = members.filter(m => m.id !== me.id);
                    if (others.length >= MAX_PLAYERS) { leaveRoom(); S.err = 'Oda dolu (en fazla ' + MAX_PLAYERS + ' oyuncu).'; render(); }
                }
            });
            S.screen = 'lobby'; S.busy = false;
            try { const u = new URL(location.href); u.searchParams.set('oda', code); history.replaceState(null, '', u.toString()); } catch (e) {}
            fetchLastMatch(code); dirUpdate(); render();
        } catch (e) { S.busy = false; S.room = null; S.err = e.message || 'Bağlanılamadı.'; render(); }
    }
    function leaveRoom() {
        if (S.room) S.room.leave(); S.room = null;
        for (const p of peers.values()) p.close(); peers.clear();
        S.members = []; S.screen = 'home'; S.hostId = null; dirUpdate();
        try { const u = new URL(location.href); u.searchParams.delete('oda'); history.replaceState(null, '', u.toString()); } catch (e) {}
        render();
    }
    window.addEventListener('pagehide', () => { if (S.room) S.room.leave(); });
    function onSync(members) {
        const uniq = new Map(); for (const m of members) if (m && m.id) uniq.set(m.id, m);
        const prevIds = new Set(S.members.map(m => m.id));
        S.members = [...uniq.values()].sort((a, b) => (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : 1));
        if (S.screen === 'lobby' && prevIds.size) {
            for (const m of S.members) if (!prevIds.has(m.id) && m.id !== me.id) { sysChat('➕ ' + m.name + ' lobiye katıldı'); beep(660); }
            const now = new Set(S.members.map(m => m.id)); for (const id of prevIds) if (!now.has(id)) { const pm = S.profiles[id]; sysChat('➖ ' + ((pm && pm.name) || 'Bir oyuncu') + ' ayrıldı'); }
        }
        const host = S.members[0]; S.hostId = host ? host.id : me.id;
        if (host && host.id !== me.id && host.mode && host.mode !== S.mode) { S.mode = host.mode; if (S.mode !== 'team') S.team = 0; else autoTeam(); }
        if (host && host.id !== me.id) { S.pub = !!host.pub; S.lname = host.lname || ''; }
        syncPeers();
        const need = S.members.map(m => m.id).filter(id => !S.profiles[id]); if (need.length) fetchProfiles(need);
        if (S.match && !S.match.over) checkEnd();
        if (S.match && S.match.over) checkRematchVotes();
        dirUpdate(); render();
    }
    function autoTeam() {
        const c = [0, 0]; for (const m of S.members) if (m.id !== me.id) c[m.team === 1 ? 1 : 0]++;
        S.team = c[1] < c[0] ? 1 : 0;
    }

    // ------------------------------------------------------------------ LOBİ SOHBETİ
    function addChat(from, txt) {
        txt = String(txt || '').replace(/\s+/g, ' ').trim().slice(0, 140); if (!txt) return;
        S.chat.push({ from, name: from === me.id ? me.name : nameOf(from), txt, ts: Date.now() });
        if (S.chat.length > 40) S.chat.shift();
        if (from !== me.id) { S.unread = (S.unread || 0) + 1; beep(880); }
        render(); setTimeout(scrollChat, 0);
    }
    function sysChat(txt) { S.chat.push({ sys: 1, txt, ts: Date.now() }); if (S.chat.length > 40) S.chat.shift(); setTimeout(scrollChat, 0); }
    function scrollChat() { const c = $('#mpChatLog'); if (c) c.scrollTop = c.scrollHeight; }
    function sendChat(txt) {
        txt = String(txt || '').trim().slice(0, 140); if (!txt || !S.room) return;
        const now = Date.now(); if (now - (S.chatT || 0) < 600) return; S.chatT = now;
        const msg = { t: 'chat', txt, eid: uid().slice(0, 12) };
        S.room.send(Object.assign({ from: me.id }, msg)); addChat(me.id, txt);
    }
    function beep(f) { try { const ac = getAC(); if (!ac) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.08, ac.currentTime + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.18); o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.2); } catch (e) {} }

    // ------------------------------------------------------------------ LOBİ KONTROLLERİ
    function setMode(mode) { if (!isHost() || !MODES[mode]) return; S.mode = mode; if (mode === 'team') autoTeam(); pushMeta(); render(); }
    function setTeam(t) { S.team = t; S.ready = false; pushMeta(); render(); }
    function setSkin(id) { me.skin = id; LS.setItem('boruMpSkin', id); saveProfile(); pushMeta(); render(); }
    function toggleReady() { S.ready = !S.ready; unlockAudio(); pushMeta(); render(); }
    function startBlockers() {
        const w = [];
        if (S.members.length < 2) w.push('En az 2 oyuncu gerekli');
        const notReady = S.members.filter(m => !m.ready); if (notReady.length) w.push('Hazır olmayan: ' + notReady.map(m => m.name).join(', '));
        if (S.mode === 'team') { const t0 = S.members.filter(m => m.team !== 1).length, t1 = S.members.length - t0; if (!t0 || !t1) w.push('Her takımda en az 1 oyuncu olmalı'); }
        return w;
    }
    function hostStart() {
        if (!isHost() || startBlockers().length) return;
        startWith(S.members);
    }
    // MAÇ SONU: aynı oyuncularla lobiye dönmeden yeniden başla
    function hostRematch() {
        if (!isHost()) return;
        if (S.members.length < 2) { toast('Yeniden başlatmak için odada en az 2 oyuncu olmalı', '#ff5555'); return; }
        if (S.mode === 'team') { const t0 = S.members.filter(m => m.team !== 1).length; if (!t0 || t0 === S.members.length) { toast('Takım modunda iki takımda da oyuncu olmalı', '#ff5555'); return; } }
        toast('🔁 Maç yeniden başlıyor…', '#33ff99');
        startWith(S.members);
    }
    function voteRematch() {
        if (isHost()) { hostRematch(); return; }
        S.rmVote = !S.rmVote; pushMeta();
        if (S.rmVote) sendAll({ t: 'rm' });
        render();
    }
    function checkRematchVotes() {
        const M = S.match; if (!isHost() || !M || !M.over || M.autoRm) return;
        const others = S.members.filter(m => m.id !== me.id); if (!others.length) return;
        if (others.every(m => m.rm || M.rm.has(m.id))) { M.autoRm = true; setTimeout(() => { if (S.match === M && M.over) hostRematch(); }, 1500); }
    }
    function startWith(members) {
        const roster = members.map(m => ({ id: m.id, name: m.name, skin: m.skin, team: S.mode === 'team' ? (m.team === 1 ? 1 : 0) : 0, code: m.code }));
        const spawns = {}, n = roster.length, rot = Math.random() * Math.PI * 2;
        if (S.mode === 'coop') roster.forEach((r, i) => { const a = rot + i / n * Math.PI * 2; spawns[r.id] = { x: Math.round(Math.cos(a) * 160), y: Math.round(Math.sin(a) * 160) }; });
        else if (S.mode === 'ffa') roster.forEach((r, i) => { const a = rot + i / n * Math.PI * 2; spawns[r.id] = { x: Math.round(Math.cos(a) * 2200), y: Math.round(Math.sin(a) * 2200) }; });
        else { const idx = [0, 0]; roster.forEach(r => { const a = rot + r.team * Math.PI, k = idx[r.team]++, off = (k - 1) * 220; spawns[r.id] = { x: Math.round(Math.cos(a) * 2200 - Math.sin(a) * off), y: Math.round(Math.sin(a) * 2200 + Math.cos(a) * off) }; }); }
        hostCast({ t: 'start', mid: uid(), mode: S.mode, roster, spawns, room: S.code });
    }

    // ------------------------------------------------------------------ MAÇ
    const REVIVE_MS = 120000; // Birlikte modunda düşen oyuncu 2 dakika sonra sığınakta doğar
    function hostileTo(id) {
        const M = S.match; if (!M || M.over || id === me.id) return false;
        if (M.mode === 'coop') return false;
        if (M.mode === 'ffa') return true;
        const a = M.roster.get(id), b = M.roster.get(me.id); return !!(a && b && a.team !== b.team);
    }
    // Kara delik eşiği için kovanları ortak sayılan oyuncular: Takım modunda yalnızca takım arkadaşları, diğer modlarda herkes
    function poolsWith(id) { const M = S.match; if (!M || id === me.id) return false; if (M.mode !== 'team') return true; const a = M.roster.get(id), b = M.roster.get(me.id); return !!(a && b && a.team === b.team); }
    function colorOf(id) {
        const M = S.match; const r = M && M.roster.get(id);
        if (M && M.mode === 'team' && r) return TEAMS[r.team].color;
        if (M && M.mode === 'ffa') return id === me.id ? '#ffd24a' : '#ff8866';
        return '#8dffcf';
    }
    function onStart(m) {
        if (S.match && S.match.mid === m.mid) return;
        if (!m.roster || !m.roster.some(r => r.id === me.id)) { toast('Maç başladı, bir sonrakine katılabilirsin.', '#ffd24a'); return; }
        const roster = new Map(m.roster.map(r => [r.id, r]));
        S.match = { mid: m.mid, mode: m.mode, roster, spawns: m.spawns, room: m.room || S.code, hostId: m.from, t0: performance.now() + 3200, startedAt: 0,
            states: new Map(), stats: new Map(), dead: new Set(), left: new Set(), pk: 0, deaths: 0, over: false, eliminated: false, reviveAt: 0, endCandidate: 0, rm: new Set() };
        S.rmVote = false;
        S.mode = m.mode; S.screen = 'count'; pushMeta(); unlockAudio(); render();
        const tick = () => {
            const M = S.match; if (!M || M.mid !== m.mid) return;
            const left = M.t0 - performance.now();
            const el = $('#mpCountNum'); if (el) el.textContent = left > 0 ? Math.ceil(left / 1000) : 'SAVAŞ!';
            if (left > 0) { requestAnimationFrame(tick); return; }
            beginMatch();
        };
        requestAnimationFrame(tick);
    }
    function beginMatch() {
        const M = S.match; if (!M || M.startedAt) return;
        const sp = M.spawns[me.id] || { x: 0, y: 0 };
        const B = window.BORU;
        B.hostile = hostileTo; B.teamColor = colorOf;
        B.onHit = (id, d) => sendTo(id, { t: 'hit', to: id, d });
        B.onLocalDeath = onLocalDeath;
        B.onHiveCaptured = (h) => {
            const t = '🏰 ' + me.name + ' bir kovanı fethetti'; feed(t, '#ffd24a'); sendAll({ t: 'note', txt: t, c: '#ffd24a' });
            sendAll(M.mode === 'coop' ? { t: 'hv', id: h && h.id, n: B.ownHives() } : { t: 'hv', n: B.ownHives() });
        };
        B.playerCount = () => { let n = 0; for (const id of M.roster.keys()) if (!M.left.has(id)) n++; return Math.max(1, n); };
        // Kara delik hakemi: kara delikteki (ölmemiş) oyunculardan kimliği en küçük olan bossun gerçek canını tutar
        B.bhAuthId = () => {
            const now = performance.now(); let best = B.inArena() && !B.isDead() ? me.id : null;
            for (const [id, st] of M.states) { if (M.left.has(id) || !st.ar || st.d || now - st.t > 3000) continue; if (best === null || id < best) best = id; }
            return best;
        };
        B.bhIsAuth = () => { const a = B.bhAuthId(); return a === null ? B.inArena() : a === me.id; };
        B.onBhGo = (lvl) => { if (M.mode === 'coop') { sendAll({ t: 'bhgo', lvl }); feed('🕳️ Kara deliğe girdin — müttefiklerin de çekiliyor', '#b77bff'); } };
        B.onBhWin = (lvl) => { if (M.mode === 'coop') sendAll({ t: 'bhwin', lvl }); };
        B.onBossDmg = (d) => { const a = B.bhAuthId(); if (a && a !== me.id) sendTo(a, { t: 'bd', to: a, d }); };
        const PP = window.boruPins;
        if (PP) {
            PP.hook = {
                add: (q) => sendAll({ t: 'pin', id: q.id, x: q.x, y: q.y, k: q.k, c: q.c }),
                del: (id) => sendAll({ t: 'pind', id }),
                here: (q) => sendAll({ t: 'pin', id: q.id, x: q.x, y: q.y, k: q.k, c: q.c })
            };
            PP.clear();
        }
        B.onBossKill = () => { const t = '👑 ' + me.name + ' bir bossu devirdi!'; feed(t, '#ff66ff'); sendAll({ t: 'note', txt: t, c: '#ff66ff' }); };
        try { B.startMatch({ name: me.name, skin: me.skin, x: sp.x, y: sp.y, mode: M.mode }); }
        catch (e) { console.error(e); toast('Maç başlatılamadı: ' + e.message, '#ff5555'); }
        M.startedAt = Date.now(); S.screen = 'hud'; render();
        feed(MODES[M.mode].icon + ' ' + MODES[M.mode].name + ' başladı! ' + M.roster.size + ' ejderha sahada.', '#ffffff');
    }
    function onLocalDeath(by) {
        const M = S.match; if (!M || M.over) return;
        M.deaths++; M.dead.add(me.id);
        sendAll({ t: 'dead', by: by || null });
        feed(by ? '🔥 ' + nameOf(by) + ', seni yaktı!' : '💀 Düştün!', '#ff5566');
        if (M.mode === 'coop') { M.reviveAt = performance.now() + REVIVE_MS; }
        else { M.eliminated = true; }
        renderHud(); checkEnd();
    }
    function onRemoteDeath(id, by) {
        const M = S.match; if (!M) return;
        M.dead.add(id);
        if (by === me.id) { M.pk++; feed('🔥 ' + nameOf(id) + ' ejderhasını yaktın!', '#ffaa00'); }
        else if (by) feed('🔥 ' + nameOf(by) + ', ' + nameOf(id) + ' ejderhasını yaktı', '#ff8866');
        else feed('💀 ' + nameOf(id) + ' düştü', '#ff8866');
        if (M.mode !== 'coop') { const alive = aliveGroups(); if (alive.count > 1) feed('⚔️ Kalan: ' + alive.label, '#cccccc'); }
        checkEnd();
    }
    function onState(id, s) {
        const M = S.match; if (!M) return;
        // Sırasız / eski paket (ör. yavaş sunucu kopyası hızlı doğrudan paketten sonra gelirse) geri atlama yaptırmasın
        const prev = M.states.get(id);
        if (prev && s.q != null && prev.q != null && s.q <= prev.q && prev.q - s.q < 100000) { prev.t = performance.now(); return; }
        M.states.set(id, Object.assign({ t: performance.now() }, s)); if (s.st) M.stats.set(id, s.st);
        setRemoteSpeaking(id, s.sp);
        if (window.BORU && s.st && s.st.ho != null && poolsWith(id)) BORU.setAllyHives(id, s.st.ho);
        if (M.mode === 'coop' && window.BORU && s.bs) BORU.remoteBossState(s.bs);
        if (M.left.has(id)) { M.left.delete(id); feed('🔌 ' + nameOf(id) + ' geri bağlandı', '#66ffcc'); }
        if (M.mode === 'coop' && !s.d && M.dead.has(id)) M.dead.delete(id);
        const r = M.roster.get(id);
        if (window.BORU && M.startedAt && !M.over) BORU.setRemote(id, Object.assign({}, s, { name: r ? r.name : '?' }));
    }
    // Maç döngüsü: durumu gönder, sayaç, bitişi kontrol et
    let lastSend = 0, lastRelay = 0, lastHud = 0, lastStats = 0, seq = 0, lastSpec = 0;
    setInterval(() => {
        const M = S.match; if (!M || !M.startedAt || M.over || !window.BORU || !BORU.matchActive) return;
        const now = performance.now();
        if (now - lastSend >= 66) {
            lastSend = now;
            const s = BORU.localState(); s.m = voice.on ? 1 : 0; s.sp = voice.talk ? 1 : 0; s.q = ++seq; s.ts = Math.round(now);
            // Skor tablosu verisi her pakette değil, saniyede bir gider (paketler küçülür, telefon ağı rahatlar)
            if (now - lastStats > 1000) { lastStats = now; const st = BORU.stats(); st.pk = M.pk; st.dh = M.deaths; st.ho = BORU.ownHives(); s.st = st; }
            // Kara delik hakemiysek ortak bossun durumu da pakete eklenir
            if (M.mode === 'coop' && s.ar) { const bs = BORU.bossState(); if (bs) s.bs = bs; }
            const str = JSON.stringify({ t: 'st', s }); const relay = [];
            for (const id of M.roster.keys()) {
                if (id === me.id) continue; const p = peers.get(id);
                if (p && p.okS() && p.dcS.bufferedAmount < 16384) { try { p.dcS.send(str); continue; } catch (e) {} }
                if (p && p.okS()) continue; // tampon dolu: bu paketi atla, bir sonraki zaten yolda
                relay.push(id);
            }
            // Doğrudan bağlanamayanlara sunucu üzerinden yedek (yalnızca onlara)
            if (relay.length && now - lastRelay > 150 && S.room) { lastRelay = now; S.room.send({ t: 'st', from: me.id, tos: relay, s }); }
        }
        if (M.mode === 'coop' && M.reviveAt && now >= M.reviveAt) {
            M.reviveAt = 0; M.dead.delete(me.id);
            const a = Math.random() * Math.PI * 2; BORU.revive(Math.round(Math.cos(a) * 150), Math.round(Math.sin(a) * 150));
            sendAll({ t: 'rev' }); feed('✨ Sığınakta yeniden doğdun', '#66ffcc');
        }
        // Uzun süre veri gelmeyen / odadan çıkan oyuncular
        for (const id of M.roster.keys()) {
            if (id === me.id || M.left.has(id)) continue;
            const inRoom = S.members.some(m => m.id === id), st = M.states.get(id);
            if (!inRoom && (!st || now - st.t > 5000)) { M.left.add(id); BORU.removeRemote(id); feed('🚪 ' + nameOf(id) + ' oyundan ayrıldı', '#aaaaaa'); checkEnd(); }
        }
        if (isHost() && S.room && now - lastSpec > 1000) { lastSpec = now; sendSpec(false); }
        if (now - lastHud > 250) { lastHud = now; renderHud(); checkEnd(); }
    }, 33);
    function isAlive(id) {
        const M = S.match; if (M.left.has(id)) return false;
        if (id === me.id) return !BORU.isDead();
        if (M.dead.has(id)) return false;
        const st = M.states.get(id); return !(st && st.d);
    }
    function aliveGroups() {
        const M = S.match; const ids = [...M.roster.keys()].filter(isAlive);
        if (M.mode === 'team') { const teams = [...new Set(ids.map(id => M.roster.get(id).team))]; return { count: teams.length, ids, teams, label: teams.map(t => TEAMS[t].name + ' (' + ids.filter(i => M.roster.get(i).team === t).length + ')').join(', ') }; }
        return { count: ids.length, ids, label: ids.map(nameOf).join(', ') };
    }
    function checkEnd() {
        const M = S.match; if (!M || M.over || !M.startedAt || S.hostId !== me.id) return;
        if (Date.now() - M.startedAt < 4000) return;
        const g = aliveGroups(); let done = false, winner = null;
        if (M.mode === 'coop') { if (g.count === 0) { done = true; winner = { kind: 'none', label: 'Tüm ejderhalar düştü' }; } }
        else if (g.count <= 1) {
            done = true;
            if (g.count === 0) winner = { kind: 'none', label: 'Kazanan yok' };
            else if (M.mode === 'team') winner = { kind: 'team', team: g.teams[0], label: TEAMS[g.teams[0]].name + ' Takım' };
            else winner = { kind: 'player', id: g.ids[0], label: nameOf(g.ids[0]) };
        }
        if (!done) { M.endCandidate = 0; return; }
        if (!M.endCandidate) { M.endCandidate = performance.now(); return; }
        if (performance.now() - M.endCandidate < 1200) return;
        hostEnd(winner);
    }
    function hostEnd(winner) {
        const M = S.match; if (!M || M.over) return;
        const board = [...M.roster.values()].map(r => {
            const st = r.id === me.id ? Object.assign(BORU.stats(), { pk: M.pk, dh: M.deaths }) : (M.stats.get(r.id) || {});
            return { id: r.id, name: r.name, team: r.team, skin: r.skin, code: r.code, k: st.k || 0, pk: st.pk || 0, dh: st.dh || 0, dl: st.dl || 0, hv: st.hv || 0, bs: st.bs || 0, lv: st.lv || 1, alive: isAlive(r.id) ? 1 : 0 };
        });
        hostCast({ t: 'end', mid: M.mid, winner, board, dur: Math.round((Date.now() - M.startedAt) / 1000), mode: M.mode });
    }
    function onEnd(m) {
        const M = S.match; if (!M || M.mid !== m.mid || M.over) return;
        M.over = true; M.result = m;
        if (isHost()) sendSpec(true, m.winner.label);
        try { BORU.endMatch(); } catch (e) {}
        if (window.boruPins) { window.boruPins.hook = null; window.boruPins.clear(); }
        const mine = m.board.find(b => b.id === me.id) || {};
        const r = M.roster.get(me.id);
        const won = m.winner.kind === 'player' ? m.winner.id === me.id : m.winner.kind === 'team' ? (r && r.team === m.winner.team) : false;
        M.won = won; S.screen = 'end'; pushMeta(); render();
        if (!TEST) (async () => {
            try {
                await loadSb();
                await sb.rpc('boru_report_result', { p_id: me.id, p_secret: me.secret, p_won: won, p_kills: (mine.k || 0) + (mine.pk || 0), p_boss: mine.bs || 0, p_hives: mine.hv || 0, p_damage: Math.round(mine.dl || 0) });
                if (m.from === me.id) await sb.rpc('boru_save_match', { p_id: me.id, p_secret: me.secret, p_room: M.room, p_mode: M.mode, p_duration: m.dur, p_winner: m.winner.label, p_results: m.board });
                fetchProfiles([...M.roster.keys()]);
            } catch (e) { console.warn('Skor kaydedilemedi', e); }
        })();
    }
    function hostEndNow() { if (!isHost() || !S.match || S.match.over) return; if (!confirm('Maçı şimdi bitirmek istiyor musun?')) return; hostEnd({ kind: 'none', label: 'Maç oda sahibi tarafından bitirildi' }); }
    function backToLobby() { const u = new URL(location.href); u.searchParams.set('oda', S.code || (S.match && S.match.room) || ''); location.href = u.toString(); }
    function backToMenu() { const u = new URL(location.href); u.searchParams.delete('oda'); location.href = u.toString(); }

    // ------------------------------------------------------------------ ARAYÜZ
    const css = `
    #mpRoot{--mp-acc:#ff9a2e;--mp-acc2:#ffcf6a;--mp-bg:#0a0709;--mp-card:rgba(255,255,255,.035);--mp-line:rgba(255,170,70,.18);--mp-txt:#f1ebe4;--mp-dim:#a89c92;
        position:fixed;inset:0;z-index:600;display:none;font-family:'Segoe UI',system-ui,-apple-system,Roboto,Arial,sans-serif;color:var(--mp-txt)}
    #mpRoot.on{display:block}
    #mpRoot .mp-scr{position:absolute;inset:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;touch-action:pan-y!important;
        background:radial-gradient(1200px 520px at 50% -140px,rgba(255,110,20,.28),transparent 70%),radial-gradient(700px 400px at 100% 100%,rgba(120,40,200,.14),transparent 70%),linear-gradient(180deg,#140a08,#070508 60%);
        padding:calc(env(safe-area-inset-top,0px) + 16px) 14px 40px;box-sizing:border-box}
    #mpRoot .mp-wrap{max-width:720px;margin:0 auto;animation:mpFade .28s ease-out}
    @keyframes mpFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
    #mpRoot .mp-scr *{touch-action:pan-y}
    #mpRoot .mp-skins,#mpRoot .mp-skins *{touch-action:pan-x pan-y!important;-webkit-overflow-scrolling:touch}
    #mpRoot input{touch-action:manipulation!important}
    #mpRoot .mp-btn,#mpRoot .mp-mode,#mpRoot .mp-skin{-webkit-tap-highlight-color:transparent}
    #mpRoot .mp-card table{display:block;overflow-x:auto;touch-action:pan-x pan-y}
    #mpRoot .mp-foot{position:sticky;bottom:-40px;margin:12px -14px -40px;padding:12px 14px calc(env(safe-area-inset-bottom,0px) + 16px);background:linear-gradient(180deg,rgba(7,5,8,0),rgba(7,5,8,.94) 24%,#070508);z-index:2}
    #mpRoot h2{margin:6px 44px 4px;text-align:center;font-size:25px;font-weight:900;letter-spacing:2px;background:linear-gradient(180deg,#fff3d6,#ffb347 55%,#ff6a00);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 12px rgba(255,100,0,.45))}
    #mpRoot .mp-sub{text-align:center;color:var(--mp-dim);font-size:12.5px;margin:0 0 16px;letter-spacing:.3px}
    #mpRoot .mp-x{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);right:12px;width:38px;height:38px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.14);color:#ddd;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.15s}
    #mpRoot .mp-x:hover{background:rgba(255,80,40,.25);border-color:#ff7a40}
    #mpRoot .mp-card{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border:1px solid var(--mp-line);border-radius:16px;padding:14px;margin-bottom:12px;box-shadow:0 8px 24px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.05)}
    #mpRoot .mp-card h3{margin:0 0 10px;font-size:12px;color:var(--mp-acc2);text-transform:uppercase;letter-spacing:1.4px;font-weight:800;display:flex;align-items:center;gap:6px}
    #mpRoot .mp-card h3 .cnt{margin-left:auto;font-size:11px;color:var(--mp-dim);letter-spacing:.5px;text-transform:none;font-weight:600}
    #mpRoot input{background:rgba(0,0,0,.4);border:1px solid rgba(255,160,70,.3);color:#fff;border-radius:11px;padding:11px 12px;font-size:16px;box-sizing:border-box;outline:none;transition:border-color .15s,box-shadow .15s}
    #mpRoot input:focus{border-color:var(--mp-acc);box-shadow:0 0 0 3px rgba(255,140,40,.18)}
    #mpRoot .mp-btn{background:rgba(255,140,40,.1);border:1px solid rgba(255,150,60,.55);color:#fff;border-radius:12px;padding:10px 14px;font-size:14.5px;font-weight:700;cursor:pointer;transition:transform .08s,background .15s,box-shadow .15s}
    #mpRoot .mp-btn:hover{background:rgba(255,140,40,.2)}
    #mpRoot .mp-btn:active{transform:scale(.97)}
    #mpRoot .mp-btn:disabled{opacity:.38;cursor:default;transform:none}
    #mpRoot .mp-btn.big{width:100%;padding:15px;font-size:16.5px;letter-spacing:.6px}
    #mpRoot .mp-btn.go{background:linear-gradient(180deg,#ff8a1e,#d93a00);border-color:#ffc16a;box-shadow:0 6px 20px rgba(255,90,0,.35),inset 0 1px 0 rgba(255,255,255,.3);text-shadow:0 1px 2px rgba(0,0,0,.4)}
    #mpRoot .mp-btn.go:not(:disabled){animation:mpGlow 2.4s ease-in-out infinite}
    @keyframes mpGlow{50%{box-shadow:0 6px 28px rgba(255,120,0,.6),inset 0 1px 0 rgba(255,255,255,.3)}}
    #mpRoot .mp-btn.ok{background:linear-gradient(180deg,rgba(40,220,130,.35),rgba(0,140,70,.35));border-color:#44ffaa}
    #mpRoot .mp-btn.blue{background:rgba(40,150,255,.16);border-color:#4ab0ff}
    #mpRoot .mp-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
    #mpRoot .mp-row>input{flex:1;min-width:120px}
    #mpRoot .mp-id{font-family:ui-monospace,Consolas,monospace;font-size:16px;color:#ffd24a;background:rgba(255,200,60,.08);border:1px dashed rgba(255,200,80,.55);border-radius:11px;padding:10px 12px;cursor:pointer;white-space:nowrap}
    #mpRoot .mp-id:after{content:' ⧉';opacity:.6;font-size:13px}
    #mpRoot .mp-stats{display:flex;gap:5px;flex-wrap:wrap;font-size:11.5px;color:#cfc3b8;margin-top:8px}
    #mpRoot .mp-stats span{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.06);border-radius:20px;padding:3px 9px}
    #mpRoot .mp-err{color:#ff7a7a;text-align:center;margin:10px 0 0;font-weight:700;background:rgba(255,50,50,.08);border:1px solid rgba(255,80,80,.3);border-radius:10px;padding:8px}
    #mpRoot .mp-or{display:flex;align-items:center;gap:10px;color:var(--mp-dim);font-size:11px;margin:12px 0 10px;letter-spacing:1px}
    #mpRoot .mp-or:before,#mpRoot .mp-or:after{content:'';flex:1;height:1px;background:rgba(255,255,255,.1)}
    #mpRoot .mp-codebox{text-align:center;padding:18px 14px;background:radial-gradient(400px 140px at 50% 0,rgba(255,120,20,.22),transparent 70%),linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02))}
    #mpRoot .mp-code{display:inline-flex;gap:6px;margin:8px 0 12px;cursor:pointer}
    #mpRoot .mp-code i{font-style:normal;width:46px;height:56px;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:900;font-family:ui-monospace,Consolas,monospace;color:#fff;background:rgba(0,0,0,.45);border:1px solid rgba(255,170,80,.55);border-radius:12px;box-shadow:inset 0 -3px 0 rgba(255,120,0,.35),0 0 18px rgba(255,100,0,.15);text-shadow:0 0 10px rgba(255,140,40,.7)}
    #mpRoot .mp-lbl{font-size:11px;color:var(--mp-dim);letter-spacing:1.5px;text-transform:uppercase}
    #mpRoot .mp-modes{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    #mpRoot .mp-mode{position:relative;border:1px solid rgba(255,255,255,.1);border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;background:rgba(0,0,0,.28);transition:.15s}
    #mpRoot .mp-mode:hover{border-color:rgba(255,170,80,.5)}
    #mpRoot .mp-mode.sel{border-color:var(--mp-acc);background:linear-gradient(180deg,rgba(255,130,20,.24),rgba(255,80,0,.08));box-shadow:0 0 0 1px rgba(255,150,50,.4),0 6px 20px rgba(255,100,0,.22)}
    #mpRoot .mp-mode.sel:after{content:'✓';position:absolute;top:6px;right:8px;font-size:12px;color:var(--mp-acc2);font-weight:900}
    #mpRoot .mp-mode.lock{cursor:default}
    #mpRoot .mp-mode b{display:block;font-size:14px;margin-top:4px}
    #mpRoot .mp-mode small{display:block;font-size:10.5px;color:var(--mp-dim);margin-top:2px}
    #mpRoot .mp-mode .i{font-size:28px;line-height:1}
    #mpRoot .mp-desc{font-size:12.5px;color:var(--mp-dim);margin-top:10px;text-align:center;line-height:1.45}
    #mpRoot .mp-tags{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin-top:10px}
    #mpRoot .mp-tag{font-size:11px;font-weight:700;padding:4px 9px;border-radius:20px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#e8ddd2}
    #mpRoot .mp-tag.p{background:rgba(183,123,255,.14);border-color:rgba(183,123,255,.45);color:#dcc4ff}
    #mpRoot .mp-tag.g{background:rgba(60,255,160,.1);border-color:rgba(60,255,160,.4);color:#9dffd0}
    #mpRoot .mp-pl{display:flex;align-items:center;gap:11px;padding:9px 10px;border-radius:13px;background:rgba(0,0,0,.3);margin-bottom:7px;border:1px solid rgba(255,255,255,.06);position:relative;overflow:hidden}
    #mpRoot .mp-pl:before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--pc,#555)}
    #mpRoot .mp-pl.me{background:linear-gradient(90deg,rgba(255,200,80,.1),rgba(0,0,0,.3) 60%);border-color:rgba(255,200,80,.25)}
    #mpRoot .mp-pl .ic{font-size:24px;width:44px;height:44px;flex:0 0 44px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--pc,#888) 45%,transparent),rgba(0,0,0,.5));border:2px solid var(--pc,#555);position:relative}
    #mpRoot .mp-pl .ic.spk{box-shadow:0 0 0 3px rgba(51,255,153,.5),0 0 14px #33ff99}
    #mpRoot .mp-pl .nm{font-weight:800;font-size:15px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    #mpRoot .mp-pl .sub{font-size:11px;color:var(--mp-dim);font-weight:500}
    #mpRoot .mp-pl .rt{margin-left:auto;display:flex;gap:6px;align-items:center;font-size:17px;flex:0 0 auto}
    #mpRoot .mp-pl .rdy{font-size:11px;font-weight:800;padding:5px 9px;border-radius:20px;background:rgba(255,255,255,.07);color:#aaa;letter-spacing:.5px}
    #mpRoot .mp-pl .rdy.y{background:linear-gradient(180deg,#20d27a,#0a8a48);color:#fff;box-shadow:0 0 12px rgba(40,220,120,.35)}
    #mpRoot .mp-pl .mp-stats{margin-top:5px}
    #mpRoot .mp-empty{border:1px dashed rgba(255,255,255,.12);border-radius:13px;padding:12px;text-align:center;color:#6f6660;font-size:12.5px;margin-bottom:7px}
    #mpRoot .mp-skins{display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,auto);grid-auto-columns:84px;gap:7px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:thin}
    #mpRoot .mp-skin{border:1px solid rgba(255,255,255,.1);border-radius:13px;padding:8px 4px 7px;text-align:center;cursor:pointer;font-size:10.5px;line-height:1.2;background:rgba(0,0,0,.32);color:#ddd;transition:.12s;min-height:66px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
    #mpRoot .mp-skin .i{font-size:24px;display:block;width:36px;height:36px;line-height:36px;border-radius:50%;background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--sc) 40%,transparent),transparent 70%)}
    #mpRoot .mp-skin.sel{border:2px solid var(--sc);background:color-mix(in srgb,var(--sc) 16%,rgba(0,0,0,.4));box-shadow:0 0 14px color-mix(in srgb,var(--sc) 45%,transparent);color:#fff}
    #mpRoot .mp-teams{display:flex;gap:8px}
    #mpRoot .mp-teams .mp-btn{flex:1}
    #mpRoot .mp-warn{font-size:12px;color:#ffbb66;text-align:center;margin-top:8px}
    #mpRoot .mp-net{font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;background:rgba(255,255,255,.07);color:#aaa}
    #mpRoot .mp-net.on{background:rgba(40,220,120,.18);color:#8f8}
    #mpCount{position:fixed;inset:0;z-index:610;display:none;align-items:center;justify-content:center;flex-direction:column;background:radial-gradient(circle,rgba(40,10,0,.55),rgba(0,0,0,.75));pointer-events:none}
    #mpCount.on{display:flex}
    #mpCountNum{font-size:130px;font-weight:900;color:#fff;text-shadow:0 0 40px #ff5500,0 0 90px rgba(255,80,0,.6);animation:mpBeat 1s ease-out infinite;font-family:'Segoe UI',system-ui,Arial,sans-serif}
    @keyframes mpBeat{0%{transform:scale(1.35);opacity:.2}25%{transform:scale(1);opacity:1}100%{transform:scale(.92);opacity:.9}}
    #mpCount .lbl{font-size:18px;color:#ffcc88;margin-top:14px;letter-spacing:3px;text-transform:uppercase;font-weight:800;padding:8px 18px;border:1px solid rgba(255,170,80,.4);border-radius:30px;background:rgba(0,0,0,.4)}
    #mpHud{position:fixed;left:0;right:0;top:calc(env(safe-area-inset-top,0px) + 76px);z-index:450;display:none;flex-direction:column;align-items:center;pointer-events:none;gap:6px;font-family:'Segoe UI',system-ui,Arial,sans-serif}
    #mpHud.on{display:flex}
    #mpHud .bar{display:flex;gap:6px;align-items:center;pointer-events:auto;background:rgba(8,5,10,.62);border:1px solid rgba(255,170,80,.28);border-radius:22px;padding:3px;box-shadow:0 4px 14px rgba(0,0,0,.4)}
    #mpHud .tm{padding:4px 10px;font-weight:800;font-size:14px;color:#fff;font-family:ui-monospace,Consolas,monospace;letter-spacing:.5px}
    #mpHud .hb{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);border-radius:18px;color:#fff;font-size:15px;padding:3px 10px;cursor:pointer;touch-action:manipulation}
    #mpHud .hb.on{border-color:#33ff99;background:rgba(0,150,70,.55);box-shadow:0 0 10px rgba(51,255,153,.4)}
    #mpChips{display:flex;gap:5px;flex-wrap:wrap;justify-content:center;max-width:92vw}
    #mpChips .c{background:rgba(8,5,10,.66);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:3px 8px 4px;font-size:11px;font-weight:700;color:#fff;min-width:60px;text-align:center;pointer-events:auto;cursor:pointer;touch-action:manipulation;position:relative;overflow:hidden}
    #mpChips .c:before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--cc,#888)}
    #mpChips .c.me{border-color:rgba(255,210,74,.45)}
    #mpChips .c.dead{opacity:.42;filter:grayscale(1)}
    #mpChips .c .h{height:4px;background:rgba(255,255,255,.12);border-radius:3px;margin-top:3px;overflow:hidden}
    #mpChips .c .h i{display:block;height:100%;background:#3f8;border-radius:3px;transition:width .25s}
    #mpChips .c.spk{box-shadow:0 0 0 1px #33ff99,0 0 10px rgba(51,255,153,.6)}
    #mpFeed{display:flex;flex-direction:column;align-items:center;gap:4px}
    #mpFeed div{background:linear-gradient(90deg,rgba(0,0,0,0),rgba(8,5,10,.75) 15%,rgba(8,5,10,.75) 85%,rgba(0,0,0,0));padding:4px 22px;font-size:12.5px;font-weight:700;animation:mpIn .25s ease-out;transition:opacity .6s;text-shadow:0 1px 2px #000}
    @keyframes mpIn{from{transform:translateY(-8px);opacity:0}to{transform:none;opacity:1}}
    #mpDeath{position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:455;display:none;text-align:center;pointer-events:none;color:#fff;background:radial-gradient(ellipse,rgba(40,0,5,.7),rgba(0,0,0,0) 70%);padding:30px 60px;font-family:'Segoe UI',system-ui,Arial,sans-serif}
    #mpDeath.on{display:block}
    #mpDeath b{display:block;font-size:36px;font-weight:900;color:#ff4455;letter-spacing:3px;text-shadow:0 0 20px rgba(255,0,40,.7)}
    #mpDeath span{font-size:14px;color:#ddd}
    #mpToast{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 90px);transform:translateX(-50%);z-index:700;background:rgba(10,6,10,.92);border:1px solid #ffaa33;color:#fff;padding:10px 16px;border-radius:14px;font-size:14px;font-weight:600;display:none;max-width:88vw;text-align:center;box-shadow:0 8px 24px rgba(0,0,0,.5);font-family:'Segoe UI',system-ui,Arial,sans-serif}
    #mpRoot table{width:100%;border-collapse:collapse;font-size:13px}
    #mpRoot th,#mpRoot td{padding:8px 5px;text-align:center;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap}
    #mpRoot th{color:var(--mp-acc2);font-size:10.5px;text-transform:uppercase;letter-spacing:.6px}
    #mpRoot td.l{text-align:left}
    #mpRoot tr.me td{background:rgba(255,200,80,.08)}
    #mpRoot tr.first td:first-child:before{content:'👑 '}
    #mpRoot .mp-win{text-align:center;font-size:40px;font-weight:900;margin:10px 0 4px;letter-spacing:3px;animation:mpPop .5s cubic-bezier(.2,1.6,.4,1)}
    @keyframes mpPop{from{transform:scale(.5);opacity:0}to{transform:none;opacity:1}}
    #mpRoot .mp-hero{text-align:center;padding:20px 12px 16px;margin-bottom:12px;border-radius:18px;border:1px solid rgba(255,170,80,.25);background:radial-gradient(500px 200px at 50% 0,var(--hc,rgba(255,120,20,.3)),transparent 70%),rgba(0,0,0,.25)}
    body.mp-match #hireBossBtn,body.mp-match #hireBtnM,body.mp-match #callBtn{display:none!important}
    /* Mobil: maç şeridi üst bilgi ve sığınak butonunun altına iner, butonlar büyür ve arası açılır */
    body.m #mpHud{top:calc(env(safe-area-inset-top,0px) + 132px);left:calc(env(safe-area-inset-left,0px) + 8px);right:calc(env(safe-area-inset-right,0px) + 96px);gap:8px}
    body.m #mpHud .bar{gap:8px}
    body.m #mpHud .tm{font-size:13px;padding:6px 10px}
    body.m #mpHud .hb{min-width:44px;height:38px;font-size:18px;padding:0 10px;border-radius:19px}
    body.m #mpChips{gap:6px;max-width:68vw}
    body.m #mpChips .c{padding:4px 9px 5px;font-size:11px}
    @media (orientation:landscape) and (max-height:520px){body.m #mpHud{top:calc(env(safe-area-inset-top,0px) + 50px)}body.m #mpChips{max-width:50vw}}
    /* ---- v6: profil, açık lobiler, sohbet ---- */
    #mpRoot .mp-scr{background:radial-gradient(ellipse 120% 60% at 50% -10%,#3a1306 0%,#170806 45%,#070508 80%)}
    #mpRoot .mp-scr::before{content:'';position:fixed;inset:0;pointer-events:none;opacity:.5;background-image:radial-gradient(2px 2px at 12% 80%,#ff7a2a,transparent),radial-gradient(1.5px 1.5px at 30% 60%,#ffb14a,transparent),radial-gradient(2px 2px at 70% 90%,#ff5a00,transparent),radial-gradient(1px 1px at 85% 50%,#ffd27a,transparent),radial-gradient(1.5px 1.5px at 50% 75%,#ff8a3a,transparent);background-size:100% 100%;animation:mpEmb 9s linear infinite}
    @keyframes mpEmb{from{transform:translateY(0)}to{transform:translateY(-60px);opacity:.15}}
    #mpRoot .mp-wrap{position:relative}
    #mpRoot h2 .mp-h2i{display:inline-block;filter:drop-shadow(0 0 8px #ff6a00);animation:mkBob 2.6s ease-in-out infinite}
    #mpRoot .mp-card{backdrop-filter:blur(2px);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))}
    #mpRoot .mp-card.glow{border-color:rgba(255,170,51,.5);box-shadow:0 0 22px rgba(255,90,0,.15),inset 0 1px 0 rgba(255,255,255,.06)}
    #mpRoot .mp-card h3{display:flex;align-items:center;gap:8px}
    .mp-av{--sz:44px;position:relative;width:var(--sz);height:var(--sz);flex:0 0 auto;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:conic-gradient(from 0deg,var(--fa),var(--fb),var(--fa),var(--fb),var(--fa));padding:3px;box-sizing:border-box;box-shadow:0 0 12px color-mix(in srgb,var(--fa) 55%,transparent)}
    .mp-av i{font-style:normal;width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at 35% 30%,#3a1a0c,#0a0503 75%);font-size:calc(var(--sz) * .52);line-height:1}
    .mp-av.rb{background:conic-gradient(#ff3c3c,#ffb43c,#f4ff3c,#3cff7a,#3cf0ff,#7a3cff,#ff3cc8,#ff3c3c);animation:mpSpin 4s linear infinite}
    .mp-av.rb i{animation:mpSpin 4s linear infinite reverse}
    .mp-av.big{box-shadow:0 0 30px var(--fa),0 0 60px color-mix(in srgb,var(--fb) 50%,transparent);padding:5px}
    .mp-av.empty{background:rgba(255,255,255,.08);box-shadow:none}
    .mp-av.empty i{background:rgba(0,0,0,.4);color:#666;font-size:22px}
    @keyframes mpSpin{to{transform:rotate(360deg)}}
    #mpRoot .mp-me{display:flex;align-items:center;gap:12px;cursor:pointer}
    #mpRoot .mp-me-t{flex:1;min-width:0}
    #mpRoot .mp-me .nm{font-weight:bold;font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #mpRoot .mp-me .rk{font-size:12px;color:#ffd24a;font-weight:bold;margin-top:1px}
    #mpRoot .mp-me .sub{font-size:11px;color:#aaa;margin-top:3px}
    #mpRoot .mp-chev{font-size:28px;color:#ffaa33;opacity:.8}
    #mpRoot .mp-xp{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;margin-top:5px}
    #mpRoot .mp-xp i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#ff5a00,#ffd24a);box-shadow:0 0 8px #ff8a00}
    #mpRoot .mp-xp.big{height:10px;margin:10px 0 6px}
    #mpRoot .mp-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
    #mpRoot .mp-tile{border-radius:14px;padding:14px 8px;border:1px solid;color:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:inherit;transition:transform .15s,box-shadow .2s;-webkit-tap-highlight-color:transparent}
    #mpRoot .mp-tile:active{transform:scale(.97)}
    #mpRoot .mp-tile .i{font-size:30px;filter:drop-shadow(0 0 8px currentColor)}
    #mpRoot .mp-tile b{font-size:15px;letter-spacing:1px}
    #mpRoot .mp-tile small{font-size:11px;color:#ccc}
    #mpRoot .mp-tile:disabled{opacity:.5}
    #mpRoot .t-quick{background:linear-gradient(160deg,rgba(255,200,0,.25),rgba(120,40,0,.35));border-color:#ffcc33;color:#ffe9a8}
    #mpRoot .t-new{background:linear-gradient(160deg,rgba(255,80,0,.28),rgba(80,0,0,.35));border-color:#ff6a1a;color:#ffd0b0}
    #mpRoot .mp-tile.sel{box-shadow:0 0 18px rgba(255,106,26,.6)}
    #mpRoot .mp-create{animation:mpIn .2s ease-out}
    #mpRoot .mp-seg{display:flex;gap:6px;flex-wrap:wrap}
    #mpRoot .mp-seg button{flex:1;min-width:90px;background:rgba(0,0,0,.35);border:1px solid #553311;color:#ddd;border-radius:9px;padding:9px 6px;font-size:13px;font-weight:bold;cursor:pointer;font-family:inherit}
    #mpRoot .mp-seg button.sel{border-color:#ffaa33;background:rgba(255,120,0,.22);color:#fff;box-shadow:0 0 10px rgba(255,120,0,.35)}
    #mpRoot .mp-btn.sm{padding:8px 14px;font-size:13px}
    #mpRoot .mp-lob{display:flex;align-items:center;gap:10px;padding:9px;border-radius:12px;background:rgba(0,0,0,.32);margin-bottom:7px;border:1px solid rgba(255,255,255,.06);animation:mpIn .25s ease-out}
    #mpRoot .mp-lob.off{opacity:.55}
    #mpRoot .mp-lob-t{flex:1;min-width:0}
    #mpRoot .mp-lob .nm{font-weight:bold;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    #mpRoot .mp-lob .sub{font-size:11px;color:#aaa;margin-top:2px}
    #mpRoot .mtag{display:inline-block;border-radius:6px;padding:1px 6px;margin-right:4px;font-weight:bold;color:#fff;background:#444}
    #mpRoot .mtag.m-coop{background:#0a5a3a}#mpRoot .mtag.m-ffa{background:#7a1a10}#mpRoot .mtag.m-team{background:#1a3a7a}
    #mpRoot .mp-dots{display:flex;gap:3px;align-items:center;margin-top:5px}
    #mpRoot .mp-dots i{width:9px;height:9px;border-radius:50%;background:rgba(255,255,255,.12)}
    #mpRoot .mp-dots i.on{background:#ffaa33;box-shadow:0 0 6px #ff8800}
    #mpRoot .mp-dots b{font-size:11px;color:#ccc;margin-left:4px}
    #mpRoot .mp-pill{font-size:11px;font-weight:bold;padding:5px 9px;border-radius:8px;background:#333;color:#bbb;white-space:nowrap}
    #mpRoot .mp-pill.warn{background:#5a3a00;color:#ffd24a}
    #mpRoot .mp-live{margin-left:auto;font-size:10px;color:#33ff99;font-weight:bold;letter-spacing:1px;animation:mpBlink 1.6s ease-in-out infinite}
    @keyframes mpBlink{50%{opacity:.4}}
    #mpRoot .mp-empty{text-align:center;color:#aaa;font-size:13px;padding:14px 6px;line-height:1.6}
    #mpRoot .mp-spin{display:inline-block;width:12px;height:12px;border:2px solid #ffaa33;border-right-color:transparent;border-radius:50%;animation:mpSpin .8s linear infinite;vertical-align:-2px}
    #mpRoot .mp-pl{transition:box-shadow .2s}
    #mpRoot .mp-pl.isr{box-shadow:inset 0 0 0 1px rgba(51,255,153,.35),0 0 12px rgba(51,255,153,.12)}
    #mpRoot .mp-pl.ghost{opacity:.45;border-left-style:dashed}
    #mpRoot .mp-pl-t{cursor:pointer;min-width:0}
    #mpRoot .mp-pl .you{font-size:10px;background:#ffd24a;color:#000;border-radius:5px;padding:1px 5px;vertical-align:2px}
    #mpRoot .mp-code{cursor:pointer}
    #mpRoot .mp-hero{position:relative;text-align:center;padding:26px 10px 16px;margin:-6px 0 12px;border-radius:16px;overflow:hidden;border:1px solid color-mix(in srgb,var(--fa) 45%,transparent)}
    #mpRoot .mp-hero-bg{position:absolute;inset:0;background:radial-gradient(circle at 50% 35%,color-mix(in srgb,var(--fa) 35%,transparent),transparent 60%),radial-gradient(circle at 50% 120%,color-mix(in srgb,var(--fb) 45%,transparent),transparent 60%),#0c0606;z-index:-1}
    #mpRoot .mp-hero-n{font-size:26px;font-weight:900;letter-spacing:1px;margin-top:12px;text-shadow:0 0 14px var(--fa)}
    #mpRoot .mp-hero-r{font-size:14px;color:#ffd24a;font-weight:bold;margin:2px 0 8px;letter-spacing:1px}
    #mpRoot .mp-bio{font-style:italic;color:#ddd;font-size:13px;margin-top:10px;font-family:Georgia,serif}
    #mpRoot .mp-time{text-align:center;border-color:rgba(255,210,74,.45)}
    #mpRoot .mp-time .lbl{font-size:11px;letter-spacing:2px;color:#ffcc88;font-weight:bold}
    #mpRoot .mp-time .big{display:flex;justify-content:center;align-items:baseline;gap:4px;margin-top:4px}
    #mpRoot .mp-time .big b{font-size:44px;font-family:monospace;color:#fff;text-shadow:0 0 16px #ff8800}
    #mpRoot .mp-time .big b.sec{font-size:26px;color:#ffcc88}
    #mpRoot .mp-time .big small{font-size:12px;color:#aaa;margin-right:8px}
    #mpRoot .mp-time .sub{font-size:12px;color:#ccc}
    #mpRoot .mp-week{display:flex;justify-content:space-between;align-items:flex-end;height:66px;margin-top:12px;gap:6px}
    #mpRoot .mp-week div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px}
    #mpRoot .mp-week i{width:100%;max-width:26px;border-radius:5px 5px 2px 2px;background:linear-gradient(180deg,#ffd24a,#ff5a00)}
    #mpRoot .mp-week span{font-size:10px;color:#999}
    #mpRoot .mp-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}
    #mpRoot .mp-tl{background:rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:9px 4px;text-align:center}
    #mpRoot .mp-tl .v{font-size:16px;font-weight:bold;white-space:nowrap}
    #mpRoot .mp-tl .l{font-size:9px;color:#aaa;letter-spacing:1px;margin-top:3px}
    #mpRoot .mp-ranks{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;touch-action:pan-x!important}
    #mpRoot .mp-ranks div{flex:0 0 auto;min-width:74px;text-align:center;border-radius:10px;padding:8px 4px;background:rgba(0,0,0,.35);border:1px solid #333;opacity:.45;touch-action:pan-x!important}
    #mpRoot .mp-ranks div.got{opacity:1;border-color:#664422}
    #mpRoot .mp-ranks div.cur{border-color:#ffd24a;box-shadow:0 0 12px rgba(255,210,74,.4);background:rgba(255,170,0,.12)}
    #mpRoot .mp-ranks span{font-size:24px;display:block}
    #mpRoot .mp-ranks b{display:block;font-size:11px;margin-top:2px}
    #mpRoot .mp-ranks small{font-size:10px;color:#999}
    #mpRoot .mp-avs{display:grid;grid-template-columns:repeat(8,1fr);gap:6px}
    #mpRoot .mp-avs button{aspect-ratio:1;font-size:22px;border-radius:10px;background:rgba(0,0,0,.35);border:1px solid #333;cursor:pointer;padding:0}
    #mpRoot .mp-avs button.sel{border-color:#ffaa33;background:rgba(255,120,0,.25);box-shadow:0 0 10px rgba(255,120,0,.5)}
    #mpRoot .mp-frs{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:8px}
    #mpRoot .mp-frs button{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(0,0,0,.35);border:1px solid #333;border-radius:12px;padding:10px 4px;color:#fff;cursor:pointer;font-family:inherit}
    #mpRoot .mp-frs button b{font-size:12px}
    #mpRoot .mp-frs button small{font-size:10px;color:#aaa}
    #mpRoot .mp-frs button.sel{border-color:#ffd24a;background:rgba(255,170,0,.15)}
    #mpRoot .mp-frs button.lock{opacity:.5;filter:grayscale(.7);cursor:default}
    #mpRoot .mp-chat{height:150px;overflow-y:auto;background:rgba(0,0,0,.4);border-radius:10px;padding:8px;font-size:13px;line-height:1.45;touch-action:pan-y!important}
    #mpRoot .mp-chat div{margin-bottom:3px;word-wrap:break-word}
    #mpRoot .mp-chat b{color:#ffcc88}
    #mpRoot .mp-chat .me b{color:#8dffcf}
    #mpRoot .mp-chat .sys{color:#888;font-size:12px;font-style:italic}
    #mpRoot .mp-quick{display:flex;gap:5px;overflow-x:auto;margin-top:6px;touch-action:pan-x!important}
    #mpRoot .mp-quick button{flex:0 0 auto;background:rgba(255,255,255,.07);border:1px solid #444;color:#ddd;border-radius:14px;padding:5px 10px;font-size:12px;cursor:pointer;touch-action:pan-x!important}
    @media (max-width:520px){#mpRoot .mp-tiles{grid-template-columns:repeat(2,1fr)}#mpRoot .mp-avs{grid-template-columns:repeat(6,1fr)}#mpRoot .mp-time .big b{font-size:36px}}
    @keyframes mkBob{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-3px) rotate(4deg)}}
    @media (max-width:520px){#mpRoot .mp-modes{grid-template-columns:1fr}#mpRoot .mp-mode{display:flex;align-items:center;gap:10px;text-align:left}#mpRoot .mp-mode b{margin:0}#mpRoot .mp-code{font-size:30px}}
    `;
    let touchDown = false, scrollT = null;
    function mount() {
        if ($('#mpRoot')) return;
        const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
        const d = document.createElement('div');
        d.innerHTML = `<div id="mpRoot"><div class="mp-scr"><div class="mp-wrap" id="mpBody"></div></div></div>
            <div id="mpCount"><div id="mpCountNum">3</div><div class="lbl" id="mpCountLbl"></div></div>
            <div id="mpHud"><div class="bar"><span class="tm" id="mpTimer">00:00</span><button class="hb" id="mpMicBtn" title="Mikrofon">🎤</button><button class="hb" id="mpEndBtn" title="Maçı bitir" style="display:none">⏹</button></div><div id="mpChips"></div><div id="mpFeed"></div></div>
            <div id="mpDeath"><b id="mpDeathT"></b><span id="mpDeathS"></span></div>
            <div id="mpToast"></div><div id="mpAudio" style="position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden"></div>`;
        while (d.firstChild) document.body.appendChild(d.firstChild);
        $('#mpMicBtn').onclick = toggleMic; $('#mpEndBtn').onclick = hostEndNow;
        // Oyun içinde bir oyuncunun adına dokun: onu sessize al / aç
        $('#mpChips').addEventListener('click', (e) => { const c = e.target.closest('.c'); if (c && c.dataset.id) toggleMute(c.dataset.id); });
        $('#mpRoot').addEventListener('click', onClick);
        $('#mpRoot').addEventListener('input', onInput);
        $('#mpRoot').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'mpChatIn') { e.preventDefault(); sendChat(e.target.value); e.target.value = ''; } else if (e.key === 'Enter' && e.target.id === 'mpJoinCode') joinRoom(e.target.value, false); });
        const rt = $('#mpRoot');
        rt.addEventListener('pointerdown', () => { touchDown = true; }, { passive: true });
        const up = () => { if (!touchDown) return; touchDown = false; if (render.pending) setTimeout(render, 60); };
        ['pointerup', 'pointercancel', 'touchend', 'touchcancel'].forEach(ev => rt.addEventListener(ev, up, { passive: true }));
        rt.querySelector('.mp-scr').addEventListener('scroll', () => { clearTimeout(scrollT); touchDown = true; scrollT = setTimeout(() => { touchDown = false; if (render.pending) render(); }, 180); }, { passive: true });
        document.addEventListener('pointerdown', unlockAudio, { passive: true });
    }
    let toastT = null;
    function toast(t, c) { const el = $('#mpToast'); if (!el) return; el.textContent = t; el.style.borderColor = c || '#ffaa33'; el.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => el.style.display = 'none', 3200); }
    function feed(t, c) {
        if (document.body.classList.contains('m')) return; // mobilde maç bildirimleri hiç gösterilmez (ekranı bölmesin)
        // Bilgisayarda oyunun kenar bildirimlerine gider (ekranın ortasını kapatmaz, kısa görünür)
        if (window.sideNote) { window.sideNote(t, c || '#fff', false); return; }
        const f = $('#mpFeed'); if (!f) return;
        const d = document.createElement('div'); d.textContent = t; d.style.color = c || '#fff'; f.prepend(d);
        while (f.children.length > 4) f.lastChild.remove();
        setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 4500);
    }
    function statsLine(p) {
        if (!p) return '<div class="mp-stats"><span>Skor yükleniyor…</span></div>';
        return `<div class="mp-stats"><span>⏱ ${fmtPlay(p.play_seconds || 0)}</span><span>🎮 ${p.matches || 0} maç</span><span>🏆 ${p.wins || 0} galibiyet</span><span>🔥 ${p.kills || 0} öldürme</span><span>👑 ${p.boss_kills || 0} boss</span><span>🏰 ${p.hives || 0} kovan</span></div>`;
    }
    function skinCard(id) { return window.BORU ? BORU.skinInfo(id || 'magma') : { icon: '🐉', name: id, color: '#fff' }; }
    function profOf(id) { if (id === me.id) return localProfile(); const p = S.profiles[id], m = member(id); if (!p && !m) return null; return Object.assign({ name: m ? m.name : 'Ejderha', code: m ? m.code : '', avatar: m && m.av, frame: m && m.fr, play_seconds: m && m.ps, matches: 0, wins: 0, kills: 0, boss_kills: 0, hives: 0, damage: 0, max_level: 1 }, p || {}); }

    function render() {
        if (!$('#mpRoot')) return;
        const root = $('#mpRoot'), body = $('#mpBody');
        root.classList.toggle('on', ['home', 'lobby', 'end', 'profile'].includes(S.screen) && S.open);
        $('#mpCount').classList.toggle('on', S.screen === 'count');
        $('#mpHud').classList.toggle('on', S.screen === 'hud');
        if (S.screen === 'count') { $('#mpCountLbl').textContent = MODES[S.mode].icon + ' ' + MODES[S.mode].name; }
        if (S.screen === 'hud') { renderHud(); return; }
        if (!S.open) return;
        const focus = document.activeElement && document.activeElement.id;
        const html = S.screen === 'home' ? homeHtml() : S.screen === 'lobby' ? lobbyHtml() : S.screen === 'end' ? endHtml() : S.screen === 'profile' ? profileHtml() : '';
        if (html === render.last) return; // aynıysa DOM'a dokunma: dokunuşlar kaybolmasın
        if (touchDown) { render.pending = true; return; } // parmak ekrandayken butonları değiştirme: dokunuş kaybolmasın
        render.pending = false;
        const keep = {}; body.querySelectorAll('input,textarea').forEach(i => { if (i.id) keep[i.id] = i.value; });
        const chatAtEnd = (() => { const c = $('#mpChatLog'); return !c || c.scrollHeight - c.scrollTop - c.clientHeight < 40; })();
        render.last = html; body.innerHTML = html;
        for (const id in keep) { const el = document.getElementById(id); if (el && el.dataset.keep !== undefined) el.value = keep[id]; }
        if (chatAtEnd) scrollChat();
        if (focus) { const el = document.getElementById(focus); if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } }
    }
    function profileMini(p, extra) {
        const rk = rankOf(p.play_seconds || 0);
        return `<div class="mp-me" data-a="profile">${avatarHtml(p.avatar, p.frame, 58)}
            <div class="mp-me-t"><div class="nm">${esc(p.name)}</div><div class="rk">${rk.r.ic} ${rk.r.name}</div>
            <div class="mp-xp"><i style="width:${Math.round(rk.p * 100)}%"></i></div><div class="sub">⏱ ${fmtPlay(p.play_seconds)} oynandı${rk.nx ? ' · ' + rk.nx.ic + ' ' + rk.nx.name + ': ' + rk.nx.h + ' saat' : ''}</div></div>
            ${extra || '<span class="mp-chev">›</span>'}</div>`;
    }
    function lobbyRow(l) {
        const md = MODES[l.mode] || MODES.coop, full = l.n >= (l.max || MAX_PLAYERS), play = l.phase === 'playing';
        const dots = Array.from({ length: l.max || MAX_PLAYERS }, (_, i) => `<i class="${i < l.n ? 'on' : ''}"></i>`).join('');
        return `<div class="mp-lob ${play || full ? 'off' : ''}">
            ${avatarHtml(l.av, l.fr, 40)}
            <div class="mp-lob-t"><div class="nm">${esc(l.lname)}</div><div class="sub"><span class="mtag m-${esc(l.mode)}">${md.icon} ${md.name}</span> 👑 ${esc(l.host || '')}</div><div class="mp-dots">${dots}<b>${l.n}/${l.max || MAX_PLAYERS}</b></div></div>
            ${play ? '<span class="mp-pill warn">⚔️ MAÇTA</span>' : full ? '<span class="mp-pill">DOLU</span>' : `<button class="mp-btn go sm" data-a="joinc" data-c="${esc(l.code)}" ${S.busy ? 'disabled' : ''}>KATIL</button>`}</div>`;
    }
    function homeHtml() {
        const p = localProfile();
        const open = DIR.list.filter(l => l.phase !== 'playing' && l.n < (l.max || MAX_PLAYERS)).length;
        const list = !DIR.ready ? '<div class="mp-empty"><span class="mp-spin"></span> Lobiler yükleniyor…</div>'
            : DIR.list.length ? DIR.list.slice(0, 20).map(lobbyRow).join('') : '<div class="mp-empty">🌙 Şu an açık lobi yok.<br><b>İlk lobiyi sen kur</b>, diğer oyuncular buradan görüp katılsın!</div>';
        const cm = S.cMode;
        return `<button class="mp-x" data-a="close">✖</button>
        <h2><span class="mp-h2i">⚔️</span> ÇEVRİMİÇİ SAVAŞ</h2>
        <div class="mp-card glow">${profileMini(p)}
            <div class="mp-row" style="margin-top:10px"><input id="mpName" maxlength="14" placeholder="Ejderhanın adı" value="${esc(me.name)}" data-keep><span class="mp-id" data-a="copyid" title="Kopyala">${esc(me.code || (TEST ? 'TEST' : 'ID alınıyor…'))}</span></div>
        </div>
        <div class="mp-grid2">
            <button class="mp-tile t-quick" data-a="quick" ${S.busy ? 'disabled' : ''}><span class="i">⚡</span><b>HIZLI KATIL</b><small>${open ? open + ' açık lobi' : 'boş lobi ara'}</small></button>
            <button class="mp-tile t-new ${S.create ? 'sel' : ''}" data-a="togglecreate"><span class="i">➕</span><b>LOBİ KUR</b><small>adı · mod · gizlilik</small></button>
        </div>
        ${S.create ? `<div class="mp-card mp-create"><h3>🏗️ Yeni lobi</h3>
            <input id="mpLName" maxlength="24" placeholder="${esc((me.name || 'Ejderha') + "'in lobisi")}" data-keep style="width:100%">
            <div class="mp-seg" style="margin-top:8px">${Object.keys(MODES).map(k => `<button class="${cm === k ? 'sel' : ''}" data-a="cmode" data-m="${k}">${MODES[k].icon} ${MODES[k].name}</button>`).join('')}</div>
            <div class="mp-seg" style="margin-top:8px"><button class="${!S.cPriv ? 'sel' : ''}" data-a="cpriv" data-v="0">🌐 Herkese açık</button><button class="${S.cPriv ? 'sel' : ''}" data-a="cpriv" data-v="1">🔒 Sadece kodla</button></div>
            <div class="mp-desc">${S.cPriv ? 'Lobi listede görünmez, sadece oda kodunu bilenler girer.' : 'Lobi aşağıdaki listede herkese görünür.'}</div>
            <button class="mp-btn go big" style="margin-top:8px" data-a="create" ${S.busy ? 'disabled' : ''}>🔥 LOBİYİ KUR</button></div>` : ''}
        ${S.busy ? '<div class="mp-desc"><span class="mp-spin"></span> Bağlanıyor…</div>' : ''}
        ${S.err ? `<div class="mp-err">${esc(S.err)}</div>` : ''}
        <div class="mp-card"><h3>🌐 Açık Lobiler <span class="mp-live">● CANLI</span></h3>${list}</div>
        <div class="mp-card"><h3>🔑 Kodla katıl</h3>
            <div class="mp-row"><input id="mpJoinCode" maxlength="6" placeholder="Oda kodu (ör. K7M2Q)" style="text-transform:uppercase" data-keep><button class="mp-btn blue" data-a="join" ${S.busy ? 'disabled' : ''}>🚪 KATIL</button></div>
        </div>
        ${friendsHtml()}
        <div class="mp-card"><h3>🔎 Arkadaşını ID ile bul</h3>
            <div class="mp-row"><input id="mpFind" placeholder="BÖRÜ-1234" data-keep><button class="mp-btn" data-a="find">Ara</button></div>
            ${S.lookup ? (S.lookup.none ? '<div class="mp-desc">Bu ID ile oyuncu bulunamadı.</div>' : `<div style="margin-top:8px">${profileMini(Object.assign({}, S.lookup), '<span class="mp-chev">›</span>').replace('data-a="profile"', 'data-a="viewp" data-id="' + esc(S.lookup.id) + '"')}</div>${isFriend(S.lookup.id) ? '<div class="mp-desc">✔ Zaten arkadaşın.</div>' : '<button class="mp-btn go" data-a="fadd" style="margin-top:8px">➕ ARKADAŞ EKLE</button>'}<div class="mp-desc">Arkadaş eklersen çevrimiçi olduğunda ve lobi kurduğunda görürsün; link beklemeden tek dokunuşla katılırsın.</div>`) : ''}
        </div>
        <div class="mp-desc">Ücretsiz. Telefon, tablet ve bilgisayardan aynı haritada birlikte oynayın. Maçlar kendi dünyandaki ilerlemeni değiştirmez.</div>`;
    }
    function profileHtml() {
        const own = !S.viewId || S.viewId === me.id;
        const p = own ? localProfile() : (S.profiles[S.viewId] || (S.lookup && S.lookup.id === S.viewId ? S.lookup : null) || profOf(S.viewId));
        if (!p) return `<button class="mp-x" data-a="pback">✖</button><h2>PROFİL</h2><div class="mp-empty">Profil bulunamadı.</div>`;
        const ps = +p.play_seconds || 0, rk = rankOf(ps), t = fmtPlayBig(ps), f = FRAMES[p.frame] || FRAMES.ates;
        let st = {}; if (own) { try { st = BORU.profileStats(); } catch (e) {} }
        const wr = p.matches ? Math.round((p.wins || 0) / p.matches * 100) : 0;
        const tiles = [
            ['🎮', p.matches || 0, 'MAÇ'], ['🏆', p.wins || 0, 'GALİBİYET'], ['📈', '%' + wr, 'KAZANMA'], ['🔥', p.kills || 0, 'ÖLDÜRME'],
            ['👑', p.boss_kills || 0, 'BOSS'], ['🏰', p.hives || 0, 'KOVAN'], ['💥', fmtNum(p.damage || 0), 'HASAR'], ['⭐', p.max_level || st.maxLevel || 1, 'EN YÜKSEK SV']
        ];
        if (own && st.skinTotal) tiles.push(['🐉', st.skins + '/' + st.skinTotal, 'KOSTÜM'], ['🌍', st.worlds || 1, 'DÜNYA']);
        const days = own ? (() => { const out = []; for (let i = 6; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5), k = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); out.push({ l: ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'][d.getDay()], v: PF.days[k] || 0 }); } return out; })() : null;
        const mx = days ? Math.max(600, ...days.map(d => d.v)) : 1;
        return `<button class="mp-x" data-a="pback">✖</button>
        <div class="mp-hero" style="--fa:${f.a};--fb:${f.b}">
            <div class="mp-hero-bg"></div>
            ${avatarHtml(p.avatar, p.frame, 104, 'big')}
            <div class="mp-hero-n">${esc(p.name)}</div>
            <div class="mp-hero-r">${rk.r.ic} ${rk.r.name}</div>
            ${p.code ? `<span class="mp-id" data-a="copyid2" data-c="${esc(p.code)}">${esc(p.code)}</span>` : ''}
            ${p.bio ? `<div class="mp-bio">“${esc(p.bio)}”</div>` : ''}
        </div>
        <div class="mp-card mp-time"><div class="lbl">⏱ TOPLAM OYNAMA SÜRESİ</div>
            <div class="big"><b>${t.h}</b><small>saat</small><b>${String(t.m).padStart(2, '0')}</b><small>dakika</small>${own ? `<b class="sec">${String(t.s).padStart(2, '0')}</b><small>sn</small>` : ''}</div>
            <div class="mp-xp big"><i style="width:${Math.round(rk.p * 100)}%"></i></div>
            <div class="sub">${rk.nx ? `Sonraki rütbe ${rk.nx.ic} <b>${rk.nx.name}</b> → ${fmtPlay(rk.nx.h * 3600 - ps)} kaldı` : '👑 En yüksek rütbedesin!'}${own && PF.sess > 30 ? ' · bu oturum: ' + fmtPlay(PF.sess) : ''}</div>
            ${days ? `<div class="mp-week">${days.map(d => `<div><i style="height:${Math.max(3, Math.round(d.v / mx * 46))}px"></i><span>${d.l}</span></div>`).join('')}</div><div class="mp-desc" style="margin-top:2px">Son 7 gün · bugün ${fmtPlay(days[6].v)}</div>` : ''}
        </div>
        <div class="mp-tiles">${tiles.map(([i, v, l]) => `<div class="mp-tl"><div class="v">${i} ${v}</div><div class="l">${l}</div></div>`).join('')}</div>
        <div class="mp-card"><h3>🎖️ Rütbe yolu</h3><div class="mp-ranks">${RANKS.map(r => `<div class="${hoursOf(ps) >= r.h ? 'got' : ''} ${r === rk.r ? 'cur' : ''}"><span>${r.ic}</span><b>${r.name}</b><small>${r.h} sa</small></div>`).join('')}</div></div>
        ${own ? `<div class="mp-card"><h3>🖼️ Avatar</h3><div class="mp-avs">${AVATARS.map(a => `<button class="${PF.avatar === a ? 'sel' : ''}" data-a="setav" data-v="${a}">${a}</button>`).join('')}</div></div>
        <div class="mp-card"><h3>💠 Çerçeve <small style="color:#999;font-weight:normal">oynadıkça açılır</small></h3><div class="mp-frs">${Object.keys(FRAMES).map(k => { const fr = FRAMES[k], ok = frameOk(k, ps); return `<button class="${PF.frame === k ? 'sel' : ''} ${ok ? '' : 'lock'}" data-a="setfr" data-v="${k}" ${ok ? '' : 'disabled'}>${avatarHtml(PF.avatar, k, 46)}<b>${fr.name}</b><small>${ok ? (PF.frame === k ? '✔ takılı' : 'seç') : '🔒 ' + fr.h + ' saat'}</small></button>`; }).join('')}</div></div>
        <div class="mp-card"><h3>✍️ Hakkımda</h3><div class="mp-row"><input id="mpBio" maxlength="80" placeholder="Ör. Kara deliklerin efendisi. Takıma katıl!" value="${esc(PF.bio)}" data-keep></div></div>
        <div class="mp-card"><h3>🐉 Ejderha adı</h3><div class="mp-row"><input id="mpName" maxlength="14" placeholder="Ejderhanın adı" value="${esc(me.name)}" data-keep></div></div>` : ''}
        <div class="mp-foot"><button class="mp-btn go big" data-a="pback">${S.back === 'lobby' ? '🏠 LOBİYE DÖN' : S.back === 'menu' ? '↩ GERİ' : '⚔️ ÇEVRİMİÇİ SAVAŞA GİT'}</button></div>`;
    }
    function fmtNum(n) { n = +n || 0; return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'B' : String(Math.round(n)); }
    function chatHtml() {
        const rows = S.chat.map(c => c.sys ? `<div class="sys">${esc(c.txt)}</div>` : `<div class="${c.from === me.id ? 'me' : ''}"><b>${esc(c.name)}:</b> ${esc(c.txt)}</div>`).join('') || '<div class="sys">Sohbet burada görünür. Selam ver! 👋</div>';
        return `<div class="mp-card"><h3>💬 Lobi sohbeti</h3><div class="mp-chat" id="mpChatLog">${rows}</div>
            <div class="mp-quick">${['👋 Selam!', '🔥 Hadi başlayalım', '⏳ 1 dk', '👍', '😂', '🐉 GG'].map(q => `<button data-a="qchat" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
            <div class="mp-row" style="margin-top:6px"><input id="mpChatIn" maxlength="140" placeholder="Mesaj yaz…" data-keep enterkeyhint="send"><button class="mp-btn" data-a="chat">➤</button></div></div>`;
    }
    function lobbyHtml() {
        const host = isHost(), mode = MODES[S.mode], blockers = startBlockers();
        const skins = window.BORU ? BORU.skins(S.mode) : [];
        if (!me.skin || !skins.some(s => s.id === me.skin)) { const was = me.skin; me.skin = (skins[0] && skins[0].id) || 'magma'; if (was !== me.skin) pushMeta(); }
        const playing = S.members.find(m => m.id === S.hostId && m.phase === 'playing') && !S.match;
        const players = S.members.map(m => {
            const sk = skinCard(m.skin), p = peers.get(m.id), net = m.id === me.id ? '' : `<span class="mp-net ${p && p.ok() ? 'on' : ''}">${p && p.ok() ? 'bağlı' : 'bağlanıyor'}</span>`;
            const tc = S.mode === 'team' ? TEAMS[m.team === 1 ? 1 : 0].color : sk.color;
            const spk = voice.speaking.has(m.id) ? '🔊' : (m.mic ? '🎤' : '');
            const pp = profOf(m.id) || {}, rk = rankOf(pp.play_seconds || 0);
            return `<div class="mp-pl ${m.ready ? 'isr' : ''}" style="border-left-color:${tc};--tc:${tc}">${avatarHtml(pp.avatar || m.av, pp.frame || m.fr, 46, '')}
                <div class="mp-pl-t" data-a="viewp" data-id="${esc(m.id)}"><div class="nm">${m.id === S.hostId ? '👑 ' : ''}${esc(m.name)}${m.id === me.id ? ' <span class="you">SEN</span>' : ''}</div>
                <div class="sub">${rk.r.ic} ${rk.r.name} · ⏱ ${fmtPlay(pp.play_seconds || 0)}</div>
                <div class="sub"><span style="color:${sk.color}">${sk.icon} ${esc(sk.name)}</span>${S.mode === 'team' ? ' · <b style="color:' + tc + '">' + TEAMS[m.team === 1 ? 1 : 0].name + '</b>' : ''} ${net}</div></div>
                <div class="rt">${spk}${m.id !== me.id && !isFriend(m.id) ? `<button class="mp-btn" style="padding:4px 8px;font-size:13px" data-a="fadd2" data-id="${esc(m.id)}" title="Arkadaş ekle">➕</button>` : ''}${m.id !== me.id && (voice.els.has(m.id) || voice.heard.has(m.id) || m.mic) ? `<button class="mp-btn" style="padding:4px 8px;font-size:13px" data-a="mute" data-id="${esc(m.id)}">${voice.muted.has(m.id) ? '🔇' : '🔈'}</button>` : ''}<span class="rdy ${m.ready ? 'y' : ''}">${m.ready ? 'HAZIR' : 'bekliyor'}</span></div></div>`;
        }).join('');
        const lm = S.lastMatch;
        const last = lm ? `<div class="mp-card"><h3>📜 Bu odadaki son maç · ${MODES[lm.mode] ? MODES[lm.mode].icon + ' ' + MODES[lm.mode].name : ''}</h3>
            <div class="mp-desc" style="text-align:left">🏆 ${esc(lm.winner || '-')} · ⏱ ${fmtTime((lm.duration_s || 0) * 1000)}</div>${boardTable(lm.results || [], lm.mode)}</div>` : '';
        const empty = Array.from({ length: Math.max(0, Math.min(MAX_PLAYERS, 4) - S.members.length) }, () => '<div class="mp-pl ghost"><span class="mp-av empty" style="--sz:46px"><i>+</i></span><div class="sub">Boş yer · davet linki gönder</div></div>').join('');
        return `<button class="mp-x" data-a="leave" title="Lobiden çık">✖</button>
        <h2><span class="mp-h2i">🏠</span> ${esc(S.lname || 'LOBİ')}</h2>
        <div class="mp-card glow" style="text-align:center"><div class="sub" style="font-size:12px;color:#aaa">ODA KODU · arkadaşlarına gönder</div>
            <div class="mp-code" data-a="copycode">${esc(S.code)}</div>
            <div class="mp-desc" style="margin-top:0">${S.pub ? '🌐 Açık lobi listesinde görünüyor' : '🔒 Gizli · sadece kodla girilir'}${host ? ` · <a href="#" data-a="togglepub" style="color:#ffcc66">${S.pub ? 'gizle' : 'herkese aç'}</a>` : ''}</div>
            <div class="mp-row" style="justify-content:center;margin-top:6px"><button class="mp-btn" data-a="share">📤 Davet Linki Gönder</button><button class="mp-btn ${voice.on ? 'ok' : ''}" data-a="mic">${voice.on ? '🎤 Mikrofon Açık' : '🎤 Sesli Sohbet'}</button></div>
        </div>
        ${playing ? '<div class="mp-card" style="text-align:center;color:#ffd24a">⚔️ Bu odada maç sürüyor. Bitince bir sonrakine katılabilirsin.</div>' : ''}
        <div class="mp-card"><h3>🎮 Mod ${host ? '(sen seçiyorsun)' : '(oda sahibi seçer)'}</h3>
            <div class="mp-modes">${Object.keys(MODES).map(k => `<div class="mp-mode ${S.mode === k ? 'sel' : ''} ${host ? '' : 'lock'}" data-a="mode" data-m="${k}"><span class="i">${MODES[k].icon}</span><div><b>${MODES[k].name}</b><small>${MODES[k].tag}</small></div></div>`).join('')}</div>
            <div class="mp-desc">${mode.desc}</div>
            <div class="mp-tags">${(mode.tags || []).join('')}</div>
        </div>
        <div class="mp-card"><h3>🐉 Ejderhan <span class="cnt">${S.mode === 'coop' ? 'Birlikte: tüm kostümler açık, yalnızca görünüş' : skins.length + ' kostüm'}</span></h3>
            <div class="mp-skins">${skins.map(s => `<div class="mp-skin ${me.skin === s.id ? 'sel' : ''}" style="--sc:${s.color}" data-a="skin" data-s="${esc(s.id)}"><span class="i">${s.icon}</span>${esc(s.name)}</div>`).join('')}</div>
            ${S.mode === 'team' ? `<div class="mp-teams" style="margin-top:10px">${TEAMS.map((t, i) => `<button class="mp-btn" style="border-color:${t.color};${S.team === i ? 'background:' + t.color + '55' : ''}" data-a="team" data-t="${i}">${S.team === i ? '✔ ' : ''}${t.name} Takım</button>`).join('')}</div>` : ''}
        </div>
        <div class="mp-card"><h3>👥 Oyuncular (${S.members.length}/${MAX_PLAYERS}) <span class="mp-live">${S.members.filter(m => m.ready).length} hazır</span></h3>${players}${empty}</div>
        ${S.err ? `<div class="mp-err">${esc(S.err)}</div>` : ''}
        ${chatHtml()}
        ${last}
        <div class="mp-foot"><button class="mp-btn big ${S.ready ? 'ok' : ''}" data-a="ready">${S.ready ? '✅ HAZIRSIN (iptal için dokun)' : '✋ HAZIRIM'}</button>
        ${host ? `<button class="mp-btn go big" style="margin-top:10px" data-a="start" ${blockers.length ? 'disabled' : ''}>⚔️ MAÇI BAŞLAT</button>${blockers.length ? `<div class="mp-warn">${esc(blockers.join(' · '))}</div>` : ''}` : '<div class="mp-desc" style="margin-top:8px">Herkes hazır olunca oda sahibi maçı başlatır.</div>'}</div>`;
    }
    function boardTable(board, mode) {
        const rows = [...board].sort((a, b) => (b.alive - a.alive) || (b.pk - a.pk) || (b.k - a.k));
        return `<table><tr><th class="l">Oyuncu</th>${mode !== 'coop' ? '<th>⚔️ Yaktı</th>' : ''}<th>🦇 Düşman</th><th>🏰 Kovan</th><th>👑 Boss</th><th>💥 Hasar</th><th>💀</th><th>⭐ Sv</th></tr>
            ${rows.map((b, i) => `<tr class="${b.id === me.id ? 'me' : ''} ${i === 0 ? 'first' : ''}"><td class="l" style="color:${mode === 'team' ? TEAMS[b.team === 1 ? 1 : 0].color : '#fff'}">${skinCard(b.skin).icon} ${esc(b.name)}${b.id === me.id ? ' (sen)' : ''}</td>${mode !== 'coop' ? `<td>${b.pk}</td>` : ''}<td>${b.k}</td><td>${b.hv}</td><td>${b.bs}</td><td>${Math.round(b.dl)}</td><td>${b.dh}</td><td>${b.lv}</td></tr>`).join('')}</table>`;
    }
    function endHtml() {
        const M = S.match, m = M && M.result; if (!m) return '';
        const title = M.mode === 'coop' ? (m.winner.kind === 'none' ? '🤝 MAÇ BİTTİ' : '🏆 ZAFER!') : (M.won ? '🏆 ZAFER!' : '💀 YENİLGİ');
        const col = M.won ? '#ffd24a' : (M.mode === 'coop' ? '#8dffcf' : '#ff5566');
        const hc = M.won ? 'rgba(255,200,40,.35)' : (M.mode === 'coop' ? 'rgba(60,255,180,.25)' : 'rgba(255,40,60,.3)');
        return `<h2>SONUÇ</h2>
        <div class="mp-sub">${MODES[M.mode].icon} ${MODES[M.mode].name}</div>
        <div class="mp-hero" style="--hc:${hc}"><div class="mp-win" style="color:${col};text-shadow:0 0 24px ${col}">${title}</div>
        <div class="mp-desc" style="font-size:15px;color:#eee;margin-top:4px">🏆 ${esc(m.winner.label)} · ⏱ ${fmtTime(m.dur * 1000)}</div></div>
        <div class="mp-card"><h3>📊 Skor tablosu</h3>${boardTable(m.board, M.mode)}</div>
        <div class="mp-card"><h3>📈 Genel skorun</h3>${statsLine(S.profiles[me.id])}</div>
        ${rematchHtml(M)}
        ${S.room ? chatHtml() : ''}
        <button class="mp-btn big" style="margin-top:10px" data-a="relobby">🏠 LOBİYE DÖN (${esc(M.room)})</button>
        <button class="mp-btn big" style="margin-top:10px" data-a="menu">↩ ANA MENÜ</button>`;
    }
    function rematchHtml(M) {
        const others = S.members.filter(m => m.id !== me.id);
        const voted = others.filter(m => m.rm || M.rm.has(m.id));
        const list = others.length ? `<div class="mp-desc">${others.map(m => (m.rm || M.rm.has(m.id) ? '✅ ' : '⏳ ') + esc(m.name)).join(' · ')}</div>` : '<div class="mp-desc">Odada başka oyuncu kalmadı.</div>';
        if (isHost()) return `<button class="mp-btn go big" data-a="rematch" ${S.members.length < 2 ? 'disabled' : ''}>🔁 YENİDEN BAŞLAT (aynı ekip)</button>${list}${others.length && voted.length === others.length ? '<div class="mp-desc" style="color:#33ff99">Herkes hazır, maç başlıyor…</div>' : ''}`;
        return `<button class="mp-btn big ${S.rmVote ? 'ok' : 'go'}" data-a="rematch">${S.rmVote ? '✅ YENİDEN OYNAMAYA HAZIRSIN' : '🔁 YENİDEN BAŞLAT'}</button><div class="mp-desc">${S.rmVote ? 'Herkes hazır olunca ya da oda sahibi başlatınca maç yeniden başlar.' : 'Bas: oda sahibine yeniden oynamak istediğini söyler.'}</div>${list}`;
    }
    function renderChips() {
        const M = S.match, el = $('#mpChips'); if (!M || !el || S.screen !== 'hud') return;
        const html = [...M.roster.values()].map(r => {
            const st = r.id === me.id ? BORU.localState() : M.states.get(r.id);
            const hp = st ? Math.max(0, Math.min(1, st.hp / (st.mh || 1))) : 1;
            const dead = M.left.has(r.id) || !isAlive(r.id);
            const c = M.mode === 'team' ? TEAMS[r.team].color : (r.id === me.id ? '#ffd24a' : skinCard(st && st.sk || r.skin).color || '#888');
            let net = '';
            if (r.id !== me.id && !M.left.has(r.id)) { const p = peers.get(r.id), st2 = M.states.get(r.id); if (p && p.okS()) { const ms = Math.round(p.rtt / 20) * 10; /* 10 ms adımlarla: şerit her ölçümde yeniden çizilmesin */ net = ms ? ' <span style="color:' + (ms < 80 ? '#6f6' : ms < 180 ? '#fd4' : '#f66') + '">' + ms + 'ms</span>' : ''; } else net = st2 && performance.now() - st2.t < 2000 ? ' <span style="color:#fd4">📡</span>' : ' <span style="color:#f66">⚠</span>'; }
            return `<div class="c ${dead ? 'dead' : ''} ${r.id === me.id ? 'me' : ''} ${voice.speaking.has(r.id) ? 'spk' : ''}" data-id="${r.id === me.id ? '' : esc(r.id)}" style="--cc:${c}">${voice.muted.has(r.id) ? '🔇' : voice.speaking.has(r.id) ? '🔊' : ''}${esc(r.name)}${M.left.has(r.id) ? ' 🚪' : ''}${net}<div class="h"><i style="width:${Math.round(hp * 100)}%;background:${hostileTo(r.id) ? '#ff4455' : '#33ff88'}"></i></div></div>`;
        }).join('');
        if (html !== renderChips.last) { renderChips.last = html; el.innerHTML = html; } // değişmediyse DOM'a dokunma (kasmayı önler)
    }
    function renderHud() {
        const M = S.match; if (!M || S.screen !== 'hud') return;
        $('#mpTimer').textContent = '⏱ ' + fmtTime(M.startedAt ? Date.now() - M.startedAt : 0) + ' · ' + MODES[M.mode].icon;
        $('#mpMicBtn').classList.toggle('on', voice.on); $('#mpMicBtn').textContent = voice.on ? '🎤' : '🔇';
        $('#mpEndBtn').style.display = isHost() ? 'inline-block' : 'none';
        renderChips();
        const dl = $('#mpDeath'), dead = window.BORU && BORU.isDead();
        dl.classList.toggle('on', !!dead);
        if (dead) {
            if (M.mode === 'coop') { $('#mpDeathT').textContent = '💀 DÜŞTÜN'; $('#mpDeathS').textContent = 'Sığınakta yeniden doğuyorsun: ' + fmtTime(Math.max(0, M.reviveAt - performance.now()) + 999); }
            else { $('#mpDeathT').textContent = '💀 ELENDİN'; $('#mpDeathS').textContent = 'Savaşı izliyorsun · kalan: ' + aliveGroups().label; }
        }
    }
    function onInput(e) {
        if (e.target.id === 'mpBio') { PF.bio = e.target.value.slice(0, 80); savePF(); clearTimeout(onInput.b); onInput.b = setTimeout(() => syncExtras(true), 1200); return; }
        if (e.target.id === 'mpName') { me.name = e.target.value.slice(0, 14); LS.setItem('boruMpName', me.name); clearTimeout(onInput.t); onInput.t = setTimeout(() => { saveProfile().then(render); pushMeta(); }, 700); }
    }
    async function onClick(e) {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a !== 'chat' && b.tagName === 'A') e.preventDefault();
        if (a === 'close') { S.open = false; render(); }
        else if (a === 'profile') { S.back = S.screen === 'profile' ? S.back : S.screen; S.viewId = null; S.screen = 'profile'; render(); $('#mpRoot .mp-scr').scrollTop = 0; }
        else if (a === 'viewp') { const id = b.dataset.id; if (!id) return; S.back = S.screen; S.viewId = id; S.screen = 'profile'; if (id !== me.id && !S.profiles[id]) fetchProfiles([id]); render(); $('#mpRoot .mp-scr').scrollTop = 0; }
        else if (a === 'pback') { const bk = S.back; S.viewId = null; if (bk === 'menu') { S.open = false; S.screen = S.room ? 'lobby' : 'home'; } else S.screen = (bk === 'lobby' && S.room) ? 'lobby' : (bk === 'end' && S.match && S.match.over) ? 'end' : 'home'; render(); renderMenuProfile(); }
        else if (a === 'setav') { PF.avatar = b.dataset.v; savePF(); syncExtras(true); pushMeta(); render(); renderMenuProfile(); }
        else if (a === 'setfr') { if (!frameOk(b.dataset.v, myPlay())) return; PF.frame = b.dataset.v; savePF(); syncExtras(true); pushMeta(); render(); renderMenuProfile(); }
        else if (a === 'quick') quickJoin();
        else if (a === 'togglecreate') { S.create = !S.create; S.err = ''; render(); }
        else if (a === 'cmode') { S.cMode = b.dataset.m; render(); }
        else if (a === 'cpriv') { S.cPriv = b.dataset.v === '1'; render(); }
        else if (a === 'joinc') joinRoom(b.dataset.c, false);
        else if (a === 'togglepub') { if (!isHost()) return; S.pub = !S.pub; try { sessionStorage.setItem('boruLobby_' + S.code, JSON.stringify({ pub: S.pub, lname: S.lname })); } catch (er) {} pushMeta(); render(); }
        else if (a === 'chat') { const i = $('#mpChatIn'); if (i) { sendChat(i.value); i.value = ''; i.focus(); } }
        else if (a === 'qchat') sendChat(b.dataset.v);
        else if (a === 'copycode') { try { await navigator.clipboard.writeText(S.code); toast('Oda kodu kopyalandı: ' + S.code); } catch (er) {} }
        else if (a === 'copyid2') { try { await navigator.clipboard.writeText(b.dataset.c); toast('ID kopyalandı: ' + b.dataset.c); } catch (er) {} }
        else if (a === 'create') joinRoom(newCode(), true, { mode: S.cMode, priv: S.cPriv, lname: (($('#mpLName') || {}).value || '').trim() });
        else if (a === 'join') joinRoom(($('#mpJoinCode') || {}).value, false);
        else if (a === 'leave') leaveRoom();
        else if (a === 'mode') setMode(b.dataset.m);
        else if (a === 'skin') setSkin(b.dataset.s);
        else if (a === 'team') setTeam(+b.dataset.t);
        else if (a === 'ready') toggleReady();
        else if (a === 'start') hostStart();
        else if (a === 'mic') toggleMic();
        else if (a === 'mute') toggleMute(b.dataset.id);
        else if (a === 'relobby') backToLobby();
        else if (a === 'rematch') voteRematch();
        else if (a === 'menu') backToMenu();
        else if (a === 'copycode') { try { await navigator.clipboard.writeText(S.code); toast('Oda kodu kopyalandı: ' + S.code); } catch (er) {} }
        else if (a === 'fadd') { if (S.lookup && !S.lookup.none) addFriend(S.lookup); }
        else if (a === 'fadd2') { const m = member(b.dataset.id); if (m) addFriend({ id: m.id, code: m.code, name: m.name, skin: m.skin }); }
        else if (a === 'fdel') delFriend(b.dataset.id);
        else if (a === 'fjoin') joinRoom(b.dataset.room, false);
        else if (a === 'fwatch') specStart(b.dataset.room);
        else if (a === 'fvis') { LS.setItem('boruMpVis', vis() ? '0' : '1'); lobbyTrack(true); render(); }
        else if (a === 'spstop') specStop();
        else if (a === 'copyid') { try { await navigator.clipboard.writeText(me.code); toast('ID kopyalandı: ' + me.code); } catch (er) {} }
        else if (a === 'share') {
            const u = new URL(location.href); u.search = ''; u.searchParams.set('oda', S.code); const link = u.toString();
            const text = 'Börü: Son Kral\'da bana katıl! Oda kodu: ' + S.code;
            try { if (navigator.share) await navigator.share({ title: 'Börü: Son Kral', text, url: link }); else { await navigator.clipboard.writeText(text + ' ' + link); toast('Davet linki kopyalandı'); } } catch (er) {}
        }
        else if (a === 'find') {
            const q = (($('#mpFind') || {}).value || '').trim().toUpperCase().replace(/^BORU-/, 'BÖRÜ-').replace(/^(\d{4})$/, 'BÖRÜ-$1');
            if (!q) return; S.lookup = null;
            try { const r = await findProfileByCode(q); S.lookup = r || { none: true }; } catch (er) { S.lookup = { none: true }; }
            render();
        }
    }
    // ------------------------------------------------------------------ ARKADAŞLAR · AKTİF ARKADAŞLAR · İZLE
    // Arkadaş listesi cihazda tutulur. Çevrimiçi durumu, kurulan lobi ve maç bilgisi ortak bir "presence" kanalından (boru-lobi) gelir;
    // böylece arkadaşın lobi kurunca link beklemeden tek dokunuşla katılırsın, maçtaysa izleyebilirsin.
    const FR_KEY = 'boruMpFriends';
    let friends = (() => { try { const a = JSON.parse(LS.getItem(FR_KEY) || '[]'); return Array.isArray(a) ? a.filter(f => f && f.id).slice(0, 50) : []; } catch (e) { return []; } })();
    const saveFriends = () => { try { LS.setItem(FR_KEY, JSON.stringify(friends)); } catch (e) {} };
    const isFriend = (id) => friends.some(f => f.id === id);
    const vis = () => LS.getItem('boruMpVis') !== '0';
    function addFriend(p) {
        if (!p || !p.id || p.id === me.id || isFriend(p.id)) return;
        friends.push({ id: p.id, code: p.code || '', name: p.name || 'Ejderha', skin: p.dragon || p.skin || 'magma' }); saveFriends();
        toast('➕ ' + (p.name || 'Ejderha') + ' arkadaş eklendi', '#33ff99'); lobbyConnect(); render();
    }
    function delFriend(id) { friends = friends.filter(f => f.id !== id); saveFriends(); render(); }
    const LB = { room: null, online: new Map(), last: '', connecting: false };
    function lobbyMeta() {
        const inMatch = S.match && !S.match.over;
        return { id: me.id, code: me.code, name: me.name, skin: me.skin, room: (vis() && S.room) ? S.code : '', ph: inMatch ? 'playing' : 'lobby', mode: S.mode, n: S.members.length, max: MAX_PLAYERS };
    }
    async function lobbyConnect() {
        if (LB.room || LB.connecting || !me.name || !me.code) return;
        LB.connecting = true;
        try {
            const room = TEST ? new TestRoom('LOBI') : new SbRoom('LOBI', 'boru-lobi');
            await room.join(lobbyMeta(), () => {}, (members) => {
                const m = new Map(); for (const x of members) if (x && x.id && x.id !== me.id) m.set(x.id, x);
                lobbyOnSync(m);
            });
            LB.room = room; LB.last = JSON.stringify(lobbyMeta());
        } catch (e) { console.warn('Arkadaş bağlantısı kurulamadı', e); }
        LB.connecting = false;
    }
    function lobbyTrack(force) {
        if (!LB.room) return; const meta = lobbyMeta(), j = JSON.stringify(meta);
        if (!force && j === LB.last) return; LB.last = j; LB.room.track(meta);
    }
    function lobbyOnSync(m) {
        const prev = LB.online; LB.online = m; let ch = false;
        for (const f of friends) {
            const o = m.get(f.id); if (!o) continue;
            if (o.name && o.name !== f.name) { f.name = o.name; ch = true; }
            const was = prev.get(f.id);
            if (o.room && o.ph === 'lobby' && !S.room && !S.match && (!was || was.room !== o.room)) toast('🏠 ' + o.name + ' lobi kurdu (' + o.n + '/' + o.max + ') — Arkadaşlar\'dan katıl', '#33ff99');
            else if (!was && !S.room && !S.match && S.open) toast('🟢 ' + o.name + ' çevrimiçi', '#8dffcf');
        }
        if (ch) saveFriends(); render();
    }
    setInterval(() => { if (!LB.room) { if (friends.length || S.open) lobbyConnect(); } else lobbyTrack(); }, 2500);
    function friendsHtml() {
        const list = friends.slice().sort((a, b) => (LB.online.has(b.id) ? 1 : 0) - (LB.online.has(a.id) ? 1 : 0));
        const onl = list.filter(f => LB.online.has(f.id)).length;
        const rows = list.map(f => {
            const o = LB.online.get(f.id), sk = skinCard(o ? o.skin : f.skin), md = o && MODES[o.mode] ? MODES[o.mode].icon + ' ' + MODES[o.mode].name : '';
            let st = '<span class="sub">⚫ Çevrimdışı</span>', act = '';
            if (o) {
                if (o.room && o.ph === 'playing') { st = `<span class="sub" style="color:#ffd24a">⚔️ Maçta · ${esc(md)} · ${o.n} oyuncu</span>`; act = `<button class="mp-btn blue" data-a="fwatch" data-room="${esc(o.room)}">👁️ İZLE</button>`; }
                else if (o.room) { st = `<span class="sub" style="color:#33ff99">🟢 Lobide · ${o.n}/${o.max} · ${esc(md)}</span>`; act = o.n >= o.max ? '<span class="sub">Dolu</span>' : `<button class="mp-btn go" data-a="fjoin" data-room="${esc(o.room)}" ${S.busy ? 'disabled' : ''}>🚪 KATIL</button>`; }
                else st = '<span class="sub" style="color:#8dffcf">🟢 Çevrimiçi</span>';
            }
            return `<div class="mp-pl"><span class="ic">${sk.icon}</span><div><div class="nm">${esc(o ? o.name : f.name)} <span class="sub">${esc(f.code)}</span></div>${st}</div><div class="rt">${act}<button class="mp-btn" style="padding:4px 8px;font-size:13px" data-a="fdel" data-id="${esc(f.id)}" title="Arkadaşlıktan çıkar">✖</button></div></div>`;
        }).join('');
        return `<div class="mp-card"><h3>👥 Arkadaşların · ${onl} çevrimiçi</h3>${rows || '<div class="mp-desc">Henüz arkadaşın yok. Aşağıdan ID ile bulup ekle; lobide ➕ ile de ekleyebilirsin.</div>'}
            <button class="mp-btn" style="margin-top:8px" data-a="fvis">${vis() ? '👁️ Odam arkadaşlarıma görünür' : '🙈 Odam gizli (dokun: göster)'}</button></div>`;
    }
    // --- İzleme: oda sahibi saniyede bir anlık görüntü yayınlar; izleyici odaya üye olmadan sadece dinler
    const SP = { room: null, snap: null, at: 0, code: '', raf: 0, disp: new Map(), lastList: '' };
    function sendSpec(over, win) {
        const M = S.match; if (!M || !S.room || !window.BORU) return;
        const pl = [];
        for (const r of M.roster.values()) {
            const st = r.id === me.id ? BORU.localState() : (M.states.get(r.id) || {}), sx = r.id === me.id ? BORU.stats() : (M.stats.get(r.id) || {});
            pl.push({ id: r.id, n: r.name, sk: r.skin, tm: r.team || 0, x: st.x, y: st.y, hp: st.hp, mh: st.mh, d: (M.left.has(r.id) || st.d) ? 1 : 0, k: sx.k || 0, hv: sx.hv || 0, bs: sx.bs || 0 });
        }
        S.room.send({ t: 'spec', from: me.id, snap: { el: M.startedAt ? Date.now() - M.startedAt : 0, mode: M.mode, pl, over: !!over, win: win || '' } });
    }
    function specMount() {
        if ($('#mpSpec')) return;
        const st = document.createElement('style');
        st.textContent = `#mpSpec{position:fixed;inset:0;z-index:640;background:#05070c;display:none;color:#fff;font-family:inherit;grid-template-columns:1fr minmax(190px,34%);grid-template-rows:auto 1fr}
        #mpSpec.on{display:grid}
        #mpSpec .sp-top{grid-column:1/-1;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 12px 8px;background:rgba(0,0,0,.6);border-bottom:1px solid #334}
        #mpSpec .sp-top b{flex:1;font-size:14px;letter-spacing:2px;color:#8ab4ff} #mpSpec .sp-top .tm{font-family:monospace;font-size:15px}
        #mpSpec .sp-x{background:rgba(255,40,70,.18);border:2px solid #ff4466;color:#fff;border-radius:10px;padding:8px 12px;font-weight:bold;cursor:pointer;touch-action:manipulation}
        #mpSpecCv{width:100%;height:100%;display:block;min-height:0}
        #mpSpecList{overflow-y:auto;padding:8px;background:rgba(10,12,20,.9);border-left:1px solid #334;touch-action:pan-y;font-size:12px}
        #mpSpecList .r{padding:6px 8px;margin-bottom:6px;border-radius:8px;background:rgba(255,255,255,.05);border-left:3px solid #888}
        #mpSpecList .r.d{opacity:.45} #mpSpecList .hp{height:5px;background:#222;border-radius:3px;margin:4px 0;overflow:hidden} #mpSpecList .hp i{display:block;height:100%}
        #mpSpecList .s{color:#bbc;font-size:11px}
        #mpSpecMsg{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,.8);border:1px solid #ffd24a;border-radius:12px;padding:10px 16px;text-align:center;max-width:60vw;display:none}
        @media (orientation:portrait){#mpSpec{grid-template-columns:1fr;grid-template-rows:auto 1fr 38%}#mpSpecList{border-left:0;border-top:1px solid #334}}`;
        document.head.appendChild(st);
        const d = document.createElement('div'); d.id = 'mpSpec';
        d.innerHTML = '<div class="sp-top"><b>👁️ CANLI İZLE</b><span class="tm" id="mpSpecTm">⏱ 00:00</span><button class="sp-x" data-a="spstop">✖ Çık</button></div><div style="position:relative;min-height:0"><canvas id="mpSpecCv"></canvas><div id="mpSpecMsg"></div></div><div id="mpSpecList"></div>';
        document.body.appendChild(d); d.addEventListener('click', onClick);
    }
    async function specStart(code) {
        if (S.room || SP.room) return;
        if (TEST) { toast('Test modunda izleme yok', '#ff5555'); return; }
        specMount(); SP.code = code; SP.snap = null; SP.at = 0; SP.disp.clear(); SP.lastList = '';
        S.open = false; render(); $('#mpSpec').classList.add('on'); $('#mpSpecMsg').style.display = 'block'; $('#mpSpecMsg').textContent = '📡 Yayına bağlanılıyor…';
        try {
            const room = new SbRoom(code); SP.room = room;
            await room.join(null, (m) => { if (m && m.t === 'spec' && m.snap) { SP.snap = m.snap; SP.at = performance.now(); } }, () => {}, true);
            specLoop();
        } catch (e) { toast(e.message || 'Bağlanılamadı', '#ff5555'); specStop(); }
    }
    function specStop() {
        cancelAnimationFrame(SP.raf); if (SP.room) { try { SP.room.leave(); } catch (e) {} } SP.room = null; SP.code = '';
        const el = $('#mpSpec'); if (el) el.classList.remove('on'); S.open = true; S.screen = 'home'; render();
    }
    function specLoop() {
        SP.raf = requestAnimationFrame(specLoop);
        const cv = $('#mpSpecCv'); if (!cv || !cv.clientWidth) return;
        const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
        if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
        const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0); c.fillStyle = '#05070c'; c.fillRect(0, 0, W, H);
        const sn = SP.snap, now = performance.now(), msg = $('#mpSpecMsg');
        if (!sn) { msg.style.display = 'block'; msg.textContent = now - (SP.t0 || (SP.t0 = now)) > 8000 ? '⏳ Yayın henüz gelmedi… Maç bitmiş ya da oda sahibi bağlantıda olmayabilir.' : '📡 Yayına bağlanılıyor…'; return; }
        SP.t0 = 0;
        const stale = now - SP.at > 6000;
        msg.style.display = (sn.over || stale) ? 'block' : 'none';
        msg.innerHTML = sn.over ? '🏁 Maç bitti<br><b>' + esc(sn.win || '') + '</b>' : '⏳ Yayın bekleniyor…';
        $('#mpSpecTm').textContent = '⏱ ' + fmtTime(sn.over ? sn.el : sn.el + (now - SP.at)) + ' · ' + (MODES[sn.mode] ? MODES[sn.mode].icon + ' ' + MODES[sn.mode].name : '');
        const pts = sn.pl.filter(p => isFinite(p.x) && isFinite(p.y));
        if (pts.length) {
            for (const p of pts) { const d = SP.disp.get(p.id) || { x: p.x, y: p.y }; d.x += (p.x - d.x) * 0.15; d.y += (p.y - d.y) * 0.15; SP.disp.set(p.id, d); }
            let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
            for (const p of pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, span = Math.max(1600, x1 - x0, y1 - y0), sc = Math.min(W, H) * 0.78 / span;
            SP.sc = (SP.sc || sc) + (sc - (SP.sc || sc)) * 0.08; SP.cx = SP.cx == null ? cx : SP.cx + (cx - SP.cx) * 0.08; SP.cy = SP.cy == null ? cy : SP.cy + (cy - SP.cy) * 0.08;
            const gs = 400 * SP.sc; c.strokeStyle = 'rgba(138,180,255,.08)'; c.lineWidth = 1;
            const ox = (W / 2 - SP.cx * SP.sc) % gs, oy = (H / 2 - SP.cy * SP.sc) % gs;
            for (let x = ox; x < W; x += gs) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
            for (let y = oy; y < H; y += gs) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
            for (const p of pts) {
                const d = SP.disp.get(p.id), sx = W / 2 + (d.x - SP.cx) * SP.sc, sy = H / 2 + (d.y - SP.cy) * SP.sc, col = sn.mode === 'team' ? TEAMS[p.tm === 1 ? 1 : 0].color : skinCard(p.sk).color;
                c.save(); c.translate(sx, sy); c.globalAlpha = p.d ? 0.4 : 1; c.shadowBlur = p.d ? 0 : 14; c.shadowColor = col; c.fillStyle = p.d ? '#666' : col; c.strokeStyle = '#fff'; c.lineWidth = 2;
                c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); c.stroke(); c.shadowBlur = 0;
                c.fillStyle = '#fff'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillText((p.d ? '💀 ' : '') + p.n, 0, -14);
                if (!p.d && p.mh) { c.fillStyle = '#300'; c.fillRect(-18, 13, 36, 5); c.fillStyle = p.hp / p.mh > 0.4 ? '#4f8' : '#f55'; c.fillRect(-18, 13, 36 * Math.max(0, Math.min(1, p.hp / p.mh)), 5); }
                c.restore();
            }
        }
        const rows = sn.pl.slice().sort((a, b) => (a.d - b.d) || (b.k - a.k)).map(p => {
            const col = sn.mode === 'team' ? TEAMS[p.tm === 1 ? 1 : 0].color : skinCard(p.sk).color, f = p.mh ? Math.max(0, Math.min(1, p.hp / p.mh)) : 0;
            return `<div class="r ${p.d ? 'd' : ''}" style="border-left-color:${col}"><b>${skinCard(p.sk).icon} ${esc(p.n)}</b>${p.d ? ' 💀' : ''}<div class="hp"><i style="width:${(f * 100).toFixed(0)}%;background:${f > 0.4 ? '#4f8' : '#f55'}"></i></div><div class="s">🦇 ${p.k} · 🏰 ${p.hv} · 👑 ${p.bs}</div></div>`;
        }).join('');
        if (rows !== SP.lastList) { SP.lastList = rows; $('#mpSpecList').innerHTML = rows; }
    }
    // Oyun dışında dokunulmaz: yalnızca menüden açılır
    window.MPUI = {
        open() {
            mount(); S.open = true;
            if (!me.name) me.name = (window.BORU && BORU.savedName()) || '';
            if (!me.skin && window.BORU) me.skin = BORU.activeSkin();
            if (S.screen !== 'lobby') S.screen = 'home';
            render(); saveProfile().then(() => { render(); lobbyConnect(); }); dirOpen();
        },
        profile() {
            mount(); S.open = true;
            if (!me.name) me.name = (window.BORU && BORU.savedName()) || '';
            if (S.screen !== 'profile') S.back = (S.screen === 'lobby' || S.screen === 'end') ? S.screen : 'menu';
            S.viewId = null; S.screen = 'profile'; render(); saveProfile().then(render);
        },
        _state: S, _me: me, _voice: voice, _peers: peers, _sp: { SP, specMount, specLoop }
    };
    // Davet linkiyle gelindiyse doğrudan odaya gir
    function boot() {
        mount(); prepTurn();
        if (!me.name && window.BORU) { try { me.name = BORU.savedName() || ''; } catch (e) {} }
        renderMenuProfile(); setInterval(renderMenuProfile, 30000);
        setInterval(() => { if (S.open && S.screen === 'profile' && !S.viewId && !(document.activeElement && document.activeElement.tagName === 'INPUT')) render(); }, 1000);
        if (me.code) setTimeout(() => syncExtras(true), 4000);
        const code = new URLSearchParams(location.search).get('oda');
        if (code) { window.MPUI.open(); if (me.name) joinRoom(code, false); else { S.err = 'Odaya katılmak için ejderhana isim ver, sonra KATIL\'a bas.'; render(); setTimeout(() => { const i = $('#mpJoinCode'); if (i) i.value = code; }, 0); } }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
