import {
  ListMyrtleEditorAssignmentsResponse,
  UpdateMyrtleEditorAssignmentBody,
  UpdateMyrtleEditorAssignmentParams,
  UpdateMyrtleEditorAssignmentResponse,
} from "@workspace/api-zod";
import {
  Router,
  type IRouter,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { hasNewsroomAdminRole } from "../lib/press-roles";
import {
  listMyrtleEditorAssignments,
  setMyrtleEditorAssignment,
} from "../lib/press-role-store";

const router: IRouter = Router();

router.use("/press/editor-assignments", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function authenticated(req: Request, res: Response, next: NextFunction): void {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Log in to manage editor access." });
    return;
  }
  next();
}

function newsroomAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !hasNewsroomAdminRole(req.user.id)) {
    res.status(403).json({ error: "Only a newsroom administrator can manage editor access." });
    return;
  }
  next();
}

router.get(
  "/press/editor-assignments",
  authenticated,
  newsroomAdmin,
  async (_req, res): Promise<void> => {
    res.json(ListMyrtleEditorAssignmentsResponse.parse(await listMyrtleEditorAssignments()));
  },
);

router.patch(
  "/press/editor-assignments/:accountId",
  authenticated,
  newsroomAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateMyrtleEditorAssignmentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid account ID." });
      return;
    }
    const body = UpdateMyrtleEditorAssignmentBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: "Choose whether to grant or revoke editor access." });
      return;
    }

    const updated = await setMyrtleEditorAssignment(
      params.data.accountId,
      body.data.enabled,
      req.user!.id,
    );
    if (!updated) {
      res.status(404).json({ error: "Authenticated account not found." });
      return;
    }
    res.json(UpdateMyrtleEditorAssignmentResponse.parse(updated));
  },
);

export default router;
