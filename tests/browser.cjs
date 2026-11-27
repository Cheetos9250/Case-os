/* Playwright smoke test: node tests/browser.cjs [--shots <dir>] — walks every tab, checks no page errors / overflow, data survives reload, backup round-trip. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const shotsIdx = process.argv.indexOf('--shots'), shots = shotsIdx > 0 ? process.argv[shotsIdx + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f));
});
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };

(async () => {
  await new Promise(r => srv.listen(0, r)); const base = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 820, height: 1180 }, acceptDownloads: true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(String(e))); p.on('dialog', d => d.accept());
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.(googleapis|gstatic)|ERR_|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await p.goto(base);
  ok(await p.title() === 'case os', 'title is lowercase "case os"');
  ok(/"name": "case os"/.test(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8')), 'manifest name lowercase');

  // requirements: paste -> 3 open, link slides
  await p.goto(base + '#/reqs');
  await p.fill('#reqPaste', '1. ต้องตอบ Synergy\n2. ส่ง Exec Summary 1 หน้า\n- ใช้คำว่า Shareholder Value');
  await p.click('[data-act=reqadd]');
  ok(await p.locator('article.req').count() === 3, '3 requirements added');
  ok(await p.locator('.b.bad').count() === 3, 'all 3 flagged unanswered');
  await p.locator('[data-k=slides]').first().fill('3, 7-9'); await p.locator('[data-k=slides]').first().blur();
  await p.waitForTimeout(100);
  ok(await p.locator('article.req.draft').count() === 1, 'linking slides turns one into draft');
  await p.locator('select[data-k=type]').nth(2).selectOption('concept');

  // numbers
  await p.goto(base + '#/nums');
  await p.fill('#nLabel', 'EV'); await p.fill('#nVal', '2.2'); await p.fill('#nUnit', 'ล้านบาท'); await p.click('[data-act=numadd]');
  await p.click('[data-act=nuadd]');
  await p.locator('[data-nu$="|slide"]').fill('19'); await p.locator('[data-nu$="|shown"]').fill('2.0'); await p.locator('[data-nu$="|shown"]').blur();
  await p.waitForTimeout(100);
  ok(await p.locator('.use.bad').count() === 1, 'mismatch 2.2 vs 2.0 is flagged');
  await p.locator('[data-nu$="|shown"]').fill('2.2'); await p.locator('[data-nu$="|shown"]').blur(); await p.waitForTimeout(100);
  ok(await p.locator('.use.ok').count() === 1, 'fixing it shows ok');
  await p.click('[data-act=numv][data-v=sum]'); await p.fill('#sumParts', '2.0 0.3 0.2 0.3'); await p.fill('#sumTotal', '3.0'); await p.locator('#sumTotal').blur(); await p.waitForTimeout(200);
  ok(/≠ 3/.test(await p.locator('.warnline').first().innerText()), 'sum check flags 2.8 != 3.0');

  // phases
  await p.goto(base + '#/phases');
  await p.fill('[data-date=submit]', '2027-02-05'); await p.locator('[data-date=submit]').blur(); await p.waitForTimeout(100);
  await p.click('[data-act=tog][data-v=p1]');
  await p.locator('[data-gate]').first().check();
  ok(/ม\.ค\./.test(await p.locator('.ph').nth(1).innerText()), 'phase dates computed when submit date set');

  // QA
  await p.goto(base + '#/qa'); await p.click('[data-act=qaseed]');
  ok(await p.locator('article.qa').count() === 6, 'seed Q&A');
  await p.click('[data-act=drill]'); await p.click('[data-act=drillshow]');
  ok(await p.locator('.drill').count() === 1, 'drill mode');

  // pre-submit + library
  await p.goto(base + '#/pre'); ok(await p.locator('.chk').count() >= 14, 'pre-submit list (incl. concept term)');
  ok(/Shareholder Value/.test(await p.locator('main').innerText()), 'concept requirement appears in pre-submit');
  await p.goto(base + '#/lib'); await p.fill('#libQ', 'synergy'); ok(await p.locator('.lib').count() >= 2, 'library search');

  // reload keeps data
  await p.goto(base + '#/reqs'); await p.reload();
  ok(await p.locator('article.req').count() === 3, 'data survives reload');
  ok(await p.evaluate(() => !!localStorage.getItem('caseos.v1')), 'stored in localStorage');

  // backup round trip
  await p.goto(base + '#/backup');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-act=export]')]);
  const f = path.join(require('os').tmpdir(), 'caseos-test.json'); await dl.saveAs(f);
  const j = JSON.parse(fs.readFileSync(f, 'utf8')); ok(j.app === 'case-os' && j.data.reqs.length === 3, 'export file content');
  await p.click('[data-act=reset]'); await p.goto(base + '#/reqs'); ok(await p.locator('article.req').count() === 0, 'reset clears');
  await p.goto(base + '#/backup'); await p.setInputFiles('#impFile', f); await p.waitForSelector('[data-act=impok]'); await p.click('[data-act=impok]');
  await p.goto(base + '#/reqs'); ok(await p.locator('article.req').count() === 3, 'import restores');
  await p.goto(base + '#/backup'); fs.writeFileSync(f, '{"hello":1}'); await p.setInputFiles('#impFile', f); await p.waitForSelector('.warnline');
  ok(true, 'bad import file rejected with message');
  ok(await p.evaluate(() => !!localStorage.getItem('caseos.v1.prev')), 'safety copy kept before replace');

  // corrupt storage is never overwritten silently
  await p.evaluate(() => localStorage.setItem('caseos.v1', '{broken')); await p.goto(base + '#/home'); await p.reload();
  ok(await p.evaluate(() => localStorage.getItem('caseos.v1.corrupt') === '{broken'), 'corrupt data copied aside');
  ok(/อ่านไม่ได้/.test(await p.locator('#banner').innerText()), 'corrupt banner shown');

  // layouts: no horizontal overflow, per view, 3 viewports x 2 schemes
  await p.evaluate(() => localStorage.removeItem('caseos.v1'));
  for (const [w, h] of [[1180, 820], [820, 1180], [390, 844]]) for (const cs of ['light', 'dark']) {
    const c2 = await b.newContext({ viewport: { width: w, height: h }, colorScheme: cs }); const q = await c2.newPage();
    q.on('pageerror', e => errs.push(String(e)));
    await q.goto(base);
    await q.evaluate(() => { const L = window.CaseLogic; const s = L.defaultState();
      s.reqs = [{ id: 'a', text: 'ต้องตอบ Key question ข้อ 1 ให้ครบถ้วนและใช้คำของโจทย์ตรงๆ', src: '§1.7', type: 'q', slides: '', owner: '', status: 'draft' }];
      s.nums = [{ id: 'n', label: 'EV', value: '2.2', unit: 'ล้านบาท', src: 'Output!B7', changed: Date.now(), uses: [{ slide: '19', shown: '2.0', note: '' }] }];
      s.qa = [{ id: 'q', q: 'ทำไม premium เท่านี้', a: '', ev: '', backup: '', owner: '', tag: 'deal', status: 'none' }]; localStorage.setItem('caseos.v1', JSON.stringify(s)); });
    for (const v of ['home', 'reqs', 'phases', 'nums', 'qa', 'pre', 'lib', 'backup']) {
      await q.goto(base + '#/' + v); await q.reload();
      if (v === 'phases') await q.click('[data-act=tog][data-v=p2]');
      if (v === 'lib') await q.click('[data-act=tog][data-v=lstress]');
      const ov = await q.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(ov <= 0, `no horizontal overflow ${v} ${w}x${h} ${cs} (${ov})`);
      if (shots && (v === 'home' || v === 'reqs' || v === 'nums' || v === 'phases')) await q.screenshot({ path: path.join(shots, `${v}-${w}-${cs}.png`) });
    }
    await c2.close();
  }
  ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close(); srv.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
