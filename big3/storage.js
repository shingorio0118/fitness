/* BIG3チャレンジ: ブラウザ内保存（localStorage, キー接頭辞 big3_） */
(function (global) {
  "use strict";
  var K_BEST = "big3_best", K_HIST = "big3_history", K_PLAYS = "big3_plays", MAX_HIST = 20;

  function read(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, val) {
    try { localStorage.setItem(key, val); return true; } catch (e) { return false; }
  }
  function remove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }
  function num(v) {
    var n = typeof v === "number" ? v : parseFloat(v);
    return isFinite(n) && n >= 0 ? n : 0;
  }
  function parse(key) {
    var raw = read(key);
    if (raw == null) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function stamp(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
      " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }

  function load() {
    var best = num(parse(K_BEST));
    var plays = Math.floor(num(parse(K_PLAYS)));
    var raw = parse(K_HIST), hist = [];
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length && hist.length < MAX_HIST; i++) {
        var h = raw[i];
        if (!h || typeof h !== "object") continue;
        hist.push({
          at: typeof h.at === "string" ? h.at.slice(0, 16) : "",
          best: num(h.best),
          lifts: Math.floor(num(h.lifts))
        });
      }
    }
    return { best: best, plays: plays, history: hist };
  }

  /* run: { best: 今回の最大成功重量(0なら成功なし), lifts: 成功回数 } */
  function record(run) {
    var d = load();
    var prev = d.best;
    var isPB = run.best > prev && run.best > 0;
    d.history.unshift({ at: stamp(new Date()), best: run.best, lifts: run.lifts });
    d.history = d.history.slice(0, MAX_HIST);
    d.plays += 1;
    if (isPB) d.best = run.best;
    write(K_BEST, JSON.stringify(d.best));
    write(K_HIST, JSON.stringify(d.history));
    write(K_PLAYS, JSON.stringify(d.plays));
    return { prevBest: prev, isPB: isPB, data: d };
  }

  function reset() {
    remove(K_BEST); remove(K_HIST); remove(K_PLAYS);
    return load();
  }

  global.Big3Storage = { load: load, record: record, reset: reset, stamp: stamp };
})(window);
