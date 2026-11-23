const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

(async () => {
  const browser = await chromium.launch({args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},timezoneId:'Asia/Seoul'});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(7000);
    await page.clock.install({time:new Date('2026-11-23T23:50:00+09:00')});
    await page.goto(process.env.SLEEP_TEST_URL || 'http://localhost:5173');
    const button = name => page.getByRole('button',{name,exact:true});
    await button('처음 설정하기').click();
    await page.getByLabel('연령대',{exact:true}).selectOption('30대');
    await button('불규칙적').click();
    await page.getByRole('checkbox',{name:'수면 전',exact:true}).check();
    await button('설정 저장').click();
    await page.getByLabel('예정 취침 시각',{exact:true}).fill('23:50');
    await button('일정 저장').click();
    await button('체크리스트 시작하기').first().click();
    await button('② 1잔').click();
    await button('카페인 줄임').click();
    await button('복용함').click();
    await button('임시 저장하고 닫기').click();
    await page.reload();
    await button('체크리스트 이어쓰기').click();
    assert.equal(await button('② 1잔').getAttribute('aria-pressed'),'true');
    assert.equal(await button('복용함').getAttribute('aria-pressed'),'true');
    await button('체크리스트 완료').click();
    await button('이제 잠을 청할게요').click();
    await page.clock.setSystemTime(new Date('2026-11-24T07:40:00+09:00'));
    await page.reload();
    assert.equal(await page.getByText('미기록',{exact:true}).count(),1);
    await button('일어났어요').click();
    await button('20분').click();
    await button('① 0회').click();
    await page.getByText('각성이 0회여서 (재입면 어려움)은 건너뛰었어요.',{exact:true}).waitFor();
    assert.equal(await page.getByText(/지난밤 중간에 깬 뒤 다시 잠들기 어려웠다/).count(),0);
    await page.locator('section').filter({has:page.getByRole('heading',{name:/전반적으로/})}).getByRole('button',{name:'④ 매우 그렇다'}).click();
    await page.reload();
    assert.equal(await button('20분').getAttribute('aria-pressed'),'true');
    await button('체크리스트 완료').click();
    await button('시각 입력·수정').click();
    await page.getByLabel('일어난 날짜와 시각').fill('2026-11-24T07:00');
    await button('기록 시각 저장').click();
    await button('대시보드').click();
    await page.getByText('00:10',{exact:true}).waitFor();
    await page.getByText('6시간 50분',{exact:true}).first().waitFor();
    await page.getByText('4점',{exact:true}).waitFor();
    assert.equal(await page.getByText('기록 없음',{exact:true}).count(),6);
    await button('최근 30일').click();
    assert.equal(await page.getByText('기록 없음',{exact:true}).count(),29);
    await button('직접 선택').click();
    await page.getByLabel('시작 날짜').fill('2026-11-23');
    await page.getByLabel('종료 날짜').fill('2026-11-23');
    assert.equal(await page.getByText('기록 없음',{exact:true}).count(),0);
    await button('설정').click();
    await page.getByLabel('목표 취침 시각',{exact:true}).fill('22:00');
    await button('설정 저장').click();
    const data = await page.evaluate(() => JSON.parse(localStorage.getItem('night-and-morning.v1')));
    assert.deepEqual(Object.keys(data.nights),['2026-11-23']);
    assert.equal(data.nights['2026-11-23'].goals.bed,'23:30');
    assert.equal(data.nights['2026-11-23'].usage,'missing');
    assert.deepEqual(errors,[]);
    if (!process.env.SLEEP_TEST_URL) {
      const checks = await page.evaluate(async () => {
        const { slots } = await import('/src/sleep/native.ts');
        const { defaults, newNight } = await import('/src/sleep/model.ts');
        const day = '2026-11-24';
        const now = Date.parse(`${day}T14:00+09:00`);
        const profile = {...defaults, schedule:'irregular', reminders:true, alarm:true};
        const night = newNight(day,profile);
        const inspect = r => slots({profile,nights:{[day]:r}},now).filter(s => s.day===day);
        const planned = {...night,plan:'23:00',planAt:now};
        return {
          unanswered: inspect(night).map(s=>s.kind),
          planned: inspect(planned).filter(s=>s.kind.startsWith('before')).map(s=>[s.kind,s.local]),
          changed: inspect({...planned,plan:'00:40'}).find(s=>s.kind==='before').local,
          stopped: [
            {...planned,bed:now}, {...planned,before:{answers:{},skipped:now}}, {...planned,before:{answers:{},completed:now}},
          ].map(r=>inspect(r).some(s=>s.kind.startsWith('before'))),
        };
      });
      assert.deepEqual(checks.unanswered,['prompt','alarm','after','afterRetry']);
      assert.deepEqual(checks.planned,[['before','2026-11-24T22:45'],['beforeRetry','2026-11-24T23:15']]);
      assert.equal(checks.changed,'2026-11-25T00:25');
      assert.deepEqual(checks.stopped,[false,false,false]);
    }
    console.log('통과: 자정 연결, 기상 누락·수정, 설문과 약 복용 이어쓰기, 각성 0회, 조회 범위와 누락값, 목표 변경 시 기존 기록 유지');
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
