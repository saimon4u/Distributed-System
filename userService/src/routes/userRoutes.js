import express from 'express';
import UserController from '../controllers/userController.js';

const userRouter = express.Router();

userRouter.post("/", UserController.createUser);
userRouter.get('/count', UserController.getUserCount);
userRouter.get("/stats/active", UserController.getActiveUsers);
userRouter.get("/:id", UserController.getUserById);

export default userRouter;