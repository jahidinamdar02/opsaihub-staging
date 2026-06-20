'use strict';
const { chromium } = require('playwright');
const BASE = 'http://localhost:3005';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  await ctx.addInitScript(() => {
    localStorage.setItem('th_pin_ok', '1');
    localStorage.setItem('th_am_name', 'Raman');
    localStorage.setItem('th_is_hod', '0');
  });

  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  const storeResponses = [];
  page.on('response', async r => {
    if (r.url().includes('/api/stores/am/')) {
      try {
        const json = await r.json();
        storeResponses.push({ url: r.url(), data: json });
      } catch(e) {
        storeResponses.push({ url: r.url(), error: e.message });
      }
    }
  });

  console.log('\n── Loading tasks.html on port 3005 ──');
  await page.goto(BASE + '/tasks.html', { waitUntil: 'networkidle' });

  // Click MON pill via JS to bypass nav overlay
  const clicked = await page.evaluate(() => {
    const pill = document.querySelector('[data-day="1"]');
    if (!pill) return false;
    pill.click();
    return true;
  });
  console.log(clicked ? '✅ Clicked MON pill' : '❌ MON pill not found');
  await page.waitForTimeout(300);

  const amPickerVis = await page.evaluate(() => {
    const el = document.getElementById('monAMPicker');
    return el ? !el.classList.contains('hidden') : false;
  });
  console.log('AM picker visible:', amPickerVis);

  const ramClicked = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#monAMCards div'));
    const raman = cards.find(d => d.textContent.trim().startsWith('Raman'));
    if (!raman) return false;
    raman.click();
    return true;
  });
  console.log(ramClicked ? '✅ Clicked Raman card' : '❌ Raman card not found');

  // Wait for fetch + render
  await page.waitForTimeout(1500);

  // Read store list
  const storeData = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('#monStoreList .store-item'));
    return items.map(el => ({
      name: (el.querySelector('.store-item-name') || {}).textContent || '?',
      region: (el.querySelector('.store-item-region') || {}).textContent || '?'
    }));
  });

  const progress = await page.evaluate(() => ({
    total: (document.getElementById('monTotal') || {}).textContent || '?',
    done:  (document.getElementById('monDone')  || {}).textContent || '?',
    amBar: (document.getElementById('monAMName') || {}).textContent || '?',
    wrapVisible: (() => {
      const w = document.getElementById('monStoreListWrap');
      return w ? !w.classList.contains('hidden') : false;
    })()
  }));

  console.log('\n── Rendered store list ──');
  console.log('Count:', storeData.length);
  storeData.forEach(s => console.log(' •', s.name, '|', s.region));
  console.log('\n── Progress bar ──');
  console.log('AM:', progress.amBar, '| Done:', progress.done, '/ Total:', progress.total);
  console.log('Store list wrap visible:', progress.wrapVisible);

  if (storeData.length === 0) {
    // Deep debug — what did the fetch actually return?
    const debug = await page.evaluate(() => {
      return {
        monState_stores: typeof monState !== 'undefined' ? JSON.stringify(monState.stores) : 'monState undefined',
        monState_am: typeof monState !== 'undefined' ? monState.am : '?'
      };
    });
    console.log('\n── Debug (stores not rendered) ──');
    console.log('monState.am:', debug.monState_am);
    console.log('monState.stores:', debug.monState_stores);
  }

  // Open T3DD form if stores loaded
  if (storeData.length > 0) {
    const storeClicked = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll('#monStoreList .store-item'));
      const t3dd = items.find(el => el.textContent.includes('T3DD'));
      if (!t3dd) return false;
      t3dd.click();
      return true;
    });
    console.log(storeClicked ? '\n✅ Clicked T3DD store' : '\n❌ T3DD store not found');
    await page.waitForTimeout(400);

    const formData = await page.evaluate(() => {
      const form = document.getElementById('monFormWrap');
      if (!form || form.classList.contains('hidden')) return { visible: false };
      const hdr = form.querySelector('.form-store-name');
      const btnCount = form.querySelectorAll('button').length;
      const submitBtn = document.getElementById('monSubmitBtn');
      return {
        visible: true,
        storeName: hdr ? hdr.textContent : '?',
        buttonCount: btnCount,
        submitEnabled: submitBtn ? !submitBtn.disabled : false
      };
    });

    console.log('\n── Monday form for T3DD ──');
    console.log('Form visible:', formData.visible);
    console.log('Store header:', formData.storeName);
    console.log('Button count:', formData.buttonCount, '(expect 43 = 14×3 + 1 submit)');
  }

  console.log('\n── API network log ──');
  if (storeResponses.length === 0) {
    console.log('⚠️  No /api/stores/am/ calls captured');
  }
  storeResponses.forEach(r => {
    if (r.error) {
      console.log('❌', r.url, '—', r.error);
    } else {
      const stores = (r.data.data || []).map(s => s.name);
      console.log('✅', r.url, '→', stores.length, 'stores:', stores.join(', '));
    }
  });

  if (errors.length) {
    console.log('\n── Console errors ──');
    errors.forEach(e => console.log('⚠️ ', e));
  } else {
    console.log('\n✅ No console errors');
  }

  await browser.close();
})();
