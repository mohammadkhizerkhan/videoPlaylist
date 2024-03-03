import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription
  const userId = req.user._id;

  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  // Check if the user with the channelId exists
  const user = await User.findById(channelId);
  if (!user) {
    throw new ApiError(404, "User with channelId does not exist");
  }

  const isSubscribed = await Subscription.findOne({
    channel: channelId,
    subscriber: userId,
  });
  console.log("------------>", isSubscribed);
  if (isSubscribed) {
    const unSubscribe = await Subscription.findByIdAndDelete(isSubscribed._id);
    return res
      .status(200)
      .json(new ApiResponse(200, { unSubscribe }, "successfull unsubscribed"));
  } else {
    const subscribe = await Subscription.create({
      channel: channelId,
      subscriber: userId,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, { subscribe }, "successfull subscribed"));
  }
});

// controller to return subscriber list of a channel
const getSubscribersOfChannel = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(channelId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  // Check if the user with the channelId exists
  const user = await User.findById(channelId);
  if (!user) {
    throw new ApiError(404, "User with channelId does not exist");
  }

  const subscribers = await Subscription.aggregate([
    {
      $match:{
        channel:new mongoose.Types.ObjectId(channelId) 
      }
    },
    {
      $lookup:{
        from:"users",
        foreignField:"_id",
        localField:"subscriber",
        as:"subscriberDetails",
      }
    },
    {
      $addFields: {
        subscriberDetails: {
          $first: "$subscriberDetails",
        },
      },
    },
    {
      $project:{
        "subscriberDetails.username": 1,
        "subscriberDetails.fullName":1,
        "subscriberDetails.avatar": 1,
        "subscriberDetails.coverImage": 1,
      }
    }
  ])
  
  if (!subscribers.length) throw new ApiError(404, "channel id does not exist");
  return res.status(200).json(new ApiResponse(200,  subscribers , "Success"));
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(subscriberId)) {
    throw new ApiError(400, "Invalid channelId");
  }

  // Check if the user with the subscriberId exists
  const user = await User.findById(subscriberId);
  if (!user) {
    throw new ApiError(404, "User with subscriberId does not exist");
  }
  const subscribedChannels = await Subscription.aggregate([
    {
      $match:{
        subscriber:new mongoose.Types.ObjectId(subscriberId) 
      }
    },
    {
      $lookup:{
        from:"users",
        foreignField:"_id",
        localField:"channel",
        as:"channelDetails",
      }
    },
    {
      $addFields: {
        channelDetails: {
          $first: "$channelDetails",
        },
      },
    },
    {
      $project:{
        "channelDetails.username": 1,
        "channelDetails.fullName":1,
        "channelDetails.avatar": 1,
        "channelDetails.coverImage": 1,
      }
    }
  ])

  return res
    .status(200)
    .json(new ApiResponse(200,  subscribedChannels , "Success"));
});

export { toggleSubscription, getSubscribersOfChannel, getSubscribedChannels };
