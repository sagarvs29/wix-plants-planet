import fs from 'fs';
import { chromium } from 'playwright';

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/https?:\\/\\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'page';
}

async function capture(url, page, dir) {
  console.log(`Navigating to ${url}`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120000 });

  // Give the page a moment to settle
  await page.waitForTimeout(2500);

  // Try to dismiss common cookie banners (best effort, safe to fail)
  try {
    const selectors = [
      'button:has-text("Accept")',
      'button:has-text("I Agree")',
      'button:has-text("Accept All")',
      '[data-testid*="accept"]',
      '[aria-label*="accept"]'
    ];
    for (const sel of selectors) {
      const el = page.locator(sel).first();
      if (await el.count()) {
        await el.click({ timeout: 1500 });
        break;
      }
    }
  } catch {}

  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const base = slugify(new URL(url).pathname || 'home') || 'home';

  const datedPath = `${dir}/${base}-${ts}.png`;
  const stablePath = `${dir}/${base}.png`;

  await page.screenshot({ path: datedPath, fullPage: true });
  await page.screenshot({ path: stablePath, fullPage: true });

  console.log(`Saved ${stablePath} and ${datedPath}`);
}

async function main() {
  const dir = 'screenshots';
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await context.newPage();

  // Accept either a JSON array of URLs in PAGES or a single TARGET_URL
  let urls = [];
  if (process.env.PAGES) {
    try {
      urls = JSON.parse(process.env.PAGES);
    } catch (e) {
      console.warn('PAGES is not valid JSON. Falling back to TARGET_URL if available.');
    }
  }
  if (!urls?.length && process.env.TARGET_URL) {
    urls = [process.env.TARGET_URL];
  }
  if (!urls?.length) {
    throw new Error('No URLs provided. Set PAGES as a JSON array or TARGET_URL as a single URL.');
  }

  for (const url of urls) {
    await capture(url, page, dir);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
