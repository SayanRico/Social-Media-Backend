const Users = require("../models/userModel");
const Posts = require("../models/postModel");
const escapeRegex = require("../utils/escapeRegex");
const { cacheGet, cacheSet } = require("../utils/cache");

const searchCtrl = {
  /** GET /api/search/global?q= */
  globalSearch: async (req, res, next) => {
    try {
      const q = (req.query.q || "").trim();
      if (!q || q.length < 2) {
        return res.json({ users: [], posts: [], hashtags: [] });
      }

      const cacheKey = `search:${q.toLowerCase()}`;
      const cached = await cacheGet(cacheKey);
      if (cached) return res.json(cached);

      const safe = escapeRegex(q);

      const users = await Users.find({
        $or: [
          { username: { $regex: safe, $options: "i" } },
          { fullname: { $regex: safe, $options: "i" } },
        ],
        status: "active",
        shadowBanned: { $ne: true },
      })
        .select("username fullname avatar verified")
        .limit(10);

      const posts = await Posts.find({
        content: { $regex: safe, $options: "i" },
      })
        .select("content images user createdAt likes comments")
        .populate("user", "username avatar")
        .sort("-createdAt")
        .limit(15);

      const hashtagMatches = [];
      const tagRegex = /#(\w+)/g;
      posts.forEach((p) => {
        const matches = (p.content || "").match(tagRegex);
        if (matches) {
          matches.forEach((tag) => {
            if (tag.toLowerCase().includes(q.toLowerCase().replace("#", ""))) {
              hashtagMatches.push(tag);
            }
          });
        }
      });

      const hashtags = [...new Set(hashtagMatches)].slice(0, 10);

      const result = { users, posts, hashtags };
      await cacheSet(cacheKey, result, 120);
      res.json(result);
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = searchCtrl;
