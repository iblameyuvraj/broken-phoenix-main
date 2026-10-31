"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, describeError } from "@/lib/api";
import type { Project, Task, TaskPage, TaskStatus } from "@/lib/types";

const PAGE_SIZE = 10;

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

function formatDate(iso: string) {
  return format(new Date(iso), "dd MMM yyyy, HH:mm");
}

function TaskBoard({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TaskPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    api<Project>(`/api/projects/${id}`, { signal: controller.signal })
      .then(setProject)
      .catch((err) => {
        if ((err as Error)?.name !== "AbortError") setError(describeError(err));
      });
    return () => controller.abort();
  }, [id]);

  // One effect owns loading the page: the newest request wins, older ones are aborted.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
      if (query) params.set("q", query);
      if (status) params.set("status", status);
      setLoading(true);
      try {
        const result = await api<TaskPage>(`/api/projects/${id}/tasks?${params}`, {
          signal: controller.signal,
        });
        setData(result);
        setError(null);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        // A failure is not an empty result: say what went wrong instead of "No tasks match."
        setData(null);
        setError(describeError(err));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [id, query, status, page, reloadTick]);

  // Re-run the query above after a successful write.
  const reload = useCallback(() => setReloadTick((n) => n + 1), []);

  // Changing a filter always goes back to page 1.
  function changeQuery(value: string) {
    setQuery(value);
    setPage(1);
  }

  function changeStatus(value: TaskStatus | "") {
    setStatus(value);
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      {project && (
        <p>
          <Link href={`/workspaces/${project.workspace_id}`}>← Back to workspace</Link>
        </p>
      )}
      <h1>{project?.name ?? "Project"}</h1>
      <NewTaskForm projectId={id} onCreated={reload} />
      <div className="row">
        <input
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => changeQuery(e.target.value)}
          aria-label="Search tasks"
        />
        <select
          value={status}
          onChange={(e) => changeStatus(e.target.value as TaskStatus | "")}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!error && loading && data === null && <p className="muted">Loading…</p>}
      {!error && !loading && data?.items.length === 0 && <p className="muted">No tasks match.</p>}

      {!error && data && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t: Task) => (
              <tr key={t.id}>
                <td className="small">{t.id.slice(-6)}</td>
                <td>{t.title}</td>
                <td>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </td>
                <td className="small">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row pager">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages} {data && <span className="muted">({data.total} tasks)</span>}
        </span>
        <button
          className="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}

function NewTaskForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One key per pending submission: a retry of the same click can never charge twice.
  const keyRef = useRef<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return; // fast fingers: the first click is the only one that counts
    setBusy(true);
    setError(null);
    keyRef.current ??= crypto.randomUUID();
    try {
      await api(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: { title },
        headers: { "Idempotency-Key": keyRef.current },
      });
      keyRef.current = null;
      setTitle("");
      onCreated();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="row">
      <input
        placeholder="New task title (costs 1 credit)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button disabled={busy}>{busy ? "Creating…" : "Create task"}</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <TaskBoard id={id} />
    </RequireAuth>
  );
}
