import { getSupabase } from "./supabase";
import { columns, parseActivity, parseComment } from "../types";
import type { TaskActivity, TaskComment } from "../types";
import { formatDueDate } from "./dates";

async function getDetailRows(
  table: "comments" | "task_activity",
  taskId: string,
  signal: AbortSignal,
): Promise<unknown[]> {
  const rows: unknown[] = [];
  const fields =
    table === "comments"
      ? "id, task_id, body, created_at"
      : "id, task_id, action, old_value, new_value, created_at";

  for (let start = 0; ; start += 100) {
    const { data, error } = await getSupabase()
      .from(table)
      .select(fields)
      .eq("task_id", taskId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + 99)
      .abortSignal(signal);

    if (error)
      throw new Error(
        "Unable to load task details. Check your connection and try again.",
      );
    if (!Array.isArray(data))
      throw new Error("Task details were invalid. Try refreshing.");

    rows.push(...data);
    if (data.length < 100) return rows;
  }
}

export async function getTaskDetails(
  taskId: string,
  signal: AbortSignal,
): Promise<{
  comments: TaskComment[];
  activity: TaskActivity[];
}> {
  const [commentRows, activityRows] = await Promise.all([
    getDetailRows("comments", taskId, signal),
    getDetailRows("task_activity", taskId, signal),
  ]);
  const comments = commentRows.map(parseComment);
  const activity = activityRows.map(parseActivity);

  if ([...comments, ...activity].some((row) => row.task_id !== taskId)) {
    throw new Error("The details did not match this task. Try refreshing.");
  }

  return { comments, activity };
}

export async function addComment(
  taskId: string,
  body: string,
): Promise<TaskComment> {
  const trimmedBody = body.trim();
  if (!trimmedBody) throw new Error("Write a comment first.");
  if (trimmedBody.length > 4000)
    throw new Error("Keep comments to 4,000 characters or fewer.");

  const { data, error } = await getSupabase()
    .from("comments")
    .insert({ task_id: taskId, body: trimmedBody })
    .select("id, task_id, body, created_at")
    .single();

  if (error)
    throw new Error(
      "Unable to confirm your comment was saved. Refresh before trying again.",
    );
  const comment = parseComment(data);
  if (comment.task_id !== taskId)
    throw new Error("The saved comment did not match this task.");
  return comment;
}

export function describeActivity(activity: TaskActivity): string {
  const oldStatus = columns.find(
    (column) => column.status === activity.old_value,
  )?.title;
  const newStatus = columns.find(
    (column) => column.status === activity.new_value,
  )?.title;

  switch (activity.action) {
    case "created":
      return "Task created";
    case "status_changed":
      return `Moved from ${oldStatus} to ${newStatus}`;
    case "title_changed":
      return `Renamed “${activity.old_value}” to “${activity.new_value}”`;
    case "due_date_changed":
      if (!activity.new_value) return "Removed the due date";
      if (!activity.old_value)
        return `Set due date to ${formatDueDate(activity.new_value)}`;
      return `Changed due date from ${formatDueDate(activity.old_value)} to ${formatDueDate(activity.new_value)}`;
    case "description_changed":
      return "Updated the description";
    case "priority_changed":
      return `Changed priority from ${activity.old_value} to ${activity.new_value}`;
    case "comment_added":
      return "Added a comment";
  }
}
