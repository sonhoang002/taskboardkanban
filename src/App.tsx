import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { columns, isTaskStatus } from "./types";
import type { TaskStatus, Task } from "./types";
import { BoardColumn } from "./components/BoardColumn";
import BoardSummary from "./components/BoardSummary";
import TaskDetails from "./components/TaskDetails";
import { ensureGuestSession } from "./lib/auth";
import {
  createTask,
  getTasks,
  updateTaskDetails,
  updateTaskStatus,
} from "./lib/tasks";
import { useToday } from "./lib/useToday";
import "./App.css";

type AuthState =
  | { status: "loading" }
  | { status: "ready"; userId: string }
  | { status: "error"; message: string };

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState("");
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detailsRevision, setDetailsRevision] = useState(0);
  const today = useToday();
  const [error, setError] = useState("");
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const [authAttempt, setAuthAttempt] = useState(0);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const submitPending = useRef(false);
  const savingTasks = useRef(new Set<string>());
  const titleInput = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 160, tolerance: 6 },
    }),
    useSensor(KeyboardSensor),
  );

  const userId = auth.status === "ready" ? auth.userId : null;
  const busy = submitting || savingIds.length > 0 || activeTask !== null;
  const selectedTask = tasks.find((task) => task.id === selectedTaskId);

  useEffect(() => {
    let ignore = false;

    ensureGuestSession()
      .then((sessionUserId) => {
        if (!ignore) {
          setAuth({ status: "ready", userId: sessionUserId });
        }
      })
      .catch((requestError: unknown) => {
        if (!ignore) {
          setAuth({
            status: "error",
            message:
              requestError instanceof Error
                ? requestError.message
                : "Unable to start your guest session.",
          });
        }
      });

    return () => {
      ignore = true;
    };
  }, [authAttempt]);

  useEffect(() => {
    if (!userId) return;

    const controller = new AbortController();

    async function loadTasks(currentUserId: string) {
      setTasksLoading(true);
      setTasksError("");

      try {
        const savedTasks = await getTasks(currentUserId, controller.signal);

        if (!controller.signal.aborted) {
          setTasks(savedTasks);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setTasksError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load your tasks. Try again.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setTasksLoading(false);
        }
      }
    }

    void loadTasks(userId);

    return () => {
      controller.abort();
    };
  }, [userId, loadAttempt]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitPending.current || tasksLoading || !userId) return;

    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      setError("Enter a task title.");
      titleInput.current?.focus();
      return;
    }

    submitPending.current = true;
    setSubmitting(true);
    setError("");

    try {
      const task = await createTask(trimmedTitle, dueDate || null);
      setTasks((previousTasks) => [...previousTasks, task]);
      setTitle("");
      setDueDate("");
      setAnnouncement("Task added to To Do.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save this task. Refresh before trying again.",
      );
    } finally {
      submitPending.current = false;
      setSubmitting(false);
    }
  }

  async function handleStatusChange(taskId: string, nextStatus: TaskStatus) {
    if (!userId || tasksLoading || savingTasks.current.has(taskId)) return;

    const previousTask = tasks.find((task) => task.id === taskId);

    if (!previousTask || previousTask.status === nextStatus) return;

    savingTasks.current.add(taskId);
    setSavingIds((previousIds) => [...previousIds, taskId]);
    setTasksError("");
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === taskId ? { ...task, status: nextStatus } : task,
      ),
    );

    try {
      const savedTask = await updateTaskStatus(taskId, userId, nextStatus);

      setTasks((previousTasks) =>
        previousTasks.map((task) => (task.id === taskId ? savedTask : task)),
      );
      setAnnouncement(
        `Task moved to ${columns.find((column) => column.status === nextStatus)?.title}.`,
      );
      setDetailsRevision((previousRevision) => previousRevision + 1);
    } catch (requestError) {
      setTasks((previousTasks) =>
        previousTasks.map((task) => (task.id === taskId ? previousTask : task)),
      );
      setTasksError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the move. The previous status has been restored.",
      );
    } finally {
      savingTasks.current.delete(taskId);
      setSavingIds((previousIds) => previousIds.filter((id) => id !== taskId));
    }
  }

  async function handleDetailsSave(
    taskId: string,
    nextTitle: string,
    nextDueDate: string | null,
  ): Promise<Task> {
    if (!userId || tasksLoading || savingTasks.current.has(taskId)) {
      throw new Error("Wait for the current save to finish, then try again.");
    }

    savingTasks.current.add(taskId);
    setSavingIds((previousIds) => [...previousIds, taskId]);
    try {
      const savedTask = await updateTaskDetails(
        taskId,
        userId,
        nextTitle,
        nextDueDate,
      );
      setTasks((previousTasks) =>
        previousTasks.map((task) => (task.id === taskId ? savedTask : task)),
      );
      setDetailsRevision((previousRevision) => previousRevision + 1);
      return savedTask;
    } finally {
      savingTasks.current.delete(taskId);
      setSavingIds((previousIds) => previousIds.filter((id) => id !== taskId));
    }
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((task) => task.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);

    if (event.over && isTaskStatus(event.over.id)) {
      void handleStatusChange(String(event.active.id), event.over.id);
    }
  }

  function handleRefresh() {
    if (submitPending.current || savingTasks.current.size > 0 || activeTask)
      return;
    setTasksLoading(true);
    setTasksError("");
    setLoadAttempt((previousAttempt) => previousAttempt + 1);
  }

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            <span className="brand-mark" aria-hidden="true" />
            YOUR PERSONAL WORKSPACE
          </p>
          <h1>
            Task Board<span className="heading-dot">.</span>
          </h1>
          <p className="page-description">A little structure. A clearer day.</p>
        </div>
        <span className="guest-badge">
          <span aria-hidden="true" />
          Guest workspace
        </span>
      </header>

      {auth.status === "loading" && (
        <section className="state-panel" role="status">
          <span className="loading-indicator" aria-hidden="true" />
          <h2>Making room for your ideas</h2>
          <p>Starting your guest session...</p>
        </section>
      )}

      {auth.status === "error" && (
        <section className="state-panel">
          <h2>Couldn’t open your workspace</h2>
          <p role="alert">{auth.message}</p>
          <button
            className="primary-button"
            onClick={() => {
              setAuth({ status: "loading" });
              setAuthAttempt((previousAttempt) => previousAttempt + 1);
            }}
          >
            Try again
          </button>
        </section>
      )}

      {auth.status === "ready" && (
        <>
          <form
            className="task-form"
            onSubmit={handleSubmit}
            aria-busy={submitting}
          >
            <label htmlFor="task-title">What’s next?</label>
            <div className="task-form-controls">
              <input
                ref={titleInput}
                id="task-title"
                value={title}
                placeholder="Give your next task a name..."
                disabled={submitting || tasksLoading}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "task-error" : undefined}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setError("");
                }}
              />
              <button
                className="primary-button"
                type="submit"
                disabled={submitting || tasksLoading}
              >
                <span aria-hidden="true">+</span>
                {submitting ? "Adding..." : "Add task"}
              </button>
            </div>
            <div className="task-form-date">
              <label htmlFor="task-due-date">
                Due date <span>(optional)</span>
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                disabled={submitting || tasksLoading}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </div>
            {error && (
              <p id="task-error" className="form-error" role="alert">
                {error}
              </p>
            )}
          </form>

          {!tasksLoading && !(tasksError && tasks.length === 0) && (
            <BoardSummary tasks={tasks} today={today} />
          )}

          <div className="board-toolbar">
            <div>
              <h2>Your board</h2>
              <p id="board-help">
                Drag a card by its handle or choose a status to move it.
              </p>
            </div>
            <button
              className="text-button"
              type="button"
              disabled={tasksLoading || busy}
              onClick={handleRefresh}
            >
              Refresh board
            </button>
          </div>

          {tasksError && (
            <div className="error-banner">
              <p role="alert">{tasksError}</p>
              <button
                className="text-button"
                type="button"
                disabled={tasksLoading || busy}
                onClick={handleRefresh}
              >
                Try again
              </button>
            </div>
          )}

          {tasksLoading ? (
            <section className="state-panel board-loading" role="status">
              <span className="loading-indicator" aria-hidden="true" />
              <p>Loading your tasks...</p>
            </section>
          ) : tasksError && tasks.length === 0 ? (
            <section className="state-panel">
              <h2>Your board is unavailable</h2>
              <p>Try refreshing to load your saved tasks.</p>
            </section>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={rectIntersection}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveTask(null)}
            >
              <div className="board" aria-describedby="board-help">
                {columns.map((column) => (
                  <BoardColumn
                    key={column.status}
                    status={column.status}
                    title={column.title}
                    tasks={tasks.filter(
                      (task) => task.status === column.status,
                    )}
                    savingIds={savingIds}
                    today={today}
                    onOpen={setSelectedTaskId}
                    onStatusChange={handleStatusChange}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={null}>
                {activeTask && (
                  <article className="task-card drag-preview">
                    <p className="card-kicker">MOVING TASK</p>
                    <h3>{activeTask.title}</h3>
                  </article>
                )}
              </DragOverlay>
            </DndContext>
          )}

          <footer className="board-footer">
            <span>Just your tasks. Just your pace.</span>
            <span>Your guest session stays in this browser.</span>
          </footer>
          {selectedTask && (
            <TaskDetails
              key={selectedTask.id}
              task={selectedTask}
              today={today}
              saving={savingIds.includes(selectedTask.id)}
              revision={detailsRevision}
              onSave={handleDetailsSave}
              onClose={() => setSelectedTaskId(null)}
            />
          )}
        </>
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </main>
  );
}

export default App;
