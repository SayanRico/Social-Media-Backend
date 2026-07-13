const Posts = require("../models/postModel");
const Comments = require("../models/commentModel");
const Users = require("../models/userModel");
const APIfeatures = require("../utils/pagination");
const { validateMediaUrl } = require("../controllers/mediaCtrl");
const { trackEvent } = require("../utils/analyticsTracker");
const Reports = require("../models/reportModel");
const {
  dispatchSocialEvent,
  removeSocialNotification,
} = require("../services/notificationEngineService");

const postCtrl = {
  createPost: async (req, res, next) => {
    try {
      const { content, images } = req.body;

      if (req.user.shadowBanned) {
        return res.json({
          msg: "Post created successfully.",
          newPost: {
            content,
            images: images || [],
            user: req.user,
            _id: "shadow",
            likes: [],
            comments: [],
            createdAt: new Date(),
          },
        });
      }

      if (!images || images.length === 0) {
        return res.status(400).json({ msg: "Please add photo(s)" });
      }

      const invalid = images.filter((url) => !validateMediaUrl(url));
      if (invalid.length) {
        return res.status(400).json({ msg: "Invalid media URL(s)." });
      }

      const newPost = new Posts({
        content,
        images,
        user: req.user._id,
      });
      await newPost.save();

      await trackEvent({
        userId: req.user._id,
        event: "post_create",
        metadata: { postId: newPost._id },
        req,
      });

      const author = await Users.findById(req.user._id).select("followers username avatar");
      if (author?.followers?.length) {
        await dispatchSocialEvent({
          eventKey: "new_post",
          actorUser: req.user,
          recipientIds: author.followers,
          entityType: "post",
          entityId: newPost._id,
          context: {
            content: content?.slice(0, 120) || "",
            image: images?.[0] || "",
          },
        });
      }

      res.json({
        msg: "Post created successfully.",
        newPost: {
          ...newPost._doc,
          user: req.user,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  getPosts: async (req, res, next) => {
    try {
      const features = new APIfeatures(
        Posts.find({
          user: [...req.user.following, req.user._id],
        }),
        req.query
      ).paginating();
      const posts = await features.query
        .sort("-createdAt")
        .populate("user likes", "avatar username fullname followers")
        .populate({
          path: "comments",
          populate: {
            path: "user likes ",
            select: "-password",
          },
        });

      res.json({
        msg: "Success",
        result: posts.length,
        posts,
      });
    } catch (err) {
      return next(err);
    }
  },

  updatePost: async (req, res, next) => {
    try {
      const { content, images } = req.body;

      const post = await Posts.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        {
          content,
          images,
        }
      )
        .populate("user likes", "avatar username fullname")
        .populate({
          path: "comments",
          populate: {
            path: "user likes ",
            select: "-password",
          },
        });

      if (!post) {
        return res
          .status(400)
          .json({ msg: "Post does not exist or you are not authorized." });
      }

      res.json({
        msg: "Post updated successfully.",
        newPost: {
          ...post._doc,
          content,
          images,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  likePost: async (req, res, next) => {
    try {
      const post = await Posts.find({
        _id: req.params.id,
        likes: req.user._id,
      });
      if (post.length > 0) {
        return res
          .status(400)
          .json({ msg: "You have already liked this post" });
      }

      const like = await Posts.findOneAndUpdate(
        { _id: req.params.id },
        {
          $push: { likes: req.user._id },
        },
        {
          new: true,
        }
      ).populate("user", "_id username avatar");

      if (!like) {
        return res.status(400).json({ msg: "Post does not exist." });
      }

      if (like.user?._id) {
        await dispatchSocialEvent({
          eventKey: "like",
          actorUser: req.user,
          recipientIds: [like.user._id],
          entityType: "post",
          entityId: like._id,
          context: {
            content: like.content?.slice(0, 120) || "",
            image: like.images?.[0] || "",
          },
        });
      }

      res.json({ msg: "Post liked successfully." });
    } catch (err) {
      return next(err);
    }
  },

  unLikePost: async (req, res, next) => {
    try {
      const like = await Posts.findOneAndUpdate(
        { _id: req.params.id },
        {
          $pull: { likes: req.user._id },
        },
        {
          new: true,
        }
      );

      if (!like) {
        return res.status(400).json({ msg: "Post does not exist." });
      }

      await removeSocialNotification({
        notifyId: req.user._id,
        url: `/post/${req.params.id}`,
      });

      res.json({ msg: "Post unliked successfully." });
    } catch (err) {
      return next(err);
    }
  },

  getUserPosts: async (req, res, next) => {
    try {
      const features = new APIfeatures(
        Posts.find({ user: req.params.id }),
        req.query
      ).paginating();
      const posts = await features.query.sort("-createdAt");

      res.json({
        posts,
        result: posts.length,
      });
    } catch (err) {
      return next(err);
    }
  },

  getPost: async (req, res, next) => {
    try {
      const post = await Posts.findById(req.params.id)
        .populate("user likes", "avatar username fullname followers")
        .populate({
          path: "comments",
          populate: {
            path: "user likes ",
            select: "-password",
          },
        });

      if (!post) {
        return res.status(400).json({ msg: "Post does not exist." });
      }

      res.json({ post });
    } catch (err) {
      return next(err);
    }
  },

  getPostDiscover: async (req, res, next) => {
    try {
      const newArr = [...req.user.following, req.user._id];

      const num = req.query.num || 8;

      const posts = await Posts.aggregate([
        { $match: { user: { $nin: newArr } } },
        { $sample: { size: Number(num) } },
      ]);

      res.json({
        msg: "Success",
        result: posts.length,
        posts,
      });
    } catch (err) {
      return next(err);
    }
  },

  deletePost: async (req, res, next) => {
    try {
      const post = await Posts.findOneAndDelete({
        _id: req.params.id,
        user: req.user._id,
      });

      if (!post) {
        return res
          .status(400)
          .json({ msg: "Post does not exist or you are not authorized." });
      }

      await Comments.deleteMany({ _id: { $in: post.comments } });

      res.json({
        msg: "Post deleted successfully.",
        newPost: {
          ...post._doc,
          user: req.user,
        },
      });
    } catch (err) {
      return next(err);
    }
  },

  reportPost: async (req, res, next) => {
    try {
      const { reason = "spam", description } = req.body;
      const post = await Posts.findById(req.params.id);
      if (!post) return res.status(404).json({ msg: "Post does not exist." });

      const dup = await Reports.findOne({
        reporter: req.user._id,
        entityType: "post",
        entityId: post._id,
        status: { $nin: ["dismissed", "closed"] },
      });
      if (dup) {
        return res.status(400).json({ msg: "You have already reported this post" });
      }

      await Posts.findByIdAndUpdate(req.params.id, {
        $addToSet: { reports: req.user._id },
      });

      await Reports.create({
        entityType: "post",
        entityId: post._id,
        reason,
        description: description || "",
        reporter: req.user._id,
        targetUser: post.user,
        status: "submitted",
      });

      res.json({ msg: "Post reported successfully." });
    } catch (err) {
      return next(err);
    }
  },

  savePost: async (req, res, next) => {
    try {
      const user = await Users.find({
        _id: req.user._id,
        saved: req.params.id,
      });
      if (user.length > 0) {
        return res
          .status(400)
          .json({ msg: "You have already saved this post." });
      }

      const save = await Users.findOneAndUpdate(
        { _id: req.user._id },
        {
          $push: { saved: req.params.id },
        },
        {
          new: true,
        }
      );

      if (!save) {
        return res.status(400).json({ msg: "User does not exist." });
      }

      res.json({ msg: "Post saved successfully." });
    } catch (err) {
      return next(err);
    }
  },

  unSavePost: async (req, res, next) => {
    try {
      const save = await Users.findOneAndUpdate(
        { _id: req.user._id },
        {
          $pull: { saved: req.params.id },
        },
        {
          new: true,
        }
      );

      if (!save) {
        return res.status(400).json({ msg: "User does not exist." });
      }

      res.json({ msg: "Post removed from collection successfully." });
    } catch (err) {
      return next(err);
    }
  },

  getSavePost: async (req, res, next) => {
    try {
      const features = new APIfeatures(
        Posts.find({ _id: { $in: req.user.saved } }),
        req.query
      ).paginating();

      const savePosts = await features.query.sort("-createdAt");

      res.json({
        savePosts,
        result: savePosts.length,
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = postCtrl;
