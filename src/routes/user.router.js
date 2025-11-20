import { Router } from "express";
import { CreateUser, loginUser, logoutUser, UpdateUser, deleteUser } from "../controller/users.controller.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = Router();

router.route("/register").post(CreateUser);
router.route("/login").post(loginUser);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/update/:id").put(verifyJWT, UpdateUser);
router.route("/delete/:id").delete(verifyJWT, deleteUser);

export default router;  