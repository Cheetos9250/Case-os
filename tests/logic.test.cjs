const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../assets/logic.js');

test('parseSlides handles lists, ranges, junk', () => {
  assert.deepEqual(L.parseSlides('3, 7-9, 12'), [3, 7, 8, 9, 12]);
  assert.deepEqual(L.parseSlides('9-7 abc 3 3'), [3, 7, 8, 9]);
  assert.deepEqual(L.parseSlides(''), []);
  assert.deepEqual(L.parseSlides('B3'), []);
});
test('splitRequirements strips bullets and numbers', () => {
  assert.deepEqual(L.splitRequirements('1. กขก\n- ขขข\n• คคค\n\n(2) งงง\n  '), ['กขก', 'ขขข', 'คคค', 'งงง']);
});
test('compareNum: KHC cases', () => {
  assert.equal(L.compareNum('2.2', '2.2'), 'ok');
  assert.equal(L.compareNum('2.2', '2.0'), 'bad');
  assert.equal(L.compareNum('2.2 ล้าน', '2.2 ล้านบาท'), 'ok');
  assert.equal(L.compareNum('26.4', '26.4M'), 'unit');
  assert.equal(L.compareNum('11.4%', '11.4 %'), 'ok');
  assert.equal(L.compareNum('100', '100.4'), 'round');
  assert.equal(L.compareNum('abc', '1'), 'empty');
  assert.equal(L.compareNum('1', ''), 'empty');
});
test('sumCheck catches 2.8 vs 3.0 and 100%', () => {
  const r = L.sumCheck('2.0 0.3 0.2 0.3', '3.0');
  assert.equal(r.ok, false); assert.equal(r.diff, -0.2);
  assert.equal(L.sumCheck('73.3, 10, 6.7, 10', '').ok, true);
  assert.equal(L.sumCheck('', ''), null);
});
test('numSummary counts', () => {
  const s = L.numSummary([{ value: '2.2', uses: [{ shown: '2.0' }, { shown: '2.2' }] }, { value: '5', uses: [] }]);
  assert.equal(s.bad, 1); assert.equal(s.unused, 1); assert.equal(s.uses, 2);
});
test('req state: no slide = open, even if marked done', () => {
  assert.equal(L.reqState({ slides: '', status: 'done' }), 'open');
  assert.equal(L.reqState({ slides: '3', status: 'draft' }), 'draft');
  assert.equal(L.reqState({ slides: '3', status: 'done' }), 'done');
});
test('criteriaCheck flags missing slides and short pages', () => {
  const c = L.criteriaCheck([{ weight: 85, pages: 18, slides: '2-10' }, { weight: 15, pages: 0, slides: '' }]);
  assert.equal(c.weightOk, true);
  assert.ok(c.flags[1].includes('no-slides'));
  assert.ok(c.flags[1].includes('few-pages'));
});
test('dates: countdown and schedule', () => {
  const from = new Date(2027, 0, 1);
  assert.equal(L.daysUntil('2027-01-15', from), 14);
  assert.equal(L.daysUntil('', from), null);
  assert.equal(L.phaseSchedule('2027-01-15', ''), null);
  assert.equal(L.phaseSchedule('2027-02-01', '2027-01-15'), null);
  const s = L.phaseSchedule('2027-01-15', '2027-02-03'); // 20 days
  assert.equal(s[1].start.getDate(), 15);
  assert.equal(s[7].end.getDate(), 3);
  assert.ok(s[2].start > s[1].end && s[3].start > s[2].end && s[5].start > s[3].end && s[7].start > s[6].end);
  assert.equal(+s[4].start, +s[3].start); assert.equal(+s[4].end, +s[5].end);
  assert.equal(L.currentPhase(s, new Date(2027, 0, 15)), 1);
  assert.equal(L.currentPhase(s, new Date(2027, 2, 1)), null);
});
test('migrate keeps data and fills gaps; garbage gives defaults', () => {
  const m = L.migrate({ v: 1, reqs: [{ id: 'a', text: 'x' }], nums: [{ id: 'n' }], team: [1] });
  assert.equal(m.reqs.length, 1); assert.deepEqual(m.nums[0].uses, []); assert.equal(m.team.length, 5);
  assert.equal(L.migrate(null).name, 'CMCC 2027');
  assert.equal(L.migrate('x').dates.release, '2027-01-15');
});
test('validateImport accepts own export, rejects others', () => {
  const s = L.defaultState(); s.reqs.push({ id: 'a', text: 't', slides: '', status: 'draft', type: 'q' });
  const ok = L.validateImport(JSON.parse(JSON.stringify({ app: 'case-os', data: s })));
  assert.equal(ok.ok, true); assert.equal(ok.counts.reqs, 1);
  assert.equal(L.validateImport({ foo: 1 }).ok, false);
  assert.equal(L.validateImport([]).ok, false);
  assert.equal(L.validateImport({ app: 'case-os', data: { v: 2 } }).ok, false);
  assert.equal(L.validateImport({ app: 'case-os', data: { v: 1, reqs: 'no' } }).ok, false);
});
test('backupDue only when there is data and it is stale', () => {
  const s = L.defaultState(); assert.equal(L.backupDue(s), false);
  s.reqs.push({}); assert.equal(L.backupDue(s), true);
  s.meta.lastExport = Date.now(); s.meta.updated = Date.now(); assert.equal(L.backupDue(s), false);
  s.meta.lastExport = Date.now() - 5 * 86400000; s.meta.updated = Date.now(); assert.equal(L.backupDue(s), true);
  s.meta.updated = s.meta.lastExport - 1; assert.equal(L.backupDue(s), false);
});
