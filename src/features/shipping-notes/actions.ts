"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAuthenticatedUser } from "@/lib/auth/session";
import { searchRoutingLocations } from "@/features/locations/queries";
import type { RoutingLocationApplicability } from "@/features/locations/constants";
import { searchPartners } from "@/features/partners/queries";
import {
  searchServiceCatalogItems,
  SERVICE_CATALOG_LOOKUP_LIMIT,
} from "@/features/service-catalog/queries";
import type { ServiceCatalogLookupItem } from "@/features/service-catalog/types";

import { readFormString } from "./form-data";
import {
  approveShippingNote,
  cancelFinalizedShippingNote,
  cancelShippingNote,
  createBuyingChargeForNote,
  createShippingNoteDraft,
  lockShippingNote,
  markShippingNoteChecked,
  reopenShippingNoteForCorrection,
  softDeleteBuyingCharge,
  startAccountingReview,
  submitShippingNote,
  unlockShippingNote,
  updateBuyingCharge,
  updateShippingNoteDraft,
  createSellingChargeForNote,
  updateSellingCharge,
  softDeleteSellingCharge,
} from "./mutations";
import {
  approveShippingNoteInputSchema,
  cancelFinalizedShippingNoteInputSchema,
  cancelShippingNoteInputSchema,
  createBuyingChargeInputSchema,
  createShippingNoteDraftInputSchema,
  partnerLookupSearchSchema,
  shippingNoteLocationLookupInputSchema,
  deleteBuyingChargeInputSchema,
  createSellingChargeInputSchema,
  lockShippingNoteInputSchema,
  markShippingNoteCheckedInputSchema,
  reopenShippingNoteForCorrectionInputSchema,
  deleteSellingChargeInputSchema,
  startAccountingReviewInputSchema,
  submitShippingNoteInputSchema,
  unlockShippingNoteInputSchema,
  updateBuyingChargeInputSchema,
  updateShippingNoteDraftInputSchema,
  updateSellingChargeInputSchema,
} from "./validators";
import type { BuyingChargeActionState } from "./types";

export type ShippingNoteActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ShippingNotePartnerLookupResult = {
  id: string;
  companyName: string;
  vendorCode: string | null;
  categoryNames: string[];
};

export type ShippingNoteServiceCatalogLookupResult = ServiceCatalogLookupItem;

export type ShippingNoteLocationLookupResult = {
  code: string;
  name: string;
  type: string;
  countryCode: string | null;
};

/**
 * Safe, authenticated Partner lookup for Shipping Note party selection.
 * The underlying Partner query owns authorization and active/deleted filtering.
 */
export async function searchShippingNotePartnersAction(
  searchTerm: string,
): Promise<ShippingNotePartnerLookupResult[]> {
  const session = await requireAuthenticatedUser();
  const parsed = partnerLookupSearchSchema.safeParse(searchTerm);

  if (!parsed.success) {
    return [];
  }

  const partners = await searchPartners(parsed.data, session.user, {
    activeOnly: true,
    limit: 12,
  });

  return partners.map((partner) => ({
    id: partner.id,
    companyName: partner.companyName,
    vendorCode: partner.vendorCode,
    categoryNames: partner.categories.map((category) => category.name),
  }));
}

/** Authenticated, authorized and bounded lookup for charge catalog selection. */
export async function searchShippingNoteServiceCatalogAction(
  searchTerm: string,
): Promise<ShippingNoteServiceCatalogLookupResult[]> {
  const session = await requireAuthenticatedUser();
  const parsed = partnerLookupSearchSchema.safeParse(searchTerm);

  if (!parsed.success) {
    return [];
  }

  return searchServiceCatalogItems(
    parsed.data,
    session.user,
    SERVICE_CATALOG_LOOKUP_LIMIT,
  );
}

/**
 * Safe, authenticated Location lookup for Shipping Note routing selection.
 * Applicability is the only selection authority; Location type is not passed
 * as a filter and therefore cannot be inferred by the UI.
 */
export async function searchShippingNoteLocationsAction(
  searchTerm: string,
  applicability: RoutingLocationApplicability,
): Promise<ShippingNoteLocationLookupResult[]> {
  const session = await requireAuthenticatedUser();
  const parsed = shippingNoteLocationLookupInputSchema.safeParse({
    searchTerm,
    applicability,
  });

  if (!parsed.success) {
    return [];
  }

  const locations = await searchRoutingLocations(parsed.data.searchTerm, session.user, {
    applicability: parsed.data.applicability,
    limit: 12,
  });

  return locations.map((location) => ({
    code: location.code,
    name: location.name,
    type: location.type,
    countryCode: location.countryCode,
  }));
}

function parseBooleanishError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong.";
}

export async function createShippingNoteDraftAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = createShippingNoteDraftInputSchema.safeParse({
    jobsheetNo: readFormString(formData, "jobsheetNo"),
    shippingMode: readFormString(formData, "shippingMode"),
    shipperPartnerId: readFormString(formData, "shipperPartnerId"),
    consigneePartnerId: readFormString(formData, "consigneePartnerId"),
    customerPartnerId: readFormString(formData, "customerPartnerId"),
    agentPartnerId: readFormString(formData, "agentPartnerId"),
    mawbHawbNo: readFormString(formData, "mawbHawbNo"),
    shipperText: readFormString(formData, "shipperText"),
    consigneeText: readFormString(formData, "consigneeText"),
    customerText: readFormString(formData, "customerText"),
    agentText: readFormString(formData, "agentText"),
    domesticOrigin: readFormString(formData, "domesticOrigin"),
    domesticDestination: readFormString(formData, "domesticDestination"),
    customModeName: readFormString(formData, "customModeName"),
    customOrigin: readFormString(formData, "customOrigin"),
    customDestination: readFormString(formData, "customDestination"),
    airOrigin: readFormString(formData, "airOrigin"),
    airDestination: readFormString(formData, "airDestination"),
    aol: readFormString(formData, "aol"),
    aod: readFormString(formData, "aod"),
    portOfLoading: readFormString(formData, "portOfLoading"),
    portOfDischarge: readFormString(formData, "portOfDischarge"),
    finalDestination: readFormString(formData, "finalDestination"),
    mawbNo: readFormString(formData, "mawbNo"),
    hawbNo: readFormString(formData, "hawbNo"),
    mblNo: readFormString(formData, "mblNo"),
    hblNo: readFormString(formData, "hblNo"),
    flightNo: readFormString(formData, "flightNo"),
    vesselName: readFormString(formData, "vesselName"),
    voyageNo: readFormString(formData, "voyageNo"),
    etd: readFormString(formData, "etd"),
    eta: readFormString(formData, "eta"),
    volumeValue: readFormString(formData, "volumeValue"),
    volumeUnit: readFormString(formData, "volumeUnit"),
    exchangeRate: readFormString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shipping note draft data.",
    };
  }

  let noteId = "";

  try {
    const note = await createShippingNoteDraft(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  redirect(`/shipping-notes/${noteId}`);
}

export async function updateShippingNoteDraftAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = updateShippingNoteDraftInputSchema.safeParse({
    id: readFormString(formData, "id"),
    jobsheetNo: readFormString(formData, "jobsheetNo"),
    shippingMode: readFormString(formData, "shippingMode"),
    shipperPartnerId: readFormString(formData, "shipperPartnerId"),
    consigneePartnerId: readFormString(formData, "consigneePartnerId"),
    customerPartnerId: readFormString(formData, "customerPartnerId"),
    agentPartnerId: readFormString(formData, "agentPartnerId"),
    mawbHawbNo: readFormString(formData, "mawbHawbNo"),
    shipperText: readFormString(formData, "shipperText"),
    consigneeText: readFormString(formData, "consigneeText"),
    customerText: readFormString(formData, "customerText"),
    agentText: readFormString(formData, "agentText"),
    domesticOrigin: readFormString(formData, "domesticOrigin"),
    domesticDestination: readFormString(formData, "domesticDestination"),
    customModeName: readFormString(formData, "customModeName"),
    customOrigin: readFormString(formData, "customOrigin"),
    customDestination: readFormString(formData, "customDestination"),
    airOrigin: readFormString(formData, "airOrigin"),
    airDestination: readFormString(formData, "airDestination"),
    aol: readFormString(formData, "aol"),
    aod: readFormString(formData, "aod"),
    portOfLoading: readFormString(formData, "portOfLoading"),
    portOfDischarge: readFormString(formData, "portOfDischarge"),
    finalDestination: readFormString(formData, "finalDestination"),
    mawbNo: readFormString(formData, "mawbNo"),
    hawbNo: readFormString(formData, "hawbNo"),
    mblNo: readFormString(formData, "mblNo"),
    hblNo: readFormString(formData, "hblNo"),
    flightNo: readFormString(formData, "flightNo"),
    vesselName: readFormString(formData, "vesselName"),
    voyageNo: readFormString(formData, "voyageNo"),
    etd: readFormString(formData, "etd"),
    eta: readFormString(formData, "eta"),
    volumeValue: readFormString(formData, "volumeValue"),
    volumeUnit: readFormString(formData, "volumeUnit"),
    exchangeRate: readFormString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shipping note draft data.",
    };
  }

  let noteId = "";

  try {
    const note = await updateShippingNoteDraft(parsed.data.id, parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  redirect(`/shipping-notes/${noteId}`);
}

export async function submitShippingNoteAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = submitShippingNoteInputSchema.safeParse({
    id: readFormString(formData, "id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid shipping note selection.",
    };
  }

  let noteId = "";

  try {
    const note = await submitShippingNote(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  redirect(`/shipping-notes/${noteId}`);
}

export async function startAccountingReviewAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = startAccountingReviewInputSchema.safeParse({
    id: readFormString(formData, "id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid shipping note selection.",
    };
  }

  let noteId = "";

  try {
    const note = await startAccountingReview(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

export async function markShippingNoteCheckedAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = markShippingNoteCheckedInputSchema.safeParse({
    id: readFormString(formData, "id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid shipping note selection.",
    };
  }

  let noteId = "";

  try {
    const note = await markShippingNoteChecked(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

export async function approveShippingNoteAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = approveShippingNoteInputSchema.safeParse({
    id: readFormString(formData, "id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid shipping note selection.",
    };
  }

  let noteId = "";

  try {
    const note = await approveShippingNote(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

export async function lockShippingNoteAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = lockShippingNoteInputSchema.safeParse({
    id: readFormString(formData, "id"),
    lockReason: readFormString(formData, "lockReason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid shipping note selection.",
    };
  }

  let noteId = "";

  try {
    const note = await lockShippingNote(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

export const closeShippingNoteAction = lockShippingNoteAction;

export async function unlockShippingNoteAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = unlockShippingNoteInputSchema.safeParse({
    id: readFormString(formData, "id"),
    unlockReason: readFormString(formData, "unlockReason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid unlock reason.",
    };
  }

  if (readFormString(formData, "unlockConfirmation") !== "confirmed") {
    return { ok: false, error: "Unlock confirmation is required." };
  }

  let noteId = "";

  try {
    const note = await unlockShippingNote(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

export async function cancelShippingNoteAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = cancelShippingNoteInputSchema.safeParse({
    id: readFormString(formData, "id"),
    expectedStatus: readFormString(formData, "expectedStatus"),
    cancelReason: readFormString(formData, "cancelReason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid cancellation request.",
    };
  }

  if (readFormString(formData, "cancelConfirmation") !== "confirmed") {
    return { ok: false, error: "Cancellation confirmation is required." };
  }

  let noteId = "";

  try {
    const note = await cancelShippingNote(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

export async function cancelFinalizedShippingNoteAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = cancelFinalizedShippingNoteInputSchema.safeParse({
    id: readFormString(formData, "id"),
    expectedStatus: readFormString(formData, "expectedStatus"),
    cancelReason: readFormString(formData, "cancelReason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid cancellation request.",
    };
  }

  if (readFormString(formData, "cancelConfirmation") !== "confirmed") {
    return { ok: false, error: "Cancellation confirmation is required." };
  }

  let noteId = "";

  try {
    const note = await cancelFinalizedShippingNote(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

export async function reopenShippingNoteForCorrectionAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = reopenShippingNoteForCorrectionInputSchema.safeParse({
    id: readFormString(formData, "id"),
    expectedStatus: readFormString(formData, "expectedStatus"),
    reason: readFormString(formData, "reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Invalid correction request.",
    };
  }

  if (readFormString(formData, "reopenConfirmation") !== "confirmed") {
    return { ok: false, error: "Correction confirmation is required." };
  }

  let noteId = "";

  try {
    const note = await reopenShippingNoteForCorrection(parsed.data, session.user);
    noteId = note.id;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath("/shipping-notes");
  revalidatePath(`/shipping-notes/${noteId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Selling charge actions
// ---------------------------------------------------------------------------

export async function createSellingChargeAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = createSellingChargeInputSchema.safeParse({
    shippingNoteId: readFormString(formData, "shippingNoteId"),
    serviceCatalogItemId: readFormString(formData, "serviceCatalogItemId"),
    chargeName: readFormString(formData, "chargeName"),
    description: readFormString(formData, "description"),
    quantity: readFormString(formData, "quantity"),
    unit: readFormString(formData, "unit"),
    unitPrice: readFormString(formData, "unitPrice"),
    currency: readFormString(formData, "currency"),
    exchangeRate: readFormString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid charge data.",
    };
  }

  try {
    await createSellingChargeForNote(parsed.data, session.user);
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${parsed.data.shippingNoteId}`);
  return { ok: true };
}

export async function updateSellingChargeAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = updateSellingChargeInputSchema.safeParse({
    id: readFormString(formData, "id"),
    serviceCatalogItemId: readFormString(formData, "serviceCatalogItemId"),
    chargeName: readFormString(formData, "chargeName"),
    description: readFormString(formData, "description"),
    quantity: readFormString(formData, "quantity"),
    unit: readFormString(formData, "unit"),
    unitPrice: readFormString(formData, "unitPrice"),
    currency: readFormString(formData, "currency"),
    exchangeRate: readFormString(formData, "exchangeRate"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid charge data.",
    };
  }

  const shippingNoteId = readFormString(formData, "shippingNoteId") ?? "";

  try {
    await updateSellingCharge(parsed.data, session.user);
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${shippingNoteId}`);
  return { ok: true };
}

export async function softDeleteSellingChargeAction(
  _state: ShippingNoteActionResult,
  formData: FormData,
): Promise<ShippingNoteActionResult> {
  const session = await requireAuthenticatedUser();

  const parsed = deleteSellingChargeInputSchema.safeParse({
    id: readFormString(formData, "id"),
    shippingNoteId: readFormString(formData, "shippingNoteId"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid charge selection.",
    };
  }

  try {
    await softDeleteSellingCharge(parsed.data.id, parsed.data.shippingNoteId, session.user);
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${parsed.data.shippingNoteId}`);
  return { ok: true };
}

export async function createBuyingChargeAction(
  _state: BuyingChargeActionState,
  formData: FormData,
): Promise<BuyingChargeActionState> {
  const session = await requireAuthenticatedUser();

  const parsed = createBuyingChargeInputSchema.safeParse({
    shippingNoteId: readFormString(formData, "shippingNoteId"),
    serviceCatalogItemId: readFormString(formData, "serviceCatalogItemId"),
    chargeName: readFormString(formData, "chargeName"),
    description: readFormString(formData, "description"),
    quantity: readFormString(formData, "quantity"),
    unit: readFormString(formData, "unit"),
    unitPrice: readFormString(formData, "unitPrice"),
    currency: readFormString(formData, "currency"),
    exchangeRate: readFormString(formData, "exchangeRate"),
    vendorOrAgentText: readFormString(formData, "vendorOrAgentText"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid buying charge data.",
    };
  }

  let shippingNoteId = "";

  try {
    const charge = await createBuyingChargeForNote(
      parsed.data.shippingNoteId,
      parsed.data,
      session.user,
    );
    shippingNoteId = charge.shippingNoteId;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${shippingNoteId}`);
  return { ok: true };
}

export async function updateBuyingChargeAction(
  _state: BuyingChargeActionState,
  formData: FormData,
): Promise<BuyingChargeActionState> {
  const session = await requireAuthenticatedUser();

  const parsed = updateBuyingChargeInputSchema.safeParse({
    id: readFormString(formData, "id"),
    serviceCatalogItemId: readFormString(formData, "serviceCatalogItemId"),
    chargeName: readFormString(formData, "chargeName"),
    description: readFormString(formData, "description"),
    quantity: readFormString(formData, "quantity"),
    unit: readFormString(formData, "unit"),
    unitPrice: readFormString(formData, "unitPrice"),
    currency: readFormString(formData, "currency"),
    exchangeRate: readFormString(formData, "exchangeRate"),
    vendorOrAgentText: readFormString(formData, "vendorOrAgentText"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid buying charge data.",
    };
  }

  let shippingNoteId = "";

  try {
    const charge = await updateBuyingCharge(parsed.data.id, parsed.data, session.user);
    shippingNoteId = charge.shippingNoteId;
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${shippingNoteId}`);
  return { ok: true };
}

export async function softDeleteBuyingChargeAction(
  _state: BuyingChargeActionState,
  formData: FormData,
): Promise<BuyingChargeActionState> {
  const session = await requireAuthenticatedUser();

  const parsed = deleteBuyingChargeInputSchema.safeParse({
    id: readFormString(formData, "id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid buying charge selection.",
    };
  }

  let shippingNoteId = "";

  try {
    shippingNoteId = await softDeleteBuyingCharge(parsed.data.id, session.user);
  } catch (error: unknown) {
    return { ok: false, error: parseBooleanishError(error) };
  }

  revalidatePath(`/shipping-notes/${shippingNoteId}`);
  return { ok: true };
}

