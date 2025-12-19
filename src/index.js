const {
  createCursor,
  getRandomPagePoint,
  installMouseHelper,
} = require("ghost-cursor");
const puppeteer = require("puppeteer");

async function start(params) {
  const browser = await puppeteer.launch({ headless: false });

  const page = await browser.newPage();

  await installMouseHelper(page);
  const cursor = new createCursor(page, undefined, true, {});

  await page.goto("https://wakatime.com/", { waitUntil: "networkidle2" });

  await cursor.click(".col-xs-12.center-xs");
}

start();
