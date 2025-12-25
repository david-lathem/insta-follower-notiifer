const r = require("./map-2.json");

function findDuplicates(data) {
  const result = {};

  for (const [key, users] of Object.entries(data)) {
    const seenUsernames = new Set();
    const seenPks = new Set();

    const duplicateUsernames = [];
    const duplicatePks = [];

    for (const user of users) {
      // Check username
      if (seenUsernames.has(user.username)) {
        duplicateUsernames.push(user.username);
      } else {
        seenUsernames.add(user.username);
      }

      // Check pk
      if (seenPks.has(user.pk)) {
        duplicatePks.push(user.pk);
      } else {
        seenPks.add(user.pk);
      }
    }

    if (duplicateUsernames.length || duplicatePks.length) {
      result[key] = {
        duplicateUsernames: [...duplicateUsernames],
        duplicatePks: [...duplicatePks],
      };
    }
  }

  console.log(result);

  return result;
}

findDuplicates(r);
