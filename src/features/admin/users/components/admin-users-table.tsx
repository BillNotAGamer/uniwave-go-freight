"use client";

import { useActionState, useId, useState } from "react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import {
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";

import { RoleBadge } from "@/components/ui/role-badge";
import { ROLE_LABELS, ROLES } from "@/lib/permissions/roles";

import {
  changeAdminUserRoleAction,
  changeOwnPasswordAction,
  createAdminUserAction,
  deactivateAdminUserAction,
  reactivateAdminUserAction,
  revokeAdminUserSessionsAction,
  setAdminUserTemporaryPasswordAction,
  softDeleteAdminUserAction,
  type AdminUserActionResult,
} from "../actions";
import type { AdminUserListItem } from "../types";
import { ADMIN_USER_CREATABLE_ROLES } from "../validators";
import {
  getPasswordInputType,
  INITIAL_PASSWORD_VISIBILITY,
  togglePasswordVisibility,
} from "../password-visibility";
import {
  getAdminUserRowActionPolicy,
} from "../ui-policy";

const initialActionState: AdminUserActionResult = {
  ok: true,
  message: "",
};

function formatDateTime(value: Date | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function AccountStatusBadge({
  status,
}: {
  status: AdminUserListItem["accountStatus"];
}) {
  const className = {
    active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border dark:border-emerald-900/60",
    inactive: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-900/60",
    deleted: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:border dark:border-slate-700",
  }[status];

  const label = {
    active: "Active",
    inactive: "Inactive",
    deleted: "Deleted",
  }[status];

  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {label}
    </span>
  );
}

function SubmitButton({
  children,
  pendingLabel,
  tone = "secondary",
  icon,
}: {
  children: ReactNode;
  pendingLabel: string;
  tone?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
}) {
  const { pending } = useFormStatus();
  const toneClass = {
    primary: "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-500 dark:border-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400",
    secondary: "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:disabled:bg-slate-950 dark:disabled:text-slate-600",
    danger: "border-red-600 bg-red-600 text-white hover:bg-red-500 dark:border-red-700 dark:bg-red-700 dark:hover:bg-red-600",
  }[tone];

  return (
    <button
      className={`inline-flex w-fit items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${toneClass}`}
      disabled={pending}
      type="submit"
    >
      {icon}
      {pending ? pendingLabel : children}
    </button>
  );
}

function ActionMessage({
  state,
}: {
  state: AdminUserActionResult;
}) {
  if (!state.ok) {
    return (
      <p className="text-sm text-red-700 dark:text-red-400" role="alert">
        {state.error}
      </p>
    );
  }

  if (!state.message) {
    return null;
  }

  return (
    <p className="text-sm text-emerald-700 dark:text-emerald-400" role="status">
      {state.message}
    </p>
  );
}

function TextInput({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <input
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
    </label>
  );
}

function PasswordInput({
  autoComplete,
  label,
  name,
  required,
}: {
  autoComplete: "current-password" | "new-password";
  label: string;
  name: string;
  required?: boolean;
}) {
  const [visibility, setVisibility] = useState(INITIAL_PASSWORD_VISIBILITY);
  const inputId = useId();
  const visible = visibility === "visible";
  const visibilityLabel = `${visible ? "Hide" : "Show"} ${label.toLowerCase()}`;

  return (
    <div className="flex min-w-0 flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
      <label htmlFor={inputId}>{label}</label>
      <span className="relative block">
        <input
          autoComplete={autoComplete}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 pr-10 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
          id={inputId}
          name={name}
          required={required}
          type={getPasswordInputType(visibility)}
        />
        <button
          aria-label={visibilityLabel}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-slate-500 outline-none hover:text-slate-800 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-slate-400 dark:hover:text-slate-100"
          onClick={() => setVisibility(togglePasswordVisibility)}
          type="button"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="h-4 w-4" />
          ) : (
            <Eye aria-hidden="true" className="h-4 w-4" />
          )}
        </button>
      </span>
    </div>
  );
}

function ReasonInput({
  required,
}: {
  required?: boolean;
}) {
  return (
    <TextInput
      label="Reason"
      name="reason"
      placeholder={required ? "Required" : "Optional"}
      required={required}
    />
  );
}

function CreateUserForm() {
  const [state, action] = useActionState(createAdminUserAction, initialActionState);

  return (
    <form action={action} className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_180px_1fr_auto] lg:items-end">
        <TextInput label="Name" name="name" required />
        <TextInput label="Email" name="email" required type="email" />
        <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
          Role
          <select
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
            name="role"
            required
          >
            {ADMIN_USER_CREATABLE_ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </label>
        <PasswordInput
          autoComplete="new-password"
          label="Temporary password"
          name="temporaryPassword"
          required
        />
        <SubmitButton
          icon={<UserPlus className="h-4 w-4" />}
          pendingLabel="Creating..."
          tone="primary"
        >
          Create
        </SubmitButton>
      </div>
      <div className="mt-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function RoleChangeForm({
  item,
}: {
  item: AdminUserListItem;
}) {
  const [state, action] = useActionState(changeAdminUserRoleAction, initialActionState);
  const roleOptions = item.role === "admin"
    ? ROLES
    : ADMIN_USER_CREATABLE_ROLES;

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[160px_1fr_auto] md:items-end">
      <input name="id" type="hidden" value={item.id} />
      <label className="flex flex-col gap-1 text-sm font-medium text-slate-700 dark:text-slate-200">
        Role
        <select
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-900 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:ring-indigo-500/20"
          defaultValue={item.role}
          name="role"
          required
        >
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>
      <ReasonInput />
      <SubmitButton
        icon={<ShieldCheck className="h-4 w-4" />}
        pendingLabel="Updating..."
      >
        Change role
      </SubmitButton>
      <div className="md:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function DeactivateForm({ item }: { item: AdminUserListItem }) {
  const [state, action] = useActionState(deactivateAdminUserAction, initialActionState);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
      <input name="id" type="hidden" value={item.id} />
      <ReasonInput required />
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 md:col-span-2">
        <input
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
          name="confirmation"
          required
          type="checkbox"
          value="confirmed"
        />
        Confirm deactivation and session revocation
      </label>
      <SubmitButton
        icon={<PauseCircle className="h-4 w-4" />}
        pendingLabel="Deactivating..."
      >
        Deactivate
      </SubmitButton>
      <div className="md:col-span-2">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function ReactivateForm({ item }: { item: AdminUserListItem }) {
  const [state, action] = useActionState(reactivateAdminUserAction, initialActionState);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
      <input name="id" type="hidden" value={item.id} />
      <ReasonInput />
      <SubmitButton
        icon={<RotateCcw className="h-4 w-4" />}
        pendingLabel="Reactivating..."
      >
        Reactivate
      </SubmitButton>
      <div className="md:col-span-2">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function SoftDeleteForm({ item }: { item: AdminUserListItem }) {
  const [state, action] = useActionState(softDeleteAdminUserAction, initialActionState);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
      <input name="id" type="hidden" value={item.id} />
      <ReasonInput required />
      <p className="text-sm text-slate-600 dark:text-slate-400 md:col-span-2">
        Account can no longer sign in, sessions are revoked, history remains, and restore is not available.
      </p>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 md:col-span-2">
        <input
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
          name="confirmation"
          required
          type="checkbox"
          value="confirmed"
        />
        Confirm soft delete
      </label>
      <SubmitButton
        icon={<Trash2 className="h-4 w-4" />}
        pendingLabel="Deleting..."
        tone="danger"
      >
        Soft delete
      </SubmitButton>
      <div className="md:col-span-2">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function RevokeSessionsForm({ item }: { item: AdminUserListItem }) {
  const [state, action] = useActionState(revokeAdminUserSessionsAction, initialActionState);

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
      <input name="id" type="hidden" value={item.id} />
      <ReasonInput required />
      <SubmitButton
        icon={<LogOut className="h-4 w-4" />}
        pendingLabel="Revoking..."
      >
        Revoke sessions
      </SubmitButton>
      <div className="md:col-span-2">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function PasswordForm({ item }: { item: AdminUserListItem }) {
  const [state, action] = useActionState(
    setAdminUserTemporaryPasswordAction,
    initialActionState,
  );

  return (
    <form action={action} className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
      <input name="id" type="hidden" value={item.id} />
      <PasswordInput
        autoComplete="new-password"
        label="Temporary password"
        name="temporaryPassword"
        required
      />
      <ReasonInput required />
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 md:col-span-3">
        <input
          className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 dark:bg-slate-950"
          name="confirmation"
          required
          type="checkbox"
          value="confirmed"
        />
        Confirm password update and session revocation
      </label>
      <SubmitButton
        icon={<KeyRound className="h-4 w-4" />}
        pendingLabel="Updating..."
      >
        Set password
      </SubmitButton>
      <div className="md:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function ChangeOwnPasswordForm() {
  const [state, action] = useActionState(
    changeOwnPasswordAction,
    initialActionState,
  );

  return (
    <form action={action} className="grid gap-3 md:grid-cols-3 md:items-end">
      <PasswordInput
        autoComplete="current-password"
        label="Current password"
        name="currentPassword"
        required
      />
      <PasswordInput
        autoComplete="new-password"
        label="New password"
        name="newPassword"
        required
      />
      <PasswordInput
        autoComplete="new-password"
        label="Confirm new password"
        name="confirmNewPassword"
        required
      />
      <SubmitButton
        icon={<KeyRound className="h-4 w-4" />}
        pendingLabel="Changing..."
        tone="primary"
      >
        Change my password
      </SubmitButton>
      <div className="md:col-span-3">
        <ActionMessage state={state} />
      </div>
    </form>
  );
}

function UserActions({
  item,
  actorUserId,
}: {
  item: AdminUserListItem;
  actorUserId: string;
}) {
  const policy = getAdminUserRowActionPolicy({
    viewerCanManageUsers: true,
    viewerUserId: actorUserId,
    item,
  });

  if (policy.isReadOnlyDeleted) {
    return <span className="text-sm text-muted-foreground">Read-only</span>;
  }

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-indigo-700 underline-offset-4 hover:underline dark:text-indigo-400">
        Actions
      </summary>
      <div className="mt-3 space-y-4 rounded-md border border-border bg-muted/40 p-4">
        {policy.canChangeRole ? <RoleChangeForm item={item} /> : null}
        {policy.canDeactivate ? <DeactivateForm item={item} /> : null}
        {policy.canReactivate ? <ReactivateForm item={item} /> : null}
        {policy.canSetTemporaryPassword ? <PasswordForm item={item} /> : null}
        {policy.canChangeOwnPassword ? <ChangeOwnPasswordForm /> : null}
        {policy.canRevokeSessions ? <RevokeSessionsForm item={item} /> : null}
        {policy.canSoftDelete ? <SoftDeleteForm item={item} /> : null}
        {!policy.canChangeRole &&
        !policy.canDeactivate &&
        !policy.canReactivate &&
        !policy.canSetTemporaryPassword &&
        !policy.canChangeOwnPassword &&
        !policy.canRevokeSessions &&
        !policy.canSoftDelete ? (
          <p className="text-sm text-muted-foreground">No actions available.</p>
        ) : null}
      </div>
    </details>
  );
}

export function AdminUsersTable({
  actorUserId,
  users,
}: {
  actorUserId: string;
  users: AdminUserListItem[];
}) {
  return (
    <div className="space-y-6">
      <CreateUserForm />

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
        <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
              <th className="border-b border-border px-3 py-3">Name</th>
              <th className="border-b border-border px-3 py-3">Email</th>
              <th className="border-b border-border px-3 py-3">Role</th>
              <th className="border-b border-border px-3 py-3">Status</th>
              <th className="border-b border-border px-3 py-3">Sessions</th>
              <th className="border-b border-border px-3 py-3">Created</th>
              <th className="border-b border-border px-3 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="align-top hover:bg-muted/40">
                <td className="border-b border-border/60 px-3 py-3 font-medium text-foreground">
                  {item.name}
                </td>
                <td className="border-b border-border/60 px-3 py-3 text-slate-700 dark:text-slate-300">
                  {item.email}
                </td>
                <td className="border-b border-border/60 px-3 py-3">
                  <RoleBadge role={item.role} />
                </td>
                <td className="border-b border-border/60 px-3 py-3">
                  <AccountStatusBadge status={item.accountStatus} />
                </td>
                <td className="border-b border-border/60 px-3 py-3 text-slate-700 dark:text-slate-300">
                  {item.activeSessionCount}
                </td>
                <td className="border-b border-border/60 px-3 py-3 text-slate-700 whitespace-nowrap dark:text-slate-300">
                  {formatDateTime(item.createdAt)}
                </td>
                <td className="min-w-[240px] border-b border-border/60 px-3 py-3">
                  <UserActions actorUserId={actorUserId} item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
