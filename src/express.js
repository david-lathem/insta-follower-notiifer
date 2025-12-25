const { TwitterApi } = require("twitter-api-v2");
const express = require("express");

const client = new TwitterApi({
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
});

const app = express();

const PORT = 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

const startExpressServer = async () => {
  const redirectUri = `http://${process.env.SERVER_IP}:${PORT}/callback`;
  const {
    url,
    codeVerifier,
    state: sessionState,
  } = client.generateOAuth2AuthLink(redirectUri, {
    scope: [
      "tweet.read",
      "tweet.write",
      "media.write",
      "users.read",
      "users.email",
      "offline.access",
    ],
  });

  console.log(url);
  console.log(sessionState);
  console.log(codeVerifier);

  app.get("/callback", (req, res) => {
    console.log(req.query);

    const { state, code } = req.query;

    if (!codeVerifier || !state || !sessionState || !code) {
      return res
        .status(400)
        .send("You denied the app or your session expired!");
    }

    if (state !== sessionState) {
      return res.status(400).send("Stored tokens didnt match!");
    }

    client
      .loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri,
      })
      .then(
        async ({
          client: loggedClient,
          accessToken,
          refreshToken,
          expiresIn,
        }) => {
          // {loggedClient} is an authenticated client in behalf of some user
          // Store {accessToken} somewhere, it will be valid until {expiresIn} is hit.
          // If you want to refresh your token later, store {refreshToken} (it is present if 'offline.access' has been given as scope)

          console.log({ accessToken, refreshToken, expiresIn });
        }
      )
      .catch(() => res.status(403).send("Invalid verifier or access tokens!"));
  });
};

startExpressServer();
