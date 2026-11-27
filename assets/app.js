/* case os — app. Everything stays in this browser (localStorage). No server, no account. */
(function () {
  'use strict';
  var L = window.CaseLogic, D = window.CaseData;
  var KEY = 'caseos.v1', THEME = 'caseos.theme';
  var S, storageOk = true, storageErr = '';
  var ui = { reqFilter: 'all', reqType: '', reqQ: '', numView: 'num', qaFilter: '', qaTag: '', libQ: '', libTag: '', open: {}, drill: null, sum: { parts: '', total: '' }, imp: null };
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ---------- storage ---------- */
  function load() {
    var raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { storageOk = false; storageErr = 'เบราว์เซอร์ไม่ให้เก็บข้อมูล (โหมดส่วนตัว?)'; }
    if (raw) {
      try { return L.migrate(JSON.parse(raw)); }
      catch (e) {
        /* never overwrite unreadable data: keep a copy and tell the user */
        try { localStorage.setItem(KEY + '.corrupt', raw); } catch (e2) {}
        storageErr = 'ข้อมูลที่เก็บไว้อ่านไม่ได้ ระบบสำเนาไว้ที่ caseos.v1.corrupt แล้วเริ่มใหม่ — ถ้ามีไฟล์สำรอง ให้นำเข้าที่หน้า "สำรอง"';
      }
    }
    return L.defaultState();
  }
  function save() {
    S.meta.updated = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; }
    catch (e) { storageOk = false; storageErr = 'บันทึกไม่ได้ (พื้นที่เต็ม หรือเบราว์เซอร์บล็อก) — กด "ดาวน์โหลดสำรอง" ทันที'; renderBanner(); }
  }
  S = load();

  /* ---------- helpers ---------- */
  function esc(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function opt(list, val, empty) {
    return (empty !== undefined ? '<option value="">' + esc(empty) + '</option>' : '') +
      list.map(function (o) { var v = Array.isArray(o) ? o[0] : o, t = Array.isArray(o) ? o[1] : o; return '<option value="' + esc(v) + '"' + (v === val ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('');
  }
  function owners() { return S.team.map(function (t) { return t.name || t.role; }); }
  function find(arr, id) { for (var i = 0; i < arr.length; i++) if (arr[i].id === id) return arr[i]; return null; }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t);
    toast.t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function fk(ent, id, k) { return ent + '|' + id + '|' + k; }
  function field(ent, id, k, val, extra) {
    return 'data-ent="' + ent + '" data-id="' + esc(id) + '" data-k="' + k + '" data-fk="' + fk(ent, id, k) + '" ' + (extra || '');
  }
  function ago(ts) {
    if (!ts) return 'ยังไม่เคย';
    var d = Math.floor((Date.now() - ts) / 86400000);
    return d <= 0 ? 'วันนี้' : d + ' วันก่อน';
  }

  /* ---------- views ---------- */
  var VIEWS = [
    ['home', 'หลัก', 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10'],
    ['reqs', 'โจทย์', 'M5 4h14v16H5zM9 9h6M9 13h6M9 17h3'],
    ['phases', 'เฟส', 'M4 6h16M4 12h10M4 18h6'],
    ['nums', 'ตัวเลข', 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16'],
    ['qa', 'Q&A', 'M4 5h16v10H9l-5 4zM9 9h6'],
    ['pre', 'ก่อนส่ง', 'M5 12l4 4 10-10'],
    ['lib', 'คลัง', 'M5 4h5v16H5zM12 4h3v16h-3zM17 6l3 1-3 13-3-1z']
  ];
  var TITLES = { home: 'หน้าหลัก', reqs: 'โจทย์ → สไลด์', phases: 'เฟสและวันสำคัญ', nums: 'ตัวเลขต้องตรงกัน', qa: 'คลัง Q&A', pre: 'เช็กลิสต์ก่อนส่ง', lib: 'คลังความรู้', backup: 'สำรองข้อมูล' };

  function reqStats() { return L.reqSummary(S.reqs); }
  function preAll() {
    var rs = reqStats(), ns = L.numSummary(S.nums);
    var items = [];
    D.PRE.forEach(function (p) {
      var st;
      if (p.auto === 'reqs') st = S.reqs.length && !rs.open && !rs.draft;
      else if (p.auto === 'nums') st = S.nums.length > 0 && ns.bad === 0 && ns.warn === 0 && ns.unused === 0;
      else st = !!S.pre[p.id];
      items.push({ g: p.g, id: p.id, t: p.t, done: !!st, auto: p.auto });
    });
    S.reqs.forEach(function (r) {
      if (r.type === 'concept') items.push({ g: 'คำบังคับ', id: 'term:' + r.id, t: 'ค้นคำ/แนวคิดบังคับในไฟล์ PDF แล้วเจอใน insight, answer, KPI, Exec Summary: “' + r.text + '”', done: !!S.pre['term:' + r.id] });
      if (r.type === 'comp') items.push({ g: 'ไฟล์', id: 'comp:' + r.id, t: 'กติกาไฟล์: ' + r.text, done: !!S.pre['comp:' + r.id] });
    });
    S.preCustom.forEach(function (c) { items.push({ g: 'ของทีมเอง', id: c.id, t: c.t, done: !!S.pre[c.id], custom: true }); });
    return items;
  }

  function vHome() {
    var d = S.dates, rs = reqStats(), ns = L.numSummary(S.nums), pre = preAll();
    var preDone = pre.filter(function (i) { return i.done; }).length;
    var qaReady = S.qa.filter(function (q) { return q.status === 'ready' || q.status === 'rehearsed'; }).length;
    var qaBackup = S.qa.filter(function (q) { return (q.backup || '').trim(); }).length;
    var next = null, relN = L.daysUntil(d.release);
    D.DATE_LABELS.forEach(function (x) {
      var n = L.daysUntil(d[x[0]]);
      if (n !== null && n >= 0 && (!next || n < next.n)) next = { key: x[0], label: x[1], n: n, date: d[x[0]] };
    });
    /* the hero counts down to the case release (D0) until it has passed, then to the next date */
    var main = relN !== null && relN >= 0 ? { key: 'release', label: 'ปล่อยเคส (D0)', n: relN, date: d.release } : next;
    var also = next && main && next.key !== main.key ? '<br><small>วันสำคัญถัดไป: ' + esc(next.label) + ' อีก ' + next.n + ' วัน (' + L.fmtDate(next.date) + ')</small>' : '';
    var sched = L.phaseSchedule(d.release, d.submit), cur = L.currentPhase(sched);
    var hero = main
      ? '<div class="hero"><div class="hero-n">' + (main.n === 0 ? 'วันนี้' : main.n) + '</div><div class="hero-t">' + (main.n === 0 ? '' : 'วัน ') + 'ถึง ' + esc(main.label) + '<br><small>' + L.fmtDate(main.date) + '</small>' + also + '</div></div>'
      : '<div class="hero"><div class="hero-t">ไม่มีวันสำคัญข้างหน้า — ตั้งวันที่ในแท็บ “เฟส”</div></div>';
    var chk = [];
    if (rs.open) chk.push('<a href="#/reqs">โจทย์ ' + rs.open + ' ข้อยังไม่มีสไลด์ตอบ</a>');
    if (ns.bad) chk.push('<a href="#/nums">ตัวเลข ' + ns.bad + ' จุดไม่ตรงกัน</a>');
    if (ns.warn) chk.push('<a href="#/nums">ตัวเลข ' + ns.warn + ' จุดควรตรวจ (ปัดต่างกัน/หน่วย/อ่านไม่ออก)</a>');
    if (!d.submit) chk.push('<a href="#/phases">ยังไม่ได้ใส่วันส่งงาน (ยังไม่ประกาศ)</a>');
    var team = '<div class="team">' + S.team.map(function (t, i) {
      return '<label class="f"><span>' + esc(t.role) + '</span><input type="text" placeholder="ชื่อ" value="' + esc(t.name) + '" data-team="' + i + '" data-fk="team|' + i + '"></label>';
    }).join('') + '</div>';
    return '' + hero +
      '<div class="grid4">' +
      stat('โจทย์', rs.total ? (rs.done + '/' + rs.total) : '–', rs.open ? rs.open + ' ยังไม่ตอบ' : (rs.total ? 'ตอบครบ' : 'ยังไม่ได้ใส่'), '#/reqs', rs.open ? 'warn' : '') +
      stat('ตัวเลข', S.nums.length || '–', ns.bad ? ns.bad + ' ไม่ตรง' : (ns.uses ? 'ตรงกัน' : 'ยังไม่ได้ใส่'), '#/nums', ns.bad ? 'bad' : '') +
      stat('Q&A พร้อม', S.qa.length ? qaReady + '/' + S.qa.length : '–', 'มี backup slide ' + qaBackup + ' ข้อ (เป้า 10)', '#/qa', '') +
      stat('ก่อนส่ง', preDone + '/' + pre.length, Math.round(preDone / pre.length * 100) + '%', '#/pre', '') +
      '</div>' +
      (cur !== null ? '<section class="card"><h2>ตอนนี้อยู่เฟส ' + cur + ': ' + esc(D.PHASES[cur].name) + '</h2><p class="mut">Gate: ' + esc(D.PHASES[cur].gate) + ' · <a href="#/phases">เปิดเช็กลิสต์</a></p></section>' : '') +
      '<section class="card"><h2>สิ่งที่ควรทำต่อ</h2>' + (chk.length ? '<ul class="todo">' + chk.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>' : '<p class="mut">ไม่มีรายการค้างที่ระบบตรวจได้</p>') + '</section>' +
      '<section class="card"><h2>ชื่อโปรเจกต์และทีม</h2><label class="f"><span>ชื่อเคส</span><input type="text" value="' + esc(S.name) + '" data-proj="name" data-fk="proj|name"></label>' + team + '<p class="mut">ชื่อที่ใส่จะขึ้นเป็นตัวเลือก “เจ้าของ” ในแท็บโจทย์และ Q&A</p></section>' +
      '<section class="card"><h2>ข้อมูลอยู่ในเครื่องนี้เท่านั้น</h2><p>สำรองล่าสุด: <b>' + esc(ago(S.meta.lastExport)) + '</b> · <a href="#/backup">ไปหน้าสำรองข้อมูล</a></p></section>';
  }
  function stat(t, n, sub, href, cls) { return '<a class="stat ' + cls + '" href="' + href + '"><span class="stat-t">' + t + '</span><span class="stat-n">' + esc(n) + '</span><span class="stat-s">' + esc(sub) + '</span></a>'; }

  /* ----- reqs ----- */
  function vReqs() {
    var rs = reqStats(), f = ui.reqFilter, q = ui.reqQ.toLowerCase();
    var list = S.reqs.filter(function (r) {
      var st = L.reqState(r);
      if (f !== 'all' && st !== f) return false;
      if (ui.reqType && r.type !== ui.reqType) return false;
      if (q && (r.text + ' ' + r.src).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var chips = [['all', 'ทั้งหมด ' + rs.total], ['open', 'ยังไม่ตอบ ' + rs.open], ['draft', 'ร่าง ' + rs.draft], ['done', 'ครบ ' + rs.done]].map(function (c) {
      return '<button class="chip' + (f === c[0] ? ' on' : '') + '" data-act="reqf" data-v="' + c[0] + '">' + c[1] + '</button>';
    }).join('');
    var cards = list.map(function (r) {
      var st = L.reqState(r), slides = L.parseSlides(r.slides);
      var badge = st === 'open' ? '<span class="b bad">ยังไม่มีสไลด์</span>' : st === 'done' ? '<span class="b ok">ครบ</span>' : '<span class="b warn">ร่าง</span>';
      return '<article class="card req ' + st + '"><div class="row-top">' + badge + '<span class="mut">' + (slides.length ? 'สไลด์ ' + slides.join(', ') : '') + '</span><button class="x" data-act="del" data-ent="reqs" data-id="' + r.id + '" aria-label="ลบ">ลบ</button></div>' +
        '<label class="f"><span>ข้อกำหนด (ก๊อปคำโจทย์ตรงๆ)</span><textarea rows="2" ' + field('reqs', r.id, 'text') + '>' + esc(r.text) + '</textarea></label>' +
        '<div class="grid2">' +
        '<label class="f"><span>หน้า booklet / §</span><input type="text" ' + field('reqs', r.id, 'src') + ' value="' + esc(r.src) + '"></label>' +
        '<label class="f"><span>ประเภท</span><select ' + field('reqs', r.id, 'type') + '>' + opt(D.REQ_TYPES, r.type) + '</select></label>' +
        '<label class="f"><span>ตอบในสไลด์ (เช่น 3, 7-9)</span><input type="text" inputmode="text" ' + field('reqs', r.id, 'slides') + ' value="' + esc(r.slides) + '"></label>' +
        '<label class="f"><span>เจ้าของ</span><select ' + field('reqs', r.id, 'owner') + '>' + opt(owners(), r.owner, '— เลือก —') + '</select></label>' +
        '<label class="f"><span>สถานะ</span><select ' + field('reqs', r.id, 'status') + '>' + opt([['draft', 'ร่าง'], ['done', 'ครบ (ตรวจแล้ว)']], r.status) + '</select></label>' +
        '</div>' + (r.status === 'done' && !slides.length ? '<p class="warnline">สถานะ “ครบ” แต่ยังไม่ได้ใส่เลขสไลด์ — นับเป็นยังไม่ตอบ</p>' : '') + '</article>';
    }).join('');
    var cc = L.criteriaCheck(S.criteria);
    var crit = S.criteria.map(function (c, i) {
      var fl = cc.flags[i];
      return '<article class="card crit"><div class="grid2">' +
        '<label class="f"><span>เกณฑ์</span><input type="text" ' + field('criteria', c.id, 'name') + ' value="' + esc(c.name) + '"></label>' +
        '<label class="f"><span>น้ำหนัก %</span><input type="text" inputmode="decimal" ' + field('criteria', c.id, 'weight') + ' value="' + esc(c.weight) + '"></label>' +
        '<label class="f"><span>สไลด์ที่ตอบ</span><input type="text" ' + field('criteria', c.id, 'slides') + ' value="' + esc(c.slides) + '"></label>' +
        '<label class="f"><span>จำนวนหน้าที่ให้</span><input type="text" inputmode="numeric" ' + field('criteria', c.id, 'pages') + ' value="' + esc(c.pages) + '"></label></div>' +
        (fl.indexOf('no-slides') >= 0 ? '<span class="b bad">ยังไม่มีสไลด์</span> ' : '') + (fl.indexOf('few-pages') >= 0 ? '<span class="b warn">หน้าน้อยกว่าน้ำหนักคะแนน</span> ' : '') +
        '<button class="x" data-act="del" data-ent="criteria" data-id="' + c.id + '">ลบ</button></article>';
    }).join('');
    return '<section class="card"><h2>เพิ่มข้อกำหนดจาก booklet</h2>' +
      '<p class="mut">วางข้อความทั้งย่อหน้าได้ — 1 บรรทัด = 1 ข้อ (ตัดเลขนำหน้า/จุดหัวข้อให้)</p>' +
      '<textarea id="reqPaste" rows="4" placeholder="เช่น\nKey question ข้อ 1 …\nต้องส่ง Exec Summary 1 หน้า …"></textarea>' +
      '<div class="row"><label class="f inl"><span>ประเภท</span><select id="reqPasteType">' + opt(D.REQ_TYPES, 'q') + '</select></label>' +
      '<button class="btn" data-act="reqadd">เพิ่มจากข้อความที่วาง</button></div></section>' +
      '<div class="chips">' + chips + '</div>' +
      '<div class="row"><input id="reqQ" type="search" placeholder="ค้นหาข้อกำหนด" value="' + esc(ui.reqQ) + '"><select id="reqType">' + opt(D.REQ_TYPES, ui.reqType, 'ทุกประเภท') + '</select></div>' +
      (cards || '<p class="empty">' + (S.reqs.length ? 'ไม่มีรายการตามตัวกรอง' : 'ยังไม่มีข้อกำหนด — วางข้อความจาก booklet ด้านบน (ปล่อย 15 ม.ค. 2027)') + '</p>') +
      '<h2 class="sec">ตารางเกณฑ์คะแนน → สไลด์</h2>' +
      '<p class="mut">แบ่งจำนวนหน้าให้ตรงกับน้ำหนักคะแนน (บทเรียน KHC: Sustainability 15% แต่ได้บรรทัดเดียว) เกณฑ์ยังไม่ประกาศ — กรอกเมื่อรู้</p>' +
      crit + (S.criteria.length ? '<p class="' + (cc.weightOk ? 'mut' : 'warnline') + '">น้ำหนักรวม ' + cc.weight + '%' + (cc.weightOk ? '' : ' (ควรเป็น 100)') + ' · หน้ารวม ' + cc.pages + '</p>' : '') +
      '<button class="btn ghost" data-act="critadd">+ เพิ่มเกณฑ์</button>';
  }

  /* ----- phases ----- */
  function vPhases() {
    var d = S.dates;
    var sched = L.phaseSchedule(d.release, d.submit), cur = L.currentPhase(sched);
    var dates = D.DATE_LABELS.map(function (x) {
      var n = L.daysUntil(d[x[0]]);
      var cd = n === null ? '' : n > 0 ? 'อีก ' + n + ' วัน' : n === 0 ? 'วันนี้' : 'ผ่านมา ' + (-n) + ' วัน';
      return '<div class="drow"><label class="f"><span>' + esc(x[1]) + '</span><input type="date" data-date="' + x[0] + '" data-fk="date|' + x[0] + '" value="' + esc(d[x[0]]) + '"></label><div class="cd">' + cd + '</div><div class="mut sm">' + esc(x[2]) + '</div></div>';
    }).join('');
    var ph = D.PHASES.map(function (p) {
      var done = 0; p.items.forEach(function (_, i) { if (S.gates['p' + p.id + '_' + i]) done++; });
      var w = sched && sched[p.id] ? L.fmtDate(sched[p.id].start) + ' – ' + L.fmtDate(sched[p.id].end) : '';
      var open = ui.open['p' + p.id];
      var items = p.items.map(function (t, i) {
        var k = 'p' + p.id + '_' + i;
        return '<label class="chk"><input type="checkbox" data-gate="' + k + '"' + (S.gates[k] ? ' checked' : '') + '><span>' + esc(t) + '</span></label>';
      }).join('');
      return '<section class="card ph' + (cur === p.id ? ' now' : '') + '"><button class="ph-h" data-act="tog" data-v="p' + p.id + '" aria-expanded="' + !!open + '"><span class="ph-n">' + (p.id || '·') + '</span><span class="ph-t"><b>' + esc(p.name) + '</b><small>' + (p.pct ? 'เวลา ' + p.pct + ' · ' : '') + 'Gate: ' + esc(p.gate) + (w ? ' · ' + w : '') + '</small></span><span class="ph-c">' + done + '/' + p.items.length + '</span></button>' +
        '<div class="bar"><i style="width:' + Math.round(done / p.items.length * 100) + '%"></i></div>' + (open ? '<div class="ph-b">' + items + '</div>' : '') + '</section>';
    }).join('');
    return '<section class="card"><h2>วันสำคัญ (แก้ได้)</h2>' + dates + '</section>' +
      '<p class="mut">' + (sched ? 'วันที่ของแต่ละเฟสคำนวณจากสัดส่วนเวลาใน case-workflow (D0 → DS) เป็นค่าประมาณ — เฟส 4 โมเดลวิ่งขนานกับเฟส 3–5' : 'ใส่ “วันส่งงานรอบแรก” เพื่อให้ระบบคำนวณช่วงวันของแต่ละเฟส (ตอนนี้แสดงเฉพาะสัดส่วนเวลา)') + '</p>' + ph;
  }

  /* ----- numbers ----- */
  var NUM_LBL = { ok: ['ok', 'ตรง'], round: ['warn', 'ปัดต่างกัน'], unit: ['warn', 'หน่วย/ตัวคูณต่างกัน'], bad: ['bad', 'ไม่ตรง'], empty: ['warn', 'อ่านเป็นตัวเลขไม่ได้'] };
  function vNums() {
    var ns = L.numSummary(S.nums);
    var head = '<div class="grid4"><div class="stat ' + (ns.bad ? 'bad' : '') + '"><span class="stat-t">ไม่ตรง</span><span class="stat-n">' + ns.bad + '</span></div><div class="stat ' + (ns.warn ? 'warn' : '') + '"><span class="stat-t">ควรตรวจ</span><span class="stat-n">' + ns.warn + '</span></div><div class="stat"><span class="stat-t">ตัวเลขหลัก</span><span class="stat-n">' + ns.total + '</span></div><div class="stat ' + (ns.unused ? 'warn' : '') + '"><span class="stat-t">ยังไม่ลงสไลด์</span><span class="stat-n">' + ns.unused + '</span></div></div>';
    var tabs = '<div class="chips"><button class="chip' + (ui.numView === 'num' ? ' on' : '') + '" data-act="numv" data-v="num">ตามตัวเลข</button><button class="chip' + (ui.numView === 'slide' ? ' on' : '') + '" data-act="numv" data-v="slide">ตามสไลด์</button><button class="chip' + (ui.numView === 'sum' ? ' on' : '') + '" data-act="numv" data-v="sum">เช็กผลรวม</button></div>';
    var body = '';
    if (ui.numView === 'num') {
      body = '<section class="card"><h2>เพิ่มตัวเลขหลักของโมเดล</h2><p class="mut">พิมพ์ครั้งเดียวจากโมเดล (ชีต Output) แล้วบันทึกว่าไปโผล่ในสไลด์ไหนบ้าง ตัวเลขที่พิมพ์ได้: 26.4, 2.2M, 11.4%, 2.2 ล้าน</p>' +
        '<div class="grid2"><label class="f"><span>ชื่อตัวเลข</span><input id="nLabel" type="text" placeholder="เช่น EV ของเป้าหมาย"></label>' +
        '<label class="f"><span>ค่าในโมเดล</span><input id="nVal" type="text" inputmode="decimal" placeholder="เช่น 26.4"></label>' +
        '<label class="f"><span>หน่วย</span><input id="nUnit" type="text" placeholder="ล้านบาท / % / เท่า"></label>' +
        '<label class="f"><span>ที่มาในโมเดล (ชีต/เซลล์)</span><input id="nSrc" type="text" placeholder="Output!B7"></label></div>' +
        '<button class="btn" data-act="numadd">เพิ่มตัวเลข</button></section>' +
        '<label class="f"><span>เวอร์ชันโมเดลที่ล็อกล่าสุด</span><input type="text" data-proj="modelVersion" data-fk="proj|mv" value="' + esc(S.modelVersion) + '" placeholder="model_v03"></label>' +
        S.nums.map(numCard).join('') || '<p class="empty">ยังไม่มีตัวเลข</p>';
      if (!S.nums.length) body = body.replace(/<p class="empty">.*$/, '') + '<p class="empty">ยังไม่มีตัวเลข — ใส่ตัวเลขสำคัญจากโมเดล</p>';
    } else if (ui.numView === 'slide') {
      var by = {};
      S.nums.forEach(function (n) { (n.uses || []).forEach(function (u) { var k = String(u.slide || '?'); (by[k] = by[k] || []).push({ n: n, u: u }); }); });
      var keys = Object.keys(by).sort(function (a, b) { return (+a || 999) - (+b || 999); });
      body = keys.length ? keys.map(function (k) {
        return '<section class="card"><h2>สไลด์ ' + esc(k) + '</h2>' + by[k].map(function (x) {
          var st = L.compareNum(x.n.value, x.u.shown), lb = NUM_LBL[st];
          return '<div class="urow"><span>' + esc(x.n.label) + '</span><span>สไลด์แสดง <b>' + esc(x.u.shown) + '</b> / โมเดล <b>' + esc(x.n.value) + '</b></span><span class="b ' + lb[0] + '">' + lb[1] + '</span></div>';
        }).join('') + '</section>';
      }).join('') : '<p class="empty">ยังไม่มีการบันทึกว่าตัวเลขไปอยู่สไลด์ไหน</p>';
    } else {
      var r = L.sumCheck(ui.sum.parts, ui.sum.total);
      body = '<section class="card"><h2>เช็กผลรวม (กราฟวงกลม / งบ)</h2><p class="mut">ใส่ส่วนย่อยทั้งหมด คั่นด้วยเว้นวรรคหรือจุลภาค — ค่าเริ่มต้นยอดรวม = 100 (บทเรียน KHC: legend รวม 2.8M แต่เขียนงบรวม 3.0M)</p>' +
        '<label class="f"><span>ส่วนย่อย</span><textarea id="sumParts" data-fk="sum|parts" rows="2" placeholder="2.0 0.3 0.2 0.3">' + esc(ui.sum.parts) + '</textarea></label>' +
        '<label class="f"><span>ยอดรวมที่เขียนในสไลด์ (เว้นว่าง = 100)</span><input id="sumTotal" data-fk="sum|total" type="text" value="' + esc(ui.sum.total) + '" placeholder="3.0"></label>' +
        (r ? '<p class="' + (r.ok ? 'okline' : 'warnline') + '">ผลรวม ' + r.sum + ' ' + (r.ok ? '= ' + r.total + ' ✔ ตรง' : '≠ ' + r.total + ' (ต่าง ' + r.diff + ')') + ' · ' + r.count + ' ส่วน</p>' : '<p class="mut">ยังไม่มีตัวเลข</p>') + '</section>';
    }
    return head + tabs + body;
  }
  function numCard(n) {
    var uses = (n.uses || []).map(function (u, i) {
      var st = L.compareNum(n.value, u.shown), lb = NUM_LBL[st];
      return '<div class="use ' + st + '"><label class="f s"><span>สไลด์</span><input type="text" inputmode="numeric" data-nu="' + n.id + '|' + i + '|slide" data-fk="nu|' + n.id + '|' + i + '|slide" value="' + esc(u.slide) + '"></label>' +
        '<label class="f s"><span>ที่เขียนบนสไลด์</span><input type="text" data-nu="' + n.id + '|' + i + '|shown" data-fk="nu|' + n.id + '|' + i + '|shown" value="' + esc(u.shown) + '"></label>' +
        '<label class="f s"><span>หมายเหตุ</span><input type="text" data-nu="' + n.id + '|' + i + '|note" data-fk="nu|' + n.id + '|' + i + '|note" value="' + esc(u.note) + '" placeholder="เช่น ใน legend"></label>' +
        '<span class="b ' + lb[0] + '">' + lb[1] + '</span><button class="x" data-act="nudel" data-id="' + n.id + '" data-i="' + i + '">ลบ</button></div>';
    }).join('');
    return '<article class="card num"><div class="grid2">' +
      '<label class="f"><span>ชื่อ</span><input type="text" ' + field('nums', n.id, 'label') + ' value="' + esc(n.label) + '"></label>' +
      '<label class="f"><span>ค่าในโมเดล</span><input type="text" ' + field('nums', n.id, 'value') + ' value="' + esc(n.value) + '"></label>' +
      '<label class="f"><span>หน่วย</span><input type="text" ' + field('nums', n.id, 'unit') + ' value="' + esc(n.unit) + '"></label>' +
      '<label class="f"><span>ที่มาในโมเดล</span><input type="text" ' + field('nums', n.id, 'src') + ' value="' + esc(n.src) + '"></label></div>' +
      '<div class="mut sm">แก้ค่าล่าสุด ' + (n.changed ? L.fmtDate(new Date(n.changed)) : '–') + (n.uses.length ? '' : ' · <b class="warnt">ยังไม่ได้ลงสไลด์ไหนเลย</b>') + '</div>' +
      uses + '<div class="row"><button class="btn ghost" data-act="nuadd" data-id="' + n.id + '">+ ลงสไลด์</button><button class="x" data-act="del" data-ent="nums" data-id="' + n.id + '">ลบตัวเลข</button></div></article>';
  }

  /* ----- QA ----- */
  var QA_ST = [['none', 'ยังไม่มีคำตอบ'], ['draft', 'ร่างคำตอบ'], ['ready', 'พร้อม'], ['rehearsed', 'ซ้อมแล้ว']];
  function vQA() {
    var list = S.qa.filter(function (q) { return (!ui.qaFilter || q.status === ui.qaFilter) && (!ui.qaTag || q.tag === ui.qaTag); });
    var ready = S.qa.filter(function (q) { return q.status === 'ready' || q.status === 'rehearsed'; }).length;
    var bk = S.qa.filter(function (q) { return (q.backup || '').trim(); }).length;
    var drill = ui.drill ? find(S.qa, ui.drill.id) : null;
    var drillBox = drill ? '<section class="card drill"><h2>ซ้อมตอบ</h2><p class="big">' + esc(drill.q) + '</p>' +
      (ui.drill.show ? '<p><b>ตอบสั้น:</b> ' + esc(drill.a || '(ยังไม่มี)') + '</p><p><b>หลักฐาน/ตัวเลข:</b> ' + esc(drill.ev || '–') + '</p><p><b>Backup slide:</b> ' + esc(drill.backup || '–') + '</p>' : '<p class="mut">ตอบออกเสียงก่อน (1 ประโยค → ตัวเลข → backup slide) แล้วค่อยกดดูคำตอบ</p>') +
      '<div class="row">' + (ui.drill.show ? '' : '<button class="btn" data-act="drillshow">ดูคำตอบ</button>') + '<button class="btn ghost" data-act="drill">ข้อถัดไป (สุ่ม)</button><button class="btn ghost" data-act="drillend">จบ</button></div></section>' : '';
    return '<div class="grid4"><div class="stat"><span class="stat-t">คำถามทั้งหมด</span><span class="stat-n">' + S.qa.length + '</span><span class="stat-s">เป้า 15–20</span></div>' +
      '<div class="stat"><span class="stat-t">พร้อมตอบ</span><span class="stat-n">' + ready + '</span></div>' +
      '<div class="stat ' + (bk < 10 ? 'warn' : '') + '"><span class="stat-t">มี backup slide</span><span class="stat-n">' + bk + '</span><span class="stat-s">เป้า 10 ข้อ</span></div></div>' + drillBox +
      '<section class="card"><h2>เพิ่มคำถาม</h2><div class="grid2"><label class="f wide"><span>คำถามที่กรรมการน่าจะถาม</span><input id="qaNew" type="text"></label><label class="f"><span>หมวด</span><select id="qaNewTag">' + opt(D.QA_TAGS, 'other') + '</select></label></div>' +
      '<div class="row"><button class="btn" data-act="qaadd">เพิ่ม</button>' + (S.qa.length ? '' : '<button class="btn ghost" data-act="qaseed">เพิ่มคำถามตัวอย่าง 6 ข้อจาก case-workflow</button>') + '<button class="btn ghost" data-act="drill"' + (S.qa.length ? '' : ' disabled') + '>ซ้อมตอบ (สุ่ม)</button></div></section>' +
      '<div class="row"><select id="qaF">' + opt(QA_ST, ui.qaFilter, 'ทุกสถานะ') + '</select><select id="qaT">' + opt(D.QA_TAGS, ui.qaTag, 'ทุกหมวด') + '</select></div>' +
      (list.map(function (q) {
        return '<article class="card qa"><label class="f"><span>คำถาม</span><textarea rows="2" ' + field('qa', q.id, 'q') + '>' + esc(q.q) + '</textarea></label>' +
          '<label class="f"><span>ตอบสั้น 1 ประโยค</span><textarea rows="2" ' + field('qa', q.id, 'a') + '>' + esc(q.a) + '</textarea></label>' +
          '<label class="f"><span>ตัวเลข / หลักฐาน</span><textarea rows="2" ' + field('qa', q.id, 'ev') + '>' + esc(q.ev) + '</textarea></label>' +
          '<div class="grid2"><label class="f"><span>Backup slide หน้า</span><input type="text" ' + field('qa', q.id, 'backup') + ' value="' + esc(q.backup) + '" placeholder="เช่น B3"></label>' +
          '<label class="f"><span>เจ้าของ</span><select ' + field('qa', q.id, 'owner') + '>' + opt(owners(), q.owner, '— เลือก —') + '</select></label>' +
          '<label class="f"><span>หมวด</span><select ' + field('qa', q.id, 'tag') + '>' + opt(D.QA_TAGS, q.tag) + '</select></label>' +
          '<label class="f"><span>สถานะ</span><select ' + field('qa', q.id, 'status') + '>' + opt(QA_ST, q.status) + '</select></label></div>' +
          '<div class="row"><button class="x" data-act="del" data-ent="qa" data-id="' + q.id + '">ลบ</button></div></article>';
      }).join('') || '<p class="empty">ไม่มีคำถามตามตัวกรอง</p>');
  }

  /* ----- pre-submit ----- */
  function vPre() {
    var items = preAll(), done = items.filter(function (i) { return i.done; }).length;
    var groups = {}, order = [];
    items.forEach(function (i) { if (!groups[i.g]) { groups[i.g] = []; order.push(i.g); } groups[i.g].push(i); });
    var left = items.filter(function (i) { return !i.done; }).length;
    return '<section class="card"><h2>' + (left ? 'ยังไม่พร้อมส่ง — เหลือ ' + left + ' ข้อ' : 'ครบทุกข้อแล้ว') + '</h2><div class="bar big"><i style="width:' + Math.round(done / items.length * 100) + '%"></i></div><p class="mut">' + done + '/' + items.length + ' · ข้อที่ระบบเช็กเองดึงจากแท็บโจทย์/ตัวเลข ส่วนคำบังคับและกติกาไฟล์ดึงจากข้อกำหนดประเภทที่เกี่ยวข้อง</p></section>' +
      order.map(function (g) {
        return '<section class="card"><h2>' + esc(g) + '</h2>' + groups[g].map(function (i) {
          if (i.auto) return '<div class="chk auto"><span class="box' + (i.done ? ' on' : '') + '">' + (i.done ? '✔' : '') + '</span><span>' + esc(i.t) + ' <a href="#/' + (i.auto === 'reqs' ? 'reqs' : 'nums') + '">ไปดู</a></span></div>';
          return '<label class="chk"><input type="checkbox" data-pre="' + esc(i.id) + '"' + (i.done ? ' checked' : '') + '><span>' + esc(i.t) + '</span>' + (i.custom ? '<button class="x" data-act="predel" data-id="' + i.id + '">ลบ</button>' : '') + '</label>';
        }).join('') + '</section>';
      }).join('') +
      '<section class="card"><h2>เพิ่มข้อของทีม (เช่น กติกาเฉพาะของ CMCC)</h2><div class="row"><input id="preNew" type="text" placeholder="เช่น ส่งเป็น PDF ตั้งชื่อไฟล์ ชื่อทีม_CMCC"><button class="btn" data-act="preadd">เพิ่ม</button></div></section>';
  }

  /* ----- library ----- */
  function vLib() {
    var q = ui.libQ.toLowerCase(), tags = ['CMCC', 'KHC', 'M&A', 'ทีมชนะ', 'ขั้นตอน'];
    var list = D.LIB.filter(function (c) {
      if (ui.libTag && c.tag !== ui.libTag) return false;
      if (!q) return true;
      var hay = c.title + ' ' + (c.list || []).join(' ') + ' ' + (c.rows || []).map(function (r) { return r.join(' '); }).join(' ');
      return hay.toLowerCase().indexOf(q) >= 0;
    });
    return '<div class="row"><input id="libQ" type="search" placeholder="ค้นหา เช่น synergy, WACC, KPI" value="' + esc(ui.libQ) + '"></div>' +
      '<div class="chips"><button class="chip' + (!ui.libTag ? ' on' : '') + '" data-act="libt" data-v="">ทั้งหมด</button>' + tags.map(function (t) { return '<button class="chip' + (ui.libTag === t ? ' on' : '') + '" data-act="libt" data-v="' + esc(t) + '">' + esc(t) + '</button>'; }).join('') + '</div>' +
      '<p class="mut">เนื้อหามาจากไฟล์ของคุณเอง 3 ไฟล์ (case-workflow, winning-case-patterns, บทเรียน KHC) — ข้อมูลที่ไม่ใช่ประกาศของ CMCC ระบุไว้ใต้หัวข้อ</p>' +
      list.map(function (c) {
        var open = ui.open['l' + c.id] || !!q;
        var body = c.list ? '<ul>' + c.list.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' :
          '<div class="tw"><table><thead><tr>' + c.rows[0].map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') + '</tr></thead><tbody>' + c.rows.slice(1).map(function (r) { return '<tr>' + r.map(function (x) { return '<td>' + esc(x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
        return '<section class="card lib"><button class="ph-h" data-act="tog" data-v="l' + c.id + '" aria-expanded="' + open + '"><span class="tagp">' + esc(c.tag) + '</span><span class="ph-t"><b>' + esc(c.title) + '</b></span><span class="ph-c">' + (open ? '–' : '+') + '</span></button>' +
          (open ? '<div class="ph-b">' + body + '<p class="mut sm">ที่มา: ' + esc(c.src) + '</p></div>' : '') + '</section>';
      }).join('') || '<p class="empty">ไม่พบ</p>';
  }

  /* ----- backup ----- */
  function vBackup() {
    var pr = ui.imp;
    var impBox = pr ? (pr.error ? '<p class="warnline">' + esc(pr.error) + '</p>' :
      '<div class="card inner"><b>พร้อมนำเข้า:</b> โจทย์ ' + pr.counts.reqs + ' · ตัวเลข ' + pr.counts.nums + ' · Q&A ' + pr.counts.qa + ' · เกณฑ์ ' + pr.counts.criteria + '<p class="mut">การนำเข้าจะ <b>แทนที่</b> ข้อมูลทั้งหมดในเครื่องนี้ (ระบบเก็บสำเนาก่อนแทนที่ไว้ 1 ชุด)</p><div class="row"><button class="btn" data-act="impok">แทนที่ด้วยไฟล์นี้</button><button class="btn ghost" data-act="impcancel">ยกเลิก</button></div></div>') : '';
    return '<section class="card warnbox"><h2>⚠ ข้อมูลอยู่ในเบราว์เซอร์เครื่องนี้เท่านั้น</h2><p>ถ้าล้างข้อมูลเว็บ/ประวัติ เปลี่ยนเบราว์เซอร์ หรือใช้เครื่องมหาวิทยาลัยที่ล้างข้อมูลเมื่อปิด ข้อมูลจะ<b>หายหมด</b> ไม่มีเซิร์ฟเวอร์เก็บให้ · Safari บน iPad อาจล้างข้อมูลเว็บที่ไม่ได้เปิดนาน ให้ “เพิ่มลงหน้าจอโฮม” และสำรองเป็นประจำ</p></section>' +
      '<section class="card"><h2>ดาวน์โหลดสำรอง</h2><p>สำรองล่าสุด: <b>' + esc(ago(S.meta.lastExport)) + '</b> · เก็บไฟล์ไว้ใน Google Drive / ส่งเข้า LINE ตัวเอง</p><div class="row"><button class="btn" data-act="export">ดาวน์โหลดไฟล์สำรอง (.json)</button><button class="btn ghost" data-act="copyjson">คัดลอก JSON</button></div></section>' +
      '<section class="card"><h2>นำเข้าจากไฟล์สำรอง</h2><input type="file" id="impFile" accept="application/json,.json">' + impBox + '</section>' +
      '<section class="card"><h2>สถานะเครื่องนี้</h2><p id="persist" class="mut">กำลังตรวจ…</p></section>' +
      '<section class="card"><h2>เริ่มเคสใหม่</h2><p class="mut">ล้างข้อมูลทั้งหมดเพื่อเริ่มเคสอื่น (ดาวน์โหลดสำรองก่อนเสมอ)</p><button class="x big" data-act="reset">ล้างข้อมูลทั้งหมด</button></section>';
  }

  var RENDER = { home: vHome, reqs: vReqs, phases: vPhases, nums: vNums, qa: vQA, pre: vPre, lib: vLib, backup: vBackup };
  var view = 'home';

  function route() {
    var h = (location.hash || '').replace(/^#\/?/, '');
    view = RENDER[h] ? h : 'home';
    render(true);
  }
  function render(scrollTop) {
    var y = window.scrollY;
    $('#main').innerHTML = RENDER[view]();
    $('#title').textContent = TITLES[view];
    document.title = (view === 'home' ? '' : TITLES[view] + ' · ') + 'case os';
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === view); a.setAttribute('aria-current', a.getAttribute('data-nav') === view ? 'page' : 'false'); });
    renderBanner();
    window.scrollTo(0, scrollTop ? 0 : y);
    if (view === 'backup') persistInfo();
  }
  function renderBanner() {
    var b = $('#banner'), msgs = [];
    if (!storageOk) msgs.push('<b>เก็บข้อมูลไม่ได้</b> ' + esc(storageErr));
    else if (storageErr) msgs.push(esc(storageErr));
    if (L.backupDue(S)) msgs.push('ยังไม่ได้สำรองข้อมูลล่าสุด (' + esc(ago(S.meta.lastExport)) + ') — ข้อมูลอยู่ในเครื่องนี้เท่านั้น <a href="#/backup">สำรองเลย</a>');
    b.hidden = !msgs.length;
    b.innerHTML = msgs.join('<br>');
  }
  function persistInfo() {
    var el = $('#persist'); if (!el) return;
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) { el.textContent = p ? 'เบราว์เซอร์รับปากว่าจะไม่ลบข้อมูลเองเมื่อพื้นที่เต็ม (persistent) — แต่ผู้ใช้ล้างเองได้' : 'ยังไม่ได้ขอสิทธิ์เก็บถาวร — ติดตั้งแอปลงหน้าจอโฮมจะช่วยได้'; }, function () { el.textContent = 'ตรวจไม่ได้'; });
    } else el.textContent = 'เบราว์เซอร์นี้ไม่รายงานสถานะ';
  }

  /* ---------- events ---------- */
  var main = $('#main');
  function rerenderKeepFocus() {
    setTimeout(function () {
      var a = document.activeElement, key = a && a.getAttribute && a.getAttribute('data-fk');
      render(false);
      if (key) { var n = document.querySelector('[data-fk="' + key.replace(/"/g, '\\"') + '"]'); if (n) { try { n.focus(); } catch (e) {} } }
    }, 0);
  }
  var DERIVED = { reqs: ['slides', 'status', 'type'], criteria: ['weight', 'pages', 'slides'], nums: ['value'] };

  main.addEventListener('change', function (e) {
    var t = e.target, ent = t.getAttribute('data-ent');
    if (ent) {
      var row = find(S[ent], t.getAttribute('data-id')), k = t.getAttribute('data-k');
      if (!row) return;
      if (ent === 'nums' && k === 'value' && row.value !== t.value) row.changed = Date.now();
      row[k] = t.value; save();
      if (ent === 'qa' && k === 'tag' || (DERIVED[ent] || []).indexOf(k) >= 0 || (ent === 'reqs' && k === 'owner' && false)) rerenderKeepFocus();
      return;
    }
    if (t.hasAttribute('data-team')) { S.team[+t.getAttribute('data-team')].name = t.value.trim(); save(); return; }
    if (t.hasAttribute('data-proj')) { S[t.getAttribute('data-proj')] = t.value; save(); return; }
    if (t.hasAttribute('data-date')) { S.dates[t.getAttribute('data-date')] = t.value; save(); rerenderKeepFocus(); return; }
    if (t.hasAttribute('data-gate')) { var g = t.getAttribute('data-gate'); if (t.checked) S.gates[g] = 1; else delete S.gates[g]; save(); rerenderKeepFocus(); return; }
    if (t.hasAttribute('data-pre')) { var p = t.getAttribute('data-pre'); if (t.checked) S.pre[p] = 1; else delete S.pre[p]; save(); rerenderKeepFocus(); return; }
    if (t.hasAttribute('data-nu')) {
      var pr = t.getAttribute('data-nu').split('|'), n = find(S.nums, pr[0]); if (!n || !n.uses[+pr[1]]) return;
      n.uses[+pr[1]][pr[2]] = t.value; save(); rerenderKeepFocus(); return;
    }
    if (t.id === 'reqType') { ui.reqType = t.value; render(false); return; }
    if (t.id === 'qaF') { ui.qaFilter = t.value; render(false); return; }
    if (t.id === 'qaT') { ui.qaTag = t.value; render(false); return; }
    if (t.id === 'sumParts' || t.id === 'sumTotal') { ui.sum.parts = ($('#sumParts') || {}).value || ''; ui.sum.total = ($('#sumTotal') || {}).value || ''; rerenderKeepFocus(); return; }
    if (t.id === 'impFile') { readImport(t.files && t.files[0]); }
  });
  main.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'reqQ') { ui.reqQ = t.value; var pos = t.selectionStart; render(false); var n = $('#reqQ'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (er) {} } }
    if (t.id === 'libQ') { ui.libQ = t.value; var p2 = t.selectionStart; render(false); var n2 = $('#libQ'); if (n2) { n2.focus(); try { n2.setSelectionRange(p2, p2); } catch (er) {} } }
  });

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function exportJSON() { return JSON.stringify({ app: 'case-os', exported: new Date().toISOString(), data: S }, null, 2); }
  function readImport(file) {
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () {
      try { ui.imp = L.validateImport(JSON.parse(fr.result)); } catch (e) { ui.imp = { ok: false, error: 'อ่านไฟล์ไม่ได้ (ไม่ใช่ JSON)' }; }
      if (!ui.imp.ok) ui.imp.error = ui.imp.error || 'ไฟล์ไม่ถูกต้อง';
      render(false);
    };
    fr.onerror = function () { ui.imp = { ok: false, error: 'อ่านไฟล์ไม่ได้' }; render(false); };
    fr.readAsText(file);
  }

  main.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id'), v = b.getAttribute('data-v');
    switch (act) {
      case 'reqf': ui.reqFilter = v; render(false); break;
      case 'reqadd': {
        var lines = L.splitRequirements($('#reqPaste').value), ty = $('#reqPasteType').value;
        if (!lines.length) { toast('วางข้อความก่อน'); break; }
        lines.forEach(function (t) { S.reqs.push({ id: L.uid(), text: t, src: '', type: ty, slides: '', owner: '', status: 'draft' }); });
        save(); ui.reqFilter = 'all'; render(false); toast('เพิ่ม ' + lines.length + ' ข้อ'); break; }
      case 'critadd': S.criteria.push({ id: L.uid(), name: '', weight: '', slides: '', pages: '' }); save(); render(false); break;
      case 'del': {
        var arr = S[b.getAttribute('data-ent')], i = arr.findIndex(function (x) { return x.id === id; });
        if (i >= 0 && confirm('ลบรายการนี้?')) { arr.splice(i, 1); save(); render(false); } break; }
      case 'tog': ui.open[v] = !ui.open[v]; render(false); break;
      case 'numv': ui.numView = v; render(false); break;
      case 'numadd': {
        var lab = $('#nLabel').value.trim(), val = $('#nVal').value.trim();
        if (!lab || !val) { toast('ใส่ชื่อและค่าก่อน'); break; }
        if (!L.parseNum(val)) { toast('ค่าต้องมีตัวเลข เช่น 26.4'); break; }
        S.nums.push({ id: L.uid(), label: lab, value: val, unit: $('#nUnit').value.trim(), src: $('#nSrc').value.trim(), changed: Date.now(), uses: [] }); save(); render(false); break; }
      case 'nuadd': { var n = find(S.nums, id); if (n) { n.uses.push({ slide: '', shown: '', note: '' }); save(); render(false); } break; }
      case 'nudel': { var n3 = find(S.nums, id); if (n3 && confirm('ลบรายการนี้?')) { n3.uses.splice(+b.getAttribute('data-i'), 1); save(); render(false); } break; }
      case 'qaadd': {
        var q = $('#qaNew').value.trim(); if (!q) { toast('พิมพ์คำถามก่อน'); break; }
        S.qa.push(newQA(q, $('#qaNewTag').value)); save(); render(false); break; }
      case 'qaseed': D.QA_SEED.forEach(function (s) { S.qa.push(newQA(s[0], s[1])); }); save(); render(false); toast('เพิ่มคำถามตัวอย่างแล้ว (จาก case-workflow ข้อ 11.1)'); break;
      case 'drill': {
        if (!S.qa.length) break;
        var pool = S.qa.filter(function (x) { return !ui.drill || x.id !== ui.drill.id; }); if (!pool.length) pool = S.qa;
        ui.drill = { id: pool[Math.floor(Math.random() * pool.length)].id, show: false }; render(false); break; }
      case 'drillshow': ui.drill.show = true; render(false); break;
      case 'drillend': ui.drill = null; render(false); break;
      case 'preadd': { var t = $('#preNew').value.trim(); if (!t) break; S.preCustom.push({ id: 'x' + L.uid(), t: t }); save(); render(false); break; }
      case 'predel': { var j = S.preCustom.findIndex(function (x) { return x.id === id; }); if (j >= 0) { S.preCustom.splice(j, 1); delete S.pre[id]; save(); render(false); } break; }
      case 'libt': ui.libTag = v; render(false); break;
      case 'export': {
        download('case-os-backup-' + new Date().toISOString().slice(0, 10) + '.json', exportJSON());
        S.meta.lastExport = Date.now(); save(); render(false); toast('ดาวน์โหลดแล้ว — เก็บไฟล์ไว้ที่อื่นด้วย'); break; }
      case 'copyjson':
        if (navigator.clipboard) navigator.clipboard.writeText(exportJSON()).then(function () { S.meta.lastExport = Date.now(); save(); render(false); toast('คัดลอกแล้ว'); }, function () { toast('คัดลอกไม่ได้ ใช้ปุ่มดาวน์โหลดแทน'); });
        else toast('เบราว์เซอร์ไม่รองรับ ใช้ปุ่มดาวน์โหลดแทน');
        break;
      case 'impok':
        if (ui.imp && ui.imp.ok && confirm('แทนที่ข้อมูลทั้งหมดในเครื่องนี้ด้วยไฟล์สำรอง?')) {
          try { var cur = localStorage.getItem(KEY); if (cur) localStorage.setItem(KEY + '.prev', cur); } catch (e2) {}
          S = ui.imp.state; S.meta.lastExport = Date.now(); ui.imp = null; save(); render(false); toast('นำเข้าแล้ว');
        } break;
      case 'impcancel': ui.imp = null; render(false); break;
      case 'reset':
        if (confirm('ล้างข้อมูลทั้งหมดในเครื่องนี้? (ย้อนกลับไม่ได้ ถ้าไม่มีไฟล์สำรอง)') && confirm('ยืนยันอีกครั้ง: ล้างทั้งหมด')) {
          try { var c2 = localStorage.getItem(KEY); if (c2) localStorage.setItem(KEY + '.prev', c2); } catch (e3) {}
          S = L.defaultState(); save(); render(false); toast('ล้างแล้ว (เหลือสำเนาล่าสุด 1 ชุดในเครื่อง)');
        } break;
    }
  });
  function newQA(q, tag) { return { id: L.uid(), q: q, a: '', ev: '', backup: '', owner: '', tag: tag || 'other', status: 'none' }; }

  /* ---------- chrome ---------- */
  function buildNav() {
    var items = VIEWS.map(function (v) {
      return '<a href="#/' + v[0] + '" data-nav="' + v[0] + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="' + v[2] + '"/></svg><span>' + v[1] + '</span></a>';
    }).join('');
    $('#nav').innerHTML = '<div class="brand">case os</div>' + items +
      '<div class="navfoot"><a href="#/backup" data-nav="backup"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 11l5 5 5-5M5 20h14"/></svg><span>สำรอง</span></a><button id="themeBtn" type="button"><span>ธีม</span></button></div>';
    $('#themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') || 'auto', nx = cur === 'auto' ? 'dark' : cur === 'dark' ? 'light' : 'auto';
      setTheme(nx); toast('ธีม: ' + { auto: 'ตามระบบ', dark: 'มืด', light: 'สว่าง' }[nx]);
    });
  }
  function setTheme(t) {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    document.documentElement.setAttribute('data-pref', t);
    try { localStorage.setItem(THEME, t); } catch (e) {}
  }
  try { var th = localStorage.getItem(THEME); if (th === 'dark' || th === 'light') setTheme(th); } catch (e) {}

  window.addEventListener('hashchange', route);
  buildNav(); route();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(function () {});
  window.__caseos = { state: function () { return S; } };
})();
