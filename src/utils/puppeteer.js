const { default: puppeteer } = require("puppeteer");
const { setTimeout } = require("node:timers/promises");
const fs = require("node:fs");
const config = require("./../../config.json");
const {
  createPageWithGhostCursor,
  performRandomMovesAndScroll,
} = require("./movements");
const { makeTweet } = require("./twitter");

const INSTA_BASE_URL = "https://www.instagram.com";

const followingMap = {};

let i = 0;
exports.startBrowserAndWatch = async () => {
  const browser = await puppeteer.launch({
    headless: false,
    devtools: true,
    userDataDir: "./data",
    ...(process.platform === "linux" && {
      executablePath: "/usr/bin/chromium-browser",
    }),
    // args: [
    //   "--no-sandbox",
    //   `--proxy-server=http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
    // ],
  });

  const { page, ghostCursor } = await createPageWithGhostCursor(
    browser,
    INSTA_BASE_URL
  );

  await page.setRequestInterception(true);

  page.on("request", (request) => {
    const url = request.url();

    if (request.isInterceptResolutionHandled()) return;

    const isFollowingApi = /api\/v1\/friendships\/\d+\/following\/\?/.test(url);

    if (!isFollowingApi) return request.continue();

    const newUrl = url.replace("count=12", "count=200");

    request.continue({ url: newUrl });
  });

  while (true) {
    i++;
    try {
      for (const username of config.usernames) {
        const start = Date.now();

        const wasTweetMade = await checkFollowingAndNotify(
          page,
          ghostCursor,
          username
        );
        const durationMs = Date.now() - start;

        console.log(`${username} took ${durationMs} ms`);

        if (wasTweetMade) await setTimeout(1000 * 60 * 2);
        if (!wasTweetMade) await setTimeout(1000 * 60 * 2);
      }
    } catch (error) {
      console.error(error);
      await setTimeout(1000 * 30);
    }
  }
};

async function checkFollowingAndNotify(page, ghostCursor, username) {
  if (!followingMap[username]) followingMap[username] = [];

  await page.goto(`${INSTA_BASE_URL}/${username}`, {
    waitUntil: "domcontentloaded",
  });

  await performRandomMovesAndScroll(page, ghostCursor);

  // didnt await so when waitForResponse doesnt miss api res
  ghostCursor.click(`a[href="/${username}/following/"]`).catch(console.error);

  const firstResponse = await page.waitForResponse(async (response) => {
    return response.url().endsWith("/following/?count=12");
  });

  const headers = firstResponse.request().headers();

  const userId = firstResponse.url().split("/friendships/")[1].split("/")[0];

  delete headers["cookie"];
  delete headers[":authority"];
  delete headers[":scheme"];
  delete headers[":method"];
  delete headers[":path"];
  delete headers["priority"];

  console.log(headers);

  const parsedRes = await firstResponse.json();

  const { next_max_id, users, has_more } = parsedRes;

  const fetchedUsers = [
    ...users.map((u) => ({
      username: u.username,
      pk: u.pk,
      full_name: u.full_name,
    })),
  ];

  if (has_more) {
    await setTimeout(1000 * 3);

    const result = await page.evaluate(
      async ({ headers, userId, startMaxId, INSTA_BASE_URL }) => {
        let hasMore = true;
        let nextMaxId = startMaxId;
        const allUsers = [];

        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

        while (hasMore) {
          const url = `${INSTA_BASE_URL}/api/v1/friendships/${userId}/following/?count=200&max_id=${nextMaxId}`;

          const res = await fetch(url, {
            method: "GET",
            headers,
            credentials: "include",
          });

          const data = await res.json();

          allUsers.push(...data.users);

          hasMore = data.has_more;
          nextMaxId = data.next_max_id;

          await sleep(3000 + Math.random() * 300);
        }

        return allUsers;
      },
      {
        headers,
        userId,
        startMaxId: next_max_id,
        INSTA_BASE_URL,
      }
    );
    fetchedUsers.push(
      ...result.map((u) => ({
        username: u.username,
        pk: u.pk,
        full_name: u.full_name,
      }))
    );
  }

  console.log(`Fetched ${fetchedUsers.length} users for ${username}`);

  if (!followingMap[username].length) {
    console.log(`First time adding in cache for ${username}`);

    followingMap[username] = fetchedUsers;
    fs.writeFileSync(`map-${i}.json`, JSON.stringify(followingMap));

    return;
  }

  // Newly followed (in fetchedUsers but NOT in cache)
  const newFollowing = fetchedUsers.filter(
    (user) =>
      !followingMap[username].some((cachedUser) => cachedUser.pk === user.pk)
  );

  // Unfollowed (in cache but NOT in fetchedUsers)
  const removedFollowing = followingMap[username].filter(
    (cachedUser) => !fetchedUsers.some((user) => user.pk === cachedUser.pk)
  );

  followingMap[username] = fetchedUsers;

  fs.writeFileSync(`map-${i}.json`, JSON.stringify(followingMap));

  if (!newFollowing.length && !removedFollowing.length)
    return console.log(`No change in followers for ${username}`);

  console.log(newFollowing);
  console.log(removedFollowing);

  return await makeTweet(username, newFollowing, removedFollowing);
}
