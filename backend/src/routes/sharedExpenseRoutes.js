import express from "express";
import { requireAuth } from "../middlewares/authJwt.js";
import {
  createSharedExpense,
  createSharedGroup,
  deleteSharedGroup,
  deleteSharedExpense,
  getSharedGroupDetail,
  getSharedGroups,
  updateSharedGroup,
} from "../controllers/sharedExpenseController.js";

const router = express.Router();

router.get("/", requireAuth, getSharedGroups);
router.post("/", requireAuth, createSharedGroup);
router.get("/:id", requireAuth, getSharedGroupDetail);
router.put("/:id", requireAuth, updateSharedGroup);
router.delete("/:id", requireAuth, deleteSharedGroup);
router.post("/:id/expenses", requireAuth, createSharedExpense);
router.delete("/:id/expenses/:expenseId", requireAuth, deleteSharedExpense);

export default router;
