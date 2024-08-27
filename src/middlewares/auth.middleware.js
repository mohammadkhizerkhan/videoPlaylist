import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";

export const verifytoken = async (req, res, next) => {
  try {
    const accessToken =
      req.cookies?.accessToken ||
      req.headers("Authorization")?.replate("Bearer ", "");
    if (!accessToken) {
      throw new ApiError(400, "Unauthorized request");
    }
    const decryptToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET
    );
    const user = await User.findById(decryptToken?._id).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new ApiError(401, "Invalid token");
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(400).send({ message: error.message, ...error });
  }
};
