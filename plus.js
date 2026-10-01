// =====================================================================
// BÖRÜ+ : oyunun mevcut sistemlerine DOKUNMADAN eklenen içerik paketi.
// Ana betikteki (index.html) global fonksiyonlar sarmalanır; ana kod hiç değiştirilmez.
//  - 7 yeni ejderha kostümü (seviye 104-150, kendi pasif yetenekleriyle)
//  - 4 yeni karaborsa eşyası, 3 yeni iksir (5-6-7 tuşları)
//  - Başarımlar (coin ve iksir ödüllü), günlük giriş ödülü (7 günlük seri)
//  - Kombo sistemi (art arda yakılan ruhlar bonus coin verir)
//  - PC: F tam ekran, P duraklat, K başarımlar, FPS göstergesi
//  - Mobil: titreşim, arka plana geçince otomatik duraklat + kayıt, ekranı açık tutma
// Çok oyunculu maçta (store.mem) ilerleme verisi yazılmaz; başarım/günlük sayaçları sadece kendi dünyanda işler.
// =====================================================================
(function () {
    'use strict';
    if (typeof skinsDB === 'undefined' || typeof store === 'undefined') return;
    const $ = (id) => document.getElementById(id);
    const inMatch = () => !!(store.mem || MP.active || (window.BORU && BORU.matchActive));
    const safe = (fn) => { try { return fn(); } catch (e) { console.warn('Börü+', e); } };

    // Tüm dünyalarda ortak ayarlar
    ['boruPlusUi'].forEach(k => GLOBAL_KEYS.add(k));
    const PUI = Object.assign({ fps: false, haptics: true, autoPause: true, wakeLock: true }, (() => { try { return JSON.parse(store.getItem('boruPlusUi')) || {}; } catch (e) { return {}; } })());
    const savePUI = () => store.setItem('boruPlusUi', JSON.stringify(PUI));

    // Dünyaya özel istatistikler
    const PS = Object.assign({ kills: 0, playSec: 0, bestWave: 1, bestCombo: 0, runs: 0 }, safeParseJSON('boruPlusStats', {}));
    let achDone = safeParseJSON('boruPlusAch', {});
    let daily = Object.assign({ last: '', streak: 0, best: 0 }, safeParseJSON('boruPlusDaily', {}));
    const savePS = () => { if (!inMatch()) store.setItem('boruPlusStats', JSON.stringify(PS)); };

    // Menüdeyken kazanılan / harcanan coin'i kayda yaz (eskiden menüdeki alışverişler kayda geçmiyordu)
    function persistCoins() {
        if (inMatch() || worldWriteLocked) return;
        safe(() => {
            const raw = store.getItem('boruSaveState');
            if (raw) { const s = JSON.parse(raw); s.coins = coins; store.setItem('boruSaveState', JSON.stringify(s)); }
            store.setItem('boruBackupCoins', coins);
        });
    }
    function afterCoinChange() {
        const cc = $('coinCount'); if (cc) cc.innerText = coins;
        if (gameActive) saveGameForce(); else persistCoins();
        safe(() => { if ($('marketModal').style.display === 'flex') updateMarketUI(); if (!gameActive) renderMenuStats(); });
    }
    function buzz(p) { if (PUI.haptics && navigator.vibrate) safe(() => navigator.vibrate(p)); }

    // =====================================================================
    // 1) YENİ KOSTÜMLER: veri odaklı organik ejderha çizimi (ORG_SKINS) ile, çizim kodu değişmeden
    // =====================================================================
    const NEW_SKINS = [
        { id: 'akay', name: 'Ak Ay Ejderi', icon: '🌕', reqLvl: 104, reqCoin: 12400, mainColor: '#cfe6ff', fireColor1: '#ffffff', fireColor2: '#6a9aff',
          desc: 'Ay ışığından dökülmüş sedef halkalı gövde, geyik boynuzları ve yelpaze kuyruk. YETENEK: gece rüzgârı - süzülme hızı +%8.',
          pal: { body: ['#f4f8ff', '#9aaccc', '#1a2238'], ridge: '#ffffff', scale: '#c8d6f0', scaleEdge: '#ffffff', irid: true,
                 membrane: ['#dfeaff', '#6a86c0', '#0e1630'], vein: '#a8c8ff', horn: ['#ffffff', '#cdd8ec', '#4a5670'], bone: '#f8fbff', eye: '#bfe0ff' },
          cfg: { skin: 'rings', wing: 'membrane', horn: 'antler', tail: 'fan', tailExt: 0.45, neck: 0.3, neckW: 0.38, whisk: true, thick: 0.9,
                 wings: [{ pos: 0.38, ws: 0.95 }, { pos: 0.56, ws: 0.6 }] } },
        { id: 'zumrut', name: 'Zümrüt Hakanı', icon: '💚', reqLvl: 108, reqCoin: 12800, mainColor: '#2aff9a', fireColor1: '#eaffd0', fireColor2: '#0a8a4a',
          desc: 'Zümrüt pullar, altın kenarlı sırt, altı boynuzlu taç ve kulak yüzgeçleri. YETENEK: hazine kokusu - kazanılan coin +%10.',
          pal: { body: ['#6affc0', '#0e7a4a', '#021a0e'], ridge: '#fff0a0', scale: '#18a060', scaleEdge: '#ffd24a',
                 membrane: ['#8affd0', '#1a8a5a', '#03200e'], vein: '#ffd24a', horn: ['#fff6c8', '#d8b04a', '#3a2a08'], bone: '#fff4d0', eye: '#ffd24a' },
          cfg: { wing: 'membrane', horn: 'six', tail: 'spade', tailExt: 0.2, earFins: true, dorsalGlow: true, thick: 1.1, arms: true } },
        { id: 'sahmaransoyu', name: 'Şahmaran Soyu', icon: '🐍', reqLvl: 114, reqCoin: 13400, mainColor: '#ffcf3a', fireColor1: '#fff6c0', fireColor2: '#3a8a1a',
          desc: 'Yılanların kraliçesinin kanatsız soyu: benekli altın gövde, açılan yaka, uzun kuğu boynu. YETENEK: kadim zehir - can çalma +%6.',
          pal: { body: ['#ffe07a', '#9a6a10', '#1e1202'], ridge: '#fff4c0', scale: '#c89a2a', scaleEdge: '#2a1a02',
                 membrane: ['#ffd86a', '#7a5010', '#1a1002'], vein: '#7aff4a', horn: ['#fff8d8', '#c8a040', '#2a1a02'], bone: '#fff0c0', eye: '#7aff4a' },
          cfg: { skin: 'spots', wing: 'none', wings: [], horn: 'flame', frill: true, tail: 'spike', tailExt: 0.7, neck: 0.34, neckW: 0.4, thick: 0.85, taper: 0.7 } },
        { id: 'karakus', name: 'Karakuş', icon: '🦅', reqLvl: 120, reqCoin: 14000, mainColor: '#ffb020', fireColor1: '#fff0c0', fireColor2: '#8a2a00',
          desc: 'Gökleri karartan kara kartal-ejder: yırtık kara kanatlar, altın damarlar, tüy kuyruk. YETENEK: pençe keskinliği - kritik şansı +%8.',
          pal: { body: ['#4a4038', '#16100c', '#030202'], ridge: '#ffd27a', scale: '#2a221c', scaleEdge: '#ffb020',
                 membrane: ['#3a3028', '#140e0a', '#030202'], vein: '#ffb020', horn: ['#fff0c8', '#a07a3a', '#1a1004'], bone: '#2a2018', eye: '#ffcc33' },
          cfg: { wing: 'tatter', horn: 'swept', tail: 'plume', tailExt: 0.3, neck: 0.12, neckW: 0.55, thick: 1.0, arms: true, roar: 'blades',
                 wings: [{ pos: 0.14, ws: 1.25 }, { pos: 0.32, ws: 0.7 }] } },
        { id: 'gokbori', name: 'Gök Börü', icon: '🐺', reqLvl: 128, reqCoin: 14800, mainColor: '#5ac8ff', fireColor1: '#ffffff', fireColor2: '#1a5aff',
          desc: 'Atalarının yolunu gösteren gök kurdu ejderhası: şimşekli kanatlar, kulak yüzgeçleri, bıyıklar. YETENEK: atalar bilgisi - kazanılan XP +%10.',
          pal: { body: ['#a8dcff', '#2a6ab0', '#04142a'], ridge: '#e8f6ff', scale: '#4a8ad0', scaleEdge: '#e8f6ff',
                 membrane: ['#2a5a9a', '#0e2a5a', '#020a1a'], vein: '#8ae0ff', bolt: '#e8faff', horn: ['#ffffff', '#b0c8e0', '#2a3a50'], bone: '#eaf4ff', eye: '#e8faff' },
          cfg: { wing: 'storm', horn: 'swept', earFins: true, whisk: true, tail: 'plume', tailExt: 0.35, neck: 0.16, neckW: 0.5, thick: 0.95 } },
        { id: 'erlik', name: 'Erlik\'in Ejderi', icon: '🔱', reqLvl: 138, reqCoin: 15600, mainColor: '#ff2a4a', fireColor1: '#ffd0d8', fireColor2: '#2a0008',
          desc: 'Yeraltı hükümdarının iki başlı bekçisi: kan kırmızısı plaka zırh, çatlaklarından kan sızan gövde, orak kanatlar. YETENEK: yeraltı ateşi - ateş hasarı +%10.',
          pal: { body: ['#5a1a22', '#1e0508', '#050001'], ridge: '#ff8a9a', scale: '#3a0a12', scaleEdge: '#ff2a4a',
                 membrane: ['#5a0a14', '#22020a', '#080002'], vein: '#ff2a4a', horn: ['#ffe0e4', '#8a3a44', '#1a0206'], bone: '#e8d0d4', eye: '#ffea6a' },
          cfg: { skin: 'plates', wing: 'scythe', horn: 'ram', cracks: true, heads: 2, tail: 'fork', tailExt: 0.25, neck: 0.22, neckW: 0.45, thick: 1.1, beam: 'vortex',
                 wings: [{ pos: 0.3, ws: 1.1 }] } },
        { id: 'tengri', name: 'Tengri\'nin Ejderi', icon: '☀️', reqLvl: 150, reqCoin: 17000, mainColor: '#ffe27a', fireColor1: '#ffffff', fireColor2: '#ffb000',
          desc: 'Son seviyenin tek ödülü: gök tanrısının ışığından örülmüş altın gövde, üç çift alev kanat, geyik boynuzları. YETENEK: gök nuru - can sürekli yenilenir.',
          pal: { body: ['#fff6d0', '#e0a820', '#3a2402'], ridge: '#ffffff', scale: '#f0c850', scaleEdge: '#ffffff', irid: true,
                 membrane: ['#fff2b0', '#ffb000', '#4a2000'], flame: ['#ffffff', '#ffd24a', 'rgba(255,140,0,0)'], vein: '#fff2a0', horn: ['#ffffff', '#ffe08a', '#6a4a08'], bone: '#fffbe8', eye: '#ffffff' },
          cfg: { wing: 'flame', horn: 'antler', whisk: true, tail: 'fan', tailExt: 0.4, neck: 0.22, neckW: 0.45, thick: 1.05, headScale: 1.05,
                 wings: [{ pos: 0.3, ws: 1.05 }, { pos: 0.46, ws: 0.8 }, { pos: 0.6, ws: 0.55 }] } }
    ];
    const SKIN_PASSIVE = { akay: 'speed', zumrut: 'gold', sahmaransoyu: 'leech', karakus: 'crit', gokbori: 'xp', erlik: 'fire', tengri: 'regen' };
    safe(() => {
        let tier = Math.max(0, ...skinsDB.map(s => s.tier || 0));
        for (const s of NEW_SKINS) {
            if (skinsDB.some(q => q.id === s.id)) continue;
            ORG_SKINS[s.id] = Object.assign({ pal: s.pal }, s.cfg);
            skinsDB.push({ id: s.id, name: s.name, icon: s.icon, desc: s.desc, reqLvl: s.reqLvl, reqCoin: s.reqCoin, mainColor: s.mainColor, uiColor: s.mainColor,
                fireColor1: s.fireColor1, fireColor2: s.fireColor2, body: s.pal.body, eyeColor: s.pal.eye, tier: ++tier });
        }
        // Kayıtlı kostüm yeni bir kostümse (ana betik yüklenirken henüz yoktu) şimdi kuşan
        const saved = store.getItem('boruActiveSkin');
        if (saved && saved !== activeTheme.id && skinsDB.some(q => q.id === saved)) { activeSkinId = saved; activeTheme = skinsDB.find(q => q.id === saved); applyThemeColors(); }
    });
    const skinPassive = () => (MP.noSkinBuffs ? null : SKIN_PASSIVE[activeTheme && activeTheme.id]) || null; // Birlikte modunda kostüm gücü yok

    // =====================================================================
    // 2) YENİ KARABORSA EŞYALARI ve İKSİRLER
    // =====================================================================
    [
        { id: 'goldTalisman', name: 'Altın Tılsım', icon: '🪙', desc: 'Kazanılan tüm coinleri %20 artırır.', cost: 1600, color: '#ffcc33' },
        { id: 'ironHide', name: 'Demir Deri', icon: '🦾', desc: 'Gelen tüm hasarı %12 azaltır.', cost: 1700, color: '#b0c4d8' },
        { id: 'emberRegen', name: 'Kor Yenilenmesi', icon: '💗', desc: '4 saniye hasar almazsan canın saniyede %1 yenilenir.', cost: 1900, color: '#ff6a8a' },
        { id: 'sageEye', name: 'Bilge Gözü', icon: '👁️', desc: 'Kazanılan XP\'yi %15 artırır.', cost: 1500, color: '#a88cff' }
    ].forEach(it => { if (!blackMarketDB.some(q => q.id === it.id)) blackMarketDB.push(it); });

    const NEW_POTIONS = [
        { id: 'healPotion', name: 'Şifa İksiri', icon: '💖', desc: 'Canının yarısını anında doldurur.', cost: 140, color: '#ff5a8a', duration: 0 },
        { id: 'goldPotion', name: 'Servet İksiri', icon: '🪙', desc: '30sn boyunca kazanılan coin iki katına çıkar.', cost: 180, color: '#ffcc33', duration: 1800 },
        { id: 'xpPotion', name: 'Bilgelik İksiri', icon: '📘', desc: '30sn boyunca kazanılan XP iki katına çıkar.', cost: 180, color: '#66aaff', duration: 1800 }
    ];
    NEW_POTIONS.forEach(p => { if (!potionsDB.some(q => q.id === p.id)) potionsDB.push(p); if (potionInventory[p.id] === undefined) potionInventory[p.id] = 0; activePotions[p.id] = 0; });
    safe(renderPotionBar);

    const _usePotion = usePotion;
    usePotion = window.usePotion = function (id) {
        const before = potionInventory[id] || 0;
        const r = _usePotion.apply(this, arguments);
        if ((potionInventory[id] || 0) < before && id === 'healPotion') {
            dragonHp = Math.min(maxHp, dragonHp + maxHp * 0.5); updateUI();
            safe(() => showWaveText('💖 ŞİFA', false, '#ff5a8a'));
        }
        if ((potionInventory[id] || 0) < before) buzz(15);
        return r;
    };

    // Coin ve XP çarpanları (eşya + iksir + kostüm yeteneği)
    const _earn = earn;
    earn = function (n) {
        let m = 1;
        if (equippedBlackMarket.goldTalisman) m *= 1.2;
        if (activePotions.goldPotion > 0) m *= 2;
        if (skinPassive() === 'gold') m *= 1.1;
        return _earn(n * m);
    };
    const _gainXp = gainXp;
    gainXp = function (amount) {
        let m = 1;
        if (equippedBlackMarket.sageEye) m *= 1.15;
        if (activePotions.xpPotion > 0) m *= 2;
        if (skinPassive() === 'xp') m *= 1.1;
        return _gainXp.call(this, amount * m);
    };
    // Kostüm yetenekleri: kalıcı istatistik bonusları
    const _abmb = applyBlackMarketBuffs;
    applyBlackMarketBuffs = function () {
        const r = _abmb.apply(this, arguments);
        const p = skinPassive();
        if (p === 'speed') stats.baseMaxSpeed *= 1.08;
        else if (p === 'leech') stats.lifeStealChance += 6;
        else if (p === 'crit') stats.critChance += 8;
        else if (p === 'fire') stats.fireDamage *= 1.1;
        return r;
    };
    safe(applyBlackMarketBuffs);

    // Hasar: Demir Deri, yenilenme zamanlayıcısı, titreşim
    let lastHurtF = -99999, lastBuzz = 0;
    const _hurt = hurtPlayer;
    hurtPlayer = function (pl, amt, shake) {
        if (equippedBlackMarket.ironHide) amt *= 0.88;
        const r = _hurt.call(this, pl, amt, shake);
        if (r) {
            lastHurtF = gFrame;
            const now = performance.now();
            if (amt > maxHp * 0.04 && now - lastBuzz > 350) { lastBuzz = now; buzz(amt > maxHp * 0.12 ? 60 : 25); }
        }
        return r;
    };

    // =====================================================================
    // 3) KOMBO SİSTEMİ + oyun içi kare takibi (yenilenme, FPS)
    // =====================================================================
    const combo = { n: 0, t: 0, last: 0, runBest: 0 };
    let fpsFrames = 0;
    const comboEl = document.createElement('div'); comboEl.id = 'pxCombo'; document.body.appendChild(comboEl);
    function comboEnd() {
        if (combo.n >= 10 && !TUT.active) {
            const bonus = earn(Math.pow(combo.n, 1.15) * 0.6);
            coins += bonus; const cc = $('coinCount'); if (cc) cc.innerText = coins;
            comboEl.innerHTML = `<b>${combo.n}x</b> KOMBO<small>+${bonus} 💰</small>`; comboEl.className = 'show end';
            setTimeout(() => { if (combo.n === 0) comboEl.className = ''; }, 1600);
        } else comboEl.className = '';
        combo.n = 0;
    }
    const _step = gameStep;
    gameStep = function () {
        const r = _step.apply(this, arguments);
        if (!gameActive || isPaused) return r;
        if (!Object.prototype.hasOwnProperty.call(ctx, 'fill')) fpsFrames++;
        // Kombo: skor her arttığında zincir uzar, 2.5 sn boyunca yeni ruh yakılmazsa zincir biter
        const d = score - combo.last; combo.last = score;
        if (d > 0 && d < 1000) {
            if (!inMatch()) PS.kills += d;
            combo.n += d <= 5 ? d : 1; combo.t = 150;
            if (combo.n > combo.runBest) combo.runBest = combo.n;
            if (combo.n > PS.bestCombo && !inMatch()) PS.bestCombo = combo.n;
            if (combo.n >= 5) { comboEl.innerHTML = `<b>${combo.n}x</b> KOMBO`; comboEl.className = 'show' + (combo.n >= 50 ? ' hot' : combo.n >= 25 ? ' warm' : ''); }
        } else if (combo.n && --combo.t <= 0) comboEnd();
        // Yenilenme (Kor Yenilenmesi eşyası / Tengri kostümü)
        const regen = (equippedBlackMarket.emberRegen && gFrame - lastHurtF > 240 ? 0.01 : 0) + (skinPassive() === 'regen' ? 0.006 : 0);
        if (regen && dragonHp > 0 && dragonHp < maxHp) { dragonHp = Math.min(maxHp, dragonHp + maxHp * regen / 60); if ((gFrame & 15) === 0) updateUI(); }
        return r;
    };

    // Yeni tur başlangıcı / ölüm özeti
    let runStart = 0, runStartCoins = 0;
    const _prep = prepGameStart;
    prepGameStart = function () {
        combo.n = 0; combo.t = 0; combo.last = score; combo.runBest = 0; runStart = Date.now(); runStartCoins = coins;
        if (!inMatch()) { PS.runs++; savePS(); }
        const r = _prep.apply(this, arguments);
        setTimeout(() => safe(() => { if (!inMatch() && !store.getItem('boruPlusSeenV1')) { store.setItem('boruPlusSeenV1', '1'); hintToast('✨ YENİ: kombo zinciri, başarımlar, günlük ödül, 3 yeni iksir (5-6-7) ve 7 yeni kostüm!', '#ffd24a', 7000); } }), 6000);
        return r;
    };
    const _death = handlePlayerDeath;
    handlePlayerDeath = function () {
        const r = _death.apply(this, arguments);
        safe(() => {
            if (combo.n) comboEnd();
            let el = $('pxRunSummary');
            if (!el) { el = document.createElement('div'); el.id = 'pxRunSummary'; const note = $('gameOverNote'); note.parentNode.insertBefore(el, note.nextSibling); }
            const sec = Math.max(0, Math.round((Date.now() - runStart) / 1000));
            const gained = Math.max(0, coins - runStartCoins);
            el.innerHTML = [['⏱️', Math.floor(sec / 60) + ' dk ' + (sec % 60) + ' sn', 'SÜRE'], ['👑', level, 'SEVİYE'], ['⛓️', combo.runBest + 'x', 'EN İYİ KOMBO'], ['💰', '+' + gained, 'KAZANILAN COIN'], ['🏆', Object.keys(achDone).length + '/' + ACH.length, 'BAŞARIM']]
                .map(([i, v, l]) => `<div><b>${i} ${v}</b><span>${l}</span></div>`).join('');
            buzz([80, 60, 120]);
        });
        return r;
    };
    const _lvl = levelUp;
    levelUp = function () { const r = _lvl.apply(this, arguments); buzz(30); return r; };

    // Menü alışverişleri artık kayda geçer (eskiden oyun dışındayken saveGame hiçbir şey yazmıyordu)
    const _save = saveGame;
    saveGame = function () {
        const r = _save.apply(this, arguments);
        if (!gameActive && $('startScreen').style.display !== 'none' && $('gameOverScreen').style.display !== 'flex') persistCoins();
        return r;
    };

    // =====================================================================
    // 4) BAŞARIMLAR
    // =====================================================================
    const royalsDown = () => { try { return ROYALS.filter(r => royalDead(r.id)).length; } catch (e) { return 0; } };
    const G = (fn) => () => { try { return fn() || 0; } catch (e) { return 0; } };
    const ACH = [];
    const A = (id, icon, name, desc, get, target, reward) => ACH.push({ id, icon, name, desc, get, target, reward });
    const kills = G(() => PS.kills), lvl = G(() => maxLevelReached), hv = G(() => totalHivesCapturedLifetime);
    A('k100', '🔥', 'İlk Kıvılcım', '100 ruh yak', kills, 100, { c: 100 });
    A('k1000', '🔥', 'Yangın', '1.000 ruh yak', kills, 1000, { c: 300 });
    A('k5000', '🌋', 'Kül Fırtınası', '5.000 ruh yak', kills, 5000, { c: 800 });
    A('k20000', '☄️', 'Gökteki Kıyamet', '20.000 ruh yak', kills, 20000, { c: 2000 });
    A('l10', '⭐', 'Kanatlanış', '10. seviyeye ulaş', lvl, 10, { c: 150 });
    A('l25', '⭐', 'Genç Ejder', '25. seviyeye ulaş', lvl, 25, { c: 400 });
    A('l50', '🌟', 'Ejder Lordu', '50. seviyeye ulaş', lvl, 50, { c: 900 });
    A('l100', '🌟', 'Kadim Varlık', '100. seviyeye ulaş', lvl, 100, { c: 2000 });
    A('l150', '👑', 'Son Kral', '150. seviyeye ulaş', lvl, 150, { c: 4000 });
    A('h1', '🏴', 'İlk Bayrak', 'İlk kovanını fethet', hv, 1, { c: 80 });
    A('h10', '🏴', 'Fatih', '10 kovan fethet', hv, 10, { c: 250 });
    A('h50', '🏰', 'İmparator', '50 kovan fethet', hv, 50, { c: 700 });
    A('h100', '🏰', 'Cihan Hakimi', '100 kovan fethet', hv, 100, { c: 1500 });
    A('h250', '🗺️', 'Dünyanın Efendisi', '250 kovan fethet', hv, 250, { c: 3000 });
    A('r1', '👹', 'Kral Katili', 'Bir biyom kralını yen', G(royalsDown), 1, { c: 600, p: 1 });
    A('r4', '💀', 'Dört Taç', 'Dört biyom kralını da yen', G(royalsDown), 4, { c: 2500, p: 2 });
    A('bh1', '🕳️', 'Olay Ufku', 'Bir kara delik bossunu yen', G(() => blackHoleTier), 1, { c: 800, p: 1 });
    A('bh3', '🌌', 'Kara Deliklerin Efendisi', 'Üç kara delik bossunu da yen', G(() => blackHoleTier), 3, { c: 3000, p: 2 });
    A('s5', '🐉', 'Koleksiyoncu', '5 kostüme sahip ol', G(() => unlockedSkins.length), 5, { c: 200 });
    A('s15', '🐉', 'Gardırop', '15 kostüme sahip ol', G(() => unlockedSkins.length), 15, { c: 800 });
    A('s30', '🐲', 'Ejder Müzesi', '30 kostüme sahip ol', G(() => unlockedSkins.length), 30, { c: 2500 });
    A('q5', '📜', 'Görev Adamı', '5 görev tamamla', G(() => questsCompletedLifetime), 5, { c: 200 });
    A('q25', '📜', 'Destan Yazarı', '25 görev tamamla', G(() => questsCompletedLifetime), 25, { c: 900 });
    A('w10', '🌊', 'Dalga Kırıcı', '10. dalgaya ulaş', G(() => PS.bestWave), 10, { c: 200 });
    A('w25', '🌊', 'Fırtına Yürüyüşü', '25. dalgaya ulaş', G(() => PS.bestWave), 25, { c: 600 });
    A('w50', '🌪️', 'Sonsuz Savaş', '50. dalgaya ulaş', G(() => PS.bestWave), 50, { c: 1500, p: 1 });
    A('c25', '⛓️', 'Zincirleme', '25x kombo yap', G(() => PS.bestCombo), 25, { c: 200 });
    A('c100', '⛓️', 'Alev Zinciri', '100x kombo yap', G(() => PS.bestCombo), 100, { c: 700 });
    A('c300', '💥', 'Durdurulamaz', '300x kombo yap', G(() => PS.bestCombo), 300, { c: 1800, p: 1 });
    A('sa10', '🏰', 'Yuva Kurucu', 'Sığınağı toplam 10 kez geliştir', G(() => sanctTotal()), 10, { c: 400 });
    A('sa30', '🏯', 'Kale Mimarı', 'Sığınağı toplam 30 kez geliştir', G(() => sanctTotal()), 30, { c: 1200 });
    A('lore', '📖', 'Kadim Hafıza', 'Tüm kadim parçaları bul', G(() => loreFound.length), (typeof loreFragmentPoints !== 'undefined' ? loreFragmentPoints.length : 8), { c: 1000, p: 1 });
    A('t60', '⏳', 'Sadık Ejder', '1 saat oyna', G(() => PS.playSec / 60), 60, { c: 300 });
    A('t300', '⌛', 'Ölümsüz Nöbet', '5 saat oyna', G(() => PS.playSec / 60), 300, { c: 1200 });
    A('d7', '🎁', 'Yedi Gün Yedi Gece', '7 gün üst üste giriş ödülü al', G(() => daily.best), 7, { c: 700, p: 1 });

    function grantReward(rw) {
        if (rw.c) coins += rw.c;
        if (rw.p) for (const p of potionsDB) potionInventory[p.id] = (potionInventory[p.id] || 0) + rw.p;
        if (rw.pot) for (const [k, v] of Object.entries(rw.pot)) potionInventory[k] = (potionInventory[k] || 0) + v;
        if (rw.p || rw.pot) { store.setItem('boruPotions', JSON.stringify(potionInventory)); safe(renderPotionBar); }
        afterCoinChange();
    }
    const rwText = (rw) => [rw.c ? '💰 ' + rw.c : '', rw.p ? '🧪 her iksirden ' + rw.p : '', rw.pot ? Object.entries(rw.pot).map(([k, v]) => { const p = potionsDB.find(q => q.id === k); return (p ? p.icon : '🧪') + ' ' + v; }).join(' ') : ''].filter(Boolean).join(' · ');

    function checkAchievements() {
        if (inMatch() || worldWriteLocked) return;
        if (gameActive) PS.bestWave = Math.max(PS.bestWave, currentWave || 1);
        const fresh = ACH.filter(a => !achDone[a.id] && a.get() >= a.target);
        if (!fresh.length) return;
        const total = { c: 0, p: 0 };
        for (const a of fresh) { achDone[a.id] = Date.now(); total.c += a.reward.c || 0; total.p += a.reward.p || 0; }
        store.setItem('boruPlusAch', JSON.stringify(achDone));
        grantReward(total);
        const msg = fresh.length === 1 ? `🏆 BAŞARIM: ${fresh[0].icon} ${fresh[0].name} · ${rwText(fresh[0].reward)}` : `🏆 ${fresh.length} BAŞARIM AÇILDI · ${rwText(total)}`;
        safe(() => hintToast(msg, '#ffd24a', 5200)); safe(() => SND.play('quest')); buzz([30, 40, 30]);
        if ($('pxModal').classList.contains('open') && pxView === 'ach') renderAch();
    }

    // =====================================================================
    // 5) GÜNLÜK ÖDÜL: 7 günlük seri, bir gün kaçarsa seri başa döner
    // =====================================================================
    const DAILY = [{ c: 100 }, { c: 150 }, { c: 150, pot: { healPotion: 1 } }, { c: 250 }, { c: 300, pot: { speedPotion: 1, shieldPotion: 1 } }, { c: 400, pot: { goldPotion: 1 } }, { c: 800, p: 1 }];
    const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
    const yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return dayKey(d); };
    const dailyReady = () => !inMatch() && daily.last !== dayKey();
    const nextStreak = () => daily.last === yesterdayKey() ? daily.streak + 1 : 1;
    function claimDaily() {
        if (!dailyReady()) return;
        const s = nextStreak(); const rw = DAILY[(s - 1) % 7];
        daily = { last: dayKey(), streak: s, best: Math.max(daily.best || 0, s) };
        store.setItem('boruPlusDaily', JSON.stringify(daily));
        grantReward(rw); safe(() => SND.play('victory')); buzz([40, 50, 40]);
        safe(() => hintToast('🎁 GÜNLÜK ÖDÜL (' + s + '. gün): ' + rwText(rw), '#ffcc33', 4200));
        renderDaily(); refreshBadges(); checkAchievements();
    }

    // =====================================================================
    // 6) ARAYÜZ: başarım / günlük ödül penceresi, menü düğmeleri, ayarlar
    // =====================================================================
    const css = document.createElement('style');
    css.textContent = `
    #pxModal { position: fixed; inset: 0; z-index: 330; background: rgba(3,0,0,0.9); display: none; justify-content: center; align-items: center; }
    #pxModal.open { display: flex; }
    .px-box { width: 94%; max-width: 860px; max-height: 92vh; max-height: 92dvh; overflow-y: auto; touch-action: pan-y; background: linear-gradient(170deg, #1d1206, #070304); border: 2px solid #c8942a; border-radius: 14px; padding: 20px 22px; color: #f0e2cc; box-shadow: 0 0 60px rgba(200,148,42,0.35); }
    .px-box * { touch-action: pan-y; }
    .px-box h2 { text-align: center; color: #ffd24a; letter-spacing: 4px; font-family: Georgia, serif; margin-bottom: 4px; }
    .px-sub { text-align: center; color: #c8b090; font-size: 13px; margin-bottom: 14px; }
    .px-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
    .px-ach { display: flex; gap: 10px; align-items: center; background: rgba(255,255,255,0.04); border: 1px solid #3a2a14; border-radius: 10px; padding: 10px; }
    .px-ach.done { border-color: #ffd24a; background: rgba(255,210,74,0.09); }
    .px-ach .ic { font-size: 28px; width: 38px; text-align: center; filter: grayscale(1) opacity(0.45); }
    .px-ach.done .ic { filter: none; }
    .px-ach .tx { flex: 1; min-width: 0; }
    .px-ach .nm { font-weight: bold; color: #fff; font-size: 14px; }
    .px-ach .ds { font-size: 12px; color: #b8a488; }
    .px-ach .rw { font-size: 11px; color: #ffd24a; margin-top: 2px; }
    .px-bar { height: 5px; background: #2a1c0c; border-radius: 3px; margin-top: 5px; overflow: hidden; }
    .px-bar i { display: block; height: 100%; background: linear-gradient(90deg, #ff8a2a, #ffd24a); }
    .px-tabs { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; flex-wrap: wrap; }
    .px-tabs button { background: rgba(0,0,0,0.4); color: #e8d0a8; border: 1px solid #6a4a1a; border-radius: 8px; padding: 7px 14px; font-weight: bold; cursor: pointer; font-size: 13px; }
    .px-tabs button.on { background: #c8942a; color: #1a0e02; border-color: #ffd24a; }
    .px-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin: 10px 0 16px; }
    .px-day { border: 1px solid #4a3414; border-radius: 10px; padding: 10px 4px; text-align: center; background: rgba(255,255,255,0.03); font-size: 12px; color: #c8b090; }
    .px-day b { display: block; font-size: 13px; color: #fff; margin-bottom: 6px; }
    .px-day.got { opacity: 0.55; border-color: #3ddc6a; }
    .px-day.now { border: 2px solid #ffd24a; background: rgba(255,210,74,0.14); box-shadow: 0 0 16px rgba(255,210,74,0.35); color: #ffe8a0; }
    .px-stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin-top: 8px; }
    .px-stats div { background: rgba(255,255,255,0.04); border: 1px solid #3a2a14; border-radius: 10px; padding: 10px; text-align: center; }
    .px-stats b { display: block; font-size: 18px; color: #ffd24a; }
    .px-stats span { font-size: 11px; color: #b8a488; letter-spacing: 1px; }
    .px-close { display: block; margin: 16px auto 0; }
    .px-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #ff3344; margin-left: 6px; box-shadow: 0 0 8px #ff3344; vertical-align: middle; animation: pxPulse 1.2s infinite; }
    @keyframes pxPulse { 50% { transform: scale(1.4); opacity: 0.6; } }
    #pxCombo { position: fixed; left: 50%; top: 21%; transform: translate(-50%, 8px) scale(0.9); z-index: 40; pointer-events: none; opacity: 0; transition: opacity .18s, transform .18s; text-align: center;
        font-weight: 900; letter-spacing: 3px; color: #ffe6b0; font-size: 18px; text-shadow: 0 0 10px #ff6a00, 0 2px 0 #000; font-family: Georgia, serif; }
    #pxCombo b { font-size: 34px; color: #fff; margin-right: 6px; }
    #pxCombo small { display: block; font-size: 15px; color: #ffd24a; letter-spacing: 1px; }
    #pxCombo.show { opacity: 1; transform: translate(-50%, 0) scale(1); }
    #pxCombo.warm b { color: #ffcc33; } #pxCombo.hot b { color: #ff5a2a; text-shadow: 0 0 18px #ff2a00; }
    #pxCombo.end { transform: translate(-50%, -6px) scale(1.08); }
    body:not(.in-game) #pxCombo { display: none; }
    body.m #pxCombo { top: calc(var(--sat, 0px) + 150px); font-size: 13px; } body.m #pxCombo b { font-size: 24px; }
    #pxFps { position: fixed; left: 50%; bottom: 4px; transform: translateX(-50%); z-index: 60; font: bold 11px monospace; color: #9f9; background: rgba(0,0,0,0.55); padding: 2px 8px; border-radius: 6px; pointer-events: none; display: none; }
    body.in-game #pxFps.on { display: block; }
    #pxRunSummary { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin: 14px auto 4px; max-width: 620px; }
    #pxRunSummary div { background: rgba(255,255,255,0.05); border: 1px solid #5a2a2a; border-radius: 10px; padding: 8px 12px; min-width: 100px; text-align: center; }
    #pxRunSummary b { display: block; color: #fff; font-size: 15px; } #pxRunSummary span { font-size: 10px; color: #c89a9a; letter-spacing: 1px; }
    body.m .px-box { width: 97%; padding: 12px 10px; max-height: 94dvh; }
    body.m .px-grid { grid-template-columns: 1fr; }
    body.m .px-days { grid-template-columns: repeat(4, 1fr); }
    @media (max-width: 520px) { .px-days { grid-template-columns: repeat(4, 1fr); } }
    `;
    document.head.appendChild(css);

    const modal = document.createElement('div'); modal.id = 'pxModal'; modal.innerHTML = '<div class="px-box" id="pxBox"></div>'; document.body.appendChild(modal);
    const fpsEl = document.createElement('div'); fpsEl.id = 'pxFps'; document.body.appendChild(fpsEl);
    let pxView = 'ach', pxPaused = false;
    const tabs = () => `<div class="px-tabs"><button class="${pxView === 'ach' ? 'on' : ''}" onclick="BoruPlus.show('ach')">🏆 BAŞARIMLAR</button><button class="${pxView === 'daily' ? 'on' : ''}" onclick="BoruPlus.show('daily')">🎁 GÜNLÜK ÖDÜL${dailyReady() ? '<span class="px-dot"></span>' : ''}</button><button class="${pxView === 'stats' ? 'on' : ''}" onclick="BoruPlus.show('stats')">📊 İSTATİSTİK</button></div>`;
    const closeBtn = '<button class="action-btn px-close" onclick="BoruPlus.close()" style="border-color:#ffd24a;color:#ffd24a;">✔ KAPAT</button>';
    function renderAch() {
        const done = ACH.filter(a => achDone[a.id]).length;
        const list = ACH.slice().sort((a, b) => (!!achDone[a.id] - !!achDone[b.id]) || (Math.min(1, b.get() / b.target) - Math.min(1, a.get() / a.target)));
        $('pxBox').innerHTML = `<h2>🏆 BAŞARIMLAR</h2><div class="px-sub">${done} / ${ACH.length} açıldı · ödüller otomatik verilir · dünyaya özeldir</div>${tabs()}<div class="px-grid">` +
            list.map(a => { const v = Math.min(a.target, Math.floor(a.get())); const ok = !!achDone[a.id];
                return `<div class="px-ach ${ok ? 'done' : ''}"><div class="ic">${a.icon}</div><div class="tx"><div class="nm">${a.name}${ok ? ' ✔' : ''}</div><div class="ds">${a.desc}</div>
                <div class="rw">${rwText(a.reward)}</div>${ok ? '' : `<div class="px-bar"><i style="width:${(v / a.target * 100).toFixed(1)}%"></i></div><div class="ds">${v.toLocaleString('tr-TR')} / ${a.target.toLocaleString('tr-TR')}</div>`}</div></div>`; }).join('') + '</div>' + closeBtn;
    }
    function renderDaily() {
        if (pxView !== 'daily' || !modal.classList.contains('open')) return;
        const ready = dailyReady(); const s = ready ? nextStreak() : daily.streak; const cur = (Math.max(1, s) - 1) % 7;
        const cells = DAILY.map((rw, i) => `<div class="px-day ${i < cur || (!ready && i === cur) ? 'got' : ''} ${ready && i === cur ? 'now' : ''}"><b>${i + 1}. GÜN</b>${rwText(rw).replace(/ · /g, '<br>')}</div>`).join('');
        $('pxBox').innerHTML = `<h2>🎁 GÜNLÜK ÖDÜL</h2><div class="px-sub">Her gün gir, seriyi büyüt. Bir gün kaçırırsan seri 1. güne döner. · Seri: <b style="color:#ffd24a">${daily.last === dayKey() || daily.last === yesterdayKey() ? daily.streak : 0} gün</b> · En iyi: ${daily.best || 0}</div>${tabs()}
            <div class="px-days">${cells}</div>
            ${ready ? `<button class="action-btn menu-btn-primary" style="--menuAccent:#ffb020; display:block; margin:0 auto; width:min(340px,90%);" onclick="BoruPlus.claim()">🎁 ÖDÜLÜ AL (${s}. GÜN)</button>` : '<div class="px-sub" style="margin-top:6px;">✔ Bugünün ödülünü aldın. Yarın tekrar gel!</div>'}` + closeBtn;
    }
    function renderStats() {
        const h = Math.floor(PS.playSec / 3600), m = Math.floor(PS.playSec / 60) % 60;
        const rows = [['🔥', PS.kills.toLocaleString('tr-TR'), 'YAKILAN RUH (TOPLAM)'], ['⏳', h + ' sa ' + m + ' dk', 'OYUN SÜRESİ'], ['🎮', PS.runs, 'OYNANAN TUR'], ['🌊', PS.bestWave, 'EN YÜKSEK DALGA'],
            ['⛓️', PS.bestCombo + 'x', 'EN İYİ KOMBO'], ['👑', maxLevelReached, 'EN YÜKSEK SEVİYE'], ['🏴', totalHivesCapturedLifetime, 'FETHEDİLEN KOVAN'], ['👹', royalsDown() + ' / 4', 'YENİLEN KRAL'],
            ['🕳️', Math.min(3, blackHoleTier || 0) + ' / 3', 'KARA DELİK'], ['🐉', unlockedSkins.length + ' / ' + skinsDB.length, 'KOSTÜM'], ['📜', questsCompletedLifetime, 'TAMAMLANAN GÖREV'], ['🏆', Object.keys(achDone).length + ' / ' + ACH.length, 'BAŞARIM']];
        $('pxBox').innerHTML = `<h2>📊 İSTATİSTİKLER</h2><div class="px-sub">${escapeHtml((currentWorld() || {}).name || '')} dünyasının ömür boyu kayıtları</div>${tabs()}<div class="px-stats">` +
            rows.map(([i, v, l]) => `<div><b>${i} ${v}</b><span>${l}</span></div>`).join('') + '</div>' + closeBtn;
    }
    function show(view) {
        pxView = view || pxView;
        if (!modal.classList.contains('open')) {
            if (gameActive && !isPaused && !MP.active) { togglePause(); pxPaused = true; }
            modal.classList.add('open');
        }
        safe(checkAchievements);
        if (pxView === 'ach') renderAch(); else if (pxView === 'daily') renderDaily(); else renderStats();
        $('pxBox').scrollTop = 0;
    }
    function close() {
        modal.classList.remove('open');
        if (pxPaused && gameActive && isPaused) { pxPaused = false; }
        refreshBadges();
    }
    window.BoruPlus = { show, close, claim: claimDaily, stats: PS };

    // Menü / duraklatma düğmeleri
    function addBtn(parent, after, html, onclick, style) {
        const b = document.createElement('button'); b.className = 'action-btn'; b.innerHTML = html; b.onclick = onclick; if (style) b.style.cssText = style;
        if (after && after.parentNode === parent) parent.insertBefore(b, after.nextSibling); else parent.appendChild(b);
        return b;
    }
    let dailyBtn = null;
    safe(() => {
        const mb = document.querySelector('.menu-btns');
        const marketBtn = Array.from(mb.querySelectorAll('button')).find(b => /MARKET/.test(b.textContent));
        const achBtn = addBtn(mb, marketBtn, '🏆 BAŞARIMLAR', () => show('ach'), 'background: rgba(255,210,74,0.1); border-color:#ffd24a; color:#ffe8a0;');
        dailyBtn = addBtn(mb, achBtn, '🎁 GÜNLÜK ÖDÜL', () => show('daily'), 'background: rgba(255,176,32,0.12); border-color:#ffb020; color:#ffe0a0;');
        const pm = $('pauseMenu');
        const jBtn = Array.from(pm.querySelectorAll('button')).find(b => /GÜNLÜK/.test(b.textContent));
        addBtn(pm, jBtn, '🏆 BAŞARIMLAR · ÖDÜLLER', () => show('ach'), 'border-color:#ffd24a; color:#ffd24a;');
    });
    function refreshBadges() {
        if (dailyBtn) dailyBtn.innerHTML = '🎁 GÜNLÜK ÖDÜL' + (dailyReady() ? '<span class="px-dot"></span>' : '');
    }
    refreshBadges();

    // Ana menü istatistik kartına başarım sayısı
    const _rms = renderMenuStats;
    renderMenuStats = function () {
        const r = _rms.apply(this, arguments);
        safe(() => { const ms = $('menuStats'); if (ms && !ms.querySelector('.px-ms')) ms.insertAdjacentHTML('beforeend', `<div class="menu-stat px-ms"><div class="ms-v">🏆 ${Object.keys(achDone).length} / ${ACH.length}</div><div class="ms-l">BAŞARIM</div></div>`); });
        return r;
    };
    safe(renderMenuStats);

    // Mobil hızlı menü
    if (typeof renderMMenu === 'function') {
        const _rmm = renderMMenu;
        renderMMenu = function () {
            const r = _rmm.apply(this, arguments);
            safe(() => {
                const done = Object.keys(achDone).length;
                $('mmGrid').insertAdjacentHTML('beforeend', `<button onclick="mAct('pxAch')"><span>🏆</span>Başarımlar<small>${done}/${ACH.length} açıldı</small></button>` +
                    `<button onclick="mAct('pxDaily')"><span>🎁</span>Günlük Ödül<small>${dailyReady() ? 'ödül hazır!' : 'yarın gel'}</small></button>`);
            });
            return r;
        };
        const _mAct = window.mAct;
        window.mAct = function (a) {
            if (a === 'pxAch' || a === 'pxDaily') { show(a === 'pxAch' ? 'ach' : 'daily'); return; }
            return _mAct.apply(this, arguments);
        };
    }

    // Ayarlar: ekstra seçenekler + kontrol listesine yeni tuşlar
    safe(() => {
        const sc = document.querySelector('#settingsModal .settings-container');
        const promo = Array.from(sc.querySelectorAll('.settings-section')).find(s => /HEDİYE/.test(s.textContent));
        const sec = document.createElement('div'); sec.className = 'settings-section'; sec.textContent = '✨ EKSTRA';
        const row = document.createElement('div'); row.className = 'settings-row';
        row.innerHTML = `<div class="opt-group" id="pxOpts">
            <button class="opt-btn" data-k="fps">📈 FPS GÖSTERGESİ</button>
            <button class="opt-btn" data-k="autoPause">⏸️ ARKA PLANDA DURAKLAT</button>
            ${navigator.vibrate ? '<button class="opt-btn" data-k="haptics">📳 TİTREŞİM</button>' : ''}
            ${'wakeLock' in navigator ? '<button class="opt-btn" data-k="wakeLock">💡 EKRANI AÇIK TUT</button>' : ''}
        </div><div class="settings-hint">Arka planda duraklat: sekme / uygulama değişince oyun durur ve kaydedilir. Ekranı açık tut: oynarken telefon ekranı kararmaz.</div>`;
        sc.insertBefore(sec, promo); sc.insertBefore(row, promo);
        const sync = () => row.querySelectorAll('.opt-btn').forEach(b => b.classList.toggle('active', !!PUI[b.dataset.k]));
        row.querySelectorAll('.opt-btn').forEach(b => b.addEventListener('click', () => { PUI[b.dataset.k] = !PUI[b.dataset.k]; savePUI(); sync(); fpsEl.classList.toggle('on', PUI.fps); syncWake(); }));
        sync();
        const kg = sc.querySelector('.keys-grid');
        if (kg) kg.insertAdjacentHTML('beforeend', '<b>5 - 7</b><span>Yeni iksirler (Şifa · Servet · Bilgelik)</span><b>T</b><span>Yetenek ağacı</span><b>L</b><span>Ulak raporları</span><b>K</b><span>Başarımlar · Günlük ödül</span><b>P</b><span>Duraklat</span><b>F</b><span>Tam ekran aç / kapat</span>');
    });
    fpsEl.classList.toggle('on', PUI.fps);

    // =====================================================================
    // 7) KLAVYE (PC)
    // =====================================================================
    window.addEventListener('keydown', (e) => {
        if (!modal.classList.contains('open')) return;
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        e.stopImmediatePropagation(); e.stopPropagation();
        if (e.code === 'Escape' || e.code === 'KeyK') close();
    }, true);
    window.addEventListener('keydown', (e) => {
        if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
        if ($('skillModal') && $('skillModal').classList.contains('open')) return;
        const live = gameActive && !isPaused && !(MP.active && MP.localDead);
        if (e.code === 'Digit5' && live) usePotion('healPotion');
        else if (e.code === 'Digit6' && live) usePotion('goldPotion');
        else if (e.code === 'Digit7' && live) usePotion('xpPotion');
        else if (e.code === 'KeyK' && !e.repeat) show('ach');
        else if (e.code === 'KeyP' && gameActive && $('levelUpScreen').style.display === 'none' && !e.repeat) togglePause();
        else if (e.code === 'KeyF' && !e.repeat && !isTouchUI) {
            const el = document.documentElement;
            if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
            else { const f = el.requestFullscreen || el.webkitRequestFullscreen; if (f) { const p = f.call(el); if (p && p.catch) p.catch(() => {}); } }
        }
    });

    // =====================================================================
    // 8) ARKA PLANA GEÇİNCE DURAKLAT + KAYDET, EKRANI AÇIK TUT
    // =====================================================================
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) { syncWake(); return; }
        safe(() => {
            if (!gameActive || MP.active) return;
            if (PUI.autoPause && !isPaused && $('levelUpScreen').style.display === 'none' && !isArenaTransitioning && $('bhReward').style.display !== 'flex' && !(typeof mMenuOpen === 'function' && mMenuOpen())) togglePause();
            if (isPaused) saveGameForce(); else saveGame();
            savePS();
        });
    });
    let wakeSentinel = null;
    function syncWake() {
        if (!('wakeLock' in navigator)) return;
        const want = PUI.wakeLock && gameActive && !isPaused && !document.hidden;
        if (want && !wakeSentinel) { navigator.wakeLock.request('screen').then(s => { wakeSentinel = s; s.addEventListener('release', () => { wakeSentinel = null; }); }).catch(() => {}); }
        else if (!want && wakeSentinel) { const s = wakeSentinel; wakeSentinel = null; s.release().catch(() => {}); }
    }

    // =====================================================================
    // 9) SAAT: oyun süresi, FPS, başarım kontrolü
    // =====================================================================
    let secTick = 0;
    setInterval(() => safe(() => {
        if (gameActive && !isPaused && !document.hidden && !inMatch()) PS.playSec++;
        if (PUI.fps) { fpsEl.textContent = fpsFrames + ' FPS'; fpsEl.style.color = fpsFrames >= 50 ? '#9f9' : fpsFrames >= 28 ? '#ff9' : '#f88'; }
        fpsFrames = 0;
        if (++secTick % 2 === 0) { checkAchievements(); syncWake(); }
        if (secTick % 10 === 0) savePS();
    }), 1000);

    // Günlük ödül hazırsa ana menüde bir kez göster
    setTimeout(() => safe(() => {
        const so = $('storyOverlay');
        const mpOpen = new URLSearchParams(location.search).has('oda') || !!document.querySelector('#mpRoot.on'); // davet linkiyle / lobideyken araya girmesin
        if (!gameActive && !inMatch() && !mpOpen && dailyReady() && $('startScreen').style.display !== 'none' && !(so && getComputedStyle(so).display !== 'none') && !modal.classList.contains('open')) show('daily');
    }), 1500);
    safe(checkAchievements);
})();
