import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createTransaction,
  listTransactions,
  getTransaction,
  updateTransaction,
  markReimbursementReceived,
  deleteTransaction
} from "../controllers/transaction.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();
router.use(verifyJWT);

router.route("/")
    .post(upload.array("files", 5), createTransaction)
    .get(listTransactions)

router.route("/:id")
    .patch(updateTransaction)
    .get(getTransaction)
    .delete(deleteTransaction)
    .put(markReimbursementReceived)

export default router;