import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Search, Shield, ShieldCheck, ShieldOff, Store, UserRound, Users } from "lucide-react";
import AdminLayout from "./AdminLayout";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import Avatar from "../../components/common/Avatar";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Pagination from "../../components/common/Pagination";
import Skeleton from "../../components/common/Skeleton";
import { Select, Textarea } from "../../components/common/Field";
import adminApi from "../../services/adminApi";
import useDebounce from "../../hooks/useDebounce";
import { useAuth } from "../../context/AuthContext";
import { formatRelative } from "../../utils/format";

const ROLES = [
  { key: "", label: "All" },
  { key: "customer", label: "Customers" },
  { key: "owner", label: "Owners" },
  { key: "admin", label: "Admins" },
];

const ROLE_TONE = { customer: "neutral", owner: "brand", admin: "ai" };

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [role, setRole] = useState("");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 350);
  const [page, setPage] = useState(1);

  const [data, setData] = useState({ users: [], pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [nextRole, setNextRole] = useState("customer");
  const [reason, setReason] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(
        await adminApi.users({ role: role || undefined, q: debouncedQuery || undefined, page, limit: 20 })
      );
    } catch (requestError) {
      setError(requestError.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, [role, debouncedQuery, page]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRole = async () => {
    setWorking(true);
    try {
      await adminApi.updateUser(editing._id, { role: nextRole });
      toast.success(`${editing.name} is now a ${nextRole}`);
      setEditing(null);
      await load();
    } catch (saveError) {
      toast.error(saveError.message || "Could not change that role");
    } finally {
      setWorking(false);
    }
  };

  const toggleActive = async (user) => {
    if (user.isActive && !reason.trim()) {
      setEditing({ ...user, mode: "deactivate" });
      return;
    }
    setWorking(true);
    try {
      await adminApi.updateUser(user._id, {
        isActive: !user.isActive,
        reason: reason.trim() || undefined,
      });
      toast.success(user.isActive ? "Account deactivated" : "Account restored");
      setEditing(null);
      setReason("");
      await load();
    } catch (toggleError) {
      toast.error(toggleError.message || "Could not update that account");
    } finally {
      setWorking(false);
    }
  };

  return (
    <AdminLayout title="Users" description={`${data.total} account${data.total === 1 ? "" : "s"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {ROLES.map((item) => (
            <button
              key={item.key || "all"}
              type="button"
              onClick={() => {
                setRole(item.key);
                setPage(1);
              }}
              aria-pressed={role === item.key}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                role === item.key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface text-ink-muted hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="relative ml-auto min-w-[12rem] flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search name or email"
            aria-label="Search users"
            className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink-soft placeholder:text-ink-faint focus:border-brand-600 focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (unused, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        ) : data.users.length === 0 ? (
          <EmptyState icon={Users} title="No users match that" description="Try a different filter." />
        ) : (
          <ul className="divide-y divide-line">
            {data.users.map((user) => {
              const isSelf = String(user._id) === String(currentUser?._id);

              return (
                <li key={user._id} className="flex flex-wrap items-center gap-3 p-4">
                  <Avatar name={user.name} email={user.email} src={user.avatarUrl} size="sm" />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-ink">{user.name}</span>
                      <Badge tone={ROLE_TONE[user.role]} size="xs">
                        {user.role}
                      </Badge>
                      {isSelf ? (
                        <Badge tone="brand" size="xs">
                          You
                        </Badge>
                      ) : null}
                      {!user.isActive ? (
                        <Badge tone="danger" size="xs">
                          Deactivated
                        </Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-ink-muted">{user.email}</p>
                    <p className="mt-0.5 text-2xs text-ink-faint">
                      Joined {formatRelative(user.createdAt)}
                      {user.lastLoginAt ? ` · last seen ${formatRelative(user.lastLoginAt)}` : ""}
                      {user.businessCount > 0 ? ` · ${user.businessCount} listing(s)` : ""}
                      {user.reviewCount > 0 ? ` · ${user.reviewCount} review(s)` : ""}
                    </p>
                    {user.suspendedReason ? (
                      <p className="mt-1 text-2xs text-danger-600">Reason: {user.suspendedReason}</p>
                    ) : null}
                  </div>

                  {/* An admin cannot act on their own account here - the
                      server refuses it too, to avoid locking the last
                      admin out of the platform. */}
                  {isSelf ? (
                    <span className="text-xs text-ink-faint">Manage in account settings</span>
                  ) : (
                    <div className="flex shrink-0 gap-1.5">
                      <Button
                        variant="outline"
                        size="xs"
                        icon={user.role === "admin" ? ShieldCheck : user.role === "owner" ? Store : UserRound}
                        onClick={() => {
                          setEditing({ ...user, mode: "role" });
                          setNextRole(user.role);
                        }}
                      >
                        Role
                      </Button>
                      <Button
                        variant={user.isActive ? "dangerGhost" : "outline"}
                        size="xs"
                        icon={user.isActive ? ShieldOff : Shield}
                        onClick={() => toggleActive(user)}
                        loading={working && editing?._id === user._id}
                      >
                        {user.isActive ? "Deactivate" : "Restore"}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Pagination page={page} pages={data.pages} onChange={setPage} className="mt-6" />

      <Modal
        open={editing?.mode === "role"}
        onClose={() => setEditing(null)}
        title={`Change role for ${editing?.name || ""}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={saveRole} loading={working} disabled={nextRole === editing?.role}>
              Save role
            </Button>
          </>
        }
      >
        <Select
          label="Role"
          value={nextRole}
          onChange={(event) => setNextRole(event.target.value)}
          options={[
            { value: "customer", label: "Customer - can search, save, review and book" },
            { value: "owner", label: "Business owner - can also list and manage businesses" },
            { value: "admin", label: "Admin - full access to this dashboard" },
          ]}
          data-autofocus
        />
        {nextRole === "admin" ? (
          <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
            Admins can approve listings, moderate reviews and deactivate accounts. Only grant this to
            people who need it.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={editing?.mode === "deactivate"}
        onClose={() => {
          setEditing(null);
          setReason("");
        }}
        title={`Deactivate ${editing?.name || ""}?`}
        description="They will be signed out and unable to sign in again."
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => toggleActive({ ...editing, isActive: true })}
              loading={working}
              disabled={reason.trim().length < 3}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <Textarea
          label="Reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={300}
          required
          hint="Sent to the user as a notification."
          data-autofocus
        />
      </Modal>
    </AdminLayout>
  );
}
