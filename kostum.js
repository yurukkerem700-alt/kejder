// =====================================================================
// KOSTÜM VİTRİNİ: marketteki Kostümler sekmesi sıfırdan yeniden tasarlandı.
// Emoji yerine her kostümün OYUNDAKİ GERÇEK ejderha çizimi (drawDragonBody) canlı olarak gösterilir:
//  - havada asılı süzülür (kanat vuruşuna bağlı yay-sönüm sistemiyle iner çıkar, yere gölgesi düşer)
//  - 360° dönüş KALDIRILDI (üstten bakışta düz bir tur gibi duruyordu); ejderha olduğu yerde süzülür, çok başlılar başlarını bağımsız oynatır
//  - alev püskürtür, süper plazmayı şarj edip ateşler (oyundaki aynı alev dokusu / ışın / şarj efektleri)
// Ana betiğin çizim kodu değişmeden kullanılır: uzak oyuncuların çizildiği gibi global durum geçici
// olarak değiştirilip her karede geri yüklenir. Oyunun kendi ejderhasına dokunulmaz.
// =====================================================================
(function () {
    'use strict';
    if (typeof skinsDB === 'undefined' || typeof drawDragonBody !== 'function' || typeof drawPlayerBeam !== 'function') return;

    const TAU = Math.PI * 2;
    const G = 1.2;                       // vitrin ejderhasının büyüklük çarpanı (oyundaki growthFactor)
    const NJ = 18;                       // omurga halka sayısı
    const SEG = 16 * spacingG(G);        // halkalar arası mesafe (oyundakiyle aynı formül)
    const FACE = -0.3;                   // alev / plazma atarken bakılan yön (sağa, hafif yukarı)
    const SEQ = [['idle', 3.6], ['fire', 4.2], ['charge', 2.0], ['beam', 2.6]];
    const SEQ_T = SEQ.reduce((a, s) => a + s[1], 0);
    const PHASE_TXT = { idle: ['🪽', 'SÜZÜLÜYOR'], fire: ['🔥', 'ALEV'], charge: ['⚡', 'PLAZMA ŞARJ'], beam: ['⚡', 'SÜPER PLAZMA'] };

    // Boss ödülü kostümlerinin nasıl kazanıldığı
    const UNLOCK_NOTE = {
        kingsbane: 'Kadim Ejderha Kralı',
        kiyametavcisi: 'Üç Başlı Kıyamet (Kara Delik III)',
        emberheir: 'Sürü Ana (Kara Delik II)',
        mirrorbane: 'Vahşi Ayna Ejderha (Kara Delik I)'
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const num = (n) => Number(n).toLocaleString('tr-TR');

    // Önizleme tuvallerinde gölge bulanıklığı tavanı (ana tuvaldeki sınırlayıcının aynısı)
    function capShadow(c, max) {
        const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'shadowBlur');
        c._sbMax = max;
        if (!d || !d.set) return;
        Object.defineProperty(c, 'shadowBlur', { configurable: true, get() { return d.get.call(this); }, set(v) { d.set.call(this, Math.min(v, this._sbMax)); } });
    }

    const spriteCache = new Map();
    function flameSprite(skin) {
        let s = spriteCache.get(skin.id);
        if (!s) { try { s = createParticleSprite(skin, false); } catch (e) { s = fireSprite; } spriteCache.set(skin.id, s); }
        return s;
    }

    function phaseAt(mode, t) {
        if (mode === 'idle') return { n: 'idle', u: 0 };
        if (mode === 'fire') return { n: 'fire', u: (t % 4.2) / 4.2 };
        if (mode === 'plasma') { const k = t % 5.0; return k < 2.0 ? { n: 'charge', u: k / 2.0 } : { n: 'beam', u: (k - 2.0) / 3.0 }; }
        let k = t % SEQ_T;
        for (const [n, d] of SEQ) { if (k < d) return { n, u: k / d }; k -= d; }
        return { n: 'idle', u: 0 };
    }

    // =====================================================================
    // ÖNİZLEME: tek bir tuval üzerinde tek bir ejderha
    // =====================================================================
    class Preview {
        constructor(cv, skin, opt) {
            this.cv = cv; this.cx = cv.getContext('2d'); this.hero = !!opt.hero; this.mode = opt.mode || 'auto';
            this.fps = opt.fps || 30; this.q = opt.q || 'low'; this.dpr = opt.dpr || 1;
            capShadow(this.cx, opt.sb || 0);
            this.visible = true; this.acc = 0; this.err = 0; this.lastPh = '';
            this.onPhase = opt.onPhase || null;
            this.setSkin(skin);
        }
        setSkin(skin) {
            this.skin = skin; this.org = ORG_SKINS[skin.id] || null;
            this.t = this.hero ? 0 : Math.random() * SEQ_T; this.tk = Math.random() * 6;
            this.yaw = FACE + (Math.random() - 0.5) * 0.4; this.om = 0; this.al = 0;
            this.h = 0; this.hv = 0; this.f = 0; this.nextBeam = false;
            this.phi = new Float32Array(NJ); this.phv = new Float32Array(NJ);
            this.tail = []; this.strikes = []; this.parts = []; this.fire = []; this.fAcc = 0;
            this.joints = []; for (let i = 0; i < NJ; i++) this.joints.push({ x: -i * SEG, y: 0, angle: this.yaw });
            this.ph = phaseAt(this.mode, this.t); this.err = 0; this.lastPh = '';
            const ext = (this.org && this.org.tailExt) || 0;
            this.ext = ext; this.len = (NJ - 1) * SEG * (1 + ext);
            this.cs = 0; this.cw = 0; this.ch = 0; this.sc = 0.3;
            this.pose();
        }
        setMode(m) { this.mode = m; this.t = 0; this.strikes.length = 0; this.parts.length = 0; this.ph = phaseAt(m, 0); }

        // ---- FİZİK -------------------------------------------------------
        step(dt) {
            const ph = this.ph = phaseAt(this.mode, this.t);
            this.t += dt; this.tk += dt * 6;
            // 1) Baş yönü: yay-sönüm denetleyicisi hedef açıyı kovalar, böylece dönüş ivmelenir, fren yapar, hafif aşar
            let tgt;
            const near = (x) => x + TAU * Math.round((this.yaw - x) / TAU);
            if (ph.n === 'idle') tgt = near(FACE) + 0.16 * Math.sin(this.t * 0.7);
            else if (ph.n === 'fire') tgt = near(FACE) + 0.32 * Math.sin(this.t * 0.9);
            else if (ph.n === 'beam') tgt = near(FACE) + 0.12 * Math.sin(this.t * 0.8);
            else tgt = near(FACE);
            const nsub = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / nsub;
            for (let s = 0; s < nsub; s++) {
                this.al = 26 * (tgt - this.yaw) - 8.5 * this.om;
                this.om += this.al * h; this.yaw += this.om * h;
                // 2) Omurga: her halkanın eğilmesi yay-sönüm; dönüş hızına karşı (hava direnci) ve açısal ivmeye karşı (atalet) savrulur
                for (let i = 1; i < NJ; i++) {
                    const w = i / NJ, ks = 46 * (1 + 2.6 * (1 - w) * (1 - w)), kc = 8.5;
                    const rest = -0.022 * this.om * (0.4 + w) + 0.07 * w * Math.sin(this.t * 1.4 - i * 0.5);
                    const acc = -ks * (this.phi[i] - rest) - kc * this.phv[i] - 0.4 * this.al * w * 0.1;
                    this.phv[i] += acc * h; this.phi[i] = clamp(this.phi[i] + this.phv[i] * h, -0.34, 0.34);
                }
            }
            // 3) Havada asılı kalma: kanat vuruşu itki verir, yerçekimi ve sönüm geri çeker (zorlanmış salınım)
            const brk = ph.n === 'fire', Om = brk ? 15 : 6, fp = brk ? this.tk * 2.5 : this.tk;
            const A = 130 * (Om / 6) * (Om / 6) * (brk ? 1.8 : 1);
            const w0 = 3;
            const ha = -A * Math.cos(fp) - 2 * 0.35 * w0 * this.hv - w0 * w0 * this.h + 2.2 * Math.sin(this.t * 0.7);
            this.hv += ha * dt; this.h += this.hv * dt; this.h = clamp(this.h, -12, 12);
            // 4) Plazma ateşlenince geri tepme: gövde havada hafifçe geriye iter
            const isBeam = ph.n === 'beam';
            if (isBeam && !this.nextBeam) { this.hv -= 38; }
            this.nextBeam = isBeam;
            // 5) Omurga halkalarını yeniden kur
            this.pose();
            // alev parçacıkları
            this.updateFire(dt, ph.n === 'fire');
        }
        pose() {
            const J = this.joints; let a = this.yaw, x = 0, y = 0, sx = 0, sy = 0;
            J[0].x = 0; J[0].y = 0; J[0].angle = a;
            for (let i = 1; i < NJ; i++) {
                a += this.phi[i]; J[i].angle = a; x -= Math.cos(a) * SEG; y -= Math.sin(a) * SEG; J[i].x = x; J[i].y = y;
            }
            for (let i = 0; i < NJ; i++) { sx += J[i].x; sy += J[i].y; }
            this.cxr = sx / NJ; this.cyr = sy / NJ;
        }
        updateFire(dt, on) {
            const G2 = G, a = this.yaw, mx = Math.cos(a) * 35 * G2, my = Math.sin(a) * 35 * G2, spr = flameSprite(this.skin);
            const multi = window.HEADFX && this.org && this.org.heads >= 2;
            const cap = this.hero ? 260 : 120;
            if (multi) {
                // çok başlı kostüm: her baş kendi alevini / gazını püskürtür, HEADFX kombo mantığını yürütür
                const k = dt * 60, self = this;
                HEADFX.update(this.joints, this.org, {
                    k, firing: on, beam: this.ph.n === 'charge' || this.ph.n === 'beam', G: G2, n: (this.hero ? 3 : 2.2) * k,
                    fire(x, y, ang, spread, sizeMul) {
                        if (self.fire.length >= cap) return;
                        const v = Math.random() * 6 + 6.8, f0 = Math.random();
                        self.fire.push({ x: x + Math.cos(ang) * v * f0, y: y + Math.sin(ang) * v * f0, vx: Math.cos(ang + spread) * v, vy: Math.sin(ang + spread) * v, life: 1, size: (Math.random() * 16 + 14) * G2 * (sizeMul || 1), grow: Math.random() * 2.5 + 1.5, spr });
                    },
                    nearFire(x, y, r) { for (const p of self.fire) if (p.life > 0.3 && (p.x - x) ** 2 + (p.y - y) ** 2 < (r + p.size * 0.4) ** 2) return true; return false; },
                    boom(x, y) { for (let q = 0; q < 3 && self.fire.length < cap + 20; q++) { const an = q / 3 * TAU + Math.random(); self.fire.push({ x, y, vx: Math.cos(an) * 6, vy: Math.sin(an) * 6, life: 1, size: 22 * G2, grow: 2.4, spr }); } }
                });
            } else if (on) {
                this.fAcc += dt * 60 * (this.hero ? 3 : 2.2);
                while (this.fAcc >= 1 && this.fire.length < cap) {
                    this.fAcc -= 1;
                    const sp = (Math.random() - 0.5) * 0.4, v = Math.random() * 6 + 6.8, f0 = Math.random();
                    this.fire.push({ x: mx + Math.cos(a) * v * f0, y: my + Math.sin(a) * v * f0, vx: Math.cos(a + sp) * v, vy: Math.sin(a + sp) * v, life: 1, size: (Math.random() * 16 + 14) * G2, grow: Math.random() * 2.5 + 1.5, spr });
                }
                this.fAcc = Math.min(this.fAcc, 3);
            }
            const k = dt * 60;
            for (let i = this.fire.length - 1; i >= 0; i--) {
                const p = this.fire[i]; p.x += p.vx * k; p.y += p.vy * k; p.life -= 0.029 * k; p.size += p.grow * k;
                if (p.life <= 0) { this.fire[i] = this.fire[this.fire.length - 1]; this.fire.pop(); }
            }
        }

        // ---- ÇİZİM -------------------------------------------------------
        fit() {
            const cv = this.cv, w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return false;
            const bw = Math.round(w * this.dpr), bh = Math.round(h * this.dpr);
            if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
            this.cw = w; this.ch = h;
            const Rb = this.len * 0.5 + 84 * G;
            this.sc = clamp(0.54 * Math.min(w, h) / Rb, 0.1, 0.9);
            return true;
        }
        backdrop(c, W, H, t) {
            const sk = this.skin, col = sk.mainColor || '#00ffcc';
            const g = c.createRadialGradient(W / 2, H * 0.55, 0, W / 2, H * 0.55, Math.max(W, H) * 0.75);
            g.addColorStop(0, hexA(col, 0.2)); g.addColorStop(0.55, 'rgba(14,9,26,1)'); g.addColorStop(1, 'rgba(5,3,10,1)');
            c.fillStyle = g; c.fillRect(0, 0, W, H);
            // zeminde dönen mühür halkaları (yere paralel çizilir: ejderha bunun üstünde asılı durur)
            const R = 0.44 * Math.min(W, H), cx = W / 2, cy = H / 2;
            c.save(); c.translate(cx, cy); c.strokeStyle = hexA(col, 0.22); c.lineWidth = 1.2;
            c.save(); c.rotate(t * 0.12); c.setLineDash([R * 0.09, R * 0.06]); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.stroke(); c.restore();
            c.save(); c.rotate(-t * 0.2); c.setLineDash([R * 0.03, R * 0.05]); c.beginPath(); c.arc(0, 0, R * 0.7, 0, TAU); c.stroke(); c.restore();
            c.strokeStyle = hexA(col, 0.12); c.beginPath(); c.arc(0, 0, R * 1.12, 0, TAU); c.stroke();
            c.restore();
        }
        shadow(c, ox, oy, sc, h) {
            // Gölge yere düşer: ejderha yükseldikçe öteye kayar, silikleşir ve yayılır
            const lift = 16 + h * 1.4, dx = lift * 0.55, dy = lift * 0.85, spread = 1 + lift * 0.012, J = this.joints, org = this.org;
            const alpha = clamp(0.34 - lift * 0.004, 0.14, 0.4);
            const flap = Math.cos(this.ph.n === 'fire' ? this.tk * 2.5 : this.tk) * 0.5 + 0.5;
            const circ = (k, a) => {
                c.fillStyle = 'rgba(0,0,0,' + a + ')'; c.beginPath();
                for (let i = 0; i < NJ; i++) {
                    const w = i / (NJ - 1); const rr = (org ? (3 + 19 * Math.pow(1 - w * 0.9, 0.85) * ((org.thick) || 1)) : Math.max(3, 20 * (1 - w))) * G * sc * k * spread;
                    const x = ox + J[i].x * sc + dx, y = oy + J[i].y * sc + dy; c.moveTo(x + rr, y); c.arc(x, y, rr, 0, TAU);
                }
                c.fill();
            };
            circ(1.35, alpha * 0.45); circ(0.95, alpha * 0.6);
            const wings = org ? (org.wing === 'none' || (org.wings && !org.wings.length) ? [] : (org.wings || [{ pos: 0.16, ws: 1 }, { pos: 0.36, ws: 0.6 }])) : [{ pos: 0.22, ws: 1 }, { pos: 0.55, ws: 0.62 }];
            c.fillStyle = 'rgba(0,0,0,' + alpha * 0.5 + ')';
            for (const wg of wings) {
                const k = clamp(Math.round(NJ * wg.pos), 1, NJ - 1), j = J[k], span = (62 + 26 * flap) * G * (wg.ws || 1) * sc * spread;
                c.save(); c.translate(ox + j.x * sc + dx, oy + j.y * sc + dy); c.rotate(j.angle); c.beginPath(); c.ellipse(-18 * G * sc, 0, 26 * G * sc, span, 0, 0, TAU); c.fill(); c.restore();
            }
        }
        draw() {
            if (!this.fit()) return;
            const c = this.cx, W = this.cw, H = this.ch, d = this.dpr, sc = this.sc, ph = this.ph;
            c.setTransform(d, 0, 0, d, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
            this.backdrop(c, W, H, this.t);
            // yerleşim: dönerken ağırlık merkezi ortada, ateş ederken ağız sağda (alev için yer kalsın)
            const firing = ph.n === 'fire' || ph.n === 'charge' || ph.n === 'beam';
            const fOn = firing ? 1 : 0; this.f += (fOn - this.f) * 0.06;
            const oxC = W / 2 - this.cxr * sc, oyC = H / 2 - this.cyr * sc;
            const oxF = clamp(W * 0.5 + this.len * sc * 0.3, W * 0.5, W * 0.72), oyF = H * 0.52;
            let ox = oxC + (oxF - oxC) * this.f, oy = oyC + (oyF - oyC) * this.f;
            // plazma şarjında gövde titrer
            if (ph.n === 'charge') { ox += (Math.random() - 0.5) * 1.6 * ph.u; oy += (Math.random() - 0.5) * 1.6 * ph.u; }
            const bob = this.h;
            this.shadow(c, ox, oy, sc, bob);
            // ---- oyunun kendi çizim kodu: global durumu geçici değiştir, çiz, geri yükle
            const sv = [ctx, joints, activeTheme, tick, camX, camY, spacePressed, isRageActive, isBreathingFire, isSuperBeamCharging, isSuperBeamFiring, superBeamChargeTimer, gfxQuality, ORG_TAIL, viewScale, isPaused, CHG.strikes, CHG.parts, MP.lite, PV_HOVER];
            try {
                ctx = c; joints = this.joints; activeTheme = this.skin; tick = this.tk; camX = 0; camY = 0;
                spacePressed = false; isRageActive = false; isBreathingFire = ph.n === 'fire';
                isSuperBeamCharging = ph.n === 'charge'; isSuperBeamFiring = ph.n === 'beam'; superBeamChargeTimer = ph.n === 'charge' ? ph.u * 120 : 0;
                gfxQuality = this.q; ORG_TAIL = this.tail; viewScale = 0.02; isPaused = false; CHG.strikes = this.strikes; CHG.parts = this.parts; MP.lite = false; PV_HOVER = true;
                // dünya birimi = ekran birimi / sc: baş (ox, oy) noktasında, yükseklik kadar yukarıda
                const hx = ox / sc, hy = (oy - bob) / sc, J = this.joints;
                for (const j of J) { j.x += hx; j.y += hy; }
                c.setTransform(d * sc, 0, 0, d * sc, 0, 0);
                try {
                    if (isSuperBeamCharging) drawChargeFx('back', 1, G);
                    drawDragonBody(1, G, 1);
                    if (isSuperBeamCharging) drawChargeFx('front', 1, G);
                    if (isSuperBeamFiring) drawPlayerBeam(G, false);
                    this.drawFlames(c, hx, hy);
                    if (window.HEADFX && this.org && this.org.heads >= 2) HEADFX.draw(J, c, hx, hy, G);
                } finally { for (const j of J) { j.x -= hx; j.y -= hy; } if (window.HEADFX) HEADFX.shift(J, -hx, -hy); }
                this.err = 0;
            } catch (e) {
                if (++this.err === 1) console.warn('Kostüm önizlemesi çizilemedi: ' + this.skin.id, e);
            } finally {
                [ctx, joints, activeTheme, tick, camX, camY, spacePressed, isRageActive, isBreathingFire, isSuperBeamCharging, isSuperBeamFiring, superBeamChargeTimer, gfxQuality, ORG_TAIL, viewScale, isPaused, CHG.strikes, CHG.parts, MP.lite, PV_HOVER] = sv;
                c.setTransform(d, 0, 0, d, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
            }
            if (this.err > 2) { c.fillStyle = '#fff'; c.font = '28px sans-serif'; c.textAlign = 'center'; c.fillText(this.skin.icon || '🐉', W / 2, H / 2 + 10); }
            if (this.onPhase && ph.n !== this.lastPh) { this.lastPh = ph.n; this.onPhase(ph.n); }
        }
        drawFlames(c, hx, hy) {
            if (!this.fire.length) return;
            c.save(); c.globalCompositeOperation = 'lighter';
            for (const p of this.fire) {
                const L = p.life, sz = p.size, x = p.x + hx, y = p.y + hy;
                c.globalAlpha = L > 0.38 ? Math.min(1, (L - 0.3) * 1.15) : L * 1.9;
                c.drawImage(p.spr, x - sz / 2, y - sz / 2, sz, sz);
            }
            c.restore();
        }
    }

    // =====================================================================
    // YÖNETİCİ: tek rAF döngüsü; yalnızca ekranda görünen ve DOM'da duran önizlemeler çalışır
    // =====================================================================
    const live = new Set(); let raf = 0, last = 0, ema = 8, perf = 0;
    function loop(ts) {
        raf = requestAnimationFrame(loop);
        const modal = document.getElementById('marketModal');
        if (!modal || modal.style.display === 'none' || document.hidden) { last = 0; return; }
        if (!last) last = ts;
        const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
        const t0 = performance.now();
        for (const pv of live) {
            if (!pv.cv.isConnected) { live.delete(pv); if (pv.io) pv.io.unobserve(pv.cv); continue; }
            if (!pv.visible) continue;
            const minDt = 1 / Math.max(10, pv.fps - perf * 8);
            pv.acc += dt; if (pv.acc < minDt - 0.002) continue;
            const step = Math.min(pv.acc, 0.066); pv.acc = 0;
            try { pv.step(step); pv.draw(); } catch (e) { if (!pv._w) { pv._w = 1; console.warn('Kostüm önizleme', e); } }
        }
        // kasma önleyici: toplam çizim süresi uzarsa kartların kare hızı kademeli düşer
        ema = ema * 0.94 + (performance.now() - t0) * 0.06;
        if (ema > 14 && perf < 2) { perf++; ema = 8; } else if (ema < 4 && perf > 0 && Math.random() < 0.01) perf--;
    }
    function ensureLoop() { if (!raf) raf = requestAnimationFrame(loop); }

    // =====================================================================
    // ARAYÜZ
    // =====================================================================
    const CSS = `
    .cs-root { width: 100%; }
    .cs-hero { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 22px; padding: 18px; border-radius: 18px; border: 2px solid var(--cs-col, #3d2963); background: linear-gradient(160deg, #1b1230 0%, #0e0918 70%); box-shadow: 0 0 40px color-mix(in srgb, var(--cs-col, #9900ff) 22%, transparent); margin-bottom: 18px; }
    .cs-stage { position: relative; border-radius: 14px; overflow: hidden; background: #08050f; height: clamp(230px, 40vh, 380px); border: 1px solid rgba(255,255,255,0.08); }
    .cs-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .cs-modes { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
    .cs-modes button { flex: 1 1 0; min-width: 88px; padding: 9px 6px; border-radius: 10px; border: 1.5px solid #3d2963; background: #150f22; color: #b9a8dc; font-weight: bold; font-size: 13px; cursor: pointer; }
    .cs-modes button.on { border-color: var(--cs-col, #00ffcc); color: #fff; background: color-mix(in srgb, var(--cs-col, #00ffcc) 22%, #150f22); }
    .cs-info { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
    .cs-info h2 { margin: 0; font-size: 30px; line-height: 1.1; color: var(--cs-col, #fff); text-shadow: 0 0 18px color-mix(in srgb, var(--cs-col, #fff) 55%, transparent); }
    .cs-tier { display: inline-block; align-self: flex-start; padding: 3px 10px; border-radius: 99px; font-size: 12px; font-weight: bold; color: #ffd700; border: 1px solid rgba(255,215,0,0.4); background: rgba(255,215,0,0.08); }
    .cs-desc { color: #c9bde6; font-size: 14px; line-height: 1.5; }
    .cs-bonus { color: #8ff; font-size: 13px; font-weight: bold; }
    .cs-need { display: flex; flex-direction: column; gap: 6px; padding: 12px; border-radius: 12px; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); }
    .cs-need .row { display: flex; justify-content: space-between; gap: 10px; font-size: 14px; color: #bbb; }
    .cs-need .ok { color: #33ff88; font-weight: bold; } .cs-need .no { color: #ff5577; font-weight: bold; }
    .cs-atk { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; line-height: 1.4; color: #c9bde6; }
    .cs-atk b { color: var(--cs-col, #fff); }
    .cs-boss { color: #ff9ec4; font-weight: bold; font-size: 14px; line-height: 1.4; }
    .cs-act { margin-top: auto; padding: 14px; border-radius: 12px; border: 2px solid var(--cs-col, #00ffcc); background: color-mix(in srgb, var(--cs-col, #00ffcc) 18%, #0d0914); color: #fff; font-size: 16px; font-weight: bold; cursor: pointer; letter-spacing: 0.5px; }
    .cs-act:hover:not(:disabled) { background: color-mix(in srgb, var(--cs-col, #00ffcc) 38%, #0d0914); }
    .cs-act:disabled { cursor: default; opacity: 0.75; border-color: #555; background: #17121f; color: #aaa; }
    .cs-act.eq { border-color: #00ffcc; color: #00ffcc; background: rgba(0,255,204,0.08); opacity: 1; }
    .cs-filters { display: flex; gap: 8px; flex-wrap: wrap; margin: 4px 0 14px; }
    .cs-filters button { padding: 7px 14px; border-radius: 99px; border: 1.5px solid #3d2963; background: #150f22; color: #b9a8dc; font-weight: bold; font-size: 13px; cursor: pointer; }
    .cs-filters button.on { border-color: #00ffcc; color: #00ffcc; background: rgba(0,255,204,0.1); }
    .cs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 16px; }
    .cs-card { position: relative; display: flex; flex-direction: column; border-radius: 16px; border: 2px solid #3d2963; background: #1a1229; overflow: hidden; cursor: pointer; transition: transform .2s, border-color .2s, box-shadow .2s; }
    .cs-card:hover { transform: translateY(-3px); border-color: var(--cs-col, #00ffcc); box-shadow: 0 8px 24px color-mix(in srgb, var(--cs-col, #00ffcc) 25%, transparent); }
    .cs-card.sel { border-color: var(--cs-col, #00ffcc); }
    .cs-card.eq { border-color: #00ffcc; box-shadow: 0 0 22px rgba(0,255,204,0.35); }
    .cs-view { position: relative; aspect-ratio: 1 / 0.82; background: #08050f; }
    .cs-view canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .cs-chip { position: absolute; top: 8px; right: 8px; padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: bold; background: rgba(0,0,0,0.7); color: #fff; border: 1px solid rgba(255,255,255,0.2); z-index: 2; }
    .cs-chip.eq { color: #00ffcc; border-color: #00ffcc; } .cs-chip.own { color: #8dffb5; border-color: #3fbf6f; } .cs-chip.lock { color: #ffb3c6; border-color: #a04060; } .cs-chip.prize { color: #ffd700; border-color: #a08a20; }
    .cs-phase { position: absolute; left: 8px; bottom: 7px; font-size: 10px; letter-spacing: 1px; font-weight: bold; color: rgba(255,255,255,0.75); text-shadow: 0 1px 3px #000; z-index: 2; pointer-events: none; }
    .cs-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .cs-name { font-size: 18px; font-weight: bold; text-align: center; color: var(--cs-col, #fff); line-height: 1.15; }
    .cs-req { font-size: 12.5px; text-align: center; color: #aaa; line-height: 1.5; min-height: 38px; display: flex; flex-direction: column; justify-content: center; }
    .cs-req .ok { color: #33ff88; font-weight: bold; } .cs-req .no { color: #ff5577; font-weight: bold; }
    .cs-req .boss { color: #ff9ec4; font-weight: bold; }
    .cs-btn { margin-top: auto; padding: 9px; border-radius: 10px; border: 1.5px solid var(--cs-col, #00ffcc); background: color-mix(in srgb, var(--cs-col, #00ffcc) 14%, #0d0914); color: #fff; font-weight: bold; font-size: 14px; cursor: pointer; }
    .cs-btn:disabled { border-color: #444; color: #888; background: #14101c; cursor: default; }
    .cs-btn.eq { border-color: #00ffcc; color: #00ffcc; background: rgba(0,255,204,0.08); }
    @media (max-width: 760px) {
        .cs-hero { grid-template-columns: 1fr; padding: 10px; gap: 12px; }
        .cs-stage { height: clamp(200px, 34vh, 300px); }
        .cs-info h2 { font-size: 22px; } .cs-desc { font-size: 12.5px; }
        .cs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
        .cs-name { font-size: 14px; } .cs-req { font-size: 11px; min-height: 32px; } .cs-body { padding: 7px 7px 9px; gap: 4px; }
        .cs-btn { padding: 7px 4px; font-size: 12px; } .cs-chip { font-size: 10px; padding: 2px 6px; top: 5px; right: 5px; }
        .cs-modes button { font-size: 11.5px; min-width: 70px; padding: 8px 4px; }
    }
    body.m .cs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; }
    body.m .cs-hero { grid-template-columns: 1fr; padding: 10px; gap: 12px; }
    body.m .cs-stage { height: clamp(200px, 34vh, 300px); }
    `;
    function injectCss() {
        if (document.getElementById('cs-style')) return;
        const s = document.createElement('style'); s.id = 'cs-style'; s.textContent = CSS; document.head.appendChild(s);
    }

    let selId = null, filter = 'all', heroPv = null, heroMode = 'auto', rootEl = null, io = null;

    function state(sk) {
        const owned = unlockedSkins.includes(sk.id), eq = activeTheme.id === sk.id, prize = sk.reqLvl >= 999;
        const okL = maxLevelReached >= sk.reqLvl, okC = coins >= sk.reqCoin;
        const okP = !sk.parents || sk.parents.every(p => unlockedSkins.includes(p));
        return { owned, eq, prize, okL, okC, okP, canBuy: !owned && !prize && okL && okC && okP };
    }
    function reqHtml(sk, s, compact) {
        if (s.owned) return compact ? '<span class="ok">Sahipsin</span>' : '<div class="row"><span>Durum</span><span class="ok">Sahipsin</span></div>';
        if (s.prize) {
            const q = sk.id === 'questmaster';
            const txt = q ? ('5 görev tamamla (' + Math.min(5, questsCompletedLifetime) + '/5)') : ('Yenilmesi gereken boss: ' + (UNLOCK_NOTE[sk.id] || 'özel boss'));
            return compact ? '<span class="boss">🏆 ' + esc(txt) + '</span>' : '<div class="cs-boss">🏆 ' + esc(txt) + '</div><div class="row"><span>Satın alınamaz</span><span>özel ödül</span></div>';
        }
        const par = sk.parents ? sk.parents.map(p => { const q = skinsDB.find(z => z.id === p); return (unlockedSkins.includes(p) ? '✔ ' : '✖ ') + (q ? q.name : p); }).join(' + ') : '';
        if (compact) return (sk.parents ? '<span>🧬 <b class="' + (s.okP ? 'ok' : 'no') + '">' + esc(par) + '</b></span>' : '') + '<span>Seviye <b class="' + (s.okL ? 'ok' : 'no') + '">' + maxLevelReached + '/' + sk.reqLvl + '</b></span><span>Coin <b class="' + (s.okC ? 'ok' : 'no') + '">' + num(coins) + '/' + num(sk.reqCoin) + '</b></span>';
        return (sk.parents ? '<div class="row"><span>🧬 Melez için gerekli</span><span class="' + (s.okP ? 'ok' : 'no') + '">' + esc(par) + '</span></div>' : '') + '<div class="row"><span>Gerekli seviye</span><span class="' + (s.okL ? 'ok' : 'no') + '">' + maxLevelReached + ' / ' + sk.reqLvl + '</span></div>'
            + '<div class="row"><span>Gerekli coin</span><span class="' + (s.okC ? 'ok' : 'no') + '">' + num(coins) + ' / ' + num(sk.reqCoin) + '</span></div>';
    }
    function actLabel(sk, s) {
        if (s.eq) return ['✔ KUŞANILDI', 'eq', true];
        if (s.owned) return ['KUŞAN', '', false];
        if (s.prize) return ['🏆 ÖZEL ÖDÜL', '', true];
        if (s.canBuy) return ['SATIN AL (' + num(sk.reqCoin) + ' coin)', '', false];
        if (!s.okP) return ['İKİ ATA DA GEREKLİ', '', true];
        if (!s.okL) return ['SEVİYE ' + sk.reqLvl + ' GEREKLİ', '', true];
        return ['YETERSİZ COIN', '', true];
    }
    function act(id) {
        const sk = skinsDB.find(q => q.id === id); if (!sk) return; const s = state(sk);
        if (s.eq || s.prize) return;
        if (s.owned) equipSkin(id); else if (s.canBuy) buySkin(id);
    }
    function pvOpts(hero) {
        const mobile = typeof isMobile !== 'undefined' && isMobile;
        if (hero) return { hero: true, fps: 60, q: mobile ? 'mid' : 'high', dpr: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2), sb: mobile ? 8 : 40 };
        return { hero: false, fps: mobile ? 24 : 30, q: mobile ? 'low' : 'mid', dpr: Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5), sb: mobile ? 0 : 5 };
    }

    function heroHtml(sk) {
        const s = state(sk), a = actLabel(sk, s), bonus = sk.tier ? '⭐ Kademe ' + sk.tier + ' · 🔥 Ateş +%' + Math.round(skinBonus(sk).fire * 100) + ' · ❤️ Can +%' + Math.round(skinBonus(sk).hp * 100) : '⭐ Başlangıç kostümü';
        return '<h2>' + esc(sk.name) + '</h2>'
            + '<span class="cs-tier">' + (sk.tier ? 'KADEME ' + sk.tier : 'BAŞLANGIÇ') + '</span>'
            + '<div class="cs-desc">' + esc(sk.desc || '') + '</div><div class="cs-bonus">' + bonus + '</div>'
            + (sk.attacks ? '<ul class="cs-atk">' + sk.attacks.map(q => '<li><b>' + q[0] + ' ' + esc(q[1]) + ':</b> ' + esc(q[2]) + '</li>').join('') + '</ul>' : '')
            + '<div class="cs-need">' + reqHtml(sk, s, false) + '</div>'
            + '<button class="cs-act ' + a[1] + '" ' + (a[2] ? 'disabled' : '') + ' data-act="' + sk.id + '">' + a[0] + '</button>';
    }
    function selectSkin(id, scroll) {
        const sk = skinsDB.find(q => q.id === id); if (!sk || !rootEl) return; selId = id;
        rootEl.style.setProperty('--cs-col', sk.mainColor);
        rootEl.querySelector('.cs-info').innerHTML = heroHtml(sk);
        rootEl.querySelectorAll('.cs-card').forEach(el => el.classList.toggle('sel', el.dataset.id === id));
        if (heroPv) heroPv.setSkin(sk);
        if (scroll) { const c = document.getElementById('marketContent'); if (c) c.scrollTo({ top: 0, behavior: 'smooth' }); }
    }
    function applyFilter() {
        if (!rootEl) return;
        rootEl.querySelectorAll('.cs-card').forEach(el => {
            const sk = skinsDB.find(q => q.id === el.dataset.id), s = state(sk); let show = true;
            if (filter === 'own') show = s.owned; else if (filter === 'open') show = !s.owned && !s.prize && s.okL; else if (filter === 'lock') show = !s.owned && !s.prize && !s.okL; else if (filter === 'prize') show = s.prize;
            el.style.display = show ? '' : 'none';
        });
        rootEl.querySelectorAll('.cs-filters button').forEach(b => b.classList.toggle('on', b.dataset.f === filter));
    }

    function render(container) {
        injectCss(); ensureLoop();
        const prevTop = container.scrollTop;
        if (io) { io.disconnect(); io = null; }
        container.style.display = 'block'; container.innerHTML = '';
        const list = skinsDB;
        if (!selId || !list.some(q => q.id === selId)) selId = (list.find(q => q.id === activeTheme.id) || list[0]).id;
        const sel = list.find(q => q.id === selId);
        const cnt = { all: list.length, own: 0, open: 0, lock: 0, prize: 0 };
        list.forEach(sk => { const s = state(sk); if (s.owned) cnt.own++; else if (s.prize) cnt.prize++; else if (s.okL) cnt.open++; else cnt.lock++; });
        const MODES = [['auto', '🔄 Otomatik'], ['idle', '🪽 Süzül'], ['fire', '🔥 Alev'], ['plasma', '⚡ Süper Plazma']];
        let html = '<div class="cs-root"><div class="cs-hero"><div><div class="cs-stage"><canvas id="csHeroCv"></canvas></div><div class="cs-modes">'
            + MODES.map(m => '<button data-mode="' + m[0] + '" class="' + (heroMode === m[0] ? 'on' : '') + '">' + m[1] + '</button>').join('') + '</div></div><div class="cs-info"></div></div>'
            + '<div class="cs-filters">' + [['all', 'Hepsi'], ['own', 'Sahip olduklarım'], ['open', 'Açılabilir'], ['lock', 'Kilitli'], ['prize', '🏆 Boss ödülü']].map(f => '<button data-f="' + f[0] + '">' + f[1] + ' (' + cnt[f[0]] + ')</button>').join('') + '</div>'
            + '<div class="cs-grid">';
        for (const sk of list) {
            const s = state(sk), a = actLabel(sk, s);
            const chip = s.eq ? '<span class="cs-chip eq">KUŞANILDI</span>' : s.owned ? '<span class="cs-chip own">✔ SAHİPSİN</span>' : s.prize ? '<span class="cs-chip prize">🏆 ÖDÜL</span>' : '<span class="cs-chip lock">🔒 KİLİTLİ</span>';
            html += '<div class="cs-card ' + (s.eq ? 'eq ' : '') + (sk.id === selId ? 'sel' : '') + '" data-id="' + sk.id + '" style="--cs-col:' + sk.mainColor + '">'
                + '<div class="cs-view"><canvas></canvas>' + chip + '<span class="cs-phase"></span></div>'
                + '<div class="cs-body"><div class="cs-name">' + esc(sk.name) + '</div><div class="cs-req">' + reqHtml(sk, s, true) + '</div>'
                + '<button class="cs-btn ' + a[1] + '" ' + (a[2] ? 'disabled' : '') + ' data-act="' + sk.id + '">' + a[0] + '</button></div></div>';
        }
        html += '</div></div>';
        container.innerHTML = html; rootEl = container.querySelector('.cs-root');

        // hero önizlemesi
        const hcv = rootEl.querySelector('#csHeroCv');
        heroPv = new Preview(hcv, sel, Object.assign(pvOpts(true), { mode: heroMode })); live.add(heroPv);
        selectSkin(selId, false);

        // önizlemeler: yalnızca ekranda görünür olanlar çalışır (hero dahil)
        const byCv = new Map(); byCv.set(hcv, heroPv);
        io = ('IntersectionObserver' in window) ? new IntersectionObserver((ents) => { for (const e of ents) { const pv = byCv.get(e.target); if (pv) pv.visible = e.isIntersecting; } }, { root: container, rootMargin: '120px' }) : null;
        if (io) { heroPv.io = io; heroPv.visible = true; io.observe(hcv); }
        rootEl.querySelectorAll('.cs-card').forEach(el => {
            const sk = list.find(q => q.id === el.dataset.id), cv = el.querySelector('canvas'), ph = el.querySelector('.cs-phase');
            const pv = new Preview(cv, sk, Object.assign(pvOpts(false), { onPhase: (n) => { const t = PHASE_TXT[n] || PHASE_TXT.idle; ph.textContent = t[0] + ' ' + t[1]; } }));
            pv.visible = !io; pv.io = io; byCv.set(cv, pv); live.add(pv); if (io) io.observe(cv);
        });

        // olaylar
        rootEl.addEventListener('click', (ev) => {
            const ab = ev.target.closest('[data-act]'); if (ab) { ev.stopPropagation(); act(ab.dataset.act); return; }
            const mb = ev.target.closest('[data-mode]'); if (mb) { heroMode = mb.dataset.mode; heroPv.setMode(heroMode); rootEl.querySelectorAll('.cs-modes button').forEach(b => b.classList.toggle('on', b === mb)); return; }
            const fb = ev.target.closest('[data-f]'); if (fb) { filter = fb.dataset.f; applyFilter(); return; }
            const cd = ev.target.closest('.cs-card'); if (cd) selectSkin(cd.dataset.id, true);
        });
        applyFilter();
        container.scrollTop = prevTop;
    }

    window.KOSTUM = { render, _live: live, _Preview: Preview };
})();
