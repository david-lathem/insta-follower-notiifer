const puppeteer = require("puppeteer");

async function login() {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "./data",
    executablePath: "/usr/bin/chromium-browser",
  });

  const page = await browser.newPage();

  await page.goto("https://instagram.com/");

  await page.setViewport({ width: 1526, height: 698 });
}

login();
