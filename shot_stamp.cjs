const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:8000/web/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(20000);
  const sello = page.getByRole('button', { name: /^Sello$/ });
  if (await sello.count()) await sello.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'stamp_only.png' });
  await browser.close();
})();
