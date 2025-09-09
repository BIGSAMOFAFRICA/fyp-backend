import express from "express";

const router = express.Router();

// Expose Cloudinary config to frontend (only safe values)
router.get("/cloudinary-config", (req, res) => {
  res.json({
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || "unsigned_preset"
  });
});

export default router;
