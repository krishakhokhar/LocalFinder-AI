import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Inbox, Mail, MailOpen } from "lucide-react";
import AdminLayout from "./AdminLayout";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Pagination from "../../components/common/Pagination";
import Skeleton from "../../components/common/Skeleton";
import { Select, Textarea } from "../../components/common/Field";
import adminApi from "../../services/adminApi";
import { formatRelative } from "../../utils/format";

const FILTERS = [
  { key: "new", label: "New" },
  { key: "in_progress", label: "In progress" },
  { key: "closed", label: "Closed" },
  { key: "", label: "All" },
];

const STATUS_TONE = { new: "brand", in_progress: "warning", closed: "neutral" };

export default function AdminContacts() {
  const [filter, setFilter] = useState("new");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ contacts: [], pages: 1, total: 0 });
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState("in_progress");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await adminApi.contacts({ status: filter || undefined, page, limit: 20 }));
    } catch (requestError) {
      setError(requestError.message || "Could not load messages.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    adminApi
      .overview()
      .then((result) => setCounts(result.totals))
      .catch(() => {});
  }, [data.total]);

  const save = async () => {
    setWorking(true);
    try {
      await adminApi.updateContact(editing._id, { status, internalNote: note.trim() || undefined });
      toast.success("Message updated");
      setEditing(null);
      setNote("");
      await load();
    } catch (saveError) {
      toast.error(saveError.message || "Could not update that message");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AdminLayout title="Messages" description="Enquiries sent through the contact form." counts={counts}>
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.key || "all"}
            type="button"
            onClick={() => {
              setFilter(item.key);
              setPage(1);
            }}
            aria-pressed={filter === item.key}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === item.key
                ? "border-ink bg-ink text-white"
                : "border-line bg-surface text-ink-muted hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {loading ? (
          Array.from({ length: 4 }, (unused, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-card" />
          ))
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : data.contacts.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No messages here"
            description="The inbox is clear."
            className="rounded-card border border-dashed border-line bg-surface"
          />
        ) : (
          data.contacts.map((contact) => (
            <article key={contact._id} className="rounded-card border border-line bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{contact.name}</span>
                    <Badge tone={STATUS_TONE[contact.status]} size="xs">
                      {contact.status.replace("_", " ")}
                    </Badge>
                    <span className="text-xs text-ink-faint">{formatRelative(contact.createdAt)}</span>
                  </div>
                  <a
                    href={`mailto:${contact.email}`}
                    className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-700 hover:underline"
                  >
                    <Mail className="h-3 w-3" aria-hidden="true" />
                    {contact.email}
                  </a>
                  {contact.subject ? (
                    <p className="mt-1 text-sm font-semibold text-ink-soft">{contact.subject}</p>
                  ) : null}
                </div>

                <Button
                  variant="outline"
                  size="xs"
                  icon={MailOpen}
                  onClick={() => {
                    setEditing(contact);
                    setStatus(contact.status === "new" ? "in_progress" : contact.status);
                    setNote(contact.internalNote || "");
                  }}
                >
                  Handle
                </Button>
              </div>

              <p className="mt-2.5 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-ink-soft">
                {contact.message}
              </p>

              {contact.internalNote ? (
                <p className="mt-2 text-xs text-ink-faint">Internal note: {contact.internalNote}</p>
              ) : null}
            </article>
          ))
        )}
      </div>

      <Pagination page={page} pages={data.pages} onChange={setPage} className="mt-6" />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Handle this message"
        description={editing?.email}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={working}>
              Save
            </Button>
          </>
        }
      >
        <Select
          label="Status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          options={[
            { value: "new", label: "New" },
            { value: "in_progress", label: "In progress" },
            { value: "closed", label: "Closed" },
          ]}
          data-autofocus
        />
        <Textarea
          label="Internal note"
          className="mt-4"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          hint="Only visible to admins. Replies go by email."
        />
        {editing ? (
          <Button
            href={`mailto:${editing.email}?subject=${encodeURIComponent(
              `Re: ${editing.subject || "Your message to LocalFinder"}`
            )}`}
            variant="outline"
            size="sm"
            icon={Mail}
            className="mt-4"
          >
            Reply by email
          </Button>
        ) : null}
      </Modal>
    </AdminLayout>
  );
}
