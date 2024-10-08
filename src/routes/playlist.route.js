import { Router } from 'express';
import {
    addVideoToPlaylist,
    createPlaylist,
    deletePlaylist,
    getPlaylistById,
    getUserPlaylists,
    removeVideoFromPlaylist,
    updatePlaylist,
} from "../controllers/playlist.controller.js"
import {verifytoken} from "../middlewares/auth.middleware.js"

const router = Router();

router.use(verifytoken); // Apply verifyJWT middleware to all routes in this file

router.route("/").post(createPlaylist)

router
    .route("/:playlistId")
    .get(getPlaylistById)
    .patch(updatePlaylist)
    .delete(deletePlaylist);

router.route("/video/add").post(addVideoToPlaylist);
router.route("/video/remove").post(removeVideoFromPlaylist);

router.route("/user/:userId").get(getUserPlaylists);

export default router