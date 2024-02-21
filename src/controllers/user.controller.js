import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ACCESS_TOKEN, REFRESH_TOKEN } from "../constants/common.js";
import jwt from "jsonwebtoken";

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
  try {
    const { username, email, fullName, password } = req.body;

    if (
      [username, email, fullName, password].some(
        (field) => field?.trim() === ""
      )
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
      avatar: avatar.url,
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
  } catch (error) {
    res.status(error.statusCode).send({ message: error.message, ...error });
  }
});

const loginUser = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.statusCode).send({ message: error.message, ...error });
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.statusCode).send({ message: error.message, ...error });
  }
});

const getRefreshToken = asyncHandler(async (req, res) => {
  try {
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
  } catch (error) {
    res.status(error.statusCode).send({ message: error.message, ...error });
  }
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

  if (!requestFields.fullName || !requestFields.email) {
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
        from: "subscription",
        foreignField: "_id",
        localField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscription",
        foreignField: "_id",
        localField: "subscriber",
        as: "subscribedTo",
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
        channelsSubscribedToCount: 1,
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
};
