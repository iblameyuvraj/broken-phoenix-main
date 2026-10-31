import { Router } from "express";
import type { FilterQuery } from "mongoose";
import { getSettings } from "../config";
import { currentUser, getProjectForUser, requireUser } from "../lib/auth";
import { asyncHandler, escapeRegex, HttpError, isDuplicateKey, parseBody, parseId } from "../lib/http";
import { TaskIn, TaskQuery } from "../lib/schemas";
import { taskOut } from "../lib/serialize";
import { CreditLedger, Task, Workspace, WorkspaceMember } from "../models";

export const tasksRouter = Router();

tasksRouter.get(
  "/api/projects/:projectId/tasks",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const projectId = parseId(req.params.projectId, "Project");
    // Membership check first: tasks of another tenant are a 404, not a listing.
    await getProjectForUser(projectId, user);
    const query = parseBody(TaskQuery, req.query);

    const filter: FilterQuery<unknown> = { project: projectId };
    // What the user types is text, not a regular expression.
    if (query.q) filter.title = new RegExp(escapeRegex(query.q), "i");
    if (query.status) filter.status = query.status;

    const total = await Task.countDocuments(filter);
    const items = await Task.find(filter)
      // _id breaks ties so pages stay stable when several tasks share a timestamp.
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.page_size)
      .limit(query.page_size)
      .lean();
    res.json({ items: items.map(taskOut), total, page: query.page, page_size: query.page_size });
  })
);

/** Creating a task costs credits. */
tasksRouter.post(
  "/api/projects/:projectId/tasks",
  requireUser,
  asyncHandler(async (req, res) => {
    const user = currentUser(res.locals);
    const projectId = parseId(req.params.projectId, "Project");
    const project = await getProjectForUser(projectId, user);
    const body = parseBody(TaskIn, req.body);
    const key = req.get("Idempotency-Key") || null;
    const cost = getSettings().TASK_CREDIT_COST;

    async function replay(keyToFind: string) {
      const previous = await CreditLedger.findOne({
        workspace: project.workspace,
        idempotencyKey: keyToFind,
      }).lean();
      if (!previous?.task) return null;
      return Task.findById(previous.task).lean();
    }

    // Asking twice costs once: a known key returns the original task untouched.
    if (key) {
      const existing = await replay(key);
      if (existing) {
        res.status(200).json(taskOut(existing));
        return;
      }
    }

    // Validate the assignee before any credit is spent.
    if (body.assignee_id) {
      const isMember = await WorkspaceMember.exists({ workspace: project.workspace, user: body.assignee_id });
      if (!isMember) throw new HttpError(422, "Assignee is not a workspace member");
    }

    // Spend the credit atomically: "check then decrement" lets two people spend the
    // last coin at the same time.
    const ws = await Workspace.findOneAndUpdate(
      { _id: project.workspace, credits: { $gte: cost } },
      { $inc: { credits: -cost } },
      { new: true }
    ).lean();
    if (!ws) throw new HttpError(402, "Not enough credits");

    const refund = async () => {
      await Workspace.updateOne({ _id: project.workspace }, { $inc: { credits: cost } });
    };

    let task;
    try {
      task = await Task.create({
        project: projectId,
        title: body.title,
        status: body.status,
        createdBy: user._id,
        assignee: body.assignee_id,
      });
    } catch (err) {
      await refund();
      throw err;
    }

    try {
      await CreditLedger.create({
        workspace: ws._id,
        delta: -cost,
        reason: `task ${task._id}`,
        task: task._id,
        idempotencyKey: key ?? undefined,
      });
    } catch (err) {
      // Keep the books straight: the task and its charge are one unit.
      await Task.deleteOne({ _id: task._id });
      await refund();
      if (key && isDuplicateKey(err)) {
        // A concurrent request with the same key won the race; answer with its task.
        const existing = await replay(key);
        if (existing) {
          res.status(200).json(taskOut(existing));
          return;
        }
      }
      throw err;
    }

    res.status(201).json(taskOut(task));
  })
);
