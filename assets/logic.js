/* case os — pure logic (no DOM). Used by the app and by tests/logic.test.cjs */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CaseLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAY = 86400000;
  var KEYS = ['reqs', 'criteria', 'gates', 'nums', 'qa', 'pre', 'preCustom', 'team', 'dates', 'meta'];

  function uid() { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

  function defaultState() {
    return {
      v: 1,
      name: 'CMCC 2027',
      dates: { register: '2027-01-10', release: '2027-01-15', submit: '', boot: '2027-02-23', present: '2027-03-15', final: '2027-04-02' },
      team: [
        { role: 'Lead / Storyline', name: '' },
        { role: 'Model Owner', name: '' },
        { role: 'Research / Industry', name: '' },
        { role: 'Primary Insight + Ideas', name: '' },
        { role: 'Design + QA + Risk', name: '' }
      ],
      reqs: [], criteria: [], gates: {}, nums: [], qa: [], pre: {}, preCustom: [],
      modelVersion: '',
      meta: { created: Date.now(), updated: 0, lastExport: 0 }
    };
  }

  /* fill missing fields so older / partial data never breaks the app */
  function migrate(o) {
    var d = defaultState();
    if (!o || typeof o !== 'object') return d;
    var s = Object.assign({}, d, o);
    s.dates = Object.assign({}, d.dates, o.dates || {});
    s.meta = Object.assign({}, d.meta, o.meta || {});
    ['reqs', 'criteria', 'nums', 'qa', 'preCustom'].forEach(function (k) { if (!Array.isArray(s[k])) s[k] = []; });
    if (!Array.isArray(s.team) || s.team.length !== 5) s.team = d.team;
    if (!s.gates || typeof s.gates !== 'object') s.gates = {};
    if (!s.pre || typeof s.pre !== 'object') s.pre = {};
    s.nums.forEach(function (n) { if (!Array.isArray(n.uses)) n.uses = []; });
    return s;
  }

  /* strict check for imported files; returns {ok, error, counts} */
  function validateImport(o) {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return { ok: false, error: 'ไฟล์ไม่ใช่ข้อมูล case os' };
    if (o.app !== 'case-os' || !o.data || typeof o.data !== 'object') return { ok: false, error: 'ไม่พบเครื่องหมาย case os ในไฟล์ (ต้องเป็นไฟล์ที่กด "ดาวน์โหลดสำรอง" จากแอปนี้)' };
    var d = o.data;
    if (d.v !== 1) return { ok: false, error: 'ไฟล์เป็นเวอร์ชันที่แอปนี้ยังไม่รองรับ' };
    var arrays = ['reqs', 'criteria', 'nums', 'qa', 'preCustom'];
    for (var i = 0; i < arrays.length; i++) if (d[arrays[i]] !== undefined && !Array.isArray(d[arrays[i]])) return { ok: false, error: 'ข้อมูล "' + arrays[i] + '" เสียหาย' };
    if (d.dates !== undefined && (typeof d.dates !== 'object' || d.dates === null)) return { ok: false, error: 'ข้อมูลวันที่เสียหาย' };
    var m = migrate(d);
    return { ok: true, state: m, counts: { reqs: m.reqs.length, nums: m.nums.length, qa: m.qa.length, criteria: m.criteria.length } };
  }

  /* "3, 7-9, 12" -> [3,7,8,9,12] ; ignores junk */
  function parseSlides(str) {
    var out = [], seen = {};
    String(str || '').split(/[,\s;、]+/).forEach(function (p) {
      if (!p) return;
      var m = /^(\d{1,3})(?:\s*[-–~]\s*(\d{1,3}))?$/.exec(p);
      if (!m) return;
      var a = +m[1], b = m[2] ? +m[2] : a;
      if (b < a) { var t = a; a = b; b = t; }
      if (b - a > 100) return;
      for (var i = a; i <= b; i++) if (!seen[i]) { seen[i] = 1; out.push(i); }
    });
    return out.sort(function (x, y) { return x - y; });
  }

  /* paste booklet text -> one requirement per non-empty line (strip bullets / numbering) */
  function splitRequirements(text) {
    return String(text || '').split(/\r?\n/).map(function (l) {
      return l.replace(/^\s*(?:[-*•●▪◦]+|\d{1,3}[.)]|\(\d{1,3}\))\s*/, '').trim();
    }).filter(function (l) { return l.length > 1; });
  }

  /* ---- numbers ---- */
  var SCALES = [
    [/พันล้าน|billion|bn\b|\bb\b/i, 1e9],
    [/ล้าน|million|mn\b|\bm\b/i, 1e6],
    [/พัน|thousand|\bk\b/i, 1e3]
  ];
  /* parseNum("2.2M") -> {n:2.2, scale:1e6, pct:false} ; null when no number */
  function parseNum(str) {
    if (str === null || str === undefined) return null;
    var s = String(str).replace(/,/g, '').replace(/−/g, '-');
    var m = /(-?\d+(?:\.\d+)?)/.exec(s);
    if (!m) return null;
    var rest = s.slice(m.index + m[0].length, m.index + m[0].length + 14);
    var scale = 1;
    for (var i = 0; i < SCALES.length; i++) if (SCALES[i][0].test(rest.trim().slice(0, 10))) { scale = SCALES[i][1]; break; }
    return { n: parseFloat(m[1]), scale: scale, pct: /^\s*(%|เปอร์เซ็นต์)/.test(rest) };
  }
  /* status of one appearance against the canonical value:
     ok | round (within 0.5%) | unit (same digits, different scale) | bad | empty (cannot read) */
  function compareNum(canon, shown) {
    var a = parseNum(canon), b = parseNum(shown);
    if (!a || !b) return 'empty';
    if (a.pct !== b.pct && (a.pct || b.pct) && a.n === b.n) return 'unit';
    if (a.n === b.n && a.scale === b.scale) return 'ok';
    if (a.n === b.n && a.scale !== b.scale) return 'unit';
    var av = a.n * a.scale, bv = b.n * b.scale;
    if (av !== 0 && Math.abs(av - bv) / Math.abs(av) <= 0.005) return 'round';
    return 'bad';
  }
  function numSummary(nums) {
    var bad = 0, warn = 0, unused = 0, uses = 0;
    nums.forEach(function (n) {
      if (!n.uses || !n.uses.length) unused++;
      (n.uses || []).forEach(function (u) {
        uses++;
        var st = compareNum(n.value, u.shown);
        if (st === 'bad') bad++; else if (st === 'round' || st === 'unit' || st === 'empty') warn++;
      });
    });
    return { bad: bad, warn: warn, unused: unused, uses: uses, total: nums.length };
  }
  /* parts must add up to total (default 100) */
  function sumCheck(partsText, totalText) {
    var parts = String(partsText || '').split(/[\s,;]+/).map(function (p) { return parseNum(p); }).filter(Boolean);
    var t = totalText === '' || totalText === undefined ? { n: 100, scale: 1 } : parseNum(totalText);
    if (!parts.length || !t) return null;
    var sum = parts.reduce(function (a, p) { return a + p.n * p.scale; }, 0);
    var tot = t.n * t.scale;
    sum = Math.round(sum * 1e6) / 1e6;
    return { sum: sum, total: tot, diff: Math.round((sum - tot) * 1e6) / 1e6, ok: Math.abs(sum - tot) < 1e-9, count: parts.length };
  }

  /* ---- requirements ---- */
  function reqState(r) {
    var slides = parseSlides(r.slides);
    if (!slides.length) return 'open';           // unanswered: no slide linked
    return r.status === 'done' ? 'done' : 'draft';
  }
  function reqSummary(reqs) {
    var o = { total: reqs.length, open: 0, draft: 0, done: 0 };
    reqs.forEach(function (r) { o[reqState(r)]++; });
    return o;
  }
  /* weights add to 100? pages roughly follow weight? */
  function criteriaCheck(rows) {
    var w = 0, p = 0;
    rows.forEach(function (c) { w += +c.weight || 0; p += +c.pages || 0; });
    var flags = rows.map(function (c) {
      var f = [];
      if (!parseSlides(c.slides).length) f.push('no-slides');
      if (p > 0 && w > 0) {
        var share = (+c.pages || 0) / p * 100, wt = (+c.weight || 0) / w * 100;
        if (wt - share >= 10) f.push('few-pages');
      }
      return f;
    });
    return { weight: w, pages: p, flags: flags, weightOk: w === 100 || rows.length === 0 };
  }

  /* ---- dates / phases ---- */
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    return isNaN(d) ? null : d;
  }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function daysUntil(dateStr, from) {
    var d = parseDate(dateStr); if (!d) return null;
    return Math.round((d - (from || today())) / DAY);
  }
  function fmtDate(d) {
    var x = typeof d === 'string' ? parseDate(d) : d; if (!x) return '';
    var M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return x.getDate() + ' ' + M[x.getMonth()] + ' ' + x.getFullYear();
  }
  /* weights of the sequential phases 1,2,3,5,6,7 (phase 4 runs in parallel) */
  var SEQ = [[1, 5], [2, 20], [3, 15], [5, 20], [6, 10], [7, 5]];
  /* returns {1:{start,end},...} as Date objects, or null when D0/DS missing or DS <= D0 */
  function phaseSchedule(d0str, dsstr) {
    var d0 = parseDate(d0str), ds = parseDate(dsstr);
    if (!d0 || !ds || ds <= d0) return null;
    var total = Math.round((ds - d0) / DAY) + 1;             // days D0..DS inclusive
    var sum = SEQ.reduce(function (a, x) { return a + x[1]; }, 0);
    var out = {}, acc = 0, cursor = 0;
    SEQ.forEach(function (x, i) {
      acc += x[1];
      var endIdx = i === SEQ.length - 1 ? total : Math.max(cursor + 1, Math.round(acc / sum * total));
      out[x[0]] = { start: new Date(+d0 + cursor * DAY), end: new Date(+d0 + (endIdx - 1) * DAY) };
      cursor = endIdx;
    });
    out[4] = { start: out[3].start, end: out[5].end };      // model: from ideas to end of deck
    return out;
  }
  function currentPhase(sched, now) {
    if (!sched) return null;
    var t = now || today();
    var order = [1, 2, 3, 5, 6, 7];
    for (var i = 0; i < order.length; i++) { var p = sched[order[i]]; if (t >= p.start && t <= p.end) return order[i]; }
    return null;
  }

  /* ---- backup reminder ---- */
  function hasData(s) { return !!(s.reqs.length || s.nums.length || s.qa.length || s.criteria.length || s.preCustom.length || Object.keys(s.gates).length || Object.keys(s.pre).length); }
  function backupDue(s, now) {
    now = now || Date.now();
    if (!hasData(s)) return false;
    var last = s.meta.lastExport || 0;
    if (!last) return true;
    return s.meta.updated > last && now - last > 3 * DAY;
  }

  return {
    uid: uid, defaultState: defaultState, migrate: migrate, validateImport: validateImport, KEYS: KEYS,
    parseSlides: parseSlides, splitRequirements: splitRequirements,
    parseNum: parseNum, compareNum: compareNum, numSummary: numSummary, sumCheck: sumCheck,
    reqState: reqState, reqSummary: reqSummary, criteriaCheck: criteriaCheck,
    parseDate: parseDate, daysUntil: daysUntil, fmtDate: fmtDate, today: today,
    phaseSchedule: phaseSchedule, currentPhase: currentPhase, hasData: hasData, backupDue: backupDue
  };
});
