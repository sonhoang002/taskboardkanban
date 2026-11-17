import { useEffect, useRef, useState } from "react";
import type { SubmitEvent } from "react";
import type { Task, TaskActivity, TaskComment } from "../types";
import { columns } from "../types";
import {
  addComment,
  describeActivity,
  getTaskDetails,
} from "../lib/taskDetails";
import { getDueState } from "../lib/dates";

type TaskDetailsProps = {
  task: Task;
  today: string;
  saving: boolean;
  revision: number;
  onSave: (
    taskId: string,
    title: string,
    dueDate: string | null,
  ) => Promise<Task>;
  onClose: () => void;
};

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function TaskDetails({
  task,
  today,
  saving,
  revision,
  onSave,
  onClose,
}: TaskDetailsProps) {
  const [title, setTitle] = useState(task.title);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [body, setBody] = useState("");
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [commentError, setCommentError] = useState("");
  const [posting, setPosting] = useState(false);
  const [reloadAttempt, setReloadAttempt] = useState(0);
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const commentPending = useRef(false);
  const editPending = useRef(false);
  const due = getDueState(task, today);
  const busy = saving || posting;

  useEffect(() => {
    const element = dialog.current;
    const focused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";

    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (focused instanceof HTMLElement && focused.isConnected)
        focused.focus();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDetails() {
      setLoading(true);
      setLoadError("");
      try {
        const details = await getTaskDetails(task.id, controller.signal);
        if (!controller.signal.aborted) {
          setComments(details.comments);
          setActivity(details.activity);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setLoadError(
            requestError instanceof Error
              ? requestError.message
              : "Unable to load task details.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadDetails();
    return () => controller.abort();
  }, [task.id, revision, reloadAttempt]);

  async function handleSave(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editPending.current || busy) return;
    if (!title.trim()) {
      setSaveError("Enter a task title.");
      return;
    }

    editPending.current = true;
    setSaveError("");
    setNotice("");
    try {
      const savedTask = await onSave(task.id, title, dueDate || null);
      setTitle(savedTask.title);
      setDueDate(savedTask.due_date ?? "");
      setNotice("Changes saved.");
    } catch (requestError) {
      setSaveError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save changes.",
      );
    } finally {
      editPending.current = false;
    }
  }

  async function handleComment(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (commentPending.current || busy || loading) return;
    if (!body.trim()) {
      setCommentError("Write a comment first.");
      return;
    }

    commentPending.current = true;
    setPosting(true);
    setCommentError("");
    setNotice("");
    try {
      const comment = await addComment(task.id, body);
      setComments((previousComments) => [...previousComments, comment]);
      setBody("");
      setNotice("Comment added.");
      setReloadAttempt((previousAttempt) => previousAttempt + 1);
    } catch (requestError) {
      setCommentError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add your comment.",
      );
    } finally {
      commentPending.current = false;
      setPosting(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="task-details"
      aria-labelledby="details-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="details-header">
        <div>
          <p className="eyebrow">A CLOSER LOOK</p>
          <h2 id="details-title">Task details</h2>
        </div>
        <button
          className="text-button"
          type="button"
          aria-label="Close task details"
          disabled={busy}
          onClick={onClose}
        >
          Close
        </button>
      </header>

      <div className="details-body">
        <div className="details-badges">
          <span className="status-badge">
            {columns.find((column) => column.status === task.status)?.title}
          </span>
          {due && (
            <span className={`due-badge due-${due.kind}`}>{due.label}</span>
          )}
        </div>

        <form className="details-form" onSubmit={handleSave} aria-busy={saving}>
          <label htmlFor="detail-title">Task title</label>
          <input
            id="detail-title"
            value={title}
            disabled={busy}
            onChange={(event) => {
              setTitle(event.target.value);
              setSaveError("");
            }}
          />
          <label htmlFor="detail-due-date">Due date</label>
          <input
            id="detail-due-date"
            type="date"
            value={dueDate}
            disabled={busy}
            onChange={(event) => setDueDate(event.target.value)}
          />
          <p className="field-hint">
            Optional. Clear the date to remove the deadline.
          </p>
          <button className="primary-button" type="submit" disabled={busy}>
            {saving ? "Saving..." : "Save changes"}
          </button>
          {saveError && (
            <p className="form-error" role="alert">
              {saveError}
            </p>
          )}
        </form>

        <div className="details-section-heading">
          <h3>Conversation & history</h3>
          <button
            className="text-button"
            type="button"
            disabled={busy || loading}
            onClick={() =>
              setReloadAttempt((previousAttempt) => previousAttempt + 1)
            }
          >
            Refresh details
          </button>
        </div>
        {loading && (
          <p className="detail-loading" role="status">
            Loading comments and activity...
          </p>
        )}
        {loadError && (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        )}
        <p className="save-notice" role="status">
          {notice}
        </p>

        <section className="detail-section" aria-labelledby="comments-title">
          <h3 id="comments-title">
            Comments <span>{comments.length}</span>
          </h3>
          {!loading && !loadError && comments.length === 0 && (
            <p className="detail-empty">
              No comments yet. Leave a note for your next step.
            </p>
          )}
          <ol className="comment-list">
            {comments.map((comment) => (
              <li key={comment.id}>
                <div className="comment-meta">
                  <strong>You</strong>
                  <time dateTime={comment.created_at}>
                    {formatTime(comment.created_at)}
                  </time>
                </div>
                <p>{comment.body}</p>
              </li>
            ))}
          </ol>
          <form
            className="comment-form"
            onSubmit={handleComment}
            aria-busy={posting}
          >
            <label htmlFor="comment-body">Add a comment</label>
            <textarea
              id="comment-body"
              rows={3}
              maxLength={4000}
              placeholder="Notes, context, or a small reminder..."
              value={body}
              disabled={busy}
              onChange={(event) => {
                setBody(event.target.value);
                setCommentError("");
              }}
            />
            <div className="comment-form-footer">
              <span>{body.length}/4000</span>
              <button
                className="primary-button"
                type="submit"
                disabled={busy || loading}
              >
                {posting ? "Posting..." : "Post comment"}
              </button>
            </div>
            {commentError && (
              <p className="form-error" role="alert">
                {commentError}
              </p>
            )}
          </form>
        </section>

        <section className="detail-section" aria-labelledby="activity-title">
          <h3 id="activity-title">Activity</h3>
          {!loading && !loadError && activity.length === 0 && (
            <p className="detail-empty">
              No recorded activity yet. New changes will appear here.
            </p>
          )}
          <ol className="activity-list">
            {activity.map((entry) => (
              <li key={entry.id}>
                <p>{describeActivity(entry)}</p>
                <time dateTime={entry.created_at}>
                  {formatTime(entry.created_at)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </dialog>
  );
}
