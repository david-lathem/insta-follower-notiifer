const puppeteer = require("puppeteer");
const { setTimeout } = require("node:timers/promises");
const fs = require("node:fs");
const config = require("./../../config.json");
const {
  createPageWithGhostCursor,
  performRandomMovesAndScroll,
  takeProfileSs,
} = require("./movements");
const { makeTweet } = require("./twitter");

const INSTA_BASE_URL = "https://www.instagram.com";

const followingMap = {};
let indexMap = {};

exports.startBrowserAndWatch = async () => {
  const browser = await puppeteer.launch({
    // headless: false,
    userDataDir: "./data",
    ...(process.platform === "linux" && {
      executablePath: "/usr/bin/chromium-browser",
    }),
    args: [
      "--no-sandbox",
      `--proxy-server=http://${process.env.PROXY_HOST}:${process.env.PROXY_PORT}`,
    ],
  });

  const { page, ghostCursor } = await createPageWithGhostCursor(
    browser,
    INSTA_BASE_URL
  );

  //   await page.setRequestInterception(true);

  //   page.on("request", (request) => {
  //     const url = request.url();

  //     if (request.isInterceptResolutionHandled()) return;

  //     const isFollowingApi = /api\/v1\/friendships\/\d+\/following\/\?/.test(url);

  //     if (!isFollowingApi) return request.continue();

  //     const newUrl = url.replace("count=12", "count=200");

  //     request.continue({ url: newUrl });
  //   });

  while (true) {
    try {
      for (const username of config.usernames) {
        console.log(`Scraping ${username} now!
          
          `);

        const start = Date.now();

        const wasTweetMade = await checkFollowingAndNotify(
          page,
          ghostCursor,
          username
        );
        const durationMs = Date.now() - start;

        console.log(`${username} took ${durationMs} ms`);

        await setTimeout(1000 * 10);
      }
    } catch (error) {
      console.error(error);
      await setTimeout(1000 * 30);
    }
  }
};

async function checkFollowingAndNotify(page, ghostCursor, username) {
  if (!followingMap[username]) followingMap[username] = [];
  if (!indexMap[username]) indexMap = 1;

  await page.goto(`${INSTA_BASE_URL}/${username}`, {
    waitUntil: "domcontentloaded",
  });

  await performRandomMovesAndScroll(page, ghostCursor);

  const image = await takeProfileSs(page);

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
  delete headers["x-web-session-id"];
  delete headers["x-web-session-id"];
  delete headers["x-ig-www-claim"];

  console.log(headers);

  const fetchedUsers = await page.evaluate(
    async ({ headers, userId, INSTA_BASE_URL }) => {
      let after = null;
      let hasNext = true;
      const followings = [];

      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

      while (hasNext) {
        const variables = {
          id: userId,
          include_reel: true,
          fetch_mutual: true,
          first: 50,
          after,
        };

        const url =
          `${INSTA_BASE_URL}/graphql/query/?` +
          "query_hash=d04b0a864b4b54837c0d870b0e77e076&variables=" +
          encodeURIComponent(JSON.stringify(variables));

        const res = await fetch(url, {
          method: "GET",
          headers,
          credentials: "include",
        });

        const json = await res.json();

        const edgeFollow = json?.data?.user?.edge_follow;
        if (!edgeFollow) break;

        hasNext = edgeFollow.page_info.has_next_page;
        after = edgeFollow.page_info.end_cursor;

        followings.push(
          ...edgeFollow.edges.map(({ node }) => ({
            username: node.username,
            full_name: node.full_name,
            pk: node.id,
          }))
        );

        // human-like delay
        await sleep(3000 + Math.random() * 300);
      }

      return followings;
    },
    {
      headers,
      userId,
      INSTA_BASE_URL,
    }
  );

  console.log(`Fetched ${fetchedUsers.length} users for ${username}`);

  fs.writeFileSync(
    `username_${username}-${indexMap[username]}.json`,
    JSON.stringify({ total: fetchedUsers.length, users: fetchedUsers })
  );

  indexMap[username]++;

  if (!followingMap[username].length) {
    console.log(`First time adding in cache for ${username}`);

    followingMap[username] = fetchedUsers;

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

  //   fs.writeFileSync(`map-${i}.json`, JSON.stringify(followingMap));

  if (!newFollowing.length && !removedFollowing.length)
    return console.log(`No change in followers for ${username}`);

  console.log(newFollowing);
  console.log(removedFollowing);

  return await makeTweet(username, newFollowing, removedFollowing, image);
}
