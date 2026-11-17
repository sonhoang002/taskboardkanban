import { useDroppable } from "@dnd-kit/core";
import type { Task, TaskStatus } from "../types";
import TaskCard from "./TaskCard";

type BoardColumnProps = {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  savingIds: string[];
  today: string;
  onOpen: (taskId: string) => void;
  onStatusChange: (taskId: string, nextStatus: TaskStatus) => void;
};

export function BoardColumn({
  status,
  title,
  tasks,
  savingIds,
  today,
  onOpen,
  onStatusChange,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={`board-column${isOver ? " is-over" : ""}`}
      data-status={status}
      aria-labelledby={`column-${status}`}
    >
      <header className="column-header">
        <h3 id={`column-${status}`} className="column-title">
          {title}
        </h3>
        <span className="column-count" aria-label={`${tasks.length} tasks`}>
          {tasks.length}
        </span>
      </header>
      <div className="column-tasks">
        {tasks.length === 0 ? (
          <div className="column-empty">
            <span className="empty-mark" aria-hidden="true">
              +
            </span>
            <p>No tasks yet</p>
            <span>
              {status === "todo"
                ? "Start with one small thing."
                : "Drop a task here when it’s ready."}
            </span>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              saving={savingIds.includes(task.id)}
              today={today}
              onOpen={onOpen}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </section>
  );
}
