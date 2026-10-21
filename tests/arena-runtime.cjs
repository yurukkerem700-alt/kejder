// Requires Playwright. Optional: BASELINE_REF, CHROMIUM_EXECUTABLE_PATH, CHROMIUM_SINGLE_PROCESS=1, CPU_RATE=4.
const { chromium } = require("playwright"),
  http = require("http"),
  fs = require("fs"),
  path = require("path"),
  { execFileSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const baselineRef = process.env.BASELINE_REF;
const old = {};
if (baselineRef)
  for (const f of ["index.html", "mp.js", "sw.js"])
    old[f] = execFileSync("git", ["show", baselineRef + ":" + f], {
      cwd: root,
      maxBuffer: 4e6,
    });
const server = http
  .createServer((q, r) => {
    const url = new URL(q.url, "http://localhost"),
      base = url.pathname.startsWith("/old/"),
      f = url.pathname.replace(/^\/(old|new)\//, "") || "index.html";
    try {
      r.setHeader(
        "Content-Type",
        f.endsWith(".html")
          ? "text/html"
          : f.endsWith(".js")
            ? "text/javascript"
            : "application/octet-stream",
      );
      r.end(base && old[f] ? old[f] : fs.readFileSync(path.join(root, f)));
    } catch {
      r.statusCode = 404;
      r.end();
    }
  })
  .listen(8780);
(async () => {
  for (const variant of baselineRef ? ["old", "new"] : ["new"]) {
    const browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
      args: process.env.CHROMIUM_SINGLE_PROCESS
        ? ["--no-sandbox", "--single-process", "--no-zygote", "--disable-gpu"]
        : [],
    });
    const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      localStorage.setItem("boruStorySeen", "1");
      localStorage.setItem("boruTutorialSeen", "1");
      localStorage.setItem("boruGfx", "mid");
      localStorage.setItem("boruFps", "60");
      let seed = 42;
      Math.random = () =>
        (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    });
    await p.goto(`http://localhost:8780/${variant}/?mptest=1`);
    await p.waitForTimeout(1200);
    await p.evaluate(() => {
      BORU.startMatch({
        mode: "arena",
        name: "Test",
        skin: "magma",
        x: 0,
        y: 0,
        worldR: 5200,
      });
      BORU.matchActive = true;
      mouseScreenX = canvas.width / 2;
      mouseScreenY = canvas.height / 2;
      BORU.hostile = () => true;
      dragonHp = maxHp = 1e9;
      const ids = Object.keys(ORG_SKINS);
      for (let i = 0; i < 11; i++) {
        const a = (i * Math.PI * 2) / 11;
        BORU.setRemote("test" + i, {
          x: Math.cos(a) * 320,
          y: Math.sin(a) * 320,
          a: a + Math.PI,
          n: 45,
          gf: 1.6,
          sm: 1,
          sk: ids[i % ids.length],
          hp: 2400,
          mh: 2400,
          f: 1,
          name: "Bot " + i,
          ts: performance.now(),
        });
      }
    });
    await p.waitForTimeout(400);
    const metrics = await p.evaluate(() => {
      const draw = [],
        simulation = [];
      for (let i = 0; i < 100; i++) {
        const muted = i % 2 === 0;
        if (muted) ctxMute(true);
        const t = performance.now();
        try {
          gameStep();
        } finally {
          if (muted) ctxMute(false);
        }
        (muted ? simulation : draw).push(performance.now() - t);
      }
      const stat = (a) => {
        a.sort((a, b) => a - b);
        return { median: +a[25].toFixed(2), p95: +a[47].toFixed(2) };
      };
      isPaused = true;
      return {
        draw: stat(draw),
        simulation: stat(simulation),
        remotes: BORU.remotes.size,
      };
    });
    console.log(variant, JSON.stringify(metrics), "errors", errors);
    const cdp = await p.context().newCDPSession(p);
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: Number(process.env.CPU_RATE) || 1,
    });
    await p.evaluate(() => {
      window.liveDraws = 0;
      window.liveStart = performance.now();
      window.originalStep = gameStep;
      gameStep = function () {
        for (const r of BORU.remotes.values()) r.seen = performance.now();
        const drawing = !ctxMuted;
        const ret = window.originalStep();
        if (drawing) window.liveDraws++;
        return ret;
      };
      isPaused = false;
    });
    await p.waitForTimeout(2200);
    console.log(
      variant + "-live",
      await p.evaluate(() => {
        const fps =
          (window.liveDraws * 1000) / (performance.now() - window.liveStart);
        gameStep = window.originalStep;
        isPaused = true;
        return {
          drawsPerSecond: Math.round(fps),
          quality: FX.q,
          scale: renderScale,
        };
      }),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    if (variant === "new") {
      console.log(
        "bot-scenarios",
        await p.evaluate(() => {
          const { mkBot, botThink, BOT } = MPUI._bot;
          let t = 10000;
          const b = mkBot(
            { id: "a", name: "a", skin: "magma" },
            { x: -900, y: 0 },
          );
          b.a = 0;
          const target = {
            id: "human",
            x: 0,
            y: 0,
            G: 1,
            inv: false,
            hp: 2400,
            mh: 2400,
          };
          let shots = 0;
          const initial = Math.hypot(b.x, b.y);
          for (let i = 0; i < 240; i++) {
            t += 1000 / 60;
            botThink(b, [target], 1, 1 / 60, t, 5200);
            shots += b.f;
          }
          const result = {
            pursues: Math.hypot(b.x, b.y) < initial,
            shots,
            damage: [...BOT.acc.values()].reduce((n, h) => n + h.d, 0),
            noFakeKills: b.k === 0 && b.hv === 0,
          };
          target.inv = true;
          botThink(b, [target], 1, 1 / 60, t + 20, 5200);
          result.ghostNotTargeted = b.tgt === null && b.f === 0;
          b.x = 5199;
          b.y = 0;
          b.a = 0;
          for (let i = 0; i < 120; i++) {
            t += 1000 / 60;
            botThink(b, [], 1, 1 / 60, t, 5200);
          }
          result.staysInside = Math.hypot(b.x, b.y) < 5194;
          result.finite = [b.x, b.y, b.a, b.hp].every(Number.isFinite);
          for (const [key, value] of Object.entries(result))
            if (!value) throw Error("Bot behavior failed: " + key);
          return result;
        }),
      );
      console.log(
        "dodge",
        await p.evaluate(() => {
          const { mkBot, botThink } = MPUI._bot;
          const b = mkBot(
            { id: "dodge", name: "dodge", skin: "magma" },
            { x: -180, y: 0 },
          );
          b.a = 0;
          const target = {
            id: "attacker",
            x: 0,
            y: 0,
            a: Math.PI,
            f: 1,
            G: 1,
            hp: 2400,
            mh: 2400,
          };
          botThink(b, [target], 1, 1 / 60, 10000, 2500);
          if (b.mode !== "evade")
            throw Error("Bot failed to evade a visible incoming breath");
          return { evades: true };
        }),
      );
      console.log(
        "long-battle",
        await p.evaluate(() => {
          const { mkBot, botThink, BOT } = MPUI._bot;
          BOT.acc.clear();
          const bots = Array.from({ length: 11 }, (_, i) => {
            const a = (i * Math.PI * 2) / 11;
            return mkBot(
              { id: "long" + i, name: "Bot", skin: "magma" },
              { x: Math.cos(a) * 900, y: Math.sin(a) * 900 },
            );
          });
          let shots = 0,
            totalDamage = 0;
          for (let frame = 0; frame < 3600; frame++) {
            const time = 20000 + (frame * 1000) / 60;
            const D = bots
              .filter((b) => !b.dead)
              .map((b) => ({
                id: b.id,
                x: b.x,
                y: b.y,
                a: b.a,
                f: b.f,
                G: b.gf,
                inv: false,
                hp: b.hp,
                mh: b.mh,
              }));
            for (const b of bots)
              if (!b.dead) {
                botThink(b, D, 1, 1 / 60, time, 2500);
                shots += b.f;
              }
            if (frame % 8 === 0) {
              for (const [id, hit] of BOT.acc) {
                const b = bots.find((q) => q.id === id);
                if (!b || b.dead) continue;
                const damage = Math.min(700, hit.d);
                b.hp -= damage;
                totalDamage += damage;
                b.hurtT = time;
                b.by = hit.by;
                b.byT = time;
                if (b.hp <= 0) {
                  b.dead = true;
                  const killer = bots.find((q) => q.id === hit.by);
                  if (killer) killer.pk++;
                }
              }
              BOT.acc.clear();
            }
          }
          return {
            shots,
            totalDamage: Math.round(totalDamage),
            survivors: bots.filter((b) => !b.dead).length,
            finite: bots.every(
              (b) => Number.isFinite(b.x) && Number.isFinite(b.y),
            ),
            inside: bots.every((b) => Math.hypot(b.x, b.y) <= 2494.01),
          };
        }),
      );
      await p.evaluate(() => {
        BORU.endMatch();
        MP.active = false;
        store.mem = null;
        gameActive = true;
        isPaused = false;
        BORU.remotes.clear();
        world.dragonX = world.dragonY = 0;
        sanct.walls = 3;
        sanct.towers = 3;
        safeZone.radius = 450;
        BORU.teleport(0, 0);
        document.getElementById("startScreen").style.display = "none";
        document.getElementById("bootSplash")?.remove();
        mouseScreenX = canvas.width / 2;
        mouseScreenY = canvas.height / 2;
        gameStep();
        isPaused = true;
      });
      console.log(
        "canvas-state",
        await p.evaluate(() => ({
          alpha: ctx.globalAlpha,
          composite: ctx.globalCompositeOperation,
          transform: String(ctx.getTransform()),
          menu: getComputedStyle(document.getElementById("startScreen"))
            .display,
          boot: !!document.getElementById("bootSplash"),
        })),
      );
      console.log(
        "sanctuary",
        await p.evaluate(() => {
          isPaused = false;
          const a = sanctuaryGround.layer;
          gameStep();
          const reused = sanctuaryGround.layer === a;
          sanct.walls++;
          gameStep();
          const invalidated = sanctuaryGround.layer !== a;
          const native = ctx;
          ctxMute(true);
          gameStep();
          ctxMute(false);
          const nativeRestored = ctx === native;
          const h = sanctuaryGround.layer.height;
          const checkpoint = gFrame;
          isPaused = true;
          gameStep();
          const checks = {
            reused,
            invalidated,
            nativeRestored,
            bounded: h <= 1536,
            paused: gFrame === checkpoint,
          };
          for (const [key, value] of Object.entries(checks))
            if (!value) throw Error("Sanctuary check failed: " + key);
          return checks;
        }),
      );
      console.log("final-errors", errors);
      if (errors.length) throw Error(errors.join("\n"));
    }
    await browser.close();
  }
  server.close();
})().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
