import { getSupabase } from "./supabase";
import { isTaskStatus, parseTask, parseTasks } from "../types";
import type { Task, TaskStatus } from "../types";
import { isDateOnly } from "./dates";

const taskColumns = "id, title, status, due_date";

export async function getTasks(
  userId: string,
  signal: AbortSignal,
): Promise<Task[]> {
  const tasks: Task[] = [];
  const pageSize = 100;

  for (let start = 0; ; start += pageSize) {
    const { data, error } = await getSupabase()
      .from("tasks")
      .select(taskColumns)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(start, start + pageSize - 1)
      .abortSignal(signal);

    if (error) {
      throw new Error(
        "Unable to load your tasks. Check your connection and try again.",
      );
    }

    const page = parseTasks(data);
    tasks.push(...page);

    if (page.length < pageSize) return tasks;
  }
}

export async function createTask(
  title: string,
  dueDate: string | null = null,
): Promise<Task> {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) {
    throw new Error("Enter a task title.");
  }

  if (dueDate !== null && !isDateOnly(dueDate)) {
    throw new Error("Choose a valid due date.");
  }

  const { data, error } = await getSupabase()
    .from("tasks")
    .insert({ title: trimmedTitle, status: "todo", due_date: dueDate })
    .select(taskColumns)
    .single();

  if (error) {
    throw new Error(
      "Unable to confirm this task was saved. Refresh the board before trying again.",
    );
  }

  return parseTask(data);
}

export async function updateTaskStatus(
  taskId: string,
  userId: string,
  status: TaskStatus,
): Promise<Task> {
  if (!isTaskStatus(status)) {
    throw new Error("Invalid task status.");
  }

  const { data, error } = await getSupabase()
    .from("tasks")
    .update({ status })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select(taskColumns)
    .single();

  if (error) {
    throw new Error(
      "Unable to confirm the status change. The previous status is shown; refresh to check the saved board.",
    );
  }

  const task = parseTask(data);

  if (task.id !== taskId) {
    throw new Error(
      "The saved task did not match. Refresh the board to try again.",
    );
  }

  return task;
}

export async function updateTaskDetails(
  taskId: string,
  userId: string,
  title: string,
  dueDate: string | null,
): Promise<Task> {
  const trimmedTitle = title.trim();

  if (!trimmedTitle) throw new Error("Enter a task title.");
  if (dueDate !== null && !isDateOnly(dueDate))
    throw new Error("Choose a valid due date.");

  const { data, error } = await getSupabase()
    .from("tasks")
    .update({ title: trimmedTitle, due_date: dueDate })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select(taskColumns)
    .single();

  if (error)
    throw new Error(
      "Unable to confirm your changes. Refresh before trying again.",
    );

  const task = parseTask(data);
  if (task.id !== taskId)
    throw new Error("The saved task did not match. Refresh the board.");
  return task;
}
