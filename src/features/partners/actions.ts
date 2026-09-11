"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";

import {
  addPartnerContact,
  createPartner,
  restorePartner,
  setPartnerCategories,
  softDeletePartner,
  softDeletePartnerContact,
  updatePartner,
  updatePartnerContact,
} from "./mutations";
import {
  createPartnerContactInputSchema,
  createPartnerInputSchema,
  setPartnerCategoriesInputSchema,
  updatePartnerContactInputSchema,
  updatePartnerInputSchema,
} from "./validators";

export type PartnerAdminActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  partnerId?: string;
};

function readFormString(formData: Pick<FormData, "get">, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readFormStrings(formData: Pick<FormData, "getAll">, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

function actionError(error: unknown, fallback: string): PartnerAdminActionResult {
  if (error instanceof Error && "issues" in error) {
    return { ok: false, error: "Please correct the highlighted Partner details and try again." };
  }

  return { ok: false, error: fallback };
}

function revalidatePartners(partnerId?: string): void {
  revalidatePath("/admin/master-data/partners");
  revalidatePath("/admin/master-data/partners/new");
  if (partnerId) {
    revalidatePath(`/admin/master-data/partners/${partnerId}`);
  }
}

export async function createPartnerAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = createPartnerInputSchema.safeParse({
    companyName: readFormString(formData, "companyName"),
    vendorCode: readFormString(formData, "vendorCode"),
    taxId: readFormString(formData, "taxId"),
    address: readFormString(formData, "address"),
    categoryCodes: readFormStrings(formData, "categoryCodes"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid Partner details." };
  }

  try {
    const partner = await createPartner(parsed.data, user);
    revalidatePartners(partner.id);
    return { ok: true, message: "Partner created.", partnerId: partner.id };
  } catch (error) {
    return actionError(error, "Partner could not be created.");
  }
}

export async function updatePartnerAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = updatePartnerInputSchema.safeParse({
    id: readFormString(formData, "id"),
    companyName: readFormString(formData, "companyName"),
    vendorCode: readFormString(formData, "vendorCode"),
    taxId: readFormString(formData, "taxId"),
    address: readFormString(formData, "address"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid Partner details." };
  }

  try {
    await updatePartner(parsed.data.id, parsed.data, user);
    revalidatePartners(parsed.data.id);
    return { ok: true, message: "Partner details updated." };
  } catch (error) {
    return actionError(error, "Partner details could not be updated.");
  }
}

export async function setPartnerCategoriesAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = setPartnerCategoriesInputSchema.safeParse({
    partnerId: readFormString(formData, "partnerId"),
    categoryCodes: readFormStrings(formData, "categoryCodes"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category assignment." };
  }

  try {
    await setPartnerCategories(parsed.data.partnerId, parsed.data.categoryCodes, user);
    revalidatePartners(parsed.data.partnerId);
    return { ok: true, message: "Partner categories updated." };
  } catch (error) {
    return actionError(error, "Partner categories could not be updated.");
  }
}

export async function addPartnerContactAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = createPartnerContactInputSchema.safeParse({
    partnerId: readFormString(formData, "partnerId"),
    picName: readFormString(formData, "picName"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid contact details." };
  }

  try {
    await addPartnerContact(parsed.data.partnerId, parsed.data, user);
    revalidatePartners(parsed.data.partnerId);
    return { ok: true, message: "Contact added." };
  } catch (error) {
    return actionError(error, "Contact could not be added.");
  }
}

export async function updatePartnerContactAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const partnerId = readFormString(formData, "partnerId");
  const parsed = updatePartnerContactInputSchema.safeParse({
    id: readFormString(formData, "id"),
    picName: readFormString(formData, "picName"),
    email: readFormString(formData, "email"),
    phone: readFormString(formData, "phone"),
  });

  if (!partnerId || !parsed.success) {
    return { ok: false, error: parsed.success ? "Partner ID is required." : parsed.error.issues[0]?.message ?? "Invalid contact details." };
  }

  try {
    await updatePartnerContact(parsed.data.id, parsed.data, user);
    revalidatePartners(partnerId);
    return { ok: true, message: "Contact updated." };
  } catch (error) {
    return actionError(error, "Contact could not be updated.");
  }
}

export async function removePartnerContactAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const id = readFormString(formData, "id");
  const partnerId = readFormString(formData, "partnerId");

  if (!id || !partnerId) return { ok: false, error: "Contact and Partner IDs are required." };

  try {
    await softDeletePartnerContact(id, user);
    revalidatePartners(partnerId);
    return { ok: true, message: "Contact removed." };
  } catch (error) {
    return actionError(error, "Contact could not be removed.");
  }
}

export async function deactivatePartnerAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const id = readFormString(formData, "id");
  if (!id || readFormString(formData, "confirmation") !== "confirmed") {
    return { ok: false, error: "Confirmation is required before deactivating this Partner." };
  }

  try {
    await softDeletePartner(id, user);
    revalidatePartners(id);
    return { ok: true, message: "Partner deactivated." };
  } catch (error) {
    return actionError(error, "Partner could not be deactivated.");
  }
}

export async function reactivatePartnerAdminAction(
  _state: PartnerAdminActionResult,
  formData: FormData,
): Promise<PartnerAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const id = readFormString(formData, "id");
  if (!id) return { ok: false, error: "Partner ID is required." };

  try {
    await restorePartner(id, user);
    revalidatePartners(id);
    return { ok: true, message: "Partner reactivated." };
  } catch (error) {
    return actionError(error, "Partner could not be reactivated.");
  }
}
