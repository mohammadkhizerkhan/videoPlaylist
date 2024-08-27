import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  //TODO: create playlist
  console.log("----------->", name, description);
  if (!name) {
    throw new ApiError(409, "please provide the valid playlist name");
  }

  const playlist = await Playlist.create({
    name,
    description,
    owner: req.user._id,
  });
  if (!playlist) {
    throw new ApiError(500, "Error while creating the playlist");
  }
  return res.status(200).json(new ApiResponse(200, playlist, "Success"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //TODO: get user playlists
  const isValidUserId = isValidObjectId(new mongoose.Types.ObjectId(userId));
  if (!userId || !isValidUserId) {
    throw new ApiError(500, "please provide the valid user id");
  }
  const allPlaylist = await Playlist.find({ owner: userId });
  if (!allPlaylist) {
    throw new ApiError(404, "couldn't able to find playlist");
  }
  return res.status(200).json(new ApiResponse(200, allPlaylist, "Success"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //TODO: get playlist by id
  const isValidPlaylistId = isValidObjectId(
    new mongoose.Types.ObjectId(playlistId)
  );
  if (!playlistId || !isValidPlaylistId) {
    throw new ApiError(500, "please provide the valid playlist id");
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "videos",
        foreignField: "_id",
        localField: "videos",
        as: "videoList",
        pipeline: [
          {
            $lookup: {
              from: "users",
              foreignField: "_id",
              localField: "owner",
              as: "videoOwnerDetails",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              videoOwnerDetails: {
                $first: "$videoOwnerDetails",
              },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "ownerDetails",
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
        ownerDetails: {
          $first: "$ownerDetails",
        },
      },
    },
    {
      $project: {
        name: 1,
        description: 1,
        ownerDetails: 1,
        "videoList.videoFile": 1,
        "videoList.thumbnail": 1,
        "videoList.title": 1,
        "videoList.description": 1,
        "videoList.duration": 1,
        "videoList.views": 1,
        "videoList.videoOwnerDetails": 1,
      },
    },
  ]);
  console.log("------------>detailsPlaylist", playlist);
  const playlists = await Playlist.findById(playlistId);
  if (!playlist[0]) {
    throw new ApiError(404, "can't find playlist");
  }
  return res.status(200).json(new ApiResponse(200, playlist[0], "Success"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.body;
  console.log("-------------->", playlistId, videoId);
  const isVideoIdPresent = await Video.findById(videoId);
  if (!isVideoIdPresent) {
    throw new ApiError(404, "Video not found");
  }
  console.log("-------------->isVideoIdPresent", isVideoIdPresent);

  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $push: { videos: videoId } },
    { new: true }
  );
  console.log("-------------->playlist", playlist);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video added to playlist successfully")
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.body;
  // TODO: remove video from playlist
  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    { $pull: { videos: videoId } },
    { new: true }
  );

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, playlist, "Video removed from playlist successfully")
    );
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const deletePlaylistRequest = await Playlist.findByIdAndDelete(
    new mongoose.Types.ObjectId(playlistId)
  );
  const isValidPlaylistId = isValidObjectId(
    new mongoose.Types.ObjectId(playlistId)
  );
  if (!playlistId || !isValidPlaylistId) {
    throw new ApiError(500, "please provide the valid playlist id");
  }
  if (!deletePlaylistRequest)
    throw new ApiError(500, "Unbale to deleted playlist");
  return res
    .status(200)
    .json(new ApiResponse(200, { deletePlaylistRequest }, "Success"));
  // TODO: delete playlist
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  if (!name) throw new ApiError(404, "Name is required");
  const updatePlaylist = await Playlist.updateOne(
    {
      _id: new mongoose.Types.ObjectId(playlistId),
    },
    { $set: { name: name, description: description } }
  );
  if (!updatePlaylist) throw new ApiError(500, "some error occurred");
  return res
    .status(200)
    .json(new ApiResponse(200, { updatePlaylist }, "success"));
  //TODO: update playlist
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};
