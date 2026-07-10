import express from "express";
import {
  getCategories,
  createCategory,
  deleteCategory,
} from "../controllers/categoryController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getCategories);
router.post("/", requireAuth, createCategory);
router.delete("/:id", requireAuth, deleteCategory);

export default router;
