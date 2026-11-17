import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Plus, Tags, Trash2 } from "lucide-react";
import AdminLayout from "./AdminLayout";
import Button from "../../components/common/Button";
import Badge from "../../components/common/Badge";
import Modal from "../../components/common/Modal";
import EmptyState from "../../components/common/EmptyState";
import ErrorState from "../../components/common/ErrorState";
import Skeleton from "../../components/common/Skeleton";
import { Checkbox, Input, Textarea } from "../../components/common/Field";
import adminApi from "../../services/adminApi";
import { categoryConfig } from "../../utils/categories";

const BLANK = { key: "", label: "", description: "", icon: "store", order: 100, active: true };

/**
 * Category management.
 *
 * A category in use cannot be deleted - the server refuses it, because
 * deleting one would leave those listings in a category that no longer
 * exists and silently drop them out of every filtered search.
 * Deactivating hides it from the filter rail without orphaning anything.
 */
export default function AdminCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [working, setWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.categories();
      setCategories(data.categories);
    } catch (requestError) {
      setError(requestError.message || "Could not load categories.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setWorking(true);
    try {
      if (editing?._id) {
        await adminApi.updateCategory(editing._id, {
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          icon: form.icon.trim() || undefined,
          order: Number(form.order) || 100,
          active: form.active,
        });
        toast.success("Category updated");
      } else {
        await adminApi.createCategory({
          key: form.key.trim().toLowerCase(),
          label: form.label.trim(),
          description: form.description.trim() || undefined,
          icon: form.icon.trim() || undefined,
          order: Number(form.order) || 100,
          active: form.active,
        });
        toast.success("Category created");
      }
      setEditing(null);
      setForm(BLANK);
      await load();
    } catch (saveError) {
      toast.error(saveError.message || "Could not save that category");
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    try {
      await adminApi.deleteCategory(confirmDelete._id);
      toast.success("Category deleted");
      setConfirmDelete(null);
      await load();
    } catch (deleteError) {
      toast.error(deleteError.message || "Could not delete that category");
      setConfirmDelete(null);
    }
  };

  return (
    <AdminLayout
      title="Categories"
      description="What businesses can list themselves under, and what customers can filter by."
      actions={
        <Button
          size="sm"
          icon={Plus}
          onClick={() => {
            setEditing({});
            setForm(BLANK);
          }}
        >
          New category
        </Button>
      }
    >
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (unused, index) => (
            <Skeleton key={index} className="h-16 w-full rounded-card" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title="No categories yet"
          description="Run the seed script, or create the first one here."
          className="rounded-card border border-dashed border-line bg-surface"
        />
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface">
          {categories.map((category) => {
            const config = categoryConfig(category.key);
            const Icon = config.icon;

            return (
              <li key={category._id} className="flex flex-wrap items-center gap-3 p-4">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${config.tint}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{category.label}</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-2xs text-ink-muted">
                      {category.key}
                    </code>
                    {!category.active ? (
                      <Badge tone="neutral" size="xs">
                        Hidden
                      </Badge>
                    ) : null}
                    {category.supportsExternalSearch ? (
                      <Badge tone="brand" size="xs">
                        Map search
                      </Badge>
                    ) : null}
                  </div>
                  {category.description ? (
                    <p className="mt-0.5 text-xs text-ink-muted">{category.description}</p>
                  ) : null}
                  <p className="mt-0.5 text-2xs text-ink-faint">
                    {category.businessCount} live listing{category.businessCount === 1 ? "" : "s"}
                  </p>
                </div>

                <div className="flex shrink-0 gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setEditing(category);
                      setForm({
                        key: category.key,
                        label: category.label,
                        description: category.description || "",
                        icon: category.icon || "store",
                        order: category.order ?? 100,
                        active: category.active,
                      });
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="dangerGhost"
                    size="xs"
                    icon={Trash2}
                    disabled={category.businessCount > 0}
                    title={
                      category.businessCount > 0
                        ? "In use by live listings - deactivate it instead"
                        : "Delete this category"
                    }
                    onClick={() => setConfirmDelete(category)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?._id ? `Edit ${editing.label}` : "New category"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={working} disabled={form.label.trim().length < 2}>
              Save
            </Button>
          </>
        }
      >
        {!editing?._id ? (
          <Input
            label="Key"
            value={form.key}
            onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))}
            placeholder="e.g. tutoring"
            hint="Lowercase letters, numbers, - or _. Cannot be changed later."
            required
            data-autofocus
          />
        ) : null}

        <Input
          label="Label"
          className="mt-4"
          value={form.label}
          onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
          placeholder="What customers see"
          required
        />

        <Textarea
          label="Description"
          className="mt-4"
          rows={2}
          value={form.description}
          onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          maxLength={300}
        />

        <Input
          label="Sort order"
          className="mt-4"
          type="number"
          min="0"
          max="999"
          value={form.order}
          onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
          hint="Lower numbers appear first."
        />

        <Checkbox
          className="mt-4"
          label="Visible to customers"
          description="Hidden categories stay attached to existing listings but disappear from the filter rail."
          checked={form.active}
          onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
        />

        {!editing?._id ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-ink-muted">
            New categories cover registered businesses only. Searching OpenStreetMap for a new
            category needs a tag mapping added in the backend.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.label}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">
          This removes the category entirely. It is only possible because no live listing uses it.
        </p>
      </Modal>
    </AdminLayout>
  );
}
