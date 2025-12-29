const { TwitterApi } = require("twitter-api-v2");
const {
  TwitterApiAutoTokenRefresher,
} = require("@twitter-api-v2/plugin-token-refresher");
const fs = require("fs");

const access = require("./../../access.json");

const credentials = {
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
};

const tokenStore = {
  accessToken: access.accessToken,
  refreshToken: access.refreshToken,
};

const autoRefresherPlugin = new TwitterApiAutoTokenRefresher({
  refreshToken: tokenStore.refreshToken,
  refreshCredentials: credentials,
  onTokenUpdate(token) {
    console.log(token);

    tokenStore.accessToken = token.accessToken;
    tokenStore.refreshToken = token.refreshToken;

    fs.writeFileSync("./access.json", JSON.stringify({ ...tokenStore }));
  },
  onTokenRefreshError(error) {
    console.error("Refresh error", error);
  },
});

const twitterClient = new TwitterApi(tokenStore.accessToken, {
  plugins: [autoRefresherPlugin],
});

exports.makeTweet = async (username, newFollowing, removedFollowing, image) => {
  let content = `👉 ${username} started following ${newFollowing.length} and unfollowed ${removedFollowing.length}:\n\n`;

  if (newFollowing.length) {
    content += formatUsers(newFollowing.slice(0, 3), "✅") + `\n\n`;
  }

  if (removedFollowing.length) {
    content += formatUsers(removedFollowing.slice(0, 3), "❌");
  }

  console.log(content);

  const mediaId = await twitterClient.v2
    .uploadMedia(image, {
      media_type: "image/png",
    })
    .catch(console.error);

  console.log(`Uploaded media with id ${mediaId}`);

  await twitterClient.v2.tweet(content, {
    ...(mediaId && { media: { media_ids: [mediaId] } }),
  });

  console.log("Made tweet");

  return true;
};

function formatUsers(users, symbol) {
  return users
    .map(
      (u) =>
        `${symbol} ${u.username} (${u.full_name || ""})\n` +
        `📎 https://instagram.com/${u.username}`
    )
    .join("\n\n");
}
