"use client";

import { useActionState, useRef } from "react";

import type { CustomsDeclarationDetail } from "../types";
import {
  addCustomsDeclarationAction,
  removeCustomsDeclarationAction,
  type CustomsDeclarationActionResult,
} from "../actions";

type CustomsDeclarationsPanelProps = {
  shippingNoteId: string;
  declarations: CustomsDeclarationDetail[];
  canManage: boolean;
};

const initialState: CustomsDeclarationActionResult = { ok: true };

function formatDateTime(value: Date | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "-";
}

function RemoveDeclarationButton({
  id,
  shippingNoteId,
}: {
  id: string;
  shippingNoteId: string;
}) {
  const [state, formAction] = useActionState(
    removeCustomsDeclarationAction,
    initialState,
  );

  return (
    <form action={formAction} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="shippingNoteId" value={shippingNoteId} />
      <button
        className="text-xs text-red-600 dark:text-red-400 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="submit"
      >
        Xóa
      </button>
      {!state.ok ? (
        <span className="text-xs text-red-700 dark:text-red-400">{state.error}</span>
      ) : null}
    </form>
  );
}

export function CustomsDeclarationsPanel({
  shippingNoteId,
  declarations,
  canManage,
}: CustomsDeclarationsPanelProps) {
  const [addState, addFormAction] = useActionState(
    addCustomsDeclarationAction,
    initialState,
  );
  const addFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="grid gap-4 rounded-md border border-border bg-muted/40 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Customs Declarations
          </p>
          <h3 className="text-sm font-medium text-foreground">
            Tờ khai hải quan ({declarations.length})
          </h3>
        </div>
      </div>

      {declarations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Chưa có tờ khai hải quan nào được ghi nhận.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <th className="border-b border-border px-3 py-2">Số tờ khai</th>
                <th className="border-b border-border px-3 py-2">Thời gian tạo</th>
                {canManage ? (
                  <th className="border-b border-border px-3 py-2 text-right">Thao tác</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {declarations.map((decl) => (
                <tr key={decl.id} className="align-middle hover:bg-muted/40">
                  <td className="border-b border-border/60 px-3 py-2 font-medium text-foreground">
                    {decl.declarationNo}
                  </td>
                  <td className="border-b border-border/60 px-3 py-2 text-muted-foreground">
                    {formatDateTime(decl.createdAt)}
                  </td>
                  {canManage ? (
                    <td className="border-b border-border/60 px-3 py-2 text-right">
                      <RemoveDeclarationButton
                        id={decl.id}
                        shippingNoteId={shippingNoteId}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <form
          ref={addFormRef}
          action={async (formData) => {
            await addFormAction(formData);
            if (addFormRef.current) {
              const input = addFormRef.current.querySelector<HTMLInputElement>(
                'input[name="declarationNo"]',
              );
              if (input && addState.ok) {
                input.value = "";
              }
            }
          }}
          className="grid gap-2 border-t border-border pt-3 sm:flex sm:items-end"
        >
          <input type="hidden" name="shippingNoteId" value={shippingNoteId} />
          <div className="flex-1">
            <label
              className="block text-xs font-medium text-muted-foreground"
              htmlFor="declarationNo"
            >
              Thêm số tờ khai hải quan
            </label>
            <input
              className="mt-1 h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              id="declarationNo"
              name="declarationNo"
              placeholder="Nhập số tờ khai (tối đa 120 ký tự)..."
              maxLength={120}
              required
            />
          </div>
          <button
            className="inline-flex h-9 items-center justify-center rounded-md bg-slate-900 px-4 text-xs font-medium text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            type="submit"
          >
            Thêm tờ khai
          </button>
        </form>
      ) : null}

      {!addState.ok ? (
        <p className="text-xs text-red-700 dark:text-red-400" role="alert">
          {addState.error}
        </p>
      ) : null}
    </div>
  );
}
