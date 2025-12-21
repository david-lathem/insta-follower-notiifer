const puppeteer = require("puppeteer");

async function login() {
  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: "./data",
    executablePath: "/usr/bin/chromium-browser",
    args: [
      "--no-sandbox",
      `--proxy-server=https://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
    ],
  });

  const page = await browser.newPage();

  await page.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  });

  await page.goto("https://instagram.com/");

  await page.setViewport({ width: 1526, height: 698 });
}

login();
