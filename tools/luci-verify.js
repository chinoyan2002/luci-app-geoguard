// LuCI 真機驗證：headless Chrome 登入 → Country Allow 頁截圖＋結構斷言
// 用法：node luci-verify.js <password> [shot.png]
const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const [,, password, shot = 'ca-shot.png'] = process.argv;
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1600,1400'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1600, height: 1200 });
    await page.goto('http://192.168.1.1/cgi-bin/luci/', { waitUntil: 'networkidle2', timeout: 30000 });
    // 登入（若已在登入頁）
    const userSel = 'input[name="luci_username"], #luci_username, input[type="text"]';
    if (await page.$(userSel)) {
      await page.evaluate(() => {
        document.querySelector('#luci_username').value = '';
        document.querySelector('#luci_password').value = '';
      });
      await page.type('#luci_username', 'root', { delay: 60 });
      await page.type('input[name="luci_password"], #luci_password, input[type="password"]', password, { delay: 60 });
      await Promise.all([
        page.keyboard.press('Enter'),
        page.waitForFunction(() => document.title.indexOf('概覽') >= 0, { timeout: 20000 }),
      ]);
    }
    await page.goto('http://192.168.1.1/cgi-bin/luci/admin/network/geoguard',
      { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
    // 直接拼 URL 會掉 session（stok 機制），改走選單點擊
    let hasView = await page.$('#cbi-geoguard');
    if (!hasView) {
      await page.goto('http://192.168.1.1/cgi-bin/luci/', { waitUntil: 'networkidle2', timeout: 30000 });
      await page.waitForSelector('#topmenu', { timeout: 15000 });
      await page.evaluate(() => {
        const net = [...document.querySelectorAll('#topmenu a.menu')].find((a) => a.textContent.trim() === '網路');
        if (net) net.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      });
      await new Promise((r) => setTimeout(r, 1000));
      await page.evaluate(() => {
        const a = [...document.querySelectorAll('#topmenu a')].find((x) => x.textContent.trim() === '國門守衛 GeoGuard' || x.textContent.trim() === 'GeoGuard');
        if (a) a.click();
      });
      await page.waitForSelector('#cbi-geoguard', { timeout: 25000 });
    }
    await page.waitForSelector('#cbi-geoguard', { timeout: 20000 });
    await new Promise((r) => setTimeout(r, 4000)); // 等 view 非同步 render
    const checks = await page.evaluate(() => {
      const out = {};
      const view = document.querySelector('#cbi-geoguard');
      out.hasView = !!view;
      const tabs = [...document.querySelectorAll('.cbi-tab, .cbi-tab-disabled')].map((t) => t.textContent.trim());
      out.tabs = tabs;
      const btns = [...document.querySelectorAll('#cbi-geoguard button')].map((b) => b.textContent.trim()).filter(Boolean);
      out.buttons = btns;
      const rows = document.querySelectorAll('#cbi-geoguard table tbody tr');
      out.countryRows = rows.length;
      const thead = document.querySelector('#cbi-geoguard thead');
      out.theadSticky = thead ? getComputedStyle(thead).position : 'none';
      const search = document.querySelector('#cbi-geoguard input[placeholder*="搜尋"]');
      out.hasSearch = !!search;
      const sel = document.querySelectorAll('#cbi-geoguard table tbody tr td:first-child input[type="checkbox"]');
      out.rowChecks = sel.length;
      const pre = document.querySelector('#cbi-geoguard pre');
      out.hasPre = !!pre;
      return out;
    });
    console.log('CHECKS=' + JSON.stringify(checks));
    await page.screenshot({ path: shot, fullPage: true });
    console.log('SHOT-OK ' + shot);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error('VERIFY-FAIL: ' + e.message); process.exit(1); });
