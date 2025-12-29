const { installMouseHelper, createCursor } = require("ghost-cursor");
const { setTimeout } = require("node:timers/promises");
const fs = require("fs");

exports.createPageWithGhostCursor = async (browser, url) => {
  const page = await browser.newPage();

  await page.setViewport({
    width: 1366,
    height: 768,
  });

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36"
  );
  await page.authenticate({
    username: process.env.PROXY_USERNAME,
    password: process.env.PROXY_PASSWORD,
  });

  //   await installMouseHelper(page);

  // second options vector, third perform random moves
  const ghostCursor = new createCursor(page, undefined, true, {
    click: { hesitate: 1000 * 1 },
  });

  await page.goto(url, {
    waitUntil: "networkidle0",
  });

  await this.performRandomMovesAndScroll(page, ghostCursor);

  return { page, ghostCursor };
};

exports.performRandomMovesAndScroll = async (page, ghostCursor) => {
  await setTimeout(1000 * 2);

  ghostCursor.toggleRandomMove(false);

  const { x, y, height } = await page.evaluate(() => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    height: window.innerHeight,
  }));

  // Move cursor to approximate center with small random offset
  await ghostCursor.moveTo({ x: x + randomOffset(), y: y + randomOffset() });

  // First scroll: full height + random offsets
  await ghostCursor.scroll(
    { y: height + randomOffset(20) },
    { scrollSpeed: 20 }
  );

  await setTimeout(1000 * 1);

  // // Second scroll: slightly less (e.g., 70–80% of height) + random offsets
  await ghostCursor.scroll(
    {
      y: height * 0.75 + randomOffset(20),
    },
    { scrollSpeed: 17 }
  );

  await setTimeout(1000 * 1);

  await ghostCursor.scrollTo("top", { scrollSpeed: 19 });
};

exports.takeProfileSs = async (page) => {
  try {
    const profile = await page.$("header");

    const box = await profile.boundingBox();

    const buffer = await page.screenshot({
      clip: {
        x: Math.floor(box.x),
        y: Math.floor(box.y),
        width: Math.floor(box.width),
        height: Math.floor(box.height),
      },
    });
    fs.writeFileSync("./a.png", buffer);
    return b;
  } catch (error) {
    console.error(error);
  }
};

function randomOffset(range = 30) {
  return Math.floor(Math.random() * (range * 2 + 1)) - range;
}
