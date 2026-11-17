import type { Task } from "../types";
import { getBoardSummary } from "../lib/dates";

type BoardSummaryProps = {
  tasks: Task[];
  today: string;
};

export default function BoardSummary({ tasks, today }: BoardSummaryProps) {
  const summary = getBoardSummary(tasks, today);

  return (
    <section className="board-summary" aria-label="Board summary">
      <dl>
        <div>
          <dt>Total tasks</dt>
          <dd>{summary.total}</dd>
        </div>
        <div>
          <dt>Completed</dt>
          <dd>{summary.completed}</dd>
        </div>
        <div className={summary.overdue > 0 ? "has-overdue" : ""}>
          <dt>Overdue</dt>
          <dd>{summary.overdue}</dd>
        </div>
      </dl>
      <p>Overdue counts unfinished tasks due before today.</p>
    </section>
  );
}
