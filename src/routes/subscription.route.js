import { Router } from "express";
import {
  getSubscribedChannels,
  getSubscribersOfChannel,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifytoken } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifytoken); // Apply verifyJWT middleware to all routes in this file

router
  .route("/channel/:channelId")
  .get(getSubscribersOfChannel)
  .post(toggleSubscription);

router.route("/user/:subscriberId").get(getSubscribedChannels);

export default router;
