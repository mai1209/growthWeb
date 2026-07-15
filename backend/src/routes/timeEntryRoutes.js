import express from "express";
import {
  getTimeEntries,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
} from "../controllers/timeEntryController.js";
import { requireAuth } from "../middlewares/authJwt.js";

const router = express.Router();

router.get("/", requireAuth, getTimeEntries);
router.post("/", requireAuth, createTimeEntry);
router.put("/:id", requireAuth, updateTimeEntry);
router.delete("/:id", requireAuth, deleteTimeEntry);

export default router;
