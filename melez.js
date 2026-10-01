// =====================================================================
// MELEZ EJDERHALAR + BAĞIMSIZ BAŞ / BOYUN SİSTEMİ
// Ana betiğe (index.html) dokunmadan eklenen paket. plus.js'ten sonra, kostum.js'ten önce yüklenir.
//
// 1) 15 MELEZ KOSTÜM: Erlik'in Ejderi, Kıyamet Avcısı, Kazuma, Mercan Baba, Aynalı ve Kızgın Kor'un
//    her ikilisi birbiriyle melezlenir (6 ejderha = 15 çift). Her melezin kendine özgü:
//      - çok başlı kombo alevi (gaz + ateş, çapraz ateş, kıskaç, sıralı nöbet ...)
//      - süper plazma görünümü, kükreme (dalga + oyun etkisi) ve pasif yeteneği vardır.
// 2) HEADFX: çok başlı ejderhalarda her boyun kendi yay-sönüm durumuyla AYRI hareket eder
//    (sallanır, uzanır, saldırır), her baş kendi alevini püskürtür. Gaz soluyan baş + o gazı tutuşturan
//    baş gibi kombolar yapar. Erlik, Kıyamet Avcısı ve Çifte Baş da bundan yararlanır.
// =====================================================================
(function () {
    'use strict';
    if (typeof skinsDB === 'undefined' || typeof ORG_SKINS === 'undefined' || typeof drawOrganic !== 'function') return;
    const TAU = Math.PI * 2;
    const rnd = Math.random;
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const nowS = () => performance.now() / 1000;
    const safe = (fn, tag) => { try { return fn(); } catch (e) { console.warn('Melez ' + (tag || ''), e); } };

    // ---------- renk yardımcıları ----------
    const hx3 = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const mixHex = (a, b, t) => { const A = hx3(a), B = hx3(b); return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); };
    const isHex = (v) => typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v);
    function mixVal(a, b, t) {
        if (Array.isArray(a) && Array.isArray(b)) return a.map((x, i) => mixVal(x, b[i], t));
        if (isHex(a) && isHex(b)) return mixHex(a, b, t);
        return t < 0.5 ? a : b;
    }
    const GROUPS = { body: ['body', 'ridge', 'scale', 'bone'], wing: ['membrane', 'flame', 'bolt'], glow: ['vein', 'scaleEdge', 'eye'], horn: ['horn'] };
    function buildPal(PA, PB, from) {
        const out = {};
        for (const g in GROUPS) for (const k of GROUPS[g]) {
            const a = PA[k], b = PB[k], m = from[g] || 'M';
            let v;
            if (m === 'A') v = a !== undefined ? a : b; else if (m === 'B') v = b !== undefined ? b : a;
            else v = (a !== undefined && b !== undefined) ? mixVal(a, b, 0.5) : (a !== undefined ? a : b);
            if (v !== undefined) out[k] = v;
        }
        return out;
    }

    // =====================================================================
    // 1) EBEVEYNLER
    // =====================================================================
    const PARENT_PAL = {
        coral: { body: ['#ffa0c4', '#c23a6a', '#3a0a1e'], ridge: '#ffd8e6', scale: '#e0507e', scaleEdge: '#ffe0ec',
                 membrane: ['#ff7aa8', '#9a2a5a', '#2a0816'], vein: '#66ffd9', horn: ['#fff0f5', '#ff9ec0', '#8a2a50'], bone: '#ffe6ee', eye: '#9dffee' },
        ragingMagma: { body: ['#5a423a', '#1c120e', '#000000'], ridge: '#ffe9b0', scale: '#2a1a14', scaleEdge: '#ff6a00',
                 membrane: ['#4a2418', '#180a06', '#000000'], vein: '#ff7a00', horn: ['#ffd8a0', '#5a3a2a', '#140804'], bone: '#3a2a22', eye: '#fffbd0',
                 flame: ['#ffffff', '#ffcc33', 'rgba(255,60,0,0)'] }
    };
    const PARENT_CFG = {
        coral: { skin: 'spots', wing: 'fin', horn: 'branch', tail: 'fan', tailExt: 0.3, neck: 0.12, neckW: 0.6, thick: 1.05, arms: true, wings: [{ pos: 0.2, ws: 1 }, { pos: 0.4, ws: 0.62 }] },
        ragingMagma: { wing: 'flame', horn: 'flame', cracks: true, tail: 'spike', tailExt: 0.2, neck: 0.1, neckW: 0.62, thick: 1.15, arms: true, wings: [{ pos: 0.16, ws: 1.1 }, { pos: 0.34, ws: 0.64 }] }
    };
    // (skin id -> { pal, cfg, name })
    function parentOf(id) {
        const o = ORG_SKINS[id];
        if (o) return { pal: o.pal, cfg: o, name: (skinsDB.find(s => s.id === id) || {}).name || id };
        if (PARENT_PAL[id]) return { pal: PARENT_PAL[id], cfg: PARENT_CFG[id], name: (skinsDB.find(s => s.id === id) || {}).name || id };
        return null;
    }
    // Ebeveyn skin id'leri: erlik, kiyametavcisi, kazuma, coral, mirrorbane, ragingMagma
    const E = 'erlik', K = 'kiyametavcisi', Z = 'kazuma', M = 'coral', A = 'mirrorbane', R = 'ragingMagma';

    // Çok başlı ebeveynlere kombo davranışı ver (HEADFX bunları okur)
    safe(() => {
        if (ORG_SKINS.erlik) { ORG_SKINS.erlik.combo = 'alternate'; ORG_SKINS.erlik.beam = ORG_SKINS.erlik.beam || 'multi'; }
        if (ORG_SKINS.kiyametavcisi) Object.assign(ORG_SKINS.kiyametavcisi, { combo: 'gasIgnite', gasHeads: [1], gas: { col: '#b77bff', style: 'cloud' }, beam: 'multi' });
        if (ORG_SKINS.twinhead) Object.assign(ORG_SKINS.twinhead, { combo: 'crossfire', beam: 'multi' });
        const add = (id, txt) => { const s = skinsDB.find(q => q.id === id); if (s && !/BAŞ SALDIRISI/.test(s.desc)) s.desc += ' BAŞ SALDIRISI: ' + txt; };
        add('erlik', 'iki baş sırayla nöbet tutar; biri öne atılıp yakarken diğeri geri çekilir.');
        add('kiyametavcisi', 'orta baş kıyamet gazı soluyup yanlardaki iki başın alevini bekler; gaz tutuşunca zincirleme patlar.');
        add('twinhead', 'iki baş alevini çapraz atar, ateşler X şeklinde kesişir.');
    }, 'ebeveyn');

    // =====================================================================
    // 2) MELEZ TANIMLARI
    // =====================================================================
    // from: renk gruplarının hangi ebeveynden geldiği (A / B / M = karışım)
    // ab: pasif yetenek bileşenleri;  roar: kükreme görseli + oyun etkisi;  txt: arayüzde gösterilen saldırı açıklamaları
    const HYB = [
        { id: 'kiyametErliki', name: 'Kıyamet Erliki', icon: '☄️', P: [E, K], from: { body: 'M', wing: 'B', glow: 'A', horn: 'M' }, charge: 'void', voice: ['infernoLord', 'kiyametavcisi'],
          cfg: { skin: 'plates', wing: 'scythe', horn: 'ram', cracks: true, scythes: true, heads: 4, tail: 'fork', tailExt: 0.3, neck: 0.3, neckW: 0.42, thick: 1.2, headScale: 0.74, arms: true,
                 wings: [{ pos: 0.34, ws: 1.15 }, { pos: 0.5, ws: 0.7 }], combo: 'gasIgnite', gasHeads: [1, 2], gas: { col: '#b24bff', style: 'cloud' }, beam: 'helix' },
          roar: { fx: 'voidring', dmg: 5, burn: 1, pull: 0.5, slow: 60 },
          ab: [{ t: 'nova', every: 320, R: 520, dmg: 16, col: '#ff3a6a', zone: true }],
          txt: { head: 'Dört başlı: iki orta baş mor kıyamet gazı soluyor, dıştaki iki baş o gazı tutuşturup zincirleme patlatıyor.', beam: 'Dört başın ışını çift sarmal olarak dönüp tek hüzmede birleşir.', roar: 'Düşmanları içeri çeker ve yakar.', ab: 'Yeraltı Kalbi: göğsünden çıkan alev dalgası yerde yanan bir alan bırakır.' } },

        { id: 'tuncErlik', name: 'Tunç Erlik', icon: '⚔️', P: [E, Z], from: { body: 'A', wing: 'A', glow: 'B', horn: 'B' }, charge: 'inferno', voice: ['infernoLord', 'kingsbane'],
          cfg: { skin: 'plates', wing: 'scythe', horn: 'crescent', cracks: true, heads: 2, tail: 'sickle', tailExt: 0.3, neck: 0.24, neckW: 0.45, thick: 1.1, whisk: true, arms: true,
                 wings: [{ pos: 0.3, ws: 1.1 }], combo: 'alternate', beam: 'scythe' },
          roar: { fx: 'ember', dmg: 8, burn: 1, pull: -0.4 },
          ab: [{ t: 'orbit', n: 3, kind: 'sickle', R: 120, dmg: 5, col: '#ffcf6a', speed: 0.07 }],
          txt: { head: 'İki baş sırayla nöbet tutar: öndeki yakarken diğeri geri çekilir, her 0,5 saniyede nöbet değişir.', beam: 'Dönerek uçan tunç hilal bıçaklar hüzmeyi biçer.', roar: 'Ateşli dalga düşmanları yakıp geri savurur.', ab: 'Tunç Oraklar: etrafında dönen üç hilal bıçak yakınındaki düşmanı biçer.' } },

        { id: 'kanMercani', name: 'Kan Mercanı', icon: '🩸', P: [E, M], from: { body: 'M', wing: 'B', glow: 'A', horn: 'B' }, charge: 'tide', voice: ['infernoLord', 'coral'],
          cfg: { skin: 'spots', wing: 'fin', horn: 'branch', cracks: true, heads: 2, tail: 'fan', tailExt: 0.3, neck: 0.22, neckW: 0.46, thick: 1.1, arms: true,
                 wings: [{ pos: 0.22, ws: 1 }, { pos: 0.42, ws: 0.62 }], combo: 'gasIgnite', gasHeads: [0], gas: { col: '#ff5a8a', style: 'bubble' }, beam: 'bubble' },
          roar: { fx: 'bubbles', dmg: 4, slow: 110, pull: -0.5 },
          ab: [{ t: 'leech', every: 60, R: 190, dmg: 3, heal: 0.006, col: '#ff5a8a' }],
          txt: { head: 'Bir baş kanlı kabarcıklar üfler; diğer baş alevle patlatır, kabarcıklar zincirleme patlar.', beam: 'Hüzme boyunca kanlı mercan kabarcıkları süzülür ve ucunda patlar.', roar: 'Gelgit dalgası: düşmanları yavaşlatıp savurur.', ab: 'Mercan Emici: yakındaki düşmanların canını emip seni iyileştirir.' } },

        { id: 'kanAynasi', name: 'Kan Aynası', icon: '🪞', P: [E, A], from: { body: 'B', wing: 'A', glow: 'A', horn: 'B' }, charge: 'mirror', voice: ['infernoLord', 'mirrorbane'],
          cfg: { skin: 'plates', wing: 'scythe', horn: 'swept', cracks: true, heads: 2, tail: 'fork', tailExt: 0.3, neck: 0.2, neckW: 0.5, thick: 1.1, arms: true,
                 wings: [{ pos: 0.14, ws: 1.1 }, { pos: 0.34, ws: 0.66 }], combo: 'crossfire', beam: 'shatter' },
          roar: { fx: 'shards', dmg: 10, clear: 1 },
          ab: [{ t: 'reflect', R: 240, cd: 110, dmg: 22, col: '#ff3a5a' }],
          txt: { head: 'İki baş alevini çapraz atar; ateşler önünde X şeklinde kesişir.', beam: 'Hüzmeyi aynadan sekip kırılan kanlı cam parçaları çevreler.', roar: 'Dalga düşman mermilerini parçalar.', ab: 'Kanlı Yansıma: kırdığı her düşman mermisini en yakın düşmana geri fırlatır.' } },

        { id: 'cehennemBekcisi', name: 'Cehennem Bekçisi', icon: '🌋', P: [E, R], from: { body: 'M', wing: 'B', glow: 'M', horn: 'A' }, charge: 'inferno', voice: ['infernoLord', 'ragingMagma'],
          cfg: { skin: 'plates', wing: 'flame', horn: 'ram', cracks: true, vents: true, heads: 2, tail: 'fork', tailExt: 0.25, neck: 0.2, neckW: 0.5, thick: 1.25, headScale: 1.05, arms: true,
                 wings: [{ pos: 0.3, ws: 1.1 }], combo: 'pincer', beam: 'lava' },
          roar: { fx: 'ember', dmg: 14, burn: 1 },
          ab: [{ t: 'trail', every: 5, life: 200, R: 62, dmg: 1.1, kind: 'lava', col: '#ff6a1a', slow: 40 }],
          txt: { head: 'İki baş kıskaç yapar: iki alev önde bir noktada birleşip çok yoğun bir ateş topu oluşturur.', beam: 'Hüzme erimiş lav gibi: kararmış kabuk parçaları ve damlayan lav.', roar: 'Alev kükremesi çok yüksek hasar verip yakar.', ab: 'Magma İzi: kuyruğunun arkasında yanan lav gölcükleri bırakır.' } },

        { id: 'geceKazuma', name: 'Gece Kazuma', icon: '🌠', P: [K, Z], from: { body: 'B', wing: 'A', glow: 'B', horn: 'M' }, charge: 'void', voice: ['kiyametavcisi', 'kingsbane'],
          cfg: { skin: 'scales', wing: 'storm', horn: 'crescent', cracks: true, heads: 3, tail: 'sickle', tailExt: 0.3, neck: 0.28, neckW: 0.44, thick: 1.1, headScale: 0.82, whisk: true,
                 wings: [{ pos: 0.32, ws: 1.05 }, { pos: 0.48, ws: 0.62 }], combo: 'fan', beam: 'storm2' },
          roar: { fx: 'bolts', dmg: 7, slow: 130 },
          ab: [{ t: 'bolt', kind: 'chain', every: 110, range: 620, count: 5, dmg: 9, col: '#7affea' }],
          txt: { head: 'Üç baş yelpaze açar; her baş ayrı yöne süpürerek ateş eder.', beam: 'Hüzme dallanan zincirleme yıldırımlarla çevrilidir.', roar: 'Yıldırım kükremesi düşmanları sersemletir.', ab: 'Gece Şimşeği: periyodik olarak düşmandan düşmana atlayan zincir yıldırım.' } },

        { id: 'derinKiyamet', name: 'Derin Kıyamet', icon: '🌊', P: [K, M], from: { body: 'A', wing: 'B', glow: 'M', horn: 'B' }, charge: 'tide', voice: ['kiyametavcisi', 'coral'],
          cfg: { skin: 'spots', wing: 'fin', horn: 'branch', cracks: true, heads: 3, tail: 'fan', tailExt: 0.3, neck: 0.3, neckW: 0.43, thick: 1.1, headScale: 0.82,
                 wings: [{ pos: 0.3, ws: 1.05 }, { pos: 0.46, ws: 0.6 }], combo: 'gasIgnite', gasHeads: [1], gas: { col: '#4a7aff', style: 'bubble' }, beam: 'tide' },
          roar: { fx: 'wave', dmg: 6, pull: 0.4, slow: 120 },
          ab: [{ t: 'nova', every: 360, R: 480, dmg: 14, col: '#6aa0ff', pull: 0.35 }],
          txt: { head: 'Orta baş derin su kabarcıkları solur, yanlardaki iki baş onları tutuşturup patlatır.', beam: 'Basınç halkaları ve dalga cepheleri hüzmeyle birlikte ilerler.', roar: 'Düşmanları içeri çekip yavaşlatan gelgit.', ab: 'Gelgit Kalbi: düşmanları kendine çeken ve sonra patlayan dalga.' } },

        { id: 'boslukAynasi', name: 'Boşluk Aynası', icon: '🔮', P: [K, A], from: { body: 'A', wing: 'M', glow: 'A', horn: 'B' }, charge: 'void', voice: ['kiyametavcisi', 'mirrorbane'],
          cfg: { skin: 'scales', wing: 'tatter', horn: 'swept', cracks: true, heads: 3, tail: 'fork', tailExt: 0.28, neck: 0.28, neckW: 0.44, thick: 1.08, headScale: 0.82, arms: true,
                 wings: [{ pos: 0.3, ws: 1.05 }, { pos: 0.46, ws: 0.6 }], combo: 'crossfire', beam: 'prism' },
          roar: { fx: 'voidring', dmg: 4, pull: 0.6, clear: 1 },
          ab: [{ t: 'reflect', R: 240, cd: 150, dmg: 14, col: '#b77bff' }, { t: 'nova', every: 420, R: 380, dmg: 10, col: '#b77bff', pull: 0.5 }],
          txt: { head: 'Üç baş alevini çapraz yöne atar; ışınlar boşlukta birbirinin yansıması gibi kesişir.', beam: 'Hüzme prizmadan geçmiş gibi altı renge bölünür.', roar: 'Mermileri yutar, düşmanları kara deliğe çeker.', ab: 'Boşluk Yansıması: mermileri kırıp geri atar, ara sıra kara delik dalgası yayar.' } },

        { id: 'karaGunes', name: 'Kara Güneş', icon: '🌑', P: [K, R], from: { body: 'M', wing: 'A', glow: 'B', horn: 'A' }, charge: 'void', voice: ['kiyametavcisi', 'ragingMagma'],
          cfg: { skin: 'plates', wing: 'flame', horn: 'flame', cracks: true, heads: 3, tail: 'spike', tailExt: 0.25, neck: 0.28, neckW: 0.45, thick: 1.2, headScale: 0.84, arms: true,
                 wings: [{ pos: 0.3, ws: 1.1 }, { pos: 0.46, ws: 0.64 }], combo: 'pincer', beam: 'blacksun' },
          roar: { fx: 'voidring', dmg: 10, pull: 0.8, slow: 60 },
          ab: [{ t: 'orbit', n: 4, kind: 'orb', R: 150, dmg: 4, col: '#c9a0ff', speed: 0.05 }, { t: 'nova', every: 480, R: 420, dmg: 12, col: '#ffcf6a', pull: 0.25 }],
          txt: { head: 'Üç baş kıskaç yapıp alevi tek noktada birleştirir.', beam: 'Hüzme ortasında ışığı yutan kapkara çekirdek, çevresinde beyaz korona vardır.', roar: 'Güçlü çekim dalgası: düşmanları içine çeker.', ab: 'Tutulma: dört kara küre etrafında döner ve çarptığı düşmana hasar verir.' } },

        { id: 'gelgitKazuma', name: 'Gelgit Kazuma', icon: '🌀', P: [Z, M], from: { body: 'A', wing: 'B', glow: 'M', horn: 'M' }, charge: 'tide', voice: ['kingsbane', 'coral'],
          cfg: { skin: 'scales', wing: 'fin', horn: 'branch', heads: 2, tail: 'fan', tailExt: 0.4, neck: 0.22, neckW: 0.46, thick: 1.0, whisk: true,
                 wings: [{ pos: 0.24, ws: 1 }, { pos: 0.42, ws: 0.62 }], combo: 'alternate', beam: 'comet' },
          roar: { fx: 'wave', dmg: 5, slow: 90, pull: -0.6 },
          ab: [{ t: 'trail', every: 6, life: 170, R: 66, dmg: 0.8, kind: 'water', col: '#4adfd0', slow: 90 }],
          txt: { head: 'İki baş dönüşümlü nöbet tutar; öndeki yakar, arkadaki dinlenir.', beam: 'Hüzme boyunca kuyruklu yıldız gibi su damlaları akar.', roar: 'Gelgit dalgası düşmanları geriye savurup yavaşlatır.', ab: 'Gelgit İzi: kuyruğunun ardında düşmanı yavaşlatan su girdapları bırakır.' } },

        { id: 'tuncAyna', name: 'Tunç Ayna', icon: '🛡️', P: [Z, A], from: { body: 'M', wing: 'B', glow: 'A', horn: 'A' }, charge: 'mirror', voice: ['kingsbane', 'mirrorbane'],
          cfg: { skin: 'scales', wing: 'tatter', horn: 'crescent', cracks: true, heads: 2, tail: 'sickle', tailExt: 0.3, neck: 0.2, neckW: 0.5, thick: 1.05, whisk: true, arms: true,
                 wings: [{ pos: 0.14, ws: 1.1 }, { pos: 0.34, ws: 0.66 }], combo: 'crossfire', beam: 'shatter' },
          roar: { fx: 'shards', dmg: 8, clear: 1, pull: -0.4 },
          ab: [{ t: 'orbit', n: 2, kind: 'shard', R: 105, dmg: 6, col: '#ffd27a', speed: 0.085 }, { t: 'reflect', R: 220, cd: 140, dmg: 12, col: '#ffd27a' }],
          txt: { head: 'Yansıması gibi ikinci bir baş: iki baş çapraz ateş eder.', beam: 'Bronz cam kırıkları ve aynadan sekmiş zikzak ışınlar.', roar: 'Kükreme mermileri kırıp düşmanları savurur.', ab: 'Tunç Yansıma: iki ayna kırığı seni çevreler, mermileri kırıp geri atar.' } },

        { id: 'altinKor', name: 'Altın Kor', icon: '☀️', P: [Z, R], from: { body: 'M', wing: 'B', glow: 'M', horn: 'A' }, charge: 'inferno', voice: ['kingsbane', 'ragingMagma'],
          po: { body: ['#ffe08a', '#a0560a', '#2a1000'], ridge: '#fff6d0', scale: '#b87a1a', scaleEdge: '#fff2b0', vein: '#ffcc33', eye: '#fffbd0', membrane: ['#ffb030', '#a02a08', '#2a0600'], flame: ['#ffffff', '#ffcc33', 'rgba(255,90,0,0)'], horn: ['#fff8d8', '#d9b060', '#3a2408'] },
          cfg: { skin: 'scales', wing: 'flame', horn: 'crescent', cracks: true, heads: 1, tail: 'sickle', tailExt: 0.3, neck: 0.1, neckW: 0.6, thick: 1.12, whisk: true, arms: true,
                 wings: [{ pos: 0.16, ws: 1.15 }, { pos: 0.36, ws: 0.66 }], beam: 'sun' },
          roar: { fx: 'sunburst', dmg: 16, burn: 1 },
          ab: [{ t: 'bolt', kind: 'homing', every: 70, count: 3, dmg: 8, col: '#ffd24a' }],
          txt: { head: 'Tek baş, ama kor gibi beyaz-sıcak alev.', beam: 'Güneş patlaması: ağızdan yayılan ışık huzmeleri ve altın halkalar.', roar: 'Güneş dalgası: yüksek hasar verip yakar.', ab: 'Güneş Topları: üç ateş küresi en yakın düşmanlara kilitlenip patlar.' } },

        { id: 'mercanAynasi', name: 'Mercan Aynası', icon: '💎', P: [M, A], from: { body: 'B', wing: 'A', glow: 'A', horn: 'M' }, charge: 'mirror', voice: ['coral', 'mirrorbane'],
          cfg: { skin: 'spots', wing: 'fin', horn: 'branch', cracks: true, heads: 2, tail: 'fan', tailExt: 0.3, neck: 0.22, neckW: 0.48, thick: 1.05, arms: true,
                 wings: [{ pos: 0.22, ws: 1 }, { pos: 0.42, ws: 0.62 }], combo: 'fan', beam: 'prism' },
          roar: { fx: 'shards', dmg: 6, slow: 100, clear: 1 },
          ab: [{ t: 'orbit', n: 5, kind: 'coral', R: 130, dmg: 4, col: '#ff8ab0', speed: 0.06 }],
          txt: { head: 'İki baş yelpaze açıp birbirinden bağımsız süpürür.', beam: 'Mercan kristalinden geçen hüzme gökkuşağına bölünür.', roar: 'Billur kükreme mermileri kırar, düşmanı yavaşlatır.', ab: 'Mercan Billurları: beş pembe kristal etrafında döner ve çarptığı düşmanı keser.' } },

        { id: 'mercanAtesi', name: 'Mercan Ateşi', icon: '🔥', P: [M, R], from: { body: 'M', wing: 'A', glow: 'B', horn: 'A' }, charge: 'inferno', voice: ['coral', 'ragingMagma'],
          cfg: { skin: 'spots', wing: 'flame', horn: 'branch', cracks: true, heads: 2, tail: 'fan', tailExt: 0.25, neck: 0.22, neckW: 0.48, thick: 1.1, arms: true,
                 wings: [{ pos: 0.2, ws: 1.1 }, { pos: 0.4, ws: 0.64 }], combo: 'gasIgnite', gasHeads: [0], gas: { col: '#ffb070', style: 'cloud' }, beam: 'lava' },
          roar: { fx: 'ember', dmg: 6, burn: 1, slow: 60 },
          ab: [{ t: 'trail', every: 6, life: 190, R: 60, dmg: 0.9, kind: 'reef', col: '#ff7a5a', slow: 30 }],
          txt: { head: 'Bir baş yanıcı mercan gazı üfler, diğeri tutuşturur: gaz bulutu boydan boya patlar.', beam: 'Hüzme lav kabuklarıyla kaplı, mercan kıvılcımları saçar.', roar: 'Kor kükremesi yakar ve yavaşlatır.', ab: 'Kor Resif: arkanda yanan mercan kayalıkları bırakır, değen düşman yanar.' } },

        { id: 'korAynasi', name: 'Kor Aynası', icon: '🪞', P: [A, R], from: { body: 'M', wing: 'A', glow: 'B', horn: 'A' }, charge: 'mirror', voice: ['mirrorbane', 'ragingMagma'],
          cfg: { skin: 'scales', wing: 'tatter', horn: 'swept', cracks: true, heads: 2, tail: 'fork', tailExt: 0.25, neck: 0.2, neckW: 0.52, thick: 1.12, arms: true,
                 wings: [{ pos: 0.14, ws: 1.1 }, { pos: 0.34, ws: 0.66 }], combo: 'pincer', beam: 'helix' },
          roar: { fx: 'sunburst', dmg: 12, burn: 1, clear: 1 },
          ab: [{ t: 'reflect', R: 240, cd: 100, dmg: 26, col: '#ff7a00' }],
          txt: { head: 'İki baş kıskaç yaparak alevi tek noktaya toplar.', beam: 'Kor ve ayna ışını birbirine sarılan çift sarmal oluşturur.', roar: 'Kor dalgası mermileri yok eder ve yakar.', ab: 'Erimiş Ayna: kırdığı mermiler ateş topuna dönüşüp düşmana döner.' } }
    ];

    // =====================================================================
    // 3) KAYIT: skinsDB + ORG_SKINS + yardımcı tablolar
    // =====================================================================
    const HMAP = {};
    safe(() => {
        let tier = Math.max(0, ...skinsDB.map(s => s.tier || 0));
        HYB.forEach((h, idx) => {
            const pa = parentOf(h.P[0]), pb = parentOf(h.P[1]);
            if (!pa || !pb) return;
            if (skinsDB.some(q => q.id === h.id)) return;
            const pal = buildPal(pa.pal, pb.pal, h.from);
            if (h.po) Object.assign(pal, h.po);
            pal.body = pal.body || pa.pal.body;
            const cfg = Object.assign({ pal }, h.cfg);
            if (cfg.heads === 1) delete cfg.heads;
            cfg.roar = h.roar.fx;
            ORG_SKINS[h.id] = cfg;
            h.pal = pal; h.parents = h.P.slice();
            const glow = pal.vein || '#ffffff', eye = pal.eye || '#ffffff';
            const lvl = clamp(Math.max(...h.P.map(p => (skinsDB.find(s => s.id === p) || {}).reqLvl || 0).filter(v => v < 900)) + 8, 100, 150);
            const attacks = [['🔥', 'Baş saldırısı', h.txt.head], ['⚡', 'Süper plazma', h.txt.beam], ['📢', 'Kükreme', h.txt.roar], ['✨', 'Yetenek', h.txt.ab]];
            skinsDB.push({ id: h.id, name: h.name, icon: h.icon, mainColor: glow, uiColor: glow, fireColor1: mixHex(eye, '#ffffff', 0.55), fireColor2: mixHex(pal.body[2], glow, 0.35),
                desc: '🧬 MELEZ: ' + parentOf(h.P[0]).name + ' × ' + parentOf(h.P[1]).name + '. ' + h.txt.ab,
                reqLvl: lvl, reqCoin: 16000 + idx * 1100, body: pal.body, eyeColor: eye, tier: ++tier, melez: true, parents: h.P.slice(), attacks });
            HMAP[h.id] = h;
            if (typeof CHARGE_STYLE !== 'undefined') CHARGE_STYLE[h.id] = h.charge;
            if (typeof ABIL_INFO !== 'undefined') ABIL_INFO[h.id] = '🧬 ' + h.txt.ab;
        });
        const saved = store.getItem('boruActiveSkin');
        if (saved && HMAP[saved] && saved !== activeTheme.id) { activeSkinId = saved; activeTheme = skinsDB.find(q => q.id === saved); applyThemeColors(); }
    }, 'kayıt');
    window.MELEZ = { list: HYB, map: HMAP };

    // Melez, ebeveynlerine sahip olmadan satın alınamaz
    safe(() => {
        const _buy = window.buySkin;
        window.buySkin = function (id) {
            const sk = skinsDB.find(s => s.id === id);
            if (sk && sk.parents && !sk.parents.every(p => unlockedSkins.includes(p))) return;
            return _buy.apply(this, arguments);
        };
    }, 'buy');

    // =====================================================================
    // 4) HEADFX: bağımsız boyun hareketi + baş başına alev + gaz/tutuşturma kombosu
    // =====================================================================
    const HF = window.HEADFX = {};
    const hsOf = (J) => J.__hs || (J.__hs = { heads: [], mode: 'idle', modeT: -9, gas: [], rings: [], tt: 0, beat: 0, lastUpd: 0 });
    function newHead(i) {
        return { sw: 0, fw: 0, ang: 0, lat: 1, bend: 0, t: 0, lunge: 0, lungeIn: 1.5 + rnd() * 3.5 + i * 0.7,
                 f1: 0.8 + rnd() * 0.7, f2: 1.7 + rnd() * 1.1, f3: 0.9 + rnd() * 0.8, f4: 0.6 + rnd() * 0.9, f5: 0.5 + rnd() * 0.7,
                 p1: rnd() * TAU, p2: rnd() * TAU, p3: rnd() * TAU, p4: rnd() * TAU, p5: rnd() * TAU };
    }
    HF.owns = function (J, id) {
        const c = ORG_SKINS[id];
        return !!(c && c.heads >= 2 && J.__heads && J.__heads.length >= c.heads && J.__heads.every(Boolean));
    };
    HF.rec = function (J, i, n, x, y, a, s) {
        const H = J.__heads || (J.__heads = []);
        H.length = n; H[i] = H[i] || {}; const h = H[i]; h.x = x; h.y = y; h.a = a; h.s = s;
    };
    HF.shift = function (J, dx, dy) { if (J.__heads) for (const h of J.__heads) if (h) { h.x += dx; h.y += dy; } };

    // Ateş ederken kombo türüne göre her boynun hedef duruşu
    function firePose(mode, cfg, i, n, side, T, hs) {
        const o = { sw: 0, fw: 0, ang: 0, lat: 1, bend: 0 };
        const sweep = Math.sin(T * 2.6 + i * 2.1);
        if (mode === 'fan') { o.ang = side * (0.34 + 0.1 * Math.sin(T * 2.0 + i)) + 0.12 * sweep; o.lat = 1.3; o.fw = 4 * Math.sin(T * 3 + i); o.bend = 5 * Math.sin(T * 2.2 + i * 1.7); }
        else if (mode === 'pincer') { o.ang = -side * 0.3; o.lat = 1.4; o.fw = 8; o.bend = 4 * Math.sin(T * 3 + i); }
        else if (mode === 'crossfire') { o.ang = -side * (0.5 + 0.18 * Math.sin(T * 1.6)); o.lat = 1.12; o.fw = 5; o.bend = 6 * Math.sin(T * 2 + i); }
        else if (mode === 'alternate') { const act = Math.floor(T * 2.0) % n; if (i === act) { o.fw = 22; o.ang = 0.05 * sweep; o.lat = 0.9; } else { o.fw = -5; o.ang = side * 0.5; o.lat = 1.2; } o.bend = 6 * Math.sin(T * 3 + i); }
        else if (mode === 'gasIgnite') {
            const gh = cfg.gasHeads || [0];
            if (gh.includes(i)) { o.fw = 14; o.ang = 0.05 * Math.sin(T * 3); o.lat = 0.8; o.bend = 5 * Math.sin(T * 4); }
            else { o.fw = 3; o.ang = -side * 0.1 + 0.06 * sweep; o.lat = 1.18; o.bend = 3 * Math.sin(T * 3 + i); }
        } else { o.ang = side * 0.2 + 0.28 * sweep; o.fw = 6 * Math.sin(T * 2.2 + i * 1.3); o.lat = 1.15; o.bend = 6 * Math.sin(T * 3 + i); }
        return o;
    }
    HF.pose = function (J, cfg, i, n) {
        const hs = hsOf(J), T = nowS(), H = hs.heads[i] || (hs.heads[i] = newHead(i));
        const dt = clamp(T - (H.t || T), 0, 0.1); H.t = T;
        const side = n === 1 ? 0 : (1 - 2 * i / (n - 1));
        const mode = (T - hs.modeT) < 0.3 ? hs.mode : 'idle';
        let tg;
        if (mode === 'beam') tg = { sw: 0, fw: 16, ang: 0, lat: 0.62, bend: 0 };
        else if (mode !== 'idle') tg = firePose(mode, cfg, i, n, side, T, hs);
        else {
            // Boşta: her boyun kendi frekans ve fazında sallanır; ara sıra biri öne atılıp "ısırır", biri etrafa bakar
            tg = { sw: Math.sin(T * H.f1 + H.p1) * 9 + Math.sin(T * H.f2 + H.p2) * 4, fw: Math.sin(T * H.f3 + H.p3) * 5,
                   ang: Math.sin(T * H.f4 + H.p4) * 0.2 + Math.sin(T * H.f5 * 0.5 + H.p5) * 0.12, lat: 1 + 0.18 * Math.sin(T * H.f5 + H.p1), bend: Math.sin(T * H.f3 * 1.3 + H.p2) * 9 };
            H.lungeIn -= dt;
            if (H.lungeIn <= 0) { H.lunge = 0.6; H.lungeIn = 2.4 + rnd() * 4; }
            if (H.lunge > 0) { H.lunge -= dt; const k = Math.sin(Math.PI * (1 - H.lunge / 0.6)); tg.fw += 24 * k; tg.ang += -side * 0.3 * k; tg.sw += -side * 5 * k; }
        }
        const k = 1 - Math.exp(-dt * (mode === 'idle' ? 7 : 10));
        H.sw += (tg.sw - H.sw) * k; H.fw += (tg.fw - H.fw) * k; H.ang += (tg.ang - H.ang) * k; H.lat += (tg.lat - H.lat) * k; H.bend += (tg.bend - H.bend) * k;
        return H;
    };

    // Güncelleme: alev, gaz, tutuşma. env: { k, firing, beam, G, n, fire(x,y,ang,spread,sizeMul,speedMul), nearFire, boom, gasHit }
    HF.update = function (J, cfg, env) {
        const n = cfg.heads | 0; if (n < 2) return false;
        const hs = hsOf(J), T = nowS(), combo = cfg.combo || (n === 2 ? 'twin' : 'fan');
        hs.mode = env.beam ? 'beam' : (env.firing ? combo : 'idle'); hs.modeT = T;
        const k = env.k, G = env.G, heads = J.__heads;
        const ok = heads && heads.length >= n && heads.every(Boolean);
        const gas = hs.gas, gcfg = cfg.gas || { col: '#9a8aff', style: 'cloud' };
        // --- gaz bulutları: sürüklenir, genişler, ateşe değince tutuşur ---
        if (k > 0) {
            for (let q = gas.length - 1; q >= 0; q--) {
                const p = gas[q];
                p.x += p.vx * k; p.y += p.vy * k; p.vx *= Math.pow(0.985, k); p.vy *= Math.pow(0.985, k); p.r += 0.5 * k * G; p.life -= k;
                if (p.life <= 0) { gas.splice(q, 1); continue; }
                if (p.ign === undefined && env.nearFire && env.nearFire(p.x, p.y, p.r * 0.75)) p.ign = 2 + rnd() * 3;
                if (p.ign !== undefined) {
                    p.ign -= k;
                    if (p.ign <= 0) {
                        // patlama: komşu bulutlara sıçrar (zincirleme)
                        for (const o of gas) if (o !== p && o.ign === undefined && (o.x - p.x) ** 2 + (o.y - p.y) ** 2 < (p.r + o.r) ** 2 * 1.1) o.ign = 3 + rnd() * 3;
                        const R = p.r * 1.45 + 26 * G;
                        hs.rings.push({ x: p.x, y: p.y, R, t: 0, col: p.col });
                        if (env.boom) env.boom(p.x, p.y, R, p);
                        gas.splice(q, 1); continue;
                    }
                } else if (env.gasHit && ((hs.beat + q) % 6 === 0)) env.gasHit(p);
            }
            for (let q = hs.rings.length - 1; q >= 0; q--) { const r = hs.rings[q]; r.t += k; if (r.t > 22) hs.rings.splice(q, 1); }
            hs.beat += k;
        }
        if (!ok || !env.firing || k <= 0) return ok && cfg.heads >= 2;
        // --- alev dağıtımı ---
        const gasHeads = combo === 'gasIgnite' ? (cfg.gasHeads || [0]) : [];
        const w = [];
        let tot = 0;
        for (let i = 0; i < n; i++) {
            let v = 1;
            if (combo === 'alternate') v = (Math.floor(T * 2.0) % n === i) ? 3 : 0.45;
            if (gasHeads.includes(i)) v = 0;
            w.push(v); tot += v;
        }
        // kıskaç: hedef nokta; gaz-tutuşturma: gaz hattı
        let aimPt = null;
        if (combo === 'pincer') { let cx = 0, cy = 0, ca = 0; for (const h of heads) { cx += h.x; cy += h.y; ca += h.a; } ca /= n; aimPt = { x: cx / n + Math.cos(ca) * 250 * G, y: cy / n + Math.sin(ca) * 250 * G }; }
        else if (combo === 'gasIgnite') { const h0 = heads[gasHeads[0] || 0]; aimPt = { x: h0.x + Math.cos(h0.a) * 230 * G, y: h0.y + Math.sin(h0.a) * 230 * G }; }
        for (let i = 0; i < n; i++) {
            const h = heads[i]; if (!h) continue;
            const mx = h.x + Math.cos(h.a) * 34 * G, my = h.y + Math.sin(h.a) * 34 * G;
            if (gasHeads.includes(i)) {
                hs.gasAcc = (hs.gasAcc || 0) + 0.38 * k;
                while (hs.gasAcc >= 1 && gas.length < 70) {
                    hs.gasAcc -= 1; const sp = 3.4 + rnd() * 2.6, a = h.a + (rnd() - 0.5) * 0.34;
                    gas.push({ x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: (12 + rnd() * 8) * G, life: 62 + rnd() * 26, max: 88, col: gcfg.col, st: gcfg.style, sd: rnd() * 6 });
                }
                hs.gasAcc = Math.min(hs.gasAcc, 3);
                continue;
            }
            if (w[i] <= 0 || tot <= 0) continue;
            const c = env.n * (w[i] / tot) * (n > 2 ? 1.1 : 1);
            let cnt = Math.floor(c) + (rnd() < c - Math.floor(c) ? 1 : 0); if (cnt < 1 && rnd() < c) cnt = 1;
            for (let q = 0; q < cnt; q++) {
                let a = h.a, spr = (rnd() - 0.5) * 0.4;
                if (aimPt && (combo === 'pincer' || combo === 'gasIgnite')) { a = Math.atan2(aimPt.y - my, aimPt.x - mx); spr *= combo === 'gasIgnite' ? 0.35 : 0.6; }
                env.fire(mx, my, a, spr, 1, 1);
            }
        }
        return true;
    };
    HF.mouths = function (J, G) { return (J.__heads || []).filter(Boolean).map(h => ({ x: h.x + Math.cos(h.a) * 34 * G, y: h.y + Math.sin(h.a) * 34 * G })); };

    // Gaz bulutları, patlama halkaları (ctx koordinatı = dünya + (ox, oy))
    HF.draw = function (J, c, ox, oy, G) {
        const hs = J.__hs; if (!hs || (!hs.gas.length && !hs.rings.length)) return;
        c.save();
        for (const p of hs.gas) {
            const x = p.x + ox, y = p.y + oy, f = clamp(p.life / p.max, 0, 1), al = Math.min(1, f * 1.5) * 0.55;
            if (p.st === 'bubble') {
                c.globalCompositeOperation = 'source-over'; c.strokeStyle = hexA(p.col, 0.8 * Math.min(1, f * 2)); c.lineWidth = 2 * G; c.fillStyle = hexA(p.col, 0.12 * Math.min(1, f * 2));
                c.beginPath(); c.arc(x, y, p.r * 0.8, 0, TAU); c.fill(); c.stroke();
                c.strokeStyle = 'rgba(255,255,255,' + 0.7 * Math.min(1, f * 2) + ')'; c.lineWidth = 1.6 * G; c.beginPath(); c.arc(x, y, p.r * 0.55, 3.7, 4.6); c.stroke();
            } else {
                c.globalCompositeOperation = 'source-over';
                const g = c.createRadialGradient(x, y, 0, x, y, p.r); g.addColorStop(0, hexA(p.col, al)); g.addColorStop(0.6, hexA(p.col, al * 0.5)); g.addColorStop(1, hexA(p.col, 0));
                c.fillStyle = g; c.beginPath(); c.arc(x, y, p.r, 0, TAU); c.fill();
            }
            if (p.ign !== undefined) { c.globalCompositeOperation = 'lighter'; const g2 = c.createRadialGradient(x, y, 0, x, y, p.r * 1.1); g2.addColorStop(0, 'rgba(255,240,180,0.8)'); g2.addColorStop(1, 'rgba(255,90,20,0)'); c.fillStyle = g2; c.beginPath(); c.arc(x, y, p.r * 1.1, 0, TAU); c.fill(); }
        }
        c.globalCompositeOperation = 'lighter';
        for (const r of hs.rings) {
            const u = r.t / 22, x = r.x + ox, y = r.y + oy;
            const g = c.createRadialGradient(x, y, 0, x, y, r.R * (0.5 + u * 0.7)); g.addColorStop(0, 'rgba(255,250,210,' + (1 - u) + ')'); g.addColorStop(0.45, 'rgba(255,130,30,' + 0.8 * (1 - u) + ')'); g.addColorStop(1, 'rgba(120,20,0,0)');
            c.fillStyle = g; c.beginPath(); c.arc(x, y, r.R * (0.5 + u * 0.7), 0, TAU); c.fill();
            c.strokeStyle = hexA(r.col && isHex(r.col) ? r.col : '#ffaa40', 0.9 * (1 - u)); c.lineWidth = 6 * G * (1 - u) + 1; c.beginPath(); c.arc(x, y, r.R * (0.3 + u * 0.9), 0, TAU); c.stroke();
        }
        c.restore();
    };
    HF.reset = function (J) { if (J) { delete J.__hs; } };

    // =====================================================================
    // 5) OYUN ORTAMI (alev parçacıkları, hasar)
    // =====================================================================
    const MS = { id: '', t: 0, orbs: [], zones: [], novas: [], fx: [], bolts: [], balls: [], burn: new Map(), roars: [], pulled: new Set(), cd: [], px: 0, py: 0, vx: 0, vy: 0, err: 0 };
    function resetMS() { MS.orbs.length = 0; MS.zones.length = 0; MS.novas.length = 0; MS.fx.length = 0; MS.bolts.length = 0; MS.balls.length = 0; MS.burn.clear(); MS.roars.length = 0; MS.pulled.clear(); MS.cd = []; }
    safe(() => {
        const _reset = resetAbilities;
        resetAbilities = window.resetAbilities = function () { resetMS(); try { HF.reset(joints); } catch (e) {} return _reset.apply(this, arguments); };
    }, 'reset');

    function gameEnv(G, firing, beam, paused) {
        const want = Math.max(1, Math.ceil(stats.fireVolume * (isRageActive ? 2 : 1)));
        const cap = Math.max(50, (isRageActive ? 300 : 150) * gfxMultMap[gfxQuality] * FX.q) + (MP.active ? (isMobile ? 40 : 120) * FX.q : 0);
        const decay = equippedBlackMarket.toxicBreath ? 0.0145 : 0.029;
        const n = Math.max(2, Math.min(want, Math.floor(cap / (1 / decay))));
        const kk = want / n, sK = Math.min(1.7, Math.sqrt(kk));
        const pw = kk > 1.01 ? stats.fireDamage * (isRageActive ? 3 : 1) * kk : undefined;
        const D = Math.max(6, stats.fireDamage || 10);
        const buffs = !MP.noSkinBuffs;
        return {
            k: paused ? 0 : 1, firing, beam, G, n,
            fire(x, y, a, spread, sizeMul, speedMul) {
                const fSpeed = (rnd() * 6 + 6.8) * (1 + Math.max(0, G - 1.7) * 0.6) * (speedMul || 1), f0 = rnd();
                fireParticles.push({ x: x + Math.cos(a) * fSpeed * f0, y: y + Math.sin(a) * fSpeed * f0, vx: Math.cos(a + spread) * fSpeed + MS.vx * 0.7, vy: Math.sin(a + spread) * fSpeed + MS.vy * 0.7,
                    life: 1.0, decay, size: (rnd() * 16 + 14) * stats.fireSizeMult * G * sK * (sizeMul || 1), growth: rnd() * 2.5 + 1.5, isBlue: isRageActive, pw, rot: rnd() * 6.28 });
            },
            nearFire(x, y, r) { return typeof fireNear === 'function' ? fireNear(x, y, r).length > 0 : false; },
            boom(x, y, R) {
                if (buffs) for (const e of enemies) if ((e.x - x) ** 2 + (e.y - y) ** 2 < (R + (e.size || 20)) ** 2 && (e._mb || 0) < MS.t) { e._mb = MS.t + 6; abHit(e, D * 7); }
                for (let q = 0; q < 3; q++) { const a = q / 3 * TAU + rnd(); fireParticles.push({ x, y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, life: 1, decay: 0.045, size: 22 * G, growth: 2.4, isBlue: false, pw: stats.fireDamage * 1.5, rot: rnd() * 6 }); }
                if ((MS.t & 3) === 0) applyShake(3);
            },
            gasHit(p) { if (!buffs) return; for (const e of enemies) if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < (p.r * 1.1 + (e.size || 20)) ** 2) { e.slowTimer = Math.max(e.slowTimer || 0, 50); abHit(e, D * 0.25); } }
        };
    }

    // =====================================================================
    // 6) SÜPER PLAZMA: yeni hüzme stilleri + her başın kendi ışını
    // =====================================================================
    const hn = () => ((joints.__heads || []).length) || 2;
    function headBeams(len, g, C1, C2, CM) {
        const J = joints, H = J.__heads; if (!H || H.length < 2 || !H.every(Boolean)) return;
        const c = ctx, a = J[0].angle, ca = Math.cos(a), sa = Math.sin(a), sx = J[0].x + ca * 40 * g, sy = J[0].y + sa * 40 * g;
        c.save(); c.lineCap = 'round';
        for (const h of H) {
            const dx = h.x - sx, dy = h.y - sy, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca, cx = len * 0.2;
            const w0 = 22 * g, w1 = 52 * g;
            c.beginPath(); c.moveTo(lx, ly - w0); c.quadraticCurveTo(cx * 0.5, ly * 0.35 - w0 * 1.1, cx, -w1); c.lineTo(cx, w1); c.quadraticCurveTo(cx * 0.5, ly * 0.35 + w0 * 1.1, lx, ly + w0); c.closePath();
            c.fillStyle = hexA(CM, 0.55); c.shadowBlur = 24; c.shadowColor = CM; c.fill();
            c.beginPath(); c.moveTo(lx, ly); c.quadraticCurveTo(cx * 0.5, ly * 0.35, cx, 0); c.strokeStyle = hexA(C1, 0.95); c.lineWidth = 9 * g; c.stroke();
            const rg = c.createRadialGradient(lx, ly, 0, lx, ly, 46 * g); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.4, hexA(C1, 0.8)); rg.addColorStop(1, hexA(CM, 0));
            c.shadowBlur = 0; c.fillStyle = rg; c.beginPath(); c.arc(lx, ly, 46 * g, 0, TAU); c.fill();
        }
        c.restore();
    }
    // Hüzmenin beyaza yanmasını önleyip kostümün rengini verir: ana katmanların üstüne yarı saydam koyu renk bandı
    function beamTint(len, g, pl, C2) {
        const c = ctx; c.save(); c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0; c.beginPath();
        for (let s = 0; s <= 24; s++) { const t = s / 24, w = (46 + t * 140) * g * 0.95 * Math.min(1, t * 5.5) * pl; s ? c.lineTo(t * len, -w / 2) : c.moveTo(0, -w / 2); }
        for (let s = 24; s >= 0; s--) { const t = s / 24, w = (46 + t * 140) * g * 0.95 * Math.min(1, t * 5.5) * pl; c.lineTo(t * len, w / 2); }
        c.closePath(); c.fillStyle = hexA(C2, 0.6); c.fill(); c.restore();
    }
    const BEAMS = {
        multi() {},
        helix(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick, ns = Math.max(2, Math.min(4, hn())); c.lineCap = 'round';
            for (let s = 0; s < ns; s++) {
                const ph = s / ns * TAU;
                c.beginPath(); for (let q = 0; q <= 60; q++) { const t = q / 60, x = t * len * 0.85, y = Math.sin(t * 26 - T * 11 + ph) * (26 + t * 90) * g * pl; q ? c.lineTo(x, y) : c.moveTo(x, y); }
                c.globalCompositeOperation = 'source-over'; c.strokeStyle = hexA(C2, 0.85); c.lineWidth = 12 * g; c.stroke(); c.globalCompositeOperation = 'lighter';
                c.strokeStyle = hexA(s % 2 ? C1 : CM, 0.95); c.lineWidth = 6 * g; c.shadowBlur = 14; c.shadowColor = CM; c.stroke();
                for (let q = 2; q < 60; q += 6) { const t = q / 60, x = t * len * 0.85, y = Math.sin(t * 26 - T * 11 + ph) * (26 + t * 90) * g * pl; c.fillStyle = C1; c.beginPath(); c.arc(x, y, (5 + t * 5) * g, 0, TAU); c.fill(); }
            }
            c.shadowBlur = 0;
        },
        bubble(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick;
            for (let k = 0; k < 24; k++) {
                const t = (T * 0.5 + k * 0.0417) % 1, x = t * len * 0.82, y = Math.sin(k * 3.1 + T * 3) * (20 + t * 90) * g, Rr = (10 + (k % 5) * 5 + t * 16) * g;
                c.strokeStyle = hexA(CM, 0.85 * (1 - t * 0.5)); c.lineWidth = 2.5 * g; c.fillStyle = hexA(C2, 0.18);
                c.beginPath(); c.arc(x, y, Rr, 0, TAU); c.fill(); c.stroke();
                c.strokeStyle = hexA(C1, 0.9); c.beginPath(); c.arc(x, y, Rr * 0.62, 3.6, 4.5); c.stroke();
                if (t > 0.9) { c.fillStyle = hexA(C1, 0.9); for (let m = 0; m < 5; m++) { const a = m * 1.26 + k; c.beginPath(); c.arc(x + Math.cos(a) * Rr * 1.4, y + Math.sin(a) * Rr * 1.4, 3 * g, 0, TAU); c.fill(); } }
            }
        },
        shatter(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick;
            for (let k = 0; k < 14; k++) {
                const t = (T * 0.8 + k * 0.0714) % 1, x = t * len * 0.85, y = Math.sin(k * 2.7 + 1) * 70 * g * t * (k % 2 ? 1 : -1), Rr = (14 + t * 30) * g;
                c.save(); c.translate(x, y); c.rotate(T * 9 + k); c.fillStyle = hexA(k % 2 ? C1 : CM, 0.85); c.shadowBlur = 12; c.shadowColor = CM;
                c.beginPath(); c.moveTo(Rr, 0); c.lineTo(-Rr * 0.35, -Rr * 0.6); c.lineTo(-Rr * 0.7, 0); c.lineTo(-Rr * 0.35, Rr * 0.55); c.closePath(); c.fill(); c.restore();
            }
            c.shadowBlur = 0; c.strokeStyle = hexA(C1, 0.9); c.lineWidth = 3 * g; c.lineJoin = 'miter';
            for (const s of [1, -1]) { c.beginPath(); for (let q = 0; q <= 22; q++) { const t = q / 22, x = t * len * 0.8, y = s * ((q % 2) ? 1 : -1) * (24 + t * 70) * g * (0.6 + 0.4 * Math.sin(T * 10 + q)); q ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
        },
        lava(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick;
            c.globalCompositeOperation = 'source-over';
            for (let k = 0; k < 16; k++) { const t = (T * 0.35 + k * 0.0625) % 1, x = t * len * 0.8, y = Math.sin(k * 4.1) * (20 + t * 60) * g;
                c.save(); c.translate(x, y); c.rotate(k); c.fillStyle = 'rgba(28,9,4,0.85)'; c.strokeStyle = hexA(CM, 0.9); c.lineWidth = 2 * g;
                c.beginPath(); c.ellipse(0, 0, (18 + t * 22) * g, (9 + t * 11) * g, 0, 0, TAU); c.fill(); c.stroke(); c.restore(); }
            c.globalCompositeOperation = 'lighter';
            for (let k = 0; k < 22; k++) { const t = (T * 0.6 + k * 0.0455) % 1, x = t * len * 0.8, y = (Math.sin(k * 2.3) * 30 + t * t * 120 * (k % 2 ? 1 : -1)) * g;
                const gr = c.createRadialGradient(x, y, 0, x, y, (9 + t * 8) * g); gr.addColorStop(0, '#fff6c0'); gr.addColorStop(0.5, hexA(CM, 0.9)); gr.addColorStop(1, hexA(C2, 0));
                c.fillStyle = gr; c.beginPath(); c.arc(x, y, (9 + t * 8) * g, 0, TAU); c.fill(); }
        },
        storm2(len, g, pl, C1, C2, CM) {
            const c = ctx; c.lineCap = 'round'; c.shadowColor = CM; c.shadowBlur = 16;
            const bolt = (x, y, a, L, d, w) => {
                c.beginPath(); c.moveTo(x, y); let px = x, py = y; const segs = 7, forks = [];
                for (let i = 0; i < segs; i++) { a += (rnd() - 0.5) * 0.9; px += Math.cos(a) * L / segs; py += Math.sin(a) * L / segs; c.lineTo(px, py); if (d < 2 && rnd() < 0.3) forks.push([px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.5)]); }
                c.strokeStyle = hexA(d ? CM : C1, d ? 0.7 : 0.95); c.lineWidth = w * g; c.stroke();
                for (const f of forks) bolt(f[0], f[1], f[2], L * 0.45, d + 1, w * 0.55);
            };
            for (let k = 0; k < 4; k++) bolt(0, (k - 1.5) * 16 * g, (rnd() - 0.5) * 0.14, len * 0.55, 0, 5);
            c.shadowBlur = 0;
        },
        tide(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick; c.lineCap = 'round';
            for (let k = 0; k < 10; k++) { const t = (T * 0.45 + k * 0.1) % 1, x = t * len * 0.8, Rr = (40 + t * 110) * g;
                c.strokeStyle = hexA(CM, 0.7 * (1 - t)); c.lineWidth = 6 * g; c.beginPath(); c.arc(x - Rr * 0.6, 0, Rr, -1.0, 1.0); c.stroke();
                c.strokeStyle = hexA(C1, 0.5 * (1 - t)); c.lineWidth = 2 * g; c.beginPath(); c.arc(x - Rr * 0.6, 0, Rr * 0.88, -0.9, 0.9); c.stroke(); }
            c.fillStyle = hexA(C1, 0.8); for (let k = 0; k < 26; k++) { const t = (T * 0.7 + k * 0.0385) % 1; c.beginPath(); c.arc(t * len * 0.8, Math.sin(k * 5.1 + T * 4) * (30 + t * 80) * g, (3 + (k % 3)) * g, 0, TAU); c.fill(); }
        },
        prism(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick, cols = ['#ff4d6d', '#ffb34d', '#fff04d', '#4dff9a', '#4dc9ff', '#a64dff']; c.lineCap = 'round';
            for (let i = 0; i < 6; i++) {
                c.save(); c.rotate((i - 2.5) * 0.05 + Math.sin(T * 3 + i) * 0.012);
                const gr = c.createLinearGradient(0, 0, len * 0.9, 0); gr.addColorStop(0, hexA(cols[i], 0.95)); gr.addColorStop(1, hexA(cols[i], 0));
                c.strokeStyle = gr; c.lineWidth = 14 * g; c.shadowBlur = 16; c.shadowColor = cols[i]; c.beginPath(); c.moveTo(20 * g, 0); c.lineTo(len * 0.9, 0); c.stroke(); c.restore();
            }
            c.shadowBlur = 0; c.fillStyle = '#ffffff'; for (let k = 0; k < 14; k++) { const t = (T * 0.6 + k * 0.071) % 1; c.globalAlpha = 1 - t; c.beginPath(); c.arc(t * len * 0.8, Math.sin(k * 3.7 + T * 5) * 60 * g * t, 3 * g, 0, TAU); c.fill(); } c.globalAlpha = 1;
        },
        blacksun(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick; c.globalCompositeOperation = 'source-over';
            c.beginPath(); for (let s = 0; s <= 24; s++) { const t = s / 24, w = (22 + t * 70) * g * 0.55 * pl * Math.min(1, t * 6); s ? c.lineTo(t * len * 0.88, -w) : c.moveTo(0, -w); }
            for (let s = 24; s >= 0; s--) { const t = s / 24, w = (22 + t * 70) * g * 0.55 * pl * Math.min(1, t * 6); c.lineTo(t * len * 0.88, w); }
            c.closePath(); c.fillStyle = 'rgba(2,0,6,0.94)'; c.fill();
            c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(C1, 0.9); c.lineWidth = 4 * g; c.shadowBlur = 18; c.shadowColor = CM; c.stroke(); c.shadowBlur = 0;
            for (let k = 0; k < 34; k++) { const t = (T * 0.5 + k * 0.0294) % 1, x = (1 - t) * len * 0.7, r = (1 - t) * 120 * g + 12 * g, a = T * 4 + k * 2.1;
                c.fillStyle = hexA(k % 2 ? C1 : CM, 0.9 * (1 - t * 0.4)); c.fillRect(x - 2 * g, Math.sin(a) * r - 2 * g, 5 * g, 5 * g); }
        },
        comet(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick; c.lineCap = 'round';
            for (let k = 0; k < 13; k++) { const t = (T * 0.9 + k * 0.0769) % 1, x = t * len * 0.85, y = (Math.sin(k * 2.4) * 36 * (0.4 + t) + Math.sin(T * 5 + k) * 8) * g, Rr = (7 + (k % 4) * 2 + t * 8) * g;
                const gr = c.createLinearGradient(x, y, x - 130 * g, y); gr.addColorStop(0, hexA(CM, 0.9)); gr.addColorStop(1, hexA(C2, 0));
                c.strokeStyle = gr; c.lineWidth = Rr * 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 130 * g, y); c.stroke();
                const rg = c.createRadialGradient(x, y, 0, x, y, Rr * 1.6); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.4, hexA(C1, 0.9)); rg.addColorStop(1, hexA(CM, 0)); c.fillStyle = rg; c.beginPath(); c.arc(x, y, Rr * 1.6, 0, TAU); c.fill(); }
        },
        sun(len, g, pl, C1, C2, CM) {
            const c = ctx, T = tick; c.lineCap = 'round';
            for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + T * 0.8, L = (150 + 100 * Math.sin(T * 3 + k * 1.7)) * g; c.strokeStyle = hexA(k % 2 ? C1 : CM, 0.6); c.lineWidth = 5 * g; c.beginPath(); c.moveTo(Math.cos(a) * 40 * g, Math.sin(a) * 40 * g); c.lineTo(Math.cos(a) * L, Math.sin(a) * L); c.stroke(); }
            for (let k = 0; k < 8; k++) { const t = (T * 0.5 + k * 0.125) % 1, x = t * len * 0.8, Rr = (50 + t * 90) * g; c.strokeStyle = hexA(C1, 0.8 * (1 - t)); c.lineWidth = 6 * g; c.beginPath(); c.ellipse(x, 0, Rr * 0.3, Rr, 0, 0, TAU); c.stroke(); }
        }
    };
    safe(() => {
        const _beam = orgBeamFx;
        orgBeamFx = function (style, len, gF, pulse, C1, C2, CM) {
            if (BEAMS[style]) {
                try { if (style !== 'multi') beamTint(len, gF, pulse, C2); headBeams(len, gF, C1, C2, CM); BEAMS[style](len, gF, pulse, C1, C2, CM); } finally { ctx.shadowBlur = 0; }
                return;
            }
            _beam.apply(this, arguments);
            if (hn() > 1 && joints.__heads && joints.__heads.length > 1 && ORG_SKINS[activeTheme.id] && ORG_SKINS[activeTheme.id].heads > 1) headBeams(len, gF, C1, C2, CM);
        };
    }, 'beam');

    // =====================================================================
    // 7) KÜKREME: yeni dalga görselleri + oyun etkisi (çekme, yavaşlatma, yakma, mermi kırma)
    // =====================================================================
    const ROARS = {
        ember(c, r, col) { c.fillStyle = hexA(col, r.life); for (let k = 0; k < 32; k++) { const a = -ROAR_ARC + 2 * ROAR_ARC * (k + 0.5) / 32, rr = r.radius * (0.55 + ((k * 7) % 10) / 10 * 0.4); c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr, 3 + (k % 4) * 1.6, 0, TAU); c.fill(); c.strokeStyle = hexA(col, r.life * 0.5); c.lineWidth = 2; c.beginPath(); c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); c.lineTo(Math.cos(a) * (rr - 22), Math.sin(a) * (rr - 22) - 8); c.stroke(); } },
        voidring(c, r, col) { c.strokeStyle = 'rgba(0,0,0,' + 0.85 * r.life + ')'; c.lineWidth = 18 * r.life + 2; c.beginPath(); c.arc(0, 0, r.radius * 0.9, -ROAR_ARC, ROAR_ARC); c.stroke(); c.strokeStyle = hexA(col, r.life); c.lineWidth = 3; c.stroke();
            for (let k = 0; k < 14; k++) { const a = -ROAR_ARC + 2 * ROAR_ARC * (k + 0.5) / 14, r0 = r.radius * 1.02, r1 = r.radius * 0.8; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.strokeStyle = hexA(col, r.life * 0.8); c.lineWidth = 3; c.stroke(); } },
        shards(c, r, col) { for (let k = 0; k < 18; k++) { const a = -ROAR_ARC + 2 * ROAR_ARC * (k + 0.5) / 18, rr = r.radius * (0.7 + ((k * 5) % 7) / 7 * 0.3); c.save(); c.translate(Math.cos(a) * rr, Math.sin(a) * rr); c.rotate(a + k);
            c.fillStyle = 'rgba(255,255,255,' + 0.85 * r.life + ')'; c.strokeStyle = hexA(col, r.life); c.lineWidth = 2; c.beginPath(); c.moveTo(16, 0); c.lineTo(-6, -7); c.lineTo(-12, 0); c.lineTo(-6, 8); c.closePath(); c.fill(); c.stroke(); c.restore(); } },
        wave(c, r, col) { for (let k = 0; k < 3; k++) { c.strokeStyle = hexA(col, r.life * (0.9 - k * 0.25)); c.lineWidth = 6 - k; c.beginPath(); for (let q = 0; q <= 36; q++) { const a = -ROAR_ARC + 2 * ROAR_ARC * q / 36, rr = r.radius * (0.92 - k * 0.12) + Math.sin(q * 1.4 + tick * 6) * 9; q ? c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); }
            c.fillStyle = 'rgba(255,255,255,' + 0.8 * r.life + ')'; for (let k = 0; k < 20; k++) { const a = -ROAR_ARC + 2 * ROAR_ARC * (k + 0.5) / 20; c.beginPath(); c.arc(Math.cos(a) * r.radius * 0.93, Math.sin(a) * r.radius * 0.93, 3, 0, TAU); c.fill(); } },
        sunburst(c, r, col) { c.strokeStyle = hexA(col, r.life); c.lineCap = 'round'; for (let k = 0; k < 20; k++) { const a = -ROAR_ARC + 2 * ROAR_ARC * (k + 0.5) / 20, r0 = r.radius * 0.5, r1 = r.radius * (k % 2 ? 0.95 : 1.1); c.lineWidth = k % 2 ? 3 : 6 * r.life + 2; c.beginPath(); c.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); c.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); c.stroke(); }
            c.fillStyle = 'rgba(255,240,180,' + 0.2 * r.life + ')'; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r.radius * 0.6, -ROAR_ARC, ROAR_ARC); c.closePath(); c.fill(); },
        bolts(c, r, col) { c.strokeStyle = hexA(col, r.life); c.lineWidth = 3; c.lineCap = 'round'; c.shadowBlur = 12; c.shadowColor = col; for (let k = 0; k < 8; k++) { const a = -ROAR_ARC + 2 * ROAR_ARC * (k + 0.5) / 8; c.beginPath(); c.moveTo(0, 0); let px = 0, py = 0; for (let q = 1; q <= 9; q++) { const rr = r.radius * q / 9; px = Math.cos(a) * rr + (rnd() - 0.5) * 22; py = Math.sin(a) * rr + (rnd() - 0.5) * 22; c.lineTo(px, py); } c.stroke(); } c.shadowBlur = 0; },
        bubbles(c, r, col) { c.lineWidth = 2.5; for (let k = 0; k < 22; k++) { const a = -ROAR_ARC + 2 * ROAR_ARC * (k + 0.5) / 22, rr = r.radius * (0.55 + ((k * 3) % 8) / 8 * 0.42), Rb = 6 + (k % 5) * 3; c.strokeStyle = hexA(col, r.life * 0.9); c.fillStyle = hexA(col, r.life * 0.12); c.beginPath(); c.arc(Math.cos(a) * rr, Math.sin(a) * rr - Math.sin(tick * 3 + k) * 4, Rb, 0, TAU); c.fill(); c.stroke(); } }
    };
    safe(() => {
        const _rf = orgRoarFx;
        orgRoarFx = function (style, r, rCol) {
            if (ROARS[style]) { const c = ctx; c.save(); c.translate(r.x - camX, r.y - camY); c.rotate(r.angle); try { ROARS[style](c, r, rCol); } finally { c.restore(); } return; }
            return _rf.apply(this, arguments);
        };
        const _tr = triggerRoar;
        triggerRoar = window.triggerRoar = function () {
            const before = roarCooldown;
            const res = _tr.apply(this, arguments);
            const hy = HMAP[activeTheme.id];
            if (hy && before <= 0 && roarCooldown > 0 && !MP.noSkinBuffs) MS.roars.push({ x: joints[0].x, y: joints[0].y, a: joints[0].angle, radius: 20, life: 1, hit: new Set(), rc: hy.roar });
            return res;
        };
        // Ses: iki ebeveynin sesi üst üste
        const _prs = playRoarSound;
        playRoarSound = window.playRoarSound = function (key, pos) {
            const hy = HMAP[activeTheme.id];
            if (key || !hy) return _prs.apply(this, arguments);
            try { SND.roar(hy.voice[0], null, { pitch: 0.92 }); setTimeout(() => { try { SND.roar(hy.voice[1], null, { pitch: 1.1, quiet: true }); } catch (e) {} }, 45); } catch (e) { return _prs.apply(this, arguments); }
        };
    }, 'roar');

    // =====================================================================
    // 8) PASİF YETENEKLER
    // =====================================================================
    function fxAdd(o) { if (MS.fx.length < 90) MS.fx.push(Object.assign({ t: 0, life: 20 }, o)); }
    function chain(from, a, D, nearby) {
        const got = new Set(), pts = [{ x: from.x, y: from.y }];
        let cur = abNearest(from.x, from.y, a.range * 1, got);
        for (let i = 0; i < a.count && cur; i++) { got.add(cur); abHit(cur, D * a.dmg); pts.push({ x: cur.x, y: cur.y }); cur = abNearest(cur.x, cur.y, 300, got); }
        if (pts.length > 1) MS.bolts.push({ pts, t: 0, col: a.col });
        return pts.length > 1;
    }
    function drawOrb(c, kind, x, y, ang, col, G, P) {
        c.save(); c.translate(x, y);
        if (kind === 'sickle') { c.rotate(ang + Math.PI / 2 + tick * 8); const Rr = 30 * G; c.fillStyle = col; c.strokeStyle = '#1a0a02'; c.lineWidth = 1.5; c.shadowBlur = 12; c.shadowColor = col;
            c.beginPath(); c.arc(0, 0, Rr, 0, Math.PI * 1.3); c.arc(Rr * 0.25, -Rr * 0.1, Rr * 0.78, Math.PI * 1.3, 0, true); c.closePath(); c.fill(); c.stroke(); }
        else if (kind === 'shard') { c.rotate(ang * 2 + tick * 5); const Rr = 24 * G; c.fillStyle = 'rgba(255,255,255,0.9)'; c.strokeStyle = col; c.lineWidth = 2.5; c.shadowBlur = 12; c.shadowColor = col;
            c.beginPath(); c.moveTo(Rr, 0); c.lineTo(0, -Rr * 0.5); c.lineTo(-Rr * 0.8, 0); c.lineTo(0, Rr * 0.5); c.closePath(); c.fill(); c.stroke(); }
        else if (kind === 'coral') { c.rotate(ang + tick * 3); const Rr = 22 * G; c.strokeStyle = col; c.fillStyle = '#fff0f5'; c.lineWidth = 4 * G; c.lineCap = 'round'; c.shadowBlur = 10; c.shadowColor = col;
            for (let m = -1; m <= 1; m++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(m * 0.7) * Rr, Math.sin(m * 0.7) * Rr); c.stroke(); c.beginPath(); c.arc(Math.cos(m * 0.7) * Rr, Math.sin(m * 0.7) * Rr, 3.4 * G, 0, TAU); c.fill(); } }
        else { c.globalCompositeOperation = 'source-over'; const Rr = 20 * G; c.fillStyle = '#05000a'; c.beginPath(); c.arc(0, 0, Rr, 0, TAU); c.fill(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(col, 0.95); c.lineWidth = 4 * G; c.shadowBlur = 16; c.shadowColor = col; c.beginPath(); c.arc(0, 0, Rr, 0, TAU); c.stroke(); }
        c.restore();
    }
    function abilityFrame(hy, S, G, live) {
        const n = joints.length, c = ctx, D = Math.max(6, stats.fireDamage || 10), H = joints[0];
        const mouth = { x: H.x + Math.cos(H.angle) * 50 * G * S, y: H.y + Math.sin(H.angle) * 50 * G * S };
        const hiQ = gfxQuality !== 'low';
        hy.ab.forEach((a, i) => {
            if (MS.cd[i] === undefined) MS.cd[i] = a.every ? a.every * 0.4 : 0;
            if (live && MS.cd[i] > 0) MS.cd[i]--;
            if (a.t === 'nova') {
                const hj = joints[Math.min(n - 1, Math.round(n * 0.32))], pu = 0.6 + 0.4 * Math.sin(tick * 6);
                c.save(); c.globalCompositeOperation = 'lighter'; const rg = c.createRadialGradient(hj.x - camX, hj.y - camY, 0, hj.x - camX, hj.y - camY, 28 * G * S); rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.35, hexA(a.col, 0.8 * pu)); rg.addColorStop(1, hexA(a.col, 0)); c.fillStyle = rg; c.beginPath(); c.arc(hj.x - camX, hj.y - camY, 28 * G * S, 0, TAU); c.fill(); c.restore();
                if (live && MS.cd[i] <= 0) { MS.cd[i] = a.every; MS.novas.push({ x: hj.x, y: hj.y, t: 0, a, hit: new Set() }); applyShake(7); }
            } else if (a.t === 'orbit') {
                const cj = joints[Math.min(n - 1, Math.round(n * 0.25))];
                for (let q = 0; q < a.n; q++) {
                    const ang = MS.t * (a.speed || 0.06) * (i % 2 ? -1 : 1) + q * TAU / a.n, x = cj.x + Math.cos(ang) * a.R * G, y = cj.y + Math.sin(ang) * a.R * G;
                    if (live) for (const e of enemies) if ((e.x - x) ** 2 + (e.y - y) ** 2 < ((e.size || 20) + 24 * G) ** 2) { const key = '_o' + i + '_' + q; if ((e[key] || 0) < MS.t) { e[key] = MS.t + 16; abHit(e, D * a.dmg); fxAdd({ k: 'spark', x, y, life: 12, col: a.col }); } }
                    drawOrb(c, a.kind, x - camX, y - camY, ang, a.col, G, null);
                }
            } else if (a.t === 'trail') {
                const tl = joints[n - 1];
                if (live && MS.t % a.every === 0 && world.speed > 2 && MS.zones.length < 40) MS.zones.push({ x: tl.x, y: tl.y, life: a.life, max: a.life, R: a.R * G, a, t: 0 });
            } else if (a.t === 'bolt') {
                if (live && MS.cd[i] <= 0) {
                    if (a.kind === 'chain') { if (chain(mouth, a, D)) MS.cd[i] = a.every; else MS.cd[i] = 14; }
                    else { const got = new Set(); let m = 0; for (let q = 0; q < a.count; q++) { const e = abNearest(mouth.x, mouth.y, 720 * G, got); if (!e) break; got.add(e); const an = H.angle + (q - (a.count - 1) / 2) * 0.7; MS.balls.push({ x: mouth.x, y: mouth.y, vx: Math.cos(an) * 9, vy: Math.sin(an) * 9, tgt: e, life: 110, a }); m++; } MS.cd[i] = m ? a.every : 15; }
                }
            } else if (a.t === 'reflect') {
                if (live && MS.cd[i] <= 0) {
                    let br = 0; const Rr = a.R * G * S;
                    for (let p = projectiles.length - 1; p >= 0; p--) { const pr = projectiles[p]; for (let k = 0; k < n; k += 4) { const j = joints[k]; if ((pr.x - j.x) ** 2 + (pr.y - j.y) ** 2 < Rr * Rr) {
                        fxAdd({ k: 'shard', x: pr.x, y: pr.y, life: 22, col: a.col }); const e = abNearest(pr.x, pr.y, 900); if (e) { abHit(e, D * a.dmg); MS.bolts.push({ pts: [{ x: pr.x, y: pr.y }, { x: e.x, y: e.y }], t: 0, col: a.col }); }
                        projectiles.splice(p, 1); br++; break; } } }
                    MS.cd[i] = br ? a.cd : 6; if (br) applyShake(4);
                }
                if (hiQ) { c.save(); c.globalAlpha = 0.16 + 0.06 * Math.sin(tick * 3); c.strokeStyle = a.col; c.lineWidth = 3 * G; c.setLineDash([10, 8]); c.beginPath();
                    for (let k = 0; k < n; k += 2) { const j = joints[k], ox = -Math.sin(j.angle) * 58 * G, oy = Math.cos(j.angle) * 58 * G; k ? c.lineTo(j.x - camX + ox, j.y - camY + oy) : c.moveTo(j.x - camX + ox, j.y - camY + oy); } c.stroke(); c.restore(); }
            } else if (a.t === 'leech') {
                if (live && MS.cd[i] <= 0) {
                    MS.cd[i] = a.every; let hit = 0; const Rr = a.R * G * S;
                    for (const e of enemies) { if (hit >= 4) break; for (let k = 0; k < n; k += 3) { const j = joints[k]; if ((e.x - j.x) ** 2 + (e.y - j.y) ** 2 < (Rr + (e.size || 20)) ** 2) { abHit(e, D * a.dmg); dragonHp = Math.min(maxHp, dragonHp + maxHp * a.heal); fxAdd({ k: 'drain', x: e.x, y: e.y, life: 20, col: a.col }); hit++; break; } } }
                    if (hit) updateUI(); fxAdd({ k: 'ring', x: joints[Math.min(n - 1, 4)].x, y: joints[Math.min(n - 1, 4)].y, life: 26, R: Rr, col: a.col });
                }
            }
        });
        // --- novalar ---
        for (let q = MS.novas.length - 1; q >= 0; q--) {
            const nv = MS.novas[q], a = nv.a; if (live) nv.t++;
            const Rr = nv.t / 32 * a.R * G;
            if (live) for (const e of enemies) { const d2 = (e.x - nv.x) ** 2 + (e.y - nv.y) ** 2;
                if (d2 < Rr * Rr) { if (!nv.hit.has(e)) { nv.hit.add(e); abHit(e, D * a.dmg); } if (a.pull && d2 < (Rr * 1.1) ** 2) { e.x += (nv.x - e.x) * a.pull * 0.07; e.y += (nv.y - e.y) * a.pull * 0.07; } } }
            c.save(); c.strokeStyle = hexA(a.col, 1 - nv.t / 32); c.lineWidth = 14 * G * (1 - nv.t / 40); c.shadowBlur = 20; c.shadowColor = a.col; c.beginPath(); c.arc(nv.x - camX, nv.y - camY, Math.max(1, Rr), 0, TAU); c.stroke(); c.restore();
            if (nv.t >= 32) { if (a.zone) MS.zones.push({ x: nv.x, y: nv.y, life: 160, max: 160, R: a.R * 0.4 * G, a: { kind: 'lava', col: a.col, dmg: a.dmg * 0.09, slow: 30 }, t: 0 }); MS.novas.splice(q, 1); }
        }
        // --- bölgeler (lav, su, resif) ---
        for (let q = MS.zones.length - 1; q >= 0; q--) {
            const z = MS.zones[q], a = z.a; if (live) { z.life--; z.t++; }
            if (z.life <= 0) { MS.zones.splice(q, 1); continue; }
            if (live && z.t % 8 === 0) for (const e of enemies) if ((e.x - z.x) ** 2 + (e.y - z.y) ** 2 < (z.R + (e.size || 20)) ** 2) { abHit(e, D * a.dmg * 3); if (a.slow) e.slowTimer = Math.max(e.slowTimer || 0, a.slow); if (a.kind === 'lava' || a.kind === 'reef') MS.burn.set(e, { t: 90, d: D * 0.03 }); }
            const f = clamp(z.life / z.max, 0, 1), x = z.x - camX, y = z.y - camY;
            c.save(); c.globalCompositeOperation = 'lighter';
            const col = a.col, gr = c.createRadialGradient(x, y, 0, x, y, z.R); gr.addColorStop(0, hexA(col, 0.5 * f)); gr.addColorStop(0.7, hexA(col, 0.22 * f)); gr.addColorStop(1, hexA(col, 0)); c.fillStyle = gr; c.beginPath(); c.arc(x, y, z.R, 0, TAU); c.fill();
            if (a.kind === 'water') { c.strokeStyle = hexA('#ffffff', 0.5 * f); c.lineWidth = 2; for (let m = 0; m < 3; m++) { c.beginPath(); c.ellipse(x, y, z.R * (0.35 + m * 0.25 + 0.1 * Math.sin(tick * 3 + m)), z.R * (0.2 + m * 0.15), tick + m, 0, TAU); c.stroke(); } }
            else if (a.kind === 'reef') { c.globalCompositeOperation = 'source-over'; c.strokeStyle = hexA(col, 0.9 * f); c.lineWidth = 3; c.lineCap = 'round'; for (let m = 0; m < 6; m++) { const an = m * 1.05 + z.x; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(an) * z.R * 0.6, y + Math.sin(an) * z.R * 0.6); c.stroke(); } }
            else { c.fillStyle = 'rgba(255,230,160,' + 0.6 * f + ')'; for (let m = 0; m < 4; m++) { const an = tick * 2 + m * 1.6 + z.x; c.beginPath(); c.arc(x + Math.cos(an) * z.R * 0.5, y + Math.sin(an * 1.3) * z.R * 0.5, 3, 0, TAU); c.fill(); } }
            c.restore();
        }
        // --- güneş topları ---
        for (let q = MS.balls.length - 1; q >= 0; q--) {
            const b = MS.balls[q]; if (live) { b.life--; if (b.tgt && enemies.includes(b.tgt)) { const dx = b.tgt.x - b.x, dy = b.tgt.y - b.y, d = Math.hypot(dx, dy) || 1; b.vx += (dx / d * 14 - b.vx) * 0.12; b.vy += (dy / d * 14 - b.vy) * 0.12; } b.x += b.vx; b.y += b.vy; }
            let boom = b.life <= 0; if (!boom && live) for (const e of enemies) if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < ((e.size || 20) + 20) ** 2) { boom = true; break; }
            if (boom) { const Rr = 90 * G; for (const e of enemies) if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < Rr * Rr) abHit(e, D * b.a.dmg); fxAdd({ k: 'boom', x: b.x, y: b.y, life: 20, R: Rr, col: b.a.col }); MS.balls.splice(q, 1); continue; }
            const x = b.x - camX, y = b.y - camY; c.save(); c.globalCompositeOperation = 'lighter';
            const gr = c.createRadialGradient(x, y, 0, x, y, 24 * G); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.4, hexA(b.a.col, 0.9)); gr.addColorStop(1, hexA(b.a.col, 0)); c.fillStyle = gr; c.beginPath(); c.arc(x, y, 24 * G, 0, TAU); c.fill();
            c.strokeStyle = hexA(b.a.col, 0.5); c.lineWidth = 8 * G; c.beginPath(); c.moveTo(x, y); c.lineTo(x - b.vx * 2.5, y - b.vy * 2.5); c.stroke(); c.restore();
        }
        // --- zincir yıldırım / yansıma çizgileri ---
        for (let q = MS.bolts.length - 1; q >= 0; q--) {
            const b = MS.bolts[q]; if (live) b.t++; if (b.t > 12) { MS.bolts.splice(q, 1); continue; }
            c.save(); c.globalCompositeOperation = 'lighter'; c.strokeStyle = hexA(b.col, 1 - b.t / 12); c.lineWidth = 4 * G; c.lineCap = 'round'; c.shadowBlur = 14; c.shadowColor = b.col;
            c.beginPath(); b.pts.forEach((p, k) => { if (k) { const pp = b.pts[k - 1], m = 6; for (let s = 1; s <= m; s++) { const t = s / m, jx = s < m ? (rnd() - 0.5) * 26 : 0, jy = s < m ? (rnd() - 0.5) * 26 : 0; c.lineTo(pp.x + (p.x - pp.x) * t - camX + jx, pp.y + (p.y - pp.y) * t - camY + jy); } } else c.moveTo(p.x - camX, p.y - camY); }); c.stroke(); c.restore();
        }
        // --- ortak efektler ---
        for (let q = MS.fx.length - 1; q >= 0; q--) {
            const f = MS.fx[q]; if (live) f.t++; if (f.t > f.life) { MS.fx.splice(q, 1); continue; }
            const k = f.t / f.life, x = f.x - camX, y = f.y - camY; c.save(); c.globalCompositeOperation = 'lighter';
            if (f.k === 'spark') { c.fillStyle = hexA(f.col, 1 - k); for (let m = 0; m < 6; m++) { const an = m * 1.05; c.beginPath(); c.arc(x + Math.cos(an) * k * 26, y + Math.sin(an) * k * 26, 3, 0, TAU); c.fill(); } }
            else if (f.k === 'boom') { const Rr = f.R * (0.4 + k * 0.8), g = c.createRadialGradient(x, y, 0, x, y, Rr); g.addColorStop(0, 'rgba(255,255,255,' + (1 - k) + ')'); g.addColorStop(0.4, hexA(f.col, 0.8 * (1 - k))); g.addColorStop(1, hexA(f.col, 0)); c.fillStyle = g; c.beginPath(); c.arc(x, y, Rr, 0, TAU); c.fill(); }
            else if (f.k === 'shard') { c.translate(x, y); c.fillStyle = 'rgba(240,240,255,' + (1 - k) + ')'; c.strokeStyle = hexA(f.col, 1 - k); c.lineWidth = 1; for (let m = 0; m < 6; m++) { const an = m + f.t * 0.2, r = k * 50; c.save(); c.translate(Math.cos(an) * r, Math.sin(an) * r); c.rotate(an); c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, -3); c.lineTo(-4, 3); c.closePath(); c.fill(); c.stroke(); c.restore(); } }
            else if (f.k === 'drain') { const mx = joints[0].x - camX, my = joints[0].y - camY; c.strokeStyle = hexA(f.col, 0.8 * (1 - k)); c.lineWidth = 5; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + mx) / 2 + Math.sin(f.t) * 18, (y + my) / 2 + Math.cos(f.t) * 18, x + (mx - x) * k, y + (my - y) * k); c.stroke(); }
            else if (f.k === 'ring') { c.strokeStyle = hexA(f.col, 0.7 * (1 - k)); c.lineWidth = 6 * (1 - k) + 1; c.beginPath(); c.arc(x, y, f.R * (0.3 + k * 0.7), 0, TAU); c.stroke(); }
            c.restore();
        }
    }
    function roarFrame(live, G) {
        const D = Math.max(6, stats.fireDamage || 10);
        for (let q = MS.roars.length - 1; q >= 0; q--) {
            const r = MS.roars[q]; if (!live) continue;
            r.radius += 13 + (stats.fireSizeMult * 2); r.life -= 0.022; if (r.life <= 0) { MS.roars.splice(q, 1); continue; }
            r.x = joints[0].x + Math.cos(joints[0].angle) * 30; r.y = joints[0].y + Math.sin(joints[0].angle) * 30; r.a += normAng(joints[0].angle - r.a) * 0.25;
            const rc = r.rc;
            for (const e of enemies) {
                if (r.hit.has(e)) continue; const dx = e.x - r.x, dy = e.y - r.y, dist = Math.hypot(dx, dy);
                if (Math.abs(dist - r.radius) > 55) continue; let df = Math.abs(Math.atan2(dy, dx) - r.a); if (df > Math.PI) df = TAU - df; if (df > ROAR_ARC) continue;
                r.hit.add(e);
                if (rc.dmg) abHit(e, D * rc.dmg); if (rc.slow) e.slowTimer = Math.max(e.slowTimer || 0, rc.slow); if (rc.burn) MS.burn.set(e, { t: 150, d: D * 0.045 });
                if (rc.pull) { e._pullT = 14; e._pullK = rc.pull; MS.pulled.add(e); }
            }
            if (rc.clear) for (let p = projectiles.length - 1; p >= 0; p--) { const pr = projectiles[p], dx = pr.x - r.x, dy = pr.y - r.y; if (Math.abs(Math.hypot(dx, dy) - r.radius) < 60) { fxAdd({ k: 'shard', x: pr.x, y: pr.y, life: 20, col: '#ffffff' }); projectiles.splice(p, 1); } }
        }
        for (const e of MS.pulled) {
            if (!enemies.includes(e) || !(e._pullT > 0)) { MS.pulled.delete(e); continue; }
            if (live) { e._pullT--; e.x += (joints[0].x - e.x) * 0.1 * e._pullK; e.y += (joints[0].y - e.y) * 0.1 * e._pullK; }
        }
        for (const [e, b] of MS.burn) {
            if (!enemies.includes(e) || b.t <= 0) { MS.burn.delete(e); continue; }
            if (live) { b.t--; abHit(e, b.d); }
            const x = e.x - camX, y = e.y - camY; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(x, y, 0, x, y, 16); g.addColorStop(0, 'rgba(255,220,120,0.8)'); g.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y - 4 - Math.sin(tick * 9 + e.x) * 3, 16, 0, TAU); ctx.fill(); ctx.restore();
        }
    }

    // Ana döngü kancası: orgAbilityTick her karede oyuncu için bir kez çağrılır
    safe(() => {
        const _tick = orgAbilityTick;
        orgAbilityTick = function (S, G) {
            _tick.apply(this, arguments);
            try {
                const id = activeTheme.id, cfg = ORG_SKINS[id]; if (!cfg) return;
                if (MS.id !== id) { MS.id = id; resetMS(); }
                const paused = isPaused || !gameActive;
                MS.vx = world.dragonX - MS.px; MS.vy = world.dragonY - MS.py; MS.px = world.dragonX; MS.py = world.dragonY;
                if (!paused) MS.t++;
                // baş başına alev, gaz ve patlamalar
                if (cfg.heads >= 2) {
                    const beam = (isSuperBeamCharging || isSuperBeamFiring) && !spacePressed;
                    const firing = isBreathingFire && !spacePressed && !(MP.active && MP.localDead) && !beam && !paused;
                    if (HF.update(joints, cfg, gameEnv(G, firing, beam, paused))) { HF.draw(joints, ctx, -camX, -camY, G); }
                }
                const hy = HMAP[id]; if (!hy) return;
                const live = !paused && !(MP.active && MP.localDead) && !spacePressed && !MP.noSkinBuffs;
                abilityFrame(hy, S, G, live);
                roarFrame(live, G);
            } catch (e) { if (!MS.err++) console.warn('Melez döngüsü', e); }
        };
    }, 'tick');
})();
