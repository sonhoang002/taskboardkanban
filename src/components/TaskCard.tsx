import { useDraggable } from "@dnd-kit/core";
import { columns, isTaskStatus } from "../types";
import type { Task, TaskStatus } from "../types";
import { getDueState } from "../lib/dates";

type TaskCardProps = {
  task: Task;
  saving: boolean;
  today: string;
  onOpen: (taskId: string) => void;
  onStatusChange: (taskId: string, nextStatus: TaskStatus) => void;
};

export default function TaskCard({
  task,
  saving,
  today,
  onOpen,
  onStatusChange,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } =
    useDraggable({ id: task.id, disabled: saving });
  const due = getDueState(task, today);

  return (
    <article
      ref={setNodeRef}
      className={`task-card${isDragging ? " is-dragging" : ""}`}
      aria-busy={saving}
    >
      <div className="card-topline">
        <span className="card-kicker">{saving ? "SAVING..." : "TASK"}</span>
        <button
          ref={setActivatorNodeRef}
          className="drag-handle"
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Move ${task.title}`}
          disabled={saving}
        >
          <span aria-hidden="true">⠿</span>
        </button>
      </div>
      <h4>
        <button
          className="task-title-button"
          type="button"
          disabled={saving}
          onClick={() => onOpen(task.id)}
        >
          {task.title}
        </button>
      </h4>
      {due && <span className={`due-badge due-${due.kind}`}>{due.label}</span>}
      <div className="card-status">
        <label htmlFor={`status-${task.id}`}>Status</label>
        <select
          id={`status-${task.id}`}
          value={task.status}
          disabled={saving}
          onChange={(event) => {
            const nextStatus = event.target.value;

            if (isTaskStatus(nextStatus)) {
              onStatusChange(task.id, nextStatus);
            }
          }}
        >
          {columns.map((column) => (
            <option key={column.status} value={column.status}>
              {column.title}
            </option>
          ))}
        </select>
      </div>
    </article>
  );
}
