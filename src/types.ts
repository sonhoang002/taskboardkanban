import { isDateOnly } from "./lib/dates";

export type TaskStatus = "todo" | "in_progress" | "in_review" | "done";

export type Task = {
  id: string;
  title: string;
  status: TaskStatus;
  due_date: string | null;
};

export const columns: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To Do" },
  { status: "in_progress", title: "In Progress" },
  { status: "in_review", title: "In Review" },
  { status: "done", title: "Done" },
];

export function isTaskStatus(value: unknown): value is TaskStatus {
  return (
    value === "todo" ||
    value === "in_progress" ||
    value === "in_review" ||
    value === "done"
  );
}

export function parseTask(value: unknown): Task {
  if (
    typeof value !== "object" ||
    value === null ||
    !("id" in value) ||
    typeof value.id !== "string" ||
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
      value.id,
    ) ||
    !("title" in value) ||
    typeof value.title !== "string" ||
    value.title.trim().length === 0 ||
    !("status" in value) ||
    !isTaskStatus(value.status) ||
    !("due_date" in value) ||
    (value.due_date !== null && !isDateOnly(value.due_date))
  ) {
    throw new Error("Task data was invalid. Refresh the board to try again.");
  }

  return {
    id: value.id,
    title: value.title,
    status: value.status,
    due_date: value.due_date,
  };
}

export function parseTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) {
    throw new Error("Task data was invalid. Refresh the board to try again.");
  }

  return value.map(parseTask);
}

export type TaskComment = {
  id: string;
  task_id: string;
  body: string;
  created_at: string;
};

export type ActivityAction =
  | "created"
  | "status_changed"
  | "title_changed"
  | "due_date_changed"
  | "description_changed"
  | "priority_changed"
  | "comment_added";

export type TaskActivity = {
  id: string;
  task_id: string;
  action: ActivityAction;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value)
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isActivityAction(value: unknown): value is ActivityAction {
  return (
    value === "created" ||
    value === "status_changed" ||
    value === "title_changed" ||
    value === "due_date_changed" ||
    value === "description_changed" ||
    value === "priority_changed" ||
    value === "comment_added"
  );
}

export function parseComment(value: unknown): TaskComment {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isId(value.task_id) ||
    typeof value.body !== "string" ||
    !value.body.trim() ||
    value.body.length > 4000 ||
    !isTimestamp(value.created_at)
  ) {
    throw new Error("Comment data was invalid. Refresh the task to try again.");
  }

  return {
    id: value.id,
    task_id: value.task_id,
    body: value.body,
    created_at: value.created_at,
  };
}

export function parseActivity(value: unknown): TaskActivity {
  if (
    !isRecord(value) ||
    !isId(value.id) ||
    !isId(value.task_id) ||
    !isActivityAction(value.action) ||
    !isTimestamp(value.created_at) ||
    (value.old_value !== null && typeof value.old_value !== "string") ||
    (value.new_value !== null && typeof value.new_value !== "string")
  ) {
    throw new Error(
      "Activity data was invalid. Refresh the task to try again.",
    );
  }

  if (
    value.action === "status_changed" &&
    (!isTaskStatus(value.old_value) || !isTaskStatus(value.new_value))
  ) {
    throw new Error(
      "Activity data was invalid. Refresh the task to try again.",
    );
  }

  if (
    value.action === "due_date_changed" &&
    ((value.old_value !== null && !isDateOnly(value.old_value)) ||
      (value.new_value !== null && !isDateOnly(value.new_value)))
  ) {
    throw new Error(
      "Activity data was invalid. Refresh the task to try again.",
    );
  }

  return {
    id: value.id,
    task_id: value.task_id,
    action: value.action,
    old_value: value.old_value,
    new_value: value.new_value,
    created_at: value.created_at,
  };
}
