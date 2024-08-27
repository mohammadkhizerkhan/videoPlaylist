import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants/common.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateTokens = async (user) => {
  try {
    const accessToken = user.generateAccessToken(user);
    const refreshToken = user.generateRefreshToken(user);
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(500, "erorr while generating tokens");
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, fullName, password } = req.body;

  if (
    [username, email, fullName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required missing");
  }

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existingUser) {
    throw new ApiError(409, "User with same email or name already exist");
  }

  const avatarLocalPath = req?.files?.avatar[0]?.path;
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar) {
    throw new ApiError(400, "Failed to upload Avatar file");
  }

  const user = await User.create({
    username: username.toLowerCase(),
    fullName,
    avatar: avatar?.url ?? "",
    coverImage: coverImage?.url ?? "",
    email,
    password,
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(500, "something went wrong while creating the user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
    const { email, username, password } = req.body;
    if (!(email || username)) {
      throw new ApiError(400, "username or email is required");
    }

    const existingUser = await User.findOne({
      $or: [{ username }, { email }],
    });
    if (!existingUser) {
      throw new ApiError(409, "User with this email or name does not exist");
    }

    const verifyPassword = await existingUser.isPasswordCorrect(password);
    if (!verifyPassword) {
      throw new ApiError(401, "incorrect password");
    }
    const { accessToken, refreshToken } = await generateTokens(existingUser);
    const loginUser = await User.findById(existingUser._id).select(
      "-passwork -refreshToken"
    );
    const cookieConfig = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie(ACCESS_TOKEN, accessToken, cookieConfig)
      .cookie(REFRESH_TOKEN, refreshToken, cookieConfig)
      .json(
        new ApiResponse(200, {
          loginUser,
          accessToken,
          refreshToken,
        })
      );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $unset: {
          refreshToken: 1, // this removes the field from document
        },
      },
      {
        new: true,
      }
    );

    const cookieConfig = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .clearCookie(ACCESS_TOKEN, cookieConfig)
      .clearCookie(REFRESH_TOKEN, cookieConfig)
      .json(new ApiResponse(200, {}, "User Logged out"));
});

const getRefreshToken = asyncHandler(async (req, res) => {
    const oldRefreshToken = req.cookie.refreshToken || req.body.refreshToken;
    if (!oldRefreshToken) {
      throw new ApiError(401, "Unauthorized request");
    }
    const decryptToken = jwt.verify(
      oldRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decryptToken?._id);
    if (!user) {
      throw new ApiError(401, "invalid refresh token");
    }

    if (oldRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const cookieConfig = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user._id
    );

    return res
      .status(200)
      .cookie(ACCESS_TOKEN, accessToken, cookieConfig)
      .cookie(REFRESH_TOKEN, refreshToken, cookieConfig)
      .json(
        new ApiResponse(200, {
          accessToken,
          refreshToken,
        })
      );
});

const updatePassword = asyncHandler(async (req, res) => {
  const { newPassword, oldPassword } = req.body;
  if (newPassword === oldPassword) {
    throw new ApiError(400, "new password cannot be same as old password");
  }

  const user = await User.findById(req?.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(400, "invalid password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password updated successfully"));
});

const getCurrentUserData = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "fetched successfully"));
});

const updateUserData = asyncHandler(async (req, res) => {
  const allowedUpdateFields = ["fullName", "email"];
  const requestFields = req.body;
  const invalidUpdateFields = [];
  const updateAllowed = Object.keys(requestFields).every((field) => {
    if (allowedUpdateFields.includes(field)) return true;
    invalidUpdateFields.push(field);
    return false;
  });

  if (!updateAllowed) {
    throw new ApiError(400, `Cannot update ${invalidUpdateFields} fields`);
  }

  if (!(requestFields.fullName || requestFields.email)) {
    throw new ApiError(400, "Please provide proper data");
  }

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        fullName: requestFields.fullName,
        email: requestFields.email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "user details updated successfully"));
});

const updateAvatar = asyncHandler(async (req, res) => {
  const filePath = req?.file?.path;
  if (!filePath) {
    throw new ApiError(500, "Avatar file is missing");
  }

  const splitedUrl = user.avatar.split("/");
  const oldFileName = splitedUrl[splitedUrl.length - 1].split(".")[0];

  const avatar = await uploadOnCloudinary(filePath);

  if (!avatar.url) {
    throw new ApiError(500, "error while uploading file");
  }
  await deleteOnCloudinary(oldFileName);

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const filePath = req?.file?.path;
  if (!filePath) {
    throw new ApiError(500, "cover image file is missing");
  }

  const splitedUrl = user.coverImage.split("/");
  const oldFileName = splitedUrl[splitedUrl.length - 1].split(".")[0];

  const coverImage = await uploadOnCloudinary(filePath);

  if (!coverImage.url) {
    throw new ApiError(500, "error while uploading file");
  }

  await deleteOnCloudinary(oldFileName);

  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "cover image updated successfully"));
});

const getUserProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username) {
    throw new ApiError(500, "username is missing");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username.trim().toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        // when local field id matches the foreign key of channel, then we'll get list of subscribers subscribed to this id
        foreignField: "channel",
        localField: "_id",
        as: "subscribers",
        pipeline: [
          {
            $lookup: {
              from: "users",
              foreignField: "_id",
              localField: "subscriber",
              as: "subscriberDetails",
              pipeline: [
                {
                  $project: {
                    username: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              subscriberDetails: {
                $first: "$subscriberDetails",
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        // when local field id matches the foreign key of subscriber, then we'll get list of channels this id subscribed
        foreignField: "subscriber",
        localField: "_id",
        as: "subscribedTo",
        pipeline: [
          {
            // we'll add another lookup to fetch the channel details , here if channel id matches the user id we'll fetch the details
            $lookup: {
              from: "users",
              foreignField: "_id",
              localField: "channel",
              as: "channelDetails",
              pipeline: [
                {
                  $project: {
                    username: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              channelDetails: {
                $first: "$channelDetails",
              },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        subscribedCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        subscribedCount: 1,
        "subscribers._id": 1,
        "subscribers.createdAt": 1,
        "subscribers.updatedAt": 1,
        "subscribers.subscriberDetails": 1,
        "subscribedTo._id": 1,
        "subscribedTo.createdAt": 1,
        "subscribedTo.updatedAt": 1,
        "subscribedTo.channelDetails": 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "channel does not exists");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              foreignField: "_id",
              localField: "owner",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  getRefreshToken,
  updatePassword,
  getCurrentUserData,
  updateUserData,
  updateAvatar,
  updateCoverImage,
  getUserProfile,
  getWatchHistory,
};
