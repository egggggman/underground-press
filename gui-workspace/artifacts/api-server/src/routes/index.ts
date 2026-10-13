import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storageRouter from "./storage";
import pressRouter from "./press";
import pressEditorAccessRouter from "./press-editor-access";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(pressRouter);
router.use(pressEditorAccessRouter);

export default router;
