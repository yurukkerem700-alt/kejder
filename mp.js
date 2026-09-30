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
            if (row) { me.code = row.code; LS.setItem('boruMpCode', me.code); S.profiles[me.id] = row; }
        } catch (e) { console.warn('Profil kaydedilemedi', e); }
    }
    const PROFILE_COLS = 'id,code,name,dragon,matches,wins,kills,boss_kills,hives,damage';
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

    // ------------------------------------------------------------------ ODA BAĞLANTISI (lobi + sinyal)
    class SbRoom {
        constructor(code) { this.code = code; }
        async join(meta, onMsg, onSync) {
            await loadSb();
            this.ch = sb.channel('boru-oda-' + this.code, { config: { presence: { key: me.id }, broadcast: { self: false, ack: false } } });
            this.ch.on('presence', { event: 'sync' }, () => onSync(this.members()));
            this.ch.on('broadcast', { event: 'm' }, (e) => onMsg(e.payload));
            await new Promise((res, rej) => {
                const to = setTimeout(() => rej(new Error('Odaya bağlanılamadı (zaman aşımı).')), 15000);
                this.ch.subscribe((st) => {
                    if (st === 'SUBSCRIBED') { clearTimeout(to); res(); }
                    else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error('Odaya bağlanılamadı (' + st + ').')); }
                });
            });
            await this.ch.track(meta);
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

    // ------------------------------------------------------------------ DURUM
    const S = {
        screen: 'home', room: null, code: '', members: [], hostId: null, mode: 'coop', ready: false, team: 0, joinedAt: 0,
        profiles: {}, lastMatch: null, err: '', busy: false, match: null, lookup: null, seenEid: new Set()
    };
    const peers = new Map();
    const isHost = () => S.hostId === me.id;
    const member = (id) => S.members.find(m => m.id === id);
    const nameOf = (id) => { if (id === me.id) return me.name; const r = S.match && S.match.roster.get(id); if (r) return r.name; const m = member(id); return m ? m.name : 'Ejderha'; };
    function myMeta() {
        return { id: me.id, code: me.code, name: me.name, skin: me.skin, ready: S.ready, team: S.team, joinedAt: S.joinedAt, mode: S.mode,
            phase: S.match && !S.match.over ? 'playing' : 'lobby', mic: voice.on ? 1 : 0, rm: S.rmVote ? 1 : 0 };
    }
    let trackT = null;
    function pushMeta() { clearTimeout(trackT); trackT = setTimeout(() => { if (S.room) S.room.track(myMeta()); }, 60); }

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
            case 'start': onStart(m); break;
            case 'end': onEnd(m); break;
            case 'vs': setRemoteSpeaking(m.from, m.on); break;
            case 'vc': playRelay(m.from, m.d); break;
            // Ortak veri (Birlikte modu)
            case 'hv': if (M && window.BORU && M.roster.has(m.from)) { if (M.mode === 'coop' && m.id) BORU.allyCapturedHive(m.id); if (poolsWith(m.from)) BORU.setAllyHives(m.from, m.n); } break;
            case 'bhgo': if (M && M.mode === 'coop' && window.BORU && M.startedAt && !M.over) { feed('🕳️ ' + nameOf(m.from) + ' kara deliğe girdi — herkes içeri çekiliyor!', '#b77bff'); BORU.netEnterBH(m.lvl); } break;
            case 'bhwin': if (M && M.mode === 'coop' && window.BORU) { feed('🏆 Kara delik bossu yenildi!', '#ffd24a'); BORU.netBhWin(m.lvl); } break;
            case 'bd': if (M && M.mode === 'coop' && window.BORU && BORU.bhIsAuth()) BORU.bossDamageIn(m.d); break;
            case 'rm': if (M && M.over) { M.rm.add(m.from); if (isHost()) toast('🔁 ' + nameOf(m.from) + ' yeniden oynamak istiyor', '#ffd24a'); render(); checkRematchVotes(); } break;
        }
    }

    // ------------------------------------------------------------------ ODA GİRİŞ / ÇIKIŞ
    const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function newCode() { let s = ''; for (let i = 0; i < 5; i++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; }
    async function joinRoom(code, creating) {
        code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        if (code.length < 4) { S.err = 'Oda kodu en az 4 karakter olmalı.'; render(); return; }
        if (!me.name.trim()) { S.err = 'Önce ejderhana bir isim ver.'; render(); return; }
        S.err = ''; S.busy = true; render();
        try {
            await Promise.all([saveProfile(), prepTurn()]);
            const room = TEST ? new TestRoom(code) : new SbRoom(code);
            S.code = code; S.joinedAt = Date.now(); S.ready = false; S.mode = 'coop'; S.team = 0;
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
            fetchLastMatch(code); render();
        } catch (e) { S.busy = false; S.room = null; S.err = e.message || 'Bağlanılamadı.'; render(); }
    }
    function leaveRoom() {
        if (S.room) S.room.leave(); S.room = null;
        for (const p of peers.values()) p.close(); peers.clear();
        S.members = []; S.screen = 'home'; S.hostId = null;
        try { const u = new URL(location.href); u.searchParams.delete('oda'); history.replaceState(null, '', u.toString()); } catch (e) {}
        render();
    }
    window.addEventListener('pagehide', () => { if (S.room) S.room.leave(); });
    function onSync(members) {
        const uniq = new Map(); for (const m of members) if (m && m.id) uniq.set(m.id, m);
        S.members = [...uniq.values()].sort((a, b) => (a.joinedAt - b.joinedAt) || (a.id < b.id ? -1 : 1));
        const host = S.members[0]; S.hostId = host ? host.id : me.id;
        if (host && host.id !== me.id && host.mode && host.mode !== S.mode) { S.mode = host.mode; if (S.mode !== 'team') S.team = 0; else autoTeam(); }
        syncPeers();
        const need = S.members.map(m => m.id).filter(id => !S.profiles[id]); if (need.length) fetchProfiles(need);
        if (S.match && !S.match.over) checkEnd();
        if (S.match && S.match.over) checkRematchVotes();
        render();
    }
    function autoTeam() {
        const c = [0, 0]; for (const m of S.members) if (m.id !== me.id) c[m.team === 1 ? 1 : 0]++;
        S.team = c[1] < c[0] ? 1 : 0;
    }

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
    let lastSend = 0, lastRelay = 0, lastHud = 0, lastStats = 0, seq = 0;
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
        try { BORU.endMatch(); } catch (e) {}
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
    @media (max-width:520px){#mpRoot .mp-modes{grid-template-columns:1fr}#mpRoot .mp-mode{display:flex;align-items:center;gap:12px;text-align:left;padding:10px 12px}#mpRoot .mp-mode b{margin:0}#mpRoot .mp-code i{width:40px;height:50px;font-size:26px}#mpRoot h2{font-size:21px}}
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
        // Maç bildirimleri oyunun kenar bildirimlerine gider (ekranın ortasını kapatmaz, kısa görünür)
        if (window.sideNote) { window.sideNote(t, c || '#fff', false); return; }
        const f = $('#mpFeed'); if (!f) return;
        const d = document.createElement('div'); d.textContent = t; d.style.color = c || '#fff'; f.prepend(d);
        while (f.children.length > 4) f.lastChild.remove();
        setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 700); }, 4500);
    }
    function statsLine(p) {
        if (!p) return '<div class="mp-stats"><span>Skor yükleniyor…</span></div>';
        return `<div class="mp-stats"><span>🎮 ${p.matches} maç</span><span>🏆 ${p.wins} galibiyet</span><span>🔥 ${p.kills} öldürme</span><span>👑 ${p.boss_kills} boss</span><span>🏰 ${p.hives} kovan</span></div>`;
    }
    function skinCard(id) { return window.BORU ? BORU.skinInfo(id || 'magma') : { icon: '🐉', name: id, color: '#fff' }; }

    function render() {
        if (!$('#mpRoot')) return;
        const root = $('#mpRoot'), body = $('#mpBody');
        root.classList.toggle('on', ['home', 'lobby', 'end'].includes(S.screen) && S.open);
        $('#mpCount').classList.toggle('on', S.screen === 'count');
        $('#mpHud').classList.toggle('on', S.screen === 'hud');
        if (S.screen === 'count') { $('#mpCountLbl').textContent = MODES[S.mode].icon + ' ' + MODES[S.mode].name; }
        if (S.screen === 'hud') { renderHud(); return; }
        if (!S.open) return;
        const focus = document.activeElement && document.activeElement.id;
        const html = S.screen === 'home' ? homeHtml() : S.screen === 'lobby' ? lobbyHtml() : S.screen === 'end' ? endHtml() : '';
        if (html === render.last) return; // aynıysa DOM'a dokunma: dokunuşlar kaybolmasın
        if (touchDown) { render.pending = true; return; } // parmak ekrandayken butonları değiştirme: dokunuş kaybolmasın
        render.pending = false;
        render.last = html; body.innerHTML = html;
        if (focus) { const el = document.getElementById(focus); if (el && el.tagName === 'INPUT') { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (e) {} } }
    }
    function homeHtml() {
        const p = S.profiles[me.id];
        return `<button class="mp-x" data-a="close" aria-label="Kapat">✕</button>
        <h2>ARKADAŞLARLA OYNA</h2>
        <div class="mp-sub">Aynı gökyüzü · en fazla ${MAX_PLAYERS} ejderha · sesli sohbet</div>
        <div class="mp-card"><h3>🐉 Profilin</h3>
            <div class="mp-row"><input id="mpName" maxlength="14" placeholder="Ejderhanın adı" value="${esc(me.name)}"><span class="mp-id" data-a="copyid" title="Kopyala">${esc(me.code || 'ID alınıyor…')}</span></div>
            ${statsLine(p)}
        </div>
        <div class="mp-card"><h3>🏠 Lobi</h3>
            <button class="mp-btn go big" data-a="create" ${S.busy ? 'disabled' : ''}>➕ YENİ LOBİ KUR</button>
            <div class="mp-or">YA DA KODLA KATIL</div>
            <div class="mp-row"><input id="mpJoinCode" maxlength="6" placeholder="Oda kodu (ör. K7M2Q)" style="text-transform:uppercase"><button class="mp-btn blue" data-a="join" ${S.busy ? 'disabled' : ''}>🚪 KATIL</button></div>
            ${S.busy ? '<div class="mp-desc">Bağlanıyor…</div>' : ''}
            ${S.err ? `<div class="mp-err">${esc(S.err)}</div>` : ''}
        </div>
        <div class="mp-card"><h3>🔎 Arkadaşını ID ile bul</h3>
            <div class="mp-row"><input id="mpFind" placeholder="BÖRÜ-1234"><button class="mp-btn" data-a="find">Ara</button></div>
            ${S.lookup ? (S.lookup.none ? '<div class="mp-desc">Bu ID ile oyuncu bulunamadı.</div>' : `<div class="mp-pl" style="margin-top:8px"><span class="ic">${skinCard(S.lookup.dragon).icon}</span><div><div class="nm">${esc(S.lookup.name)} <span class="sub">${esc(S.lookup.code)}</span></div>${statsLine(S.lookup)}</div></div><div class="mp-desc">Onu oyuna çağırmak için lobi kur ve oda kodunu gönder.</div>`) : ''}
        </div>
        <div class="mp-desc">Ücretsiz. Aynı haritada telefon, tablet ve bilgisayardan birlikte oynayabilirsiniz. Maçlar kendi dünyandaki ilerlemeni değiştirmez.</div>`;
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
            return `<div class="mp-pl ${m.id === me.id ? 'me' : ''}" style="--pc:${tc}"><span class="ic ${voice.speaking.has(m.id) ? 'spk' : ''}">${sk.icon}</span>
                <div style="min-width:0"><div class="nm">${m.id === S.hostId ? '👑 ' : ''}${esc(m.name)}${m.id === me.id ? ' <span class="sub">(sen)</span>' : ''} <span class="sub">${esc(m.code || '')}</span></div>
                <div class="sub">${esc(sk.name)}${S.mode === 'team' ? ' · <b style="color:' + tc + '">' + TEAMS[m.team === 1 ? 1 : 0].name + '</b>' : ''} ${net}</div>${statsLine(S.profiles[m.id])}</div>
                <div class="rt">${spk}${m.id !== me.id && (voice.els.has(m.id) || voice.heard.has(m.id) || m.mic) ? `<button class="mp-btn" style="padding:4px 8px;font-size:13px" data-a="mute" data-id="${esc(m.id)}">${voice.muted.has(m.id) ? '🔇' : '🔈'}</button>` : ''}<span class="rdy ${m.ready ? 'y' : ''}">${m.ready ? 'HAZIR' : 'bekliyor'}</span></div></div>`;
        }).join('');
        const lm = S.lastMatch;
        const last = lm ? `<div class="mp-card"><h3>📜 Bu odadaki son maç · ${MODES[lm.mode] ? MODES[lm.mode].icon + ' ' + MODES[lm.mode].name : ''}</h3>
            <div class="mp-desc" style="text-align:left">🏆 ${esc(lm.winner || '-')} · ⏱ ${fmtTime((lm.duration_s || 0) * 1000)}</div>${boardTable(lm.results || [], lm.mode)}</div>` : '';
        const empty = Math.max(0, Math.min(2, MAX_PLAYERS - S.members.length));
        return `<button class="mp-x" data-a="leave" title="Lobiden çık" aria-label="Lobiden çık">✕</button>
        <h2>LOBİ</h2>
        <div class="mp-sub">${mode.icon} ${esc(mode.name)} · ${S.members.length}/${MAX_PLAYERS} oyuncu</div>
        <div class="mp-card mp-codebox"><div class="mp-lbl">Oda kodu · arkadaşlarına gönder</div>
            <div class="mp-code" data-a="copycode" title="Kopyala">${[...String(S.code)].map(ch => '<i>' + esc(ch) + '</i>').join('')}</div>
            <div class="mp-row" style="justify-content:center"><button class="mp-btn" data-a="share">📤 Davet Linki Gönder</button><button class="mp-btn ${voice.on ? 'ok' : ''}" data-a="mic">${voice.on ? '🎤 Mikrofon Açık' : '🎤 Sesli Sohbet'}</button></div>
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
        <div class="mp-card"><h3>👥 Oyuncular <span class="cnt">${S.members.filter(m => m.ready).length}/${S.members.length} hazır</span></h3>${players}${'<div class="mp-empty">➕ Boş yer · oda kodunu paylaş</div>'.repeat(empty)}</div>
        ${S.err ? `<div class="mp-err">${esc(S.err)}</div>` : ''}
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
        if (e.target.id === 'mpName') { me.name = e.target.value.slice(0, 14); LS.setItem('boruMpName', me.name); clearTimeout(onInput.t); onInput.t = setTimeout(() => { saveProfile().then(render); pushMeta(); }, 700); }
    }
    async function onClick(e) {
        const b = e.target.closest('[data-a]'); if (!b) return;
        const a = b.dataset.a;
        if (a === 'close') { S.open = false; render(); }
        else if (a === 'create') joinRoom(newCode(), true);
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
    // Oyun dışında dokunulmaz: yalnızca menüden açılır
    window.MPUI = {
        open() {
            mount(); S.open = true;
            if (!me.name) me.name = (window.BORU && BORU.savedName()) || '';
            if (!me.skin && window.BORU) me.skin = BORU.activeSkin();
            if (S.screen !== 'lobby') S.screen = 'home';
            render(); saveProfile().then(render);
        },
        _state: S, _me: me, _voice: voice, _peers: peers
    };
    // Davet linkiyle gelindiyse doğrudan odaya gir
    function boot() {
        mount(); prepTurn();
        const code = new URLSearchParams(location.search).get('oda');
        if (code) { window.MPUI.open(); if (me.name) joinRoom(code, false); else { S.err = 'Odaya katılmak için ejderhana isim ver, sonra KATIL\'a bas.'; render(); setTimeout(() => { const i = $('#mpJoinCode'); if (i) i.value = code; }, 0); } }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
