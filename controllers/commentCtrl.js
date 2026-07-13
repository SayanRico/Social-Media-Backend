const Comments = require("../models/commentModel");
const Posts = require("../models/postModel");
const { dispatchSocialEvent, removeSocialNotification } = require("../services/notificationEngineService");

const commentCtrl = {
  createComment: async (req, res, next) => {
    try {
      const { postId, content, tag, reply, postUserId } = req.body;

      const post = await Posts.findById(postId).populate("user", "_id");
      if (!post) {
        return res.status(400).json({ msg: "Post does not exist." });
      }

      if (reply) {
        const cm = await Comments.findById(reply);
        if (!cm) {
          return res.status(400).json({ msg: "Comment does not exist." });
        }
      }

      const newComment = new Comments({
        user: req.user._id,
        content,
        tag,
        reply,
        postUserId,
        postId,
      });

      await Posts.findOneAndUpdate(
        { _id: postId },
        {
          $push: { comments: newComment._id },
        },
        { new: true }
      );

      await newComment.save();

      const recipients = reply && tag ? [tag] : [post.user?._id || postUserId];
      const eventKey = reply && tag ? "mention" : "comment";

      await dispatchSocialEvent({
        eventKey,
        actorUser: req.user,
        recipientIds: recipients,
        entityType: "post",
        entityId: postId,
        context: {
          commentId: newComment._id,
          content: reply ? content?.slice(0, 120) : post.content?.slice(0, 120) || "",
          image: post.images?.[0] || "",
        },
      });

      res.json({ newComment });
    } catch (err) {
      return next(err);
    }
  },

  updateComment: async (req, res, next) => {
    try {
      const { content } = req.body;

      const comment = await Comments.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id },
        { content }
      );

      if (!comment) {
        return res
          .status(400)
          .json({ msg: "Comment does not exist or you are not authorized." });
      }

      res.json({ msg: "updated successfully." });
    } catch (err) {
      return next(err);
    }
  },

  likeComment: async (req, res, next) => {
    try {
      const comment = await Comments.find({
        _id: req.params.id,
        likes: req.user._id,
      });
      if (comment.length > 0) {
        return res
          .status(400)
          .json({ msg: "You have already liked this post" });
      }

      await Comments.findOneAndUpdate(
        { _id: req.params.id },
        {
          $push: { likes: req.user._id },
        },
        {
          new: true,
        }
      );

      res.json({ msg: "Comment liked successfully." });
    } catch (err) {
      return next(err);
    }
  },

  unLikeComment: async (req, res, next) => {
    try {
      await Comments.findOneAndUpdate(
        { _id: req.params.id },
        {
          $pull: { likes: req.user._id },
        },
        {
          new: true,
        }
      );

      res.json({ msg: "Comment unliked successfully." });
    } catch (err) {
      return next(err);
    }
  },

  deleteComment: async (req, res, next) => {
    try {
      const comment = await Comments.findOneAndDelete({
        _id: req.params.id,
        $or: [{ user: req.user._id }, { postUserId: req.user._id }],
      });

      if (!comment) {
        return res
          .status(400)
          .json({ msg: "Comment does not exist or you are not authorized." });
      }

      await Posts.findOneAndUpdate(
        { _id: comment.postId },
        {
          $pull: { comments: req.params.id },
        }
      );

      await removeSocialNotification({
        notifyId: comment._id,
        url: `/post/${comment.postId}`,
      });

      res.json({ msg: "Comment deleted successfully." });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = commentCtrl;
