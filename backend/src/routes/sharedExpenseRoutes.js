import express from "express";
import { requireAuth } from "../middlewares/authJwt.js";
import {
  addSharedGroupMember,
  createSharedDebt,
  createSharedExpense,
  createSharedGroup,
  deleteSharedGroup,
  deleteSharedExpense,
  getSharedGroupDetail,
  getSharedGroups,
  settleSharedDebt,
  updateSharedGroup,
} from "../controllers/sharedExpenseController.js";

const router = express.Router();

router.get("/", requireAuth, getSharedGroups);
router.post("/", requireAuth, createSharedGroup);
router.get("/:id", requireAuth, getSharedGroupDetail);
router.put("/:id", requireAuth, updateSharedGroup);
router.post("/:id/members", requireAuth, addSharedGroupMember);
router.delete("/:id", requireAuth, deleteSharedGroup);
router.post("/:id/expenses", requireAuth, createSharedExpense);
router.delete("/:id/expenses/:expenseId", requireAuth, deleteSharedExpense);
router.post("/:id/debts", requireAuth, createSharedDebt);
router.post("/:id/debts/:debtId/settle", requireAuth, settleSharedDebt);

export default router;
