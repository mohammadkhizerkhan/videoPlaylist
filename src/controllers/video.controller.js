import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 0, limit = 10, query, sortBy, sortType, userId } = req.query;
  let sortOption = {};
  if (sortBy) {
    sortOption[sortBy] = sortType === "dsc" ? -1 : 1;
  }

  let queryOption = {};
  if (query) {
    queryOption.$or = [
      { title: { $regex: query, $options: "i" } },
      { description: { $regex: query, $options: "i" } },
    ];
  }

  const videos = await Video.aggregate([
    {
      $match: {
        ...queryOption,
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $sort: sortOption,
    },
    {
      $skip: parseInt(page * limit),
    },
    {
      $limit: parseInt(limit),
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Successfully fetched"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video
  // const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
  // const thumbnailFileLocalPath = req.files?.thumbnail?.[0]?.path;
  // if (!videoFileLocalPath) throw new ApiError(400, "Video file required");
  // if (!thumbnailFileLocalPath)
  //   throw new ApiError(400, "Thumbnail file required");
  // const uploadVideoOnCloudinary =
  //   await uploadOnCloudinary(videoFileLocalPath);
  // const uploadThubnailCloudinary = await uploadOnCloudinary(
  //   thumbnailFileLocalPath
  // );
  // if (!(uploadThubnailCloudinary || uploadVideoOnCloudinary))
  //   throw new ApiError(400, "Upload video error");
  let uploadVideoOnCloudinary;
  let uploadThubnailCloudinary;

  const videoPublish = await Video.create({
    videoFile: uploadVideoOnCloudinary?.url ?? "dummy",
    thumbnail: uploadThubnailCloudinary?.url ?? "dummy",
    title,
    description,
    duration: uploadVideoOnCloudinary?.duration ?? 0,
    cloudinaryVideoID: uploadVideoOnCloudinary?.public_id ?? "dummy", //Adding these details to delete the video from the cloudinary also
    cloudinaryThumbnailID: uploadThubnailCloudinary?.public_id ?? "dummy",
    owner: req.user._id,
  });
  if (!videoPublish)
    throw new ApiError(500, "Something went wrong while uploading");
  return res.status(200).json(new ApiResponse(200, videoPublish, "Success"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: get video by id
  const isValidVideoId = isValidObjectId(new mongoose.Types.ObjectId(videoId));
  if (!videoId || !isValidVideoId) {
    throw new ApiError(500, "please provide the valid video id");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "video is not available");
  }

  return res.status(200).json(new ApiResponse(200, video, "Success"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;
  const localFilePathofthumbnail = req.file.path;

  if (!localFilePathofthumbnail) {
    throw new ApiError(404, "File not found");
  }

  const uploadCloud = await uploadOnCloudinary(localFilePathofthumbnail);

  if (!uploadCloud.url) {
    throw new ApiError(500, "Unable to upload to cloud");
  }
  const public_id_video = await Video.findById(videoId);
  const deleteFileServer = await deleteFile(
    public_id_video.cloudinaryThumbnailID
  );
  const uploadfileonServer = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        thumbnail: uploadCloud.url,
        cloudinaryThumbnailID: uploadCloud.public_id,
        title: title,
        description: description,
      },
    },
    { new: true }
  );
  if (!uploadfileonServer)
    throw new ApiError(500, "Unable to update video on server");
  return res
    .status(200)
    .json(new ApiResponse(200, { uploadfileonServer }, "Success"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const public_id_video = await Video.findById(videoId);

  if (!public_id_video) {
    throw new ApiError(404, "Video not found");
  }

  const cloudinaryVideoID = public_id_video.get("cloudinaryVideoID");

  const deleteFileServer = await deleteFile(cloudinaryVideoID);

  if (!deleteFileServer.result || deleteFileServer.result !== "ok") {
    throw new ApiError(500, "Unable to delete file on Cloudinary");
  }

  const uploadfileonServer = await Video.findByIdAndDelete(videoId);

  if (!uploadfileonServer) {
    throw new ApiError(500, "Unable to delete video on server");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, { uploadfileonServer }, "Success"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const video = await Video.findById(videoId);

  if (!video) {
    return res.status(404).json(new ApiResponse(404, null, "Video not found"));
  }

  const newPublishStatus = !video.isPublished;

  const toggle = await Video.findOneAndUpdate(
    { _id: videoId },
    { $set: { isPublished: newPublishStatus } },
    { new: true }
  );

  return res.status(200).json(new ApiResponse(200, { toggle }, "Updated"));
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
