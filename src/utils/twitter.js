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
    content += formatUsers(newFollowing, "✅") + `\n\n`;
  }

  if (removedFollowing.length) {
    content += formatUsers(removedFollowing, "❌");
  }

  console.log(content);

  return true;

  //   const r = await twitterClient.v2.me();
};

function formatUsers(users, symbol) {
  return users
    .map(
      (u) =>
        `${symbol} ${u.username} (${u.full_name})\n` +
        `📎 https://instagram.com/${u.username}`
    )
    .join("\n\n");
}
