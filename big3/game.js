/* BIG3チャレンジ（スクワット版）: 画面・判定・アニメーション */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var S = window.Big3Storage;
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- 調整値 ---------- */
  var START_W = 60, STEP_W = 5, BAR_W = 20, MAX_FAILS = 3;
  var LIMIT_MS = 4000;      // 各ゲージの制限時間
  var READY_MS = 800;       // 構え（自動）
  var BOTTOM_MS = 350;      // ボトムの間（この間のタップは無視）
  var RESULT_MS = 1400;     // 結果表示のあと次の試技へ
  // n = ここまでの成功回数。ゾーン幅(ゲージ全体を1とする)と片道秒数
  function level(n) {
    return {
      zd: Math.max(0.10, 0.32 - 0.02 * n),   // 深さゲージの緑ゾーン幅
      zp: Math.max(0.10, 0.30 - 0.02 * n),   // 力ゲージの緑ゾーン幅
      td: Math.max(0.72, 1.20 - 0.04 * n),   // 深さマーカーの片道(秒)
      tp: Math.max(0.66, 1.10 - 0.04 * n)    // 力マーカーの片道(秒)
    };
  }

  /* ---------- SVG補助 ---------- */
  function mk(name, attrs, parent) {
    var e = document.createElementNS(NS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function f(n) { return Math.round(n * 10) / 10; }

  /* プレート(片側の枚数)。バー20kg、25/20/15/10/5/2.5/1.25を大きい順に */
  var PLATE_SIZES = [25, 20, 15, 10, 5, 2.5, 1.25];
  var PLATE_STYLE = {
    "25": { c: "#c0392b", r: 26, w: 6 }, "20": { c: "#2d62ad", r: 26, w: 6 },
    "15": { c: "#d8b229", r: 26, w: 5 }, "10": { c: "#3c9150", r: 26, w: 4.5 },
    "5": { c: "#eeeeee", r: 18, w: 4 }, "2.5": { c: "#2a2e35", r: 14, w: 3.5 },
    "1.25": { c: "#aeb5bf", r: 11, w: 3 }
  };
  function platesFor(total) {
    var side = (total - BAR_W) / 2, out = [];
    for (var i = 0; i < PLATE_SIZES.length; i++) {
      while (side >= PLATE_SIZES[i] - 1e-9) { out.push(PLATE_SIZES[i]); side -= PLATE_SIZES[i]; }
    }
    return out;
  }
  function fmtW(w) { return Number.isInteger(w) ? String(w) : String(Math.round(w * 100) / 100); }

  /* ---------- ライフター ---------- */
  var FLOOR = 250, A = { x: 200, y: 244 };
  var L_SHIN = 60, L_THIGH = 64, L_TORSO = 66, L_UARM = 34, L_FARM = 32;

  function ik(p, q, l1, l2, wantPos) { // p->q の2リンク。肘/膝の位置
    var dx = q.x - p.x, dy = q.y - p.y, d = Math.sqrt(dx * dx + dy * dy);
    d = Math.max(Math.abs(l1 - l2) + 0.5, Math.min(l1 + l2 - 0.5, d));
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var ex = dx / Math.sqrt(dx * dx + dy * dy || 1), ey = dy / Math.sqrt(dx * dx + dy * dy || 1);
    var c1 = { x: p.x + a * ex - h * ey, y: p.y + a * ey + h * ex };
    var c2 = { x: p.x + a * ex + h * ey, y: p.y + a * ey - h * ex };
    return wantPos(c1) >= wantPos(c2) ? c1 : c2;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function createLifter(svg) {
    var g = {};
    // 背景
    mk("rect", { x: 0, y: 0, width: 400, height: FLOOR, "class": "s-wall" }, svg);
    mk("rect", { x: 0, y: 150, width: 400, height: 100, "class": "s-wall2", opacity: 0.55 }, svg);
    mk("rect", { x: 80, y: 20, width: 9, height: FLOOR - 20, "class": "s-rack" }, svg);
    mk("rect", { x: 80, y: 62, width: 26, height: 5, "class": "s-rack" }, svg);
    mk("rect", { x: 80, y: 130, width: 26, height: 5, "class": "s-rack" }, svg);
    mk("rect", { x: 0, y: FLOOR, width: 400, height: 20, "class": "s-plat" }, svg);
    var barBack = mk("g", {}, svg);
    var shadow = mk("ellipse", { cx: A.x - 4, cy: FLOOR + 1, rx: 70, ry: 3.5, fill: "#000", opacity: 0.18 }, svg);
    g.thigh = mk("line", { "class": "s-shorts", "stroke-width": 21, "stroke-linecap": "butt" }, svg);
    g.shin = mk("line", { "class": "s-skin", "stroke-width": 14, "stroke-linecap": "butt" }, svg);
    g.foot = mk("polygon", { "class": "s-shoe" }, svg);
    g.torso = mk("line", { "class": "s-shirt", "stroke-width": 26, "stroke-linecap": "butt" }, svg);
    g.neck = mk("line", { "class": "s-skin", "stroke-width": 9, "stroke-linecap": "butt" }, svg);
    g.hair = mk("circle", { r: 11.5, "class": "s-hair" }, svg);
    g.head = mk("circle", { r: 9.5, "class": "s-skinf" }, svg);
    g.uarm = mk("line", { "class": "s-skin", "stroke-width": 11, "stroke-linecap": "butt" }, svg);
    g.farm = mk("line", { "class": "s-skin", "stroke-width": 9, "stroke-linecap": "butt" }, svg);
    g.hand = mk("circle", { r: 5, "class": "s-skinf" }, svg);
    var barFront = mk("g", {}, svg);
    g.barBack = barBack; g.barFront = barFront;
    var plateKey = null, bp = {};

    function buildBar(total) {
      var key = String(total);
      if (key === plateKey) return;
      plateKey = key;
      barBack.textContent = ""; barFront.textContent = "";
      var list = platesFor(total), sum = 0, i;
      for (i = 0; i < list.length; i++) sum += PLATE_STYLE[list[i]].w + 1;
      var k = Math.min(1, 62 / Math.max(1, sum)), off = 30, pos = [];
      for (i = 0; i < list.length; i++) {
        var st = PLATE_STYLE[list[i]];
        pos.push({ st: st, o: off + st.w * k * 0.5 });
        off += (st.w + 1) * k;
      }
      var end = off + 10, SL = 0.17; // 軸の傾き（奥は右上、手前は左下）
      mk("line", { x1: 0, y1: 0, x2: end, y2: -end * SL, "class": "s-bar", "stroke-width": 3.5 }, barBack);
      mk("line", { x1: 0, y1: 0, x2: -end, y2: end * SL, "class": "s-bar", "stroke-width": 3.5 }, barFront);
      function plate(parent, o, sgn, st, last) {
        var cx = sgn * o, cy = -sgn * o * SL;
        mk("ellipse", { cx: f(cx), cy: f(cy), rx: Math.max(3.2, st.r * 0.24), ry: st.r, fill: st.c, stroke: "var(--plstroke)", "stroke-width": 1 }, parent);
        if (last) mk("ellipse", { cx: f(cx), cy: f(cy), rx: 1.6, ry: 3.2, "class": "s-barf" }, parent);
      }
      // 奥側は外側から内側へ、手前側は内側から外側へ描く（重なり順）
      for (i = pos.length - 1; i >= 0; i--) plate(barBack, pos[i].o, 1, pos[i].st, i === pos.length - 1);
      for (i = 0; i < pos.length; i++) plate(barFront, pos[i].o, -1, pos[i].st, i === pos.length - 1);
      mk("circle", { cx: 0, cy: 0, r: 3.2, "class": "s-barf" }, barFront);
      bp.plateTop = list.length ? 26 : 4;
    }

    /* p: { d:深さ0〜1+, tilt:度, drop:0〜1, anchor:{x,y}, shake:px } */
    g.render = function (p, total) {
      buildBar(total);
      var d = p.d, sh = p.shake || 0;
      var H = { x: A.x - 4 - 46 * d + sh, y: A.y - 120 + 74 * d };
      var Aw = { x: A.x, y: A.y };
      var th = d * 50 * Math.PI / 180;
      var t = { x: Math.sin(th), y: -Math.cos(th) }, n = { x: -Math.cos(th), y: -Math.sin(th) };
      var Sh = { x: H.x + L_TORSO * t.x, y: H.y + L_TORSO * t.y };
      var K = ik(Aw, H, L_SHIN, L_THIGH, function (c) { return c.x; });
      // バー位置
      var P0 = { x: Sh.x + n.x * 9 - t.x * 6, y: Sh.y + n.y * 9 - t.y * 6 };
      var drop = p.drop || 0, P = P0;
      if (drop > 0) {
        var an = p.anchor || P0, e = drop * drop;
        P = { x: an.x - 60 * drop, y: an.y + (FLOOR - 27 - an.y) * e };
      }
      var tilt = (p.tilt || 0) * (1 - drop), rad = tilt * Math.PI / 180;
      var gx = -19, gy = 2.5; // 握る位置（バー上の手前方向）
      var Hand = { x: P.x + gx * Math.cos(rad) - gy * Math.sin(rad), y: P.y + gx * Math.sin(rad) + gy * Math.cos(rad) };
      var hang = { x: Sh.x - 4, y: Sh.y + 56 }, u = Math.min(1, drop * 3);
      Hand = { x: lerp(Hand.x, hang.x, u), y: lerp(Hand.y, hang.y, u) };
      var E = ik(Sh, Hand, L_UARM, L_FARM, function (c) { return c.y - c.x * 0.3; });
      var thh = th * 0.45, hd = { x: Sh.x + Math.sin(thh) * 18 + 3, y: Sh.y - Math.cos(thh) * 18 };

      function ln(el, a, b) { el.setAttribute("x1", f(a.x)); el.setAttribute("y1", f(a.y)); el.setAttribute("x2", f(b.x)); el.setAttribute("y2", f(b.y)); }
      ln(g.thigh, H, K); ln(g.shin, K, Aw); ln(g.torso, H, Sh); ln(g.neck, Sh, hd);
      ln(g.uarm, Sh, E); ln(g.farm, E, Hand);
      g.foot.setAttribute("points", [[A.x - 12, FLOOR], [A.x - 12, A.y - 9], [A.x + 4, A.y - 11], [A.x + 16, A.y - 3], [A.x + 31, A.y + 1], [A.x + 31, FLOOR]].map(function (q) { return q.join(","); }).join(" "));
      g.hair.setAttribute("cx", f(hd.x - 2)); g.hair.setAttribute("cy", f(hd.y - 1.5));
      g.head.setAttribute("cx", f(hd.x + 2)); g.head.setAttribute("cy", f(hd.y + 1.5));
      g.hand.setAttribute("cx", f(Hand.x)); g.hand.setAttribute("cy", f(Hand.y));
      var tr = "translate(" + f(P.x) + " " + f(P.y) + ") rotate(" + f(tilt) + ")";
      barBack.setAttribute("transform", tr); barFront.setAttribute("transform", tr);
    };
    return g;
  }

  /* ---------- 画面切り替え ---------- */
  var screens = { title: $("s-title"), game: $("s-game"), result: $("s-result") };
  var current = "title";
  function show(name) {
    current = name;
    for (var k in screens) screens[k].hidden = k !== name;
    window.scrollTo(0, 0);
  }

  /* ---------- テーマ（RM換算表と共通キー） ---------- */
  var root = document.documentElement, modeBtn = $("mode");
  function paintMode() { modeBtn.setAttribute("aria-pressed", String(root.dataset.theme === "dark")); }
  modeBtn.addEventListener("click", function () {
    root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("rm_theme", root.dataset.theme); } catch (e) {}
    paintMode();
  });
  paintMode();

  /* ---------- タイトル ---------- */
  var titleLifter = createLifter($("svg-title"));
  titleLifter.render({ d: 0, tilt: 0, drop: 0 }, START_W);
  function refreshTitle() {
    var d = S.load();
    $("t-best").textContent = d.best > 0 ? fmtW(d.best) + " kg" : "記録なし";
    $("t-plays").textContent = d.plays > 0 ? "プレイ " + d.plays + "回" : "";
  }
  $("btn-start").addEventListener("click", startRun);

  /* ---------- ゲーム ---------- */
  var lifter = createLifter($("svg-game"));
  var el = {
    weight: $("g-weight"), pips: $("g-pips"), plates: $("g-plates"), msg: $("g-msg"),
    gv: $("gv"), gh: $("gh"), vz: $("gv-zone"), hz: $("gh-zone"), vm: $("gv-mk"), hm: $("gh-mk"),
    timer: $("g-timer"), act: $("act"), game: screens.game
  };
  var run = null;      // { weight, lifts, bestW, fails }
  var att = null;      // 現在の試技
  var pose = { d: 0, tilt: 0, drop: 0, shake: 0, anchor: null };
  var anims = [], timeouts = [];

  function later(fn, ms) { var id = setTimeout(fn, ms); timeouts.push(id); }
  function clearLater() { timeouts.forEach(clearTimeout); timeouts = []; }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
  function easeOut(x) { return 1 - (1 - x) * (1 - x); }
  function easeIn(x) { return x * x; }
  function tween(key, to, ms, fn, done) {
    anims = anims.filter(function (a) { return a.key !== key; });
    anims.push({ key: key, from: pose[key], to: to, ms: ms, t0: performance.now(), fn: fn || ease, done: done });
  }
  function setPhase(ph) { att.phase = ph; el.game.dataset.phase = ph; }
  function setMsg(text, cls) { el.msg.textContent = text; el.msg.className = "msg" + (cls ? " " + cls : ""); }
  function setBtn(text, disabled) { el.act.textContent = text; el.act.disabled = !!disabled; }
  function tri(x) { x = x % 2; if (x < 0) x += 2; return x <= 1 ? x : 2 - x; }
  function pct(v) { return f(v * 100) + "%"; }

  function paintPips() {
    var is = el.pips.children;
    for (var i = 0; i < is.length; i++) is[i].className = i < run.fails ? "on" : "";
    el.pips.setAttribute("aria-label", "失敗" + run.fails + "回");
  }
  function paintWeight() {
    el.weight.textContent = fmtW(run.weight);
    var pl = platesFor(run.weight);
    el.plates.textContent = "バー" + BAR_W + "kg ＋ 片側 " + (pl.length ? pl.join(" / ") : "なし") + " kg";
  }

  function startRun() {
    clearLater(); anims = [];
    run = { weight: START_W, lifts: 0, bestW: 0, fails: 0 };
    show("game");
    paintWeight(); paintPips();
    nextAttempt();
    el.act.focus({ preventScroll: true });
  }

  function nextAttempt() {
    var lv = level(run.lifts);
    var cd = 0.72 + Math.random() * 0.14, cp = 0.45 + Math.random() * 0.4;
    att = {
      phase: "ready", lv: lv,
      zd: [cd - lv.zd / 2, cd + lv.zd / 2], cd: cd,
      zp: [cp - lv.zp / 2, cp + lv.zp / 2],
      t0: 0, lockUntil: 0
    };
    pose.d = 0; pose.tilt = 0; pose.drop = 0; pose.shake = 0; pose.anchor = null;
    anims = [];
    el.vz.style.top = pct(att.zd[0]); el.vz.style.height = pct(lv.zd);
    el.hz.style.left = pct(att.zp[0]); el.hz.style.width = pct(lv.zp);
    el.vm.style.top = "0%"; el.hm.style.left = "0%"; el.timer.style.width = "0%";
    el.gv.dataset.zlo = f(att.zd[0]); el.gv.dataset.zhi = f(att.zd[1]);
    el.gh.dataset.zlo = f(att.zp[0]); el.gh.dataset.zhi = f(att.zp[1]);
    el.gv.classList.remove("active"); el.gh.classList.remove("active");
    paintWeight();
    setPhase("ready"); setMsg("構え中"); setBtn("構え中", true);
    later(function () {
      setPhase("depth"); att.t0 = performance.now();
      el.gv.classList.add("active");
      setMsg("緑のところでタップ"); setBtn("しゃがむ", false);
    }, READY_MS);
  }

  function markerPos() { // 現在のマーカー位置
    var now = performance.now();
    if (att.phase === "depth") return tri((now - att.t0) / 1000 / att.lv.td);
    if (att.phase === "power") return tri((now - att.t0) / 1000 / att.lv.tp);
    return null;
  }

  function act() {
    if (current !== "game" || !att) return;
    var now = performance.now();
    if (now < att.lockUntil) return;
    if (att.phase === "depth") {
      var p = markerPos();
      att.lockUntil = now + 150;
      if (p >= att.zd[0] && p <= att.zd[1]) {
        el.vm.style.top = pct(p); pose.d = p;
        setPhase("bottom"); setBtn("たつ", true); setMsg("ボトム");
        el.gv.classList.remove("active");
        tween("d", att.cd, 220, easeOut);
        later(function () {
          setPhase("power"); att.t0 = performance.now(); att.lockUntil = 0;
          el.gh.classList.add("active"); setMsg("緑のところでタップ"); setBtn("たつ", false);
        }, BOTTOM_MS);
      } else {
        el.vm.style.top = pct(p);
        fail(p < att.zd[0] ? "浅すぎます" : "深すぎます");
      }
    } else if (att.phase === "power") {
      var q = markerPos();
      el.hm.style.left = pct(q);
      if (q >= att.zp[0] && q <= att.zp[1]) success(); else fail("タイミングがずれました");
    }
  }

  function success() {
    setPhase("rise"); el.gh.classList.remove("active");
    run.lifts += 1; run.bestW = run.weight;
    setMsg("ナイスリフト  " + fmtW(run.weight) + " kg", "ok"); setBtn("成功", true);
    pose.shake = 0;
    tween("d", 0, 700, ease);
    later(function () { run.weight += STEP_W; nextAttempt(); }, RESULT_MS);
  }

  function fail(reason) {
    setPhase("fail");
    el.gv.classList.remove("active"); el.gh.classList.remove("active");
    run.fails += 1; paintPips();
    setMsg("失敗：" + reason, "ng"); setBtn("失敗", true);
    pose.shake = 0; el.timer.style.width = "0%";
    var sign = Math.random() < 0.5 ? -1 : 1;
    tween("tilt", 13 * sign, 380, easeIn);
    tween("d", Math.min(1.12, Math.max(pose.d, 0.6) + 0.14), 380, easeIn, function () {
      pose.anchor = null; // 現在のバー位置を基点にして落とす
      pose.anchor = barAnchor();
      tween("drop", 1, 520, easeIn);
      tween("d", 0.04, 520, easeOut);
    });
    later(function () {
      if (run.fails >= MAX_FAILS) finishRun(); else nextAttempt();
    }, RESULT_MS + 250);
  }

  function barAnchor() { // 描画と同じ式でバー中心を求める
    var d = pose.d, th = d * 50 * Math.PI / 180;
    var H = { x: A.x - 4 - 46 * d, y: A.y - 120 + 74 * d };
    var S0 = { x: H.x + L_TORSO * Math.sin(th), y: H.y - L_TORSO * Math.cos(th) };
    return { x: S0.x - Math.cos(th) * 9 - Math.sin(th) * -6, y: S0.y - Math.sin(th) * 9 + Math.cos(th) * -6 };
  }

  /* アニメーションループ */
  function frame(now) {
    var dones = [], keep = [];
    anims.forEach(function (a) {
      var x = Math.min(1, (now - a.t0) / a.ms);
      pose[a.key] = lerp(a.from, a.to, a.fn(x));
      if (x >= 1) { if (a.done) dones.push(a.done); } else keep.push(a);
    });
    anims = keep;
    dones.forEach(function (fn) { fn(); });
    if (current === "game" && att) {
      var ph = att.phase, m;
      if (ph === "depth") {
        m = markerPos(); el.vm.style.top = pct(m); pose.d = m;
        el.timer.style.width = pct(Math.max(0, 1 - (now - att.t0) / LIMIT_MS));
        if (now - att.t0 > LIMIT_MS) fail("時間切れ");
      } else if (ph === "power") {
        m = markerPos(); el.hm.style.left = pct(m);
        el.timer.style.width = pct(Math.max(0, 1 - (now - att.t0) / LIMIT_MS));
        pose.shake = Math.sin(now / 38) * 0.9;
        if (now - att.t0 > LIMIT_MS) fail("時間切れ");
      } else if (ph === "bottom") {
        el.timer.style.width = "0%"; pose.shake = Math.sin(now / 38) * 0.6;
      } else if (ph === "ready" || ph === "rise" || ph === "fail") {
        if (ph !== "fail") el.timer.style.width = "0%";
      }
      lifter.render(pose, run.weight);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- 入力 ---------- */
  el.act.addEventListener("pointerdown", function (e) { e.preventDefault(); act(); });
  el.act.addEventListener("click", function (e) { if (e.detail === 0 && !e.__k) act(); });
  function isKey(e) { return e.key === " " || e.key === "Spacebar" || e.key === "Enter"; }
  document.addEventListener("keydown", function (e) {
    if (current !== "game" || !isKey(e)) return;
    e.preventDefault();
    if (!e.repeat) act();
  });
  document.addEventListener("keyup", function (e) { if (current === "game" && isKey(e)) e.preventDefault(); });

  /* ---------- 結果 ---------- */
  function finishRun() {
    clearLater();
    var res = S.record({ best: run.bestW, lifts: run.lifts });
    var d = res.data;
    $("r-best").textContent = run.bestW > 0 ? fmtW(run.bestW) + " kg" : "成功なし";
    $("r-lifts").textContent = "成功 " + run.lifts + "回";
    $("r-pb").hidden = !res.isPB;
    $("r-pbtxt").textContent = res.isPB ? (res.prevBest > 0 ? "これまで " + fmtW(res.prevBest) + " kg" : "") : (d.best > 0 ? "自己ベスト " + fmtW(d.best) + " kg" : "");
    renderHistory(d.history);
    show("result");
    $("btn-retry").focus({ preventScroll: true });
  }
  function renderHistory(hist) {
    var body = $("r-body");
    body.textContent = "";
    if (!hist.length) {
      var tr0 = document.createElement("tr"), td0 = document.createElement("td");
      td0.colSpan = 3; td0.className = "empty"; td0.textContent = "履歴なし";
      tr0.appendChild(td0); body.appendChild(tr0); return;
    }
    hist.forEach(function (h) {
      var tr = document.createElement("tr");
      [h.at || "-", h.best > 0 ? fmtW(h.best) + " kg" : "-", h.lifts + "回"].forEach(function (t) {
        var td = document.createElement("td"); td.textContent = t; tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  }
  $("btn-retry").addEventListener("click", function () { refreshTitle(); startRun(); });
  $("btn-reset").addEventListener("click", function () {
    if (!window.confirm("記録をすべて消します。よろしいですか？")) return;
    var d = S.reset();
    $("r-pb").hidden = true; $("r-pbtxt").textContent = "";
    renderHistory(d.history);
    refreshTitle();
  });

  refreshTitle();
  show("title");
})();
