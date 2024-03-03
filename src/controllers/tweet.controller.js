import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet
  const { content } = req.body;
  if (!content) {
    throw new ApiError(404, "Tweet cannot be empty");
  }
  const createdTweet = await Tweet.create({
    content: content,
    owner: req.user._id,
  });

  if (!createdTweet) {
    throw new ApiError(500, "couldn't able to create the tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { createdTweet }, "Tweet created successfully"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const { userId } = req.params;
  const userTweets = await Tweet.find({ owner: userId });
  if (!userTweets) {
    throw new ApiError(500, "Error while fetching the tweets");
  }
  return res.status(200).json(new ApiResponse(200, userTweets, "success"));
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet
  const { tweetId } = req.params;
  const { content } = req.body;
  const userId = req.user._id;

  const tweet = await Tweet.findOne({
    _id: tweetId,
    owner: userId,
  });
  if (!tweet) {
    throw new ApiError(409, "invalid tweet id");
  }
  const updatedTweet = await Tweet.updateOne(
    { _id: tweetId },
    {
      $set: {
        content: content,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedTweet) {
    throw new ApiError(409, "couldn't able to updated tweet");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { updatedTweet }, "Tweet updated successfully"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params;
  const userId = req.user._id;
  const ownerDetails = await Tweet.findOne({
    owner: new mongoose.Types.ObjectId(userId),
  }).select("-content");
  if (!ownerDetails) throw new ApiError(401, "You are not Authenticated");

  const deletedTweet = await Tweet.findByIdAndDelete(tweetId);
  if (!deleteTweet) {
    throw new ApiError(500, "couldn't able to delete tweet");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, { deletedTweet }, "Success"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };
