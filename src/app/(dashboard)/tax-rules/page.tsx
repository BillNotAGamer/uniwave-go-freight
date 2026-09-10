import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { AuthorizationError } from "@/lib/permissions/require-permission";
import { listTaxRulesForUser } from "@/features/tax-rules/queries";
import { TaxRulesTable } from "@/features/tax-rules/components/tax-rules-table";

export default async function TaxRulesPage() {
  const { user } = await requireAuthenticatedUser();
  const canManage = hasPermission(user.role, PERMISSIONS.TAX_RULES_MANAGE);

  let rules;

  try {
    rules = await listTaxRulesForUser(user, { activeOnly: !canManage });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      notFound();
    }

    throw error;
  }

  return (
    <PageContainer>
      <PageHeader
        title="Tax Rules"
        description="Manage and review manual VAT/tax rules for charge classification."
      />

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <TaxRulesTable rules={rules} canManage={canManage} />
      </div>
    </PageContainer>
  );
}
