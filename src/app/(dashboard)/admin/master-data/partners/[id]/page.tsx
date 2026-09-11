import Link from "next/link";
import { notFound } from "next/navigation";

import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/shell/page-header";
import { EditPartnerForm, PartnerCategoriesForm, PartnerContactsPanel, PartnerLifecycleControls } from "@/features/partners/components/admin-partner-forms";
import { canMutatePartners } from "@/features/partners/permissions";
import { getPartnerByIdForAdmin, listPartnerCategories } from "@/features/partners/queries";
import { requireAuthenticatedUser } from "@/lib/auth/session";

type PartnerDetailPageProps = { params: Promise<{ id: string }> };

export default async function PartnerDetailPage({ params }: PartnerDetailPageProps) {
  const { user } = await requireAuthenticatedUser();
  if (!canMutatePartners(user)) notFound();
  const { id } = await params;
  const [partner, categories] = await Promise.all([getPartnerByIdForAdmin(id, user), listPartnerCategories(user)]);
  if (!partner) notFound();
  const isDeleted = partner.deletedAt !== null;

  return <PageContainer><PageHeader title={partner.companyName} description={isDeleted ? "This Partner is deactivated. Reactivate it to make it available for Shipping Note lookup." : "Manage reusable Partner details, contacts, and operational categories."}><Link className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted" href="/admin/master-data/partners">Back to Partners</Link></PageHeader><div className="space-y-6">{!isDeleted ? <><EditPartnerForm partner={partner} /><PartnerCategoriesForm categories={categories} partner={partner} /><PartnerContactsPanel partner={partner} /></> : null}<PartnerLifecycleControls partner={partner} /></div></PageContainer>;
}
