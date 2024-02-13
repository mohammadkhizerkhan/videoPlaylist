import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const deleteOnCloudinary = async (fileName) => {
  try {
    if (!fileName) return null;
    const deletedResponse = await cloudinary.uploader.destroy(fileName);
    console.log("------------> file deleted in cloudinary");
    return deletedResponse;
  } catch (error) {
    console.log("--------------> error while deleting file");
  }
};

const uploadOnCloudinary = async (filePath) => {
  try {
    if (!filePath) return null;
    const uploadResponse = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    console.log(
      "------------> file uploaded to cloudinary",
      uploadResponse.url
    );
    return uploadResponse;
  } catch (error) {
    return null;
  } finally {
    fs.unlinkSync(filePath);
  }
};

export { uploadOnCloudinary, deleteOnCloudinary };
