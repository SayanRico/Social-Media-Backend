const Users = require("../models/userModel");
const escapeRegex = require("../utils/escapeRegex");
const {
  dispatchSocialEvent,
  removeSocialNotification,
} = require("../services/notificationEngineService");
const userCtrl = {
  searchUser: async (req, res, next) => {
    try {
      const username = escapeRegex(req.query.username || "");
      const users = await Users.find({
        username: { $regex: username },
      })
        .limit(10)
        .select("fullname username avatar status");

      res.json({ users });
    } catch (err) {
      return next(err);
    }
  },

  getUser: async (req, res, next) => {
    try {
      const user = await Users.findById(req.params.id)
        .select("-password")
        .populate("followers following", "-password");

      if (!user) {
        return res.status(400).json({ msg: "requested user does not exist." });
      }

      res.json({ user });
    } catch (err) {
      return next(err);
    }
  },

  updateUser: async (req, res, next) => {
    try {
      const { avatar, fullname, mobile, address, story, website, gender } =
        req.body;
      if (!fullname) {
        return res.status(400).json({ msg: "Please add your full name." });
      }

      await Users.findOneAndUpdate(
        { _id: req.user._id },
        { avatar, fullname, mobile, address, story, website, gender }
      );

      res.json({ msg: "Profile updated successfully." });
    } catch (err) {
      return next(err);
    }
  },

  follow: async (req, res, next) => {
    try {
      const user = await Users.find({
        _id: req.params.id,
        followers: req.user._id,
      });
      if (user.length > 0)
        return res
          .status(400)
          .json({ msg: "You are already following this user." });

      const newUser = await Users.findOneAndUpdate(
        { _id: req.params.id },
        {
          $push: {
            followers: req.user._id,
          },
        },
        { new: true }
      ).populate("followers following", "-password");

      await Users.findOneAndUpdate(
        { _id: req.user._id },
        { $push: { following: req.params.id } },
        { new: true }
      );

      await dispatchSocialEvent({
        eventKey: "follow",
        actorUser: req.user,
        recipientIds: [req.params.id],
        entityType: "user",
        entityId: req.user._id,
      });

      res.json({ newUser });
    } catch (err) {
      return next(err);
    }
  },

  unfollow: async (req, res, next) => {
    try {
      const newUser = await Users.findOneAndUpdate(
        { _id: req.params.id },
        {
          $pull: { followers: req.user._id },
        },
        { new: true }
      ).populate("followers following", "-password");

      await Users.findOneAndUpdate(
        { _id: req.user._id },
        { $pull: { following: req.params.id } },
        { new: true }
      );

      await removeSocialNotification({
        notifyId: req.user._id,
        url: `/profile/${req.user._id}`,
        recipientIds: [req.params.id],
      });

      res.json({ newUser });
    } catch (err) {
      return next(err);
    }
  },

  suggestionsUser: async (req, res, next) => {
    try {
      const newArr = [...req.user.following, req.user._id];

      const num = req.query.num || 10;
      const users = await Users.aggregate([
        { $match: { _id: { $nin: newArr } } },
        { $sample: { size: Number(num) } },
        {
          $lookup: {
            from: "users",
            localField: "followers",
            foreignField: "_id",
            as: "followers",
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "following",
            foreignField: "_id",
            as: "following",
          },
        },
      ]).project("-password");

      return res.json({
        users,
        result: users.length,
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = userCtrl;
