const Conversations = require("../models/conversationModel");
const Messages = require("../models/messageModel");
const APIfeatures = require("../utils/pagination");

const messageCtrl = {
  createMessage: async (req, res, next) => {
    try {
      const { recipient, text, media } = req.body;
      if (!recipient || (!(text && text.trim()) && (!media || media.length === 0))) {
        return res.status(400).json({ msg: "Message content required." });
      }

      const newConversation = await Conversations.findOneAndUpdate(
        {
          $or: [
            { recipients: [req.user._id, recipient] },
            { recipients: [recipient, req.user._id] },
          ],
        },
        {
          recipients: [req.user._id, recipient],
          text,
          media,
        },
        { new: true, upsert: true }
      );

      const newMessage = new Messages({
        conversation: newConversation._id,
        sender: req.user._id,
        recipient,
        text,
        media,
      });

      await newMessage.save();

      res.json({ msg: "Created." });
    } catch (err) {
      return next(err);
    }
  },

  getConversations: async (req, res, next) => {
    try {
      const features = new APIfeatures(
        Conversations.find({
          recipients: req.user._id,
        }),
        req.query
      ).paginating();

      const conversations = await features.query
        .sort("-updatedAt")
        .populate("recipients", "avatar username fullname");

      res.json({
        conversations,
        result: conversations.length,
      });
    } catch (err) {
      return next(err);
    }
  },

  getMessages: async (req, res, next) => {
    try {
      const features = new APIfeatures(
        Messages.find({
          $or: [
            { sender: req.user._id, recipient: req.params.id },
            { sender: req.params.id, recipient: req.user._id },
          ],
        }),
        req.query
      ).paginating();

      const messages = await features.query.sort("-createdAt");

      res.json({
        messages,
        result: messages.length,
      });
    } catch (err) {
      return next(err);
    }
  },
};

module.exports = messageCtrl;
