import mongoose from "mongoose";
import { CreditLedger } from "./ledger";
import { Project } from "./project";
import { Task, TASK_STATUSES } from "./task";
import { User } from "./user";
import { ROLES, Workspace, WorkspaceMember } from "./workspace";

export { User } from "./user";
export { Workspace, WorkspaceMember, ROLES } from "./workspace";
export { Project } from "./project";
export { Task, TASK_STATUSES } from "./task";
export { CreditLedger } from "./ledger";

/**
 * Every registered model. Used to warm up the connection and to make sure the
 * indexes each model declares really get created before the API serves traffic.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_MODELS: mongoose.Model<any>[] = [
  User,
  Workspace,
  WorkspaceMember,
  Project,
  Task,
  CreditLedger,
];
