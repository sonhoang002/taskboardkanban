import type { Task } from "../types";

export function isDateOnly(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  ) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function getLocalDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatDueDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

export function getDueState(
  task: Task,
  today: string,
): { kind: string; label: string } | null {
  if (!task.due_date) return null;

  const label = formatDueDate(task.due_date);
  if (task.status === "done")
    return { kind: "completed", label: `Completed · ${label}` };

  const days = Math.round(
    (Date.parse(`${task.due_date}T00:00:00Z`) -
      Date.parse(`${today}T00:00:00Z`)) /
      86400000,
  );

  if (days < 0) return { kind: "overdue", label: `Overdue · ${label}` };
  if (days === 0) return { kind: "today", label: "Due today" };
  if (days <= 3) return { kind: "soon", label: `Due soon · ${label}` };
  return { kind: "upcoming", label: `Due ${label}` };
}

export function getBoardSummary(tasks: Task[], today: string) {
  return {
    total: tasks.length,
    completed: tasks.filter((task) => task.status === "done").length,
    overdue: tasks.filter(
      (task) =>
        task.status !== "done" &&
        task.due_date !== null &&
        task.due_date < today,
    ).length,
  };
}
