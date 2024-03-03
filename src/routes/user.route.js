import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifytoken } from "../middlewares/auth.middleware.js";
import {
  getCurrentUserData,
  getRefreshToken,
  getUserProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  registerUser,
  updateAvatar,
  updateCoverImage,
  updatePassword,
  updateUserData,
} from "../controllers/user.controller.js";
const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);
router.route("/logout").post(verifytoken, logoutUser);
router.route("/refresh-token").get(getRefreshToken);
router.route("/update-password").post(verifytoken, updatePassword);
router.route("/self").post(verifytoken, getCurrentUserData);
router.route("/update-user").post(verifytoken, updateUserData);
router
  .route("/update-avatar")
  .post(verifytoken, upload.single("avatar"), updateAvatar);
router
  .route("/update-coverImage")
  .post(verifytoken, upload.single("coverImage"), updateCoverImage);
router.route("/:username").get(verifytoken, getUserProfile);
router.route("/history").get(verifytoken, getWatchHistory);

export default router;
