import "server-only";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { logAuditEvent } from "@/lib/audit/log";
import { rejectInactiveOrSoftDeletedUsers } from "@/lib/auth/user-state";
import {
  AuthorizationError,
  requireAnyPermission,
} from "@/lib/permissions/require-permission";
import { PERMISSIONS, type Permission } from "@/lib/permissions/permissions";
import {
  businessPartners,
  serviceCatalogItems,
  shippingNoteEditGrants,
  shippingNotes,
  shippingNoteCharges,
  users,
  type User as DbUser,
} from "@/lib/db/schema";

import {
  cancelFinalizedShippingNoteInputSchema,
  cancelShippingNoteInputSchema,
  duplicateShippingNoteInputSchema,
  lockShippingNoteInputSchema,
  reopenShippingNoteForCorrectionInputSchema,
  unlockShippingNoteInputSchema,
} from "./validators";
import type {
  CancelFinalizedShippingNoteInput,
  CancelShippingNoteInput,
  CreateBuyingChargeInput,
  CreateShippingNoteDraftInput,
  DuplicateShippingNoteInput,
  CreateSellingChargeInput,
  ApproveShippingNoteInput,
  LockShippingNoteInput,
  MarkShippingNoteCheckedInput,
  ReopenShippingNoteForCorrectionInput,
  StartAccountingReviewInput,
  SubmitShippingNoteInput,
  UnlockShippingNoteInput,
  UpdateBuyingChargeInput,
  UpdateShippingNoteDraftInput,
  UpdateShippingNotePostSubmitInput,
  UpdateSellingChargeInput,
} from "./validators";
import type {
  BuyingChargeDetail,
  SellingChargeDetail,
  ShippingNoteDetail,
} from "./types";
import type { ShippingNoteStatus } from "./constants";
import {
  getShippingNoteById,
  getShippingNoteForUser,
  shippingNoteDetailSelect,
} from "./queries";
import { calculateChargeAmounts } from "@/lib/calculations/money";
import { parseDecimalToScaledInteger } from "@/lib/calculations/decimal";
import {
  canAccessDraftMutationSubject,
  canApproveShippingNoteStatus,
  canCancelFinalizedShippingNoteStatus,
  canCancelShippingNoteStatus,
  canLockShippingNoteStatus,
  LOCK_SOURCE_STATUSES,
  canMutateBuyingChargeForActor,
  canMutateSellingChargeForDraft,
  canMutateReopenedSellingCharges,
  canReopenShippingNoteForCorrectionStatus,
  canSubmitShippingNoteDraft,
  canUnlockShippingNoteStatus,
  canUsePostSubmitEditGrantAtStatus,
  isExpectedAccountingTransitionSource,
} from "./status-policy";
import { updateShippingNotePostSubmitInputSchema } from "./validators";
import {
  summarizeTaxCompleteness,
  TAX_COMPLETENESS_ERROR,
} from "./tax/completeness";
import { recomputeVatForCommercialChange } from "./tax/mutations";
import {
  getRequestedShippingNotePartnerIds,
  resolveShippingNotePartySnapshots,
  type ShippingNotePartyInput,
  type ShippingNotePartyPersistence,
} from "./party-snapshots";
import {
  assertValidShippingNoteModeFields,
  canonicalizeShippingNoteModeFields,
} from "./mode-rules";
import {
  resolveChargeCatalogPersistence,
  type ChargeCatalogPersistence,
  type ChargeCatalogSelection,
} from "./accounting/catalog-charge";
import {
  buildShippingNoteDuplicationDraft,
  canDuplicateShippingNote,
} from "./duplication";

const CANCELLATION_REASON_REQUIRED = "Cancellation reason is required.";

function normalizeOptionalDate(value: Date | undefined): Date | null {
  return value ?? null;
}

function normalizeOptionalText(value: string | undefined): string | null {
  return value ?? null;
}

function normalizeOptionalNumber(value: number | undefined): string | null {
  return value === undefined ? null : value.toString();
}

function buildPostSubmitOperationalPersistence(
  input: UpdateShippingNotePostSubmitInput,
  partyPersistence: ShippingNotePartyPersistence,
) {
  return {
    commodityHsCode: normalizeOptionalText(input.commodityHsCode),
    commodity: normalizeOptionalText(input.commodity),
    hsCode: normalizeOptionalText(input.hsCode),
    containerType: normalizeOptionalText(input.containerType),
    containerNo: normalizeOptionalText(input.containerNo),
    sealNo: normalizeOptionalText(input.sealNo),
    carrierName: normalizeOptionalText(input.carrierName),
    grossWeight: normalizeOptionalText(input.grossWeight),
    chargeableWeight: normalizeOptionalText(input.chargeableWeight),
    licensePlate: normalizeOptionalText(input.licensePlate),
    driverInformation: normalizeOptionalText(input.driverInformation),
    vehiclePayloadCapacity: normalizeOptionalText(input.vehiclePayloadCapacity),
    shippingMode: input.shippingMode,
    mawbHawbNo: normalizeOptionalText(input.mawbHawbNo),
    ...partyPersistence,
    domesticOrigin: normalizeOptionalText(input.domesticOrigin),
    domesticDestination: normalizeOptionalText(input.domesticDestination),
    customModeName: normalizeOptionalText(input.customModeName),
    customOrigin: normalizeOptionalText(input.customOrigin),
    customDestination: normalizeOptionalText(input.customDestination),
    aol: normalizeOptionalText(input.aol),
    aod: normalizeOptionalText(input.aod),
    portOfLoading: normalizeOptionalText(input.portOfLoading),
    portOfDischarge: normalizeOptionalText(input.portOfDischarge),
    finalDestination: normalizeOptionalText(input.finalDestination),
    mawbNo: normalizeOptionalText(input.mawbNo),
    hawbNo: normalizeOptionalText(input.hawbNo),
    mblNo: normalizeOptionalText(input.mblNo),
    hblNo: normalizeOptionalText(input.hblNo),
    flightNo: normalizeOptionalText(input.flightNo),
    vesselName: normalizeOptionalText(input.vesselName),
    voyageNo: normalizeOptionalText(input.voyageNo),
    etd: normalizeOptionalDate(input.etd),
    eta: normalizeOptionalDate(input.eta),
    volumeValue: normalizeOptionalNumber(input.volumeValue),
    volumeUnit: input.volumeUnit ?? null,
  };
}

type PostSubmitOperationalPersistence = ReturnType<
  typeof buildPostSubmitOperationalPersistence
>;

function arePostSubmitValuesEqual(
  field: keyof PostSubmitOperationalPersistence,
  currentValue: unknown,
  proposedValue: unknown,
): boolean {
  if (currentValue instanceof Date || proposedValue instanceof Date) {
    return currentValue instanceof Date &&
      proposedValue instanceof Date &&
      currentValue.getTime() === proposedValue.getTime();
  }

  if (field === "volumeValue" && currentValue !== null && proposedValue !== null) {
    return parseDecimalToScaledInteger(String(currentValue), 3) ===
      parseDecimalToScaledInteger(String(proposedValue), 3);
  }

  return currentValue === proposedValue;
}

function getChangedPostSubmitFields(
  current: ShippingNoteDetail,
  proposed: PostSubmitOperationalPersistence,
): Array<keyof PostSubmitOperationalPersistence> {
  return (Object.keys(proposed) as Array<keyof PostSubmitOperationalPersistence>)
    .filter((field) => !arePostSubmitValuesEqual(field, current[field], proposed[field]));
}

async function resolvePartyPersistence(
  input: ShippingNotePartyInput,
  queryClient: Pick<typeof db, "select">,
): Promise<ShippingNotePartyPersistence> {
  const requestedPartnerIds = getRequestedShippingNotePartnerIds(input);
  const partners = requestedPartnerIds.length === 0
    ? []
    : await queryClient
        .select({
          id: businessPartners.id,
          companyName: businessPartners.companyName,
          isActive: businessPartners.isActive,
          deletedAt: businessPartners.deletedAt,
        })
        .from(businessPartners)
        .where(inArray(businessPartners.id, requestedPartnerIds));

  return resolveShippingNotePartySnapshots(input, partners);
}

function requireShippingNoteAccess(
  user: DbUser,
  permission: Permission | readonly Permission[],
): void {
  requireAnyPermission(user.role, permission);
}

export class ShippingNoteJobsheetConflictError extends Error {
  constructor() {
    super("Jobsheet No already exists.");
    this.name = "ShippingNoteJobsheetConflictError";
  }
}

async function assertJobsheetNoIsUnique(
  jobsheetNo: string,
  excludeId?: string,
  queryClient: Pick<typeof db, "select"> = db,
): Promise<void> {
  const conditions = [eq(shippingNotes.jobsheetNo, jobsheetNo)];

  if (excludeId) {
    conditions.push(ne(shippingNotes.id, excludeId));
  }

  const existing = await queryClient
    .select({ id: shippingNotes.id })
    .from(shippingNotes)
    .where(and(...conditions))
    .limit(1);

  if (existing.length > 0) {
    throw new ShippingNoteJobsheetConflictError();
  }
}

function isPostgresUniqueViolation(error: unknown): boolean {
  let current = error;

  for (let depth = 0; depth < 5 && current && typeof current === "object"; depth += 1) {
    if ("code" in current && current.code === "23505") {
      return true;
    }

    current = "cause" in current ? current.cause : null;
  }

  return false;
}

async function insertShippingNoteDraftRecord(
  tx: Pick<typeof db, "select" | "insert">,
  canonicalInput: CreateShippingNoteDraftInput,
  createdById: string,
  preparedPartyPersistence?: ShippingNotePartyPersistence,
): Promise<ShippingNoteDetail> {
  const partyPersistence =
    preparedPartyPersistence ?? await resolvePartyPersistence(canonicalInput, tx);
  const [created] = await tx
    .insert(shippingNotes)
    .values({
      jobsheetNo: canonicalInput.jobsheetNo,
      commodityHsCode: normalizeOptionalText(canonicalInput.commodityHsCode),
      commodity: normalizeOptionalText(canonicalInput.commodity),
      hsCode: normalizeOptionalText(canonicalInput.hsCode),
      containerType: normalizeOptionalText(canonicalInput.containerType),
      containerNo: normalizeOptionalText(canonicalInput.containerNo),
      sealNo: normalizeOptionalText(canonicalInput.sealNo),
      carrierName: normalizeOptionalText(canonicalInput.carrierName),
      grossWeight: normalizeOptionalText(canonicalInput.grossWeight),
      chargeableWeight: normalizeOptionalText(canonicalInput.chargeableWeight),
      licensePlate: normalizeOptionalText(canonicalInput.licensePlate),
      driverInformation: normalizeOptionalText(canonicalInput.driverInformation),
      vehiclePayloadCapacity: normalizeOptionalText(canonicalInput.vehiclePayloadCapacity),
      shippingMode: canonicalInput.shippingMode,
      mawbHawbNo: normalizeOptionalText(canonicalInput.mawbHawbNo),
      ...partyPersistence,
      domesticOrigin: normalizeOptionalText(canonicalInput.domesticOrigin),
      domesticDestination: normalizeOptionalText(canonicalInput.domesticDestination),
      customModeName: normalizeOptionalText(canonicalInput.customModeName),
      customOrigin: normalizeOptionalText(canonicalInput.customOrigin),
      customDestination: normalizeOptionalText(canonicalInput.customDestination),
      aol: normalizeOptionalText(canonicalInput.aol),
      aod: normalizeOptionalText(canonicalInput.aod),
      portOfLoading: normalizeOptionalText(canonicalInput.portOfLoading),
      portOfDischarge: normalizeOptionalText(canonicalInput.portOfDischarge),
      finalDestination: normalizeOptionalText(canonicalInput.finalDestination),
      mawbNo: normalizeOptionalText(canonicalInput.mawbNo),
      hawbNo: normalizeOptionalText(canonicalInput.hawbNo),
      mblNo: normalizeOptionalText(canonicalInput.mblNo),
      hblNo: normalizeOptionalText(canonicalInput.hblNo),
      flightNo: normalizeOptionalText(canonicalInput.flightNo),
      vesselName: normalizeOptionalText(canonicalInput.vesselName),
      voyageNo: normalizeOptionalText(canonicalInput.voyageNo),
      etd: normalizeOptionalDate(canonicalInput.etd),
      eta: normalizeOptionalDate(canonicalInput.eta),
      volumeValue: normalizeOptionalNumber(canonicalInput.volumeValue),
      volumeUnit: canonicalInput.volumeUnit ?? null,
      exchangeRate: (canonicalInput.exchangeRate ?? 1).toString(),
      status: "draft",
      createdById,
    })
    .returning(shippingNoteDetailSelect);

  if (!created) {
    throw new Error("Failed to create shipping note draft.");
  }

  return created;
}

function ensureDraftAccess(note: ShippingNoteDetail | null, user: DbUser): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (!canAccessDraftMutationSubject(note, user)) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureSubmitDraftAccess(
  note: ShippingNoteDetail | null,
  user: DbUser,
): ShippingNoteDetail {
  if (!note || !canSubmitShippingNoteDraft(note, user)) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureAccountingTransitionAccess(
  note: ShippingNoteDetail | null,
  expectedStatus: ShippingNoteStatus,
): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (!isExpectedAccountingTransitionSource(note.status, expectedStatus)) {
    throw new AuthorizationError();
  }

  return note;
}

async function getApprovalTransitionSnapshot(
  id: string,
): Promise<{
  id: string;
  status: ShippingNoteStatus;
  approvedById: string | null;
  approvedAt: Date | null;
} | null> {
  const [note] = await db
    .select({
      id: shippingNotes.id,
      status: shippingNotes.status,
      approvedById: shippingNotes.approvedById,
      approvedAt: shippingNotes.approvedAt,
    })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, id), isNull(shippingNotes.deletedAt)))
    .limit(1);

  return note ?? null;
}

async function getLockTransitionSnapshot(
  id: string,
): Promise<{
  id: string;
  status: ShippingNoteStatus;
  lockedById: string | null;
  lockedAt: Date | null;
  lockReason: string | null;
} | null> {
  const [note] = await db
    .select({
      id: shippingNotes.id,
      status: shippingNotes.status,
      lockedById: shippingNotes.lockedById,
      lockedAt: shippingNotes.lockedAt,
      lockReason: shippingNotes.lockReason,
    })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, id), isNull(shippingNotes.deletedAt)))
    .limit(1);

  return note ?? null;
}

async function getCancellationTransitionSnapshot(
  id: string,
): Promise<{
  id: string;
  status: ShippingNoteStatus;
  createdById: string | null;
  cancelledById: string | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
} | null> {
  const [note] = await db
    .select({
      id: shippingNotes.id,
      status: shippingNotes.status,
      createdById: shippingNotes.createdById,
      cancelledById: shippingNotes.cancelledById,
      cancelledAt: shippingNotes.cancelledAt,
      cancelReason: shippingNotes.cancelReason,
    })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, id), isNull(shippingNotes.deletedAt)))
    .limit(1);

  return note ?? null;
}

async function getReopenTransitionSnapshot(
  id: string,
): Promise<{
  id: string;
  status: ShippingNoteStatus;
  checkedById: string | null;
  checkedAt: Date | null;
  approvedById: string | null;
  approvedAt: Date | null;
  lockedById: string | null;
  lockedAt: Date | null;
  lockReason: string | null;
} | null> {
  const [note] = await db
    .select({
      id: shippingNotes.id,
      status: shippingNotes.status,
      checkedById: shippingNotes.checkedById,
      checkedAt: shippingNotes.checkedAt,
      approvedById: shippingNotes.approvedById,
      approvedAt: shippingNotes.approvedAt,
      lockedById: shippingNotes.lockedById,
      lockedAt: shippingNotes.lockedAt,
      lockReason: shippingNotes.lockReason,
    })
    .from(shippingNotes)
    .where(and(eq(shippingNotes.id, id), isNull(shippingNotes.deletedAt)))
    .limit(1);

  return note ?? null;
}

function ensureApprovalTransitionAccess(
  note: Awaited<ReturnType<typeof getApprovalTransitionSnapshot>>,
): NonNullable<Awaited<ReturnType<typeof getApprovalTransitionSnapshot>>> {
  if (!note) {
    throw new AuthorizationError();
  }

  if (!canApproveShippingNoteStatus(note.status)) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureLockTransitionAccess(
  note: Awaited<ReturnType<typeof getLockTransitionSnapshot>>,
): NonNullable<Awaited<ReturnType<typeof getLockTransitionSnapshot>>> {
  if (!note) {
    throw new AuthorizationError();
  }

  if (!canLockShippingNoteStatus(note.status)) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureUnlockTransitionAccess(
  note: Awaited<ReturnType<typeof getLockTransitionSnapshot>>,
): NonNullable<Awaited<ReturnType<typeof getLockTransitionSnapshot>>> {
  if (!note) {
    throw new AuthorizationError();
  }

  if (!canUnlockShippingNoteStatus(note.status)) {
    throw new AuthorizationError();
  }

  return note;
}

function requireCancellationReason(reason: string | undefined): string {
  if (!reason) {
    throw new Error(CANCELLATION_REASON_REQUIRED);
  }

  return reason;
}

function ensureNormalCancellationAccess(
  note: Awaited<ReturnType<typeof getCancellationTransitionSnapshot>>,
  user: DbUser,
  expectedStatus: CancelShippingNoteInput["expectedStatus"],
  cancelReason: string | undefined,
): NonNullable<Awaited<ReturnType<typeof getCancellationTransitionSnapshot>>> {
  if (!note) {
    throw new AuthorizationError();
  }

  if (
    note.status !== expectedStatus ||
    !canCancelShippingNoteStatus(note.status)
  ) {
    throw new AuthorizationError();
  }

  if (note.status === "draft") {
    if ((user.role === "sale" || user.role === "ops") && note.createdById === user.id) {
      return note;
    }

    if (user.role === "admin") {
      requireCancellationReason(cancelReason);
      return note;
    }

    throw new AuthorizationError();
  }

  if (note.status === "submitted" || note.status === "accounting_reviewing") {
    if (user.role !== "accountant" && user.role !== "admin") {
      throw new AuthorizationError();
    }

    requireCancellationReason(cancelReason);
    return note;
  }

  throw new AuthorizationError();
}

function ensureFinalizedCancellationAccess(
  note: Awaited<ReturnType<typeof getCancellationTransitionSnapshot>>,
  expectedStatus: CancelFinalizedShippingNoteInput["expectedStatus"],
): NonNullable<Awaited<ReturnType<typeof getCancellationTransitionSnapshot>>> {
  if (!note) {
    throw new AuthorizationError();
  }

  if (
    note.status !== expectedStatus ||
    !canCancelFinalizedShippingNoteStatus(note.status)
  ) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureReopenTransitionAccess(
  note: Awaited<ReturnType<typeof getReopenTransitionSnapshot>>,
  expectedStatus: ReopenShippingNoteForCorrectionInput["expectedStatus"],
): NonNullable<Awaited<ReturnType<typeof getReopenTransitionSnapshot>>> {
  if (!note) {
    throw new AuthorizationError();
  }

  if (
    note.status !== expectedStatus ||
    !canReopenShippingNoteForCorrectionStatus(note.status)
  ) {
    throw new AuthorizationError();
  }

  if (note.lockedById || note.lockedAt || note.lockReason) {
    throw new Error("Cannot reopen shipping note with active lock metadata.");
  }

  return note;
}

export async function createShippingNoteDraft(
  input: CreateShippingNoteDraftInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  const canonicalInput = canonicalizeShippingNoteModeFields(input);
  assertValidShippingNoteModeFields(canonicalInput);

  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_CREATE_OWN);

  await assertJobsheetNoIsUnique(canonicalInput.jobsheetNo);

  try {
    return await db.transaction(async (tx) => {
      const created = await insertShippingNoteDraftRecord(
        tx,
        canonicalInput,
        user.id,
      );

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.create_draft",
        entityType: "shipping_note",
        entityId: created.id,
        after: created,
      });

      return created;
    });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof ShippingNoteJobsheetConflictError
    ) {
      throw error;
    }

    if (isPostgresUniqueViolation(error)) {
      throw new ShippingNoteJobsheetConflictError();
    }

    throw new Error("Failed to create shipping note draft.");
  }
}

export async function duplicateShippingNote(
  input: DuplicateShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  const actor = rejectInactiveOrSoftDeletedUsers(user);
  if (!actor || actor.role === "accountant") {
    throw new AuthorizationError();
  }

  const parsedInput = duplicateShippingNoteInputSchema.parse(input);

  try {
    return await db.transaction(async (tx) => {
      const [source] = await tx
        .select(shippingNoteDetailSelect)
        .from(shippingNotes)
        .where(
          and(
            eq(shippingNotes.id, parsedInput.sourceId),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .limit(1)
        .for("share");

      if (!source || !canDuplicateShippingNote(source, actor)) {
        throw new AuthorizationError();
      }

      if (parsedInput.newJobsheetNo === source.jobsheetNo) {
        throw new ShippingNoteJobsheetConflictError();
      }

      await assertJobsheetNoIsUnique(parsedInput.newJobsheetNo, undefined, tx);

      const partnerIds = [
        source.shipperPartnerId,
        source.consigneePartnerId,
        source.customerPartnerId,
        source.agentPartnerId,
      ].filter((partnerId): partnerId is string => partnerId !== null);
      const partners = partnerIds.length === 0
        ? []
        : await tx
            .select({
              id: businessPartners.id,
              companyName: businessPartners.companyName,
              isActive: businessPartners.isActive,
              deletedAt: businessPartners.deletedAt,
            })
            .from(businessPartners)
            .where(inArray(businessPartners.id, partnerIds));
      const duplicateDraft = buildShippingNoteDuplicationDraft(
        source,
        parsedInput.newJobsheetNo,
        partners,
      );
      const created = await insertShippingNoteDraftRecord(
        tx,
        duplicateDraft.input,
        actor.id,
        duplicateDraft.partyPersistence,
      );

      await logAuditEvent(tx, {
        actorUserId: actor.id,
        action: "shipping_note.duplicate",
        entityType: "shipping_note",
        entityId: created.id,
        before: {
          sourceShippingNoteId: source.id,
          sourceJobsheetNo: source.jobsheetNo,
        },
        after: {
          sourceShippingNoteId: source.id,
          newShippingNoteId: created.id,
          newJobsheetNo: created.jobsheetNo,
          status: "draft",
          createdById: actor.id,
          copyScope: "operational_fields_only",
        },
      });

      return created;
    });
  } catch (error) {
    if (
      error instanceof AuthorizationError ||
      error instanceof ShippingNoteJobsheetConflictError
    ) {
      throw error;
    }

    if (isPostgresUniqueViolation(error)) {
      throw new ShippingNoteJobsheetConflictError();
    }

    throw new Error("Failed to duplicate shipping note.");
  }
}

export async function updateShippingNoteDraft(
  id: string,
  input: UpdateShippingNoteDraftInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  const canonicalInput = canonicalizeShippingNoteModeFields(input);
  assertValidShippingNoteModeFields(canonicalInput);

  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);

  const current = ensureDraftAccess(await getShippingNoteById(id), user);

  if (canonicalInput.jobsheetNo !== current.jobsheetNo) {
    await assertJobsheetNoIsUnique(canonicalInput.jobsheetNo, id);
  }

  try {
    return await db.transaction(async (tx) => {
      const partyPersistence = await resolvePartyPersistence(canonicalInput, tx);
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          jobsheetNo: canonicalInput.jobsheetNo,
          commodityHsCode: normalizeOptionalText(canonicalInput.commodityHsCode),
          commodity: normalizeOptionalText(canonicalInput.commodity),
          hsCode: normalizeOptionalText(canonicalInput.hsCode),
          containerType: normalizeOptionalText(canonicalInput.containerType),
          containerNo: normalizeOptionalText(canonicalInput.containerNo),
          sealNo: normalizeOptionalText(canonicalInput.sealNo),
          carrierName: normalizeOptionalText(canonicalInput.carrierName),
          grossWeight: normalizeOptionalText(canonicalInput.grossWeight),
          chargeableWeight: normalizeOptionalText(canonicalInput.chargeableWeight),
          licensePlate: normalizeOptionalText(canonicalInput.licensePlate),
          driverInformation: normalizeOptionalText(canonicalInput.driverInformation),
          vehiclePayloadCapacity: normalizeOptionalText(canonicalInput.vehiclePayloadCapacity),
          shippingMode: canonicalInput.shippingMode,
          mawbHawbNo: normalizeOptionalText(canonicalInput.mawbHawbNo),
          ...partyPersistence,
          domesticOrigin: normalizeOptionalText(canonicalInput.domesticOrigin),
          domesticDestination: normalizeOptionalText(canonicalInput.domesticDestination),
          customModeName: normalizeOptionalText(canonicalInput.customModeName),
          customOrigin: normalizeOptionalText(canonicalInput.customOrigin),
          customDestination: normalizeOptionalText(canonicalInput.customDestination),
          aol: normalizeOptionalText(canonicalInput.aol),
          aod: normalizeOptionalText(canonicalInput.aod),
          portOfLoading: normalizeOptionalText(canonicalInput.portOfLoading),
          portOfDischarge: normalizeOptionalText(canonicalInput.portOfDischarge),
          finalDestination: normalizeOptionalText(canonicalInput.finalDestination),
          mawbNo: normalizeOptionalText(canonicalInput.mawbNo),
          hawbNo: normalizeOptionalText(canonicalInput.hawbNo),
          mblNo: normalizeOptionalText(canonicalInput.mblNo),
          hblNo: normalizeOptionalText(canonicalInput.hblNo),
          flightNo: normalizeOptionalText(canonicalInput.flightNo),
          vesselName: normalizeOptionalText(canonicalInput.vesselName),
          voyageNo: normalizeOptionalText(canonicalInput.voyageNo),
          etd: normalizeOptionalDate(canonicalInput.etd),
          eta: normalizeOptionalDate(canonicalInput.eta),
          volumeValue: normalizeOptionalNumber(canonicalInput.volumeValue),
          volumeUnit: canonicalInput.volumeUnit ?? null,
          exchangeRate: (canonicalInput.exchangeRate ?? 1).toString(),
        })
        .where(and(eq(shippingNotes.id, id), eq(shippingNotes.status, "draft")))
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.update_draft",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to update shipping note draft.");
  }
}

export async function updateShippingNotePostSubmit(
  input: UpdateShippingNotePostSubmitInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);
  const parsedInput = updateShippingNotePostSubmitInputSchema.parse(input);
  const canonicalInput = canonicalizeShippingNoteModeFields(parsedInput);
  assertValidShippingNoteModeFields(canonicalInput);

  if (user.role !== "sale" && user.role !== "ops") {
    throw new AuthorizationError();
  }

  try {
    return await db.transaction(async (tx) => {
      const [current] = await tx
        .select({
          ...shippingNoteDetailSelect,
          checkedById: shippingNotes.checkedById,
          checkedAt: shippingNotes.checkedAt,
          approvedById: shippingNotes.approvedById,
          approvedAt: shippingNotes.approvedAt,
        })
        .from(shippingNotes)
        .where(and(eq(shippingNotes.id, parsedInput.id), isNull(shippingNotes.deletedAt)))
        .limit(1)
        .for("update");

      if (
        !current ||
        current.createdById !== user.id ||
        !canUsePostSubmitEditGrantAtStatus(current.status) ||
        current.updatedAt.getTime() !== parsedInput.expectedUpdatedAt.getTime()
      ) {
        throw new AuthorizationError("This Shipping Note changed or is no longer editable. Refresh and try again.");
      }

      const [activeGrant] = await tx
        .select({ id: shippingNoteEditGrants.id })
        .from(shippingNoteEditGrants)
        .innerJoin(users, eq(users.id, shippingNoteEditGrants.recipientUserId))
        .where(
          and(
            eq(shippingNoteEditGrants.shippingNoteId, current.id),
            eq(shippingNoteEditGrants.recipientUserId, user.id),
            eq(shippingNoteEditGrants.status, "active"),
            eq(users.isActive, true),
            isNull(users.deletedAt),
            eq(users.role, user.role),
          ),
        )
        .limit(1)
        .for("update");

      if (!activeGrant) {
        throw new AuthorizationError("Your edit grant is no longer active.");
      }

      const partyPersistence = await resolvePartyPersistence(canonicalInput, tx);
      const operationalValues = buildPostSubmitOperationalPersistence(
        canonicalInput,
        partyPersistence,
      );
      const changedFields = getChangedPostSubmitFields(current, operationalValues);

      if (changedFields.length === 0) {
        return current;
      }

      const invalidatesCurrentSignoff =
        current.status === "checked" || current.status === "approved";
      const updatedAt = new Date();
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          ...operationalValues,
          ...(invalidatesCurrentSignoff
            ? {
                status: "accounting_reviewing" as const,
                checkedById: null,
                checkedAt: null,
                approvedById: null,
                approvedAt: null,
              }
            : {}),
          updatedAt,
        })
        .where(
          and(
            eq(shippingNotes.id, current.id),
            eq(shippingNotes.status, current.status),
            eq(shippingNotes.updatedAt, parsedInput.expectedUpdatedAt),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError("This Shipping Note changed or is no longer editable. Refresh and try again.");
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.update_post_submit",
        entityType: "shipping_note",
        entityId: updated.id,
        before: {
          ...current,
          amendment: {
            changedFields,
            previousStatus: current.status,
            currentSignoffInvalidated: invalidatesCurrentSignoff,
          },
        },
        after: {
          ...updated,
          amendment: {
            changedFields,
            newStatus: updated.status,
            currentSignoffInvalidated: invalidatesCurrentSignoff,
          },
        },
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to update Shipping Note with delegated access.");
  }
}

export async function submitShippingNote(
  input: SubmitShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_EDIT_OWN);

  const current = ensureSubmitDraftAccess(
    await getShippingNoteById(input.id),
    user,
  );

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "submitted",
          submittedAt: new Date(),
        })
        .where(and(eq(shippingNotes.id, input.id), eq(shippingNotes.status, "draft")))
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.submit",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to submit shipping note.");
  }
}

export async function startAccountingReview(
  input: StartAccountingReviewInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_ACCOUNTING_REVIEW);

  const current = ensureAccountingTransitionAccess(
    await getShippingNoteForUser(input.id, user),
    "submitted",
  );

  try {
    return await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "accounting_reviewing",
        })
        .where(
          and(
            eq(shippingNotes.id, input.id),
            eq(shippingNotes.status, "submitted"),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.accounting_review.start",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to start accounting review.");
  }
}

export async function markShippingNoteChecked(
  input: MarkShippingNoteCheckedInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_MARK_CHECKED);

  ensureAccountingTransitionAccess(
    await getShippingNoteForUser(input.id, user),
    "accounting_reviewing",
  );

  try {
    return await db.transaction(async (tx) => {
      const [lockedCurrent] = await tx
        .select(shippingNoteDetailSelect)
        .from(shippingNotes)
        .where(
          and(
            eq(shippingNotes.id, input.id),
            eq(shippingNotes.status, "accounting_reviewing"),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .limit(1)
        .for("update");

      if (!lockedCurrent) {
        throw new AuthorizationError();
      }

      const checkedAt = new Date();
      const chargeTaxRows = await tx
        .select({
          amountVnd: shippingNoteCharges.amountVnd,
          taxRuleId: shippingNoteCharges.taxRuleId,
          taxRuleCodeSnapshot: shippingNoteCharges.taxRuleCodeSnapshot,
          taxRuleNameSnapshot: shippingNoteCharges.taxRuleNameSnapshot,
          taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
          vatPercent: shippingNoteCharges.vatPercent,
          vatAmount: shippingNoteCharges.vatAmount,
          isOverride: shippingNoteCharges.isOverride,
          overrideReason: shippingNoteCharges.overrideReason,
          deletedAt: shippingNoteCharges.deletedAt,
        })
        .from(shippingNoteCharges)
        .where(
          and(
            eq(shippingNoteCharges.shippingNoteId, input.id),
            isNull(shippingNoteCharges.deletedAt),
          ),
        );

      if (!summarizeTaxCompleteness(chargeTaxRows).taxComplete) {
        throw new Error(TAX_COMPLETENESS_ERROR);
      }

      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "checked",
          checkedById: user.id,
          checkedAt,
          sellingRateReopenedById: null,
          sellingRateReopenedAt: null,
          sellingRateReopenReason: null,
        })
        .where(
          and(
            eq(shippingNotes.id, input.id),
            eq(shippingNotes.status, "accounting_reviewing"),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.accounting_review.checked",
        entityType: "shipping_note",
        entityId: updated.id,
        before: lockedCurrent,
        after: {
          ...updated,
          checkedById: user.id,
          checkedAt,
        },
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    if (error instanceof Error && error.message === TAX_COMPLETENESS_ERROR) {
      throw error;
    }

    throw new Error("Failed to mark shipping note as checked.");
  }
}

export async function approveShippingNote(
  input: ApproveShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_APPROVE);

  const current = ensureApprovalTransitionAccess(
    await getApprovalTransitionSnapshot(input.id),
  );

  try {
    return await db.transaction(async (tx) => {
      const approvalTime = new Date();
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "approved",
          approvedById: user.id,
          approvedAt: approvalTime,
          updatedAt: approvalTime,
        })
        .where(
          and(
            eq(shippingNotes.id, input.id),
            eq(shippingNotes.status, "checked"),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.approve",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: {
          id: updated.id,
          status: "approved",
          approvedById: user.id,
          approvedAt: approvalTime,
        },
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to approve shipping note.");
  }
}

export async function lockShippingNote(
  input: LockShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_LOCK);
  const parsedInput = lockShippingNoteInputSchema.parse(input);

  const current = ensureLockTransitionAccess(
    await getLockTransitionSnapshot(parsedInput.id),
  );

  try {
    return await db.transaction(async (tx) => {
      const lockTime = new Date();
      const lockReason = parsedInput.lockReason ?? null;
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "locked",
          lockedById: user.id,
          lockedAt: lockTime,
          lockReason,
          updatedAt: lockTime,
        })
        .where(
          and(
            eq(shippingNotes.id, parsedInput.id),
            inArray(shippingNotes.status, [...LOCK_SOURCE_STATUSES]),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.lock",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: {
          id: updated.id,
          status: "locked",
          lockedById: user.id,
          lockedAt: lockTime,
          lockReason,
        },
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to lock shipping note.");
  }
}

export const closeShippingNote = lockShippingNote;

export async function unlockShippingNote(
  input: UnlockShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_UNLOCK);
  const parsedInput = unlockShippingNoteInputSchema.parse(input);

  const current = ensureUnlockTransitionAccess(
    await getLockTransitionSnapshot(parsedInput.id),
  );

  try {
    return await db.transaction(async (tx) => {
      const unlockTime = new Date();
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "approved",
          lockedById: null,
          lockedAt: null,
          lockReason: null,
          updatedAt: unlockTime,
        })
        .where(
          and(
            eq(shippingNotes.id, parsedInput.id),
            eq(shippingNotes.status, "locked"),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.unlock",
        entityType: "shipping_note",
        entityId: updated.id,
        before: current,
        after: {
          id: updated.id,
          status: "approved",
          lockedById: null,
          lockedAt: null,
          lockReason: null,
        },
        reason: parsedInput.unlockReason,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to unlock shipping note.");
  }
}

export async function cancelShippingNote(
  input: CancelShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_CANCEL);
  const parsedInput = cancelShippingNoteInputSchema.parse(input);
  const cancelReason = parsedInput.cancelReason ?? null;

  const current = ensureNormalCancellationAccess(
    await getCancellationTransitionSnapshot(parsedInput.id),
    user,
    parsedInput.expectedStatus,
    parsedInput.cancelReason,
  );

  try {
    return await db.transaction(async (tx) => {
      const cancellationTime = new Date();
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "cancelled",
          cancelledById: user.id,
          cancelledAt: cancellationTime,
          cancelReason,
          updatedAt: cancellationTime,
        })
        .where(
          and(
            eq(shippingNotes.id, parsedInput.id),
            eq(shippingNotes.status, parsedInput.expectedStatus),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.cancel",
        entityType: "shipping_note",
        entityId: updated.id,
        before: {
          id: current.id,
          status: current.status,
          cancelledById: current.cancelledById,
          cancelledAt: current.cancelledAt,
          cancelReason: current.cancelReason,
        },
        after: {
          id: updated.id,
          status: "cancelled",
          cancelledById: user.id,
          cancelledAt: cancellationTime,
          cancelReason,
        },
        reason: cancelReason,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to cancel shipping note.");
  }
}

export async function cancelFinalizedShippingNote(
  input: CancelFinalizedShippingNoteInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_CANCEL_FINALIZED);
  const parsedInput = cancelFinalizedShippingNoteInputSchema.parse(input);

  const current = ensureFinalizedCancellationAccess(
    await getCancellationTransitionSnapshot(parsedInput.id),
    parsedInput.expectedStatus,
  );

  try {
    return await db.transaction(async (tx) => {
      const cancellationTime = new Date();
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "cancelled",
          cancelledById: user.id,
          cancelledAt: cancellationTime,
          cancelReason: parsedInput.cancelReason,
          updatedAt: cancellationTime,
        })
        .where(
          and(
            eq(shippingNotes.id, parsedInput.id),
            eq(shippingNotes.status, parsedInput.expectedStatus),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.cancel",
        entityType: "shipping_note",
        entityId: updated.id,
        before: {
          id: current.id,
          status: current.status,
          cancelledById: current.cancelledById,
          cancelledAt: current.cancelledAt,
          cancelReason: current.cancelReason,
        },
        after: {
          id: updated.id,
          status: "cancelled",
          cancelledById: user.id,
          cancelledAt: cancellationTime,
          cancelReason: parsedInput.cancelReason,
        },
        reason: parsedInput.cancelReason,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to cancel finalized shipping note.");
  }
}

export async function reopenShippingNoteForCorrection(
  input: ReopenShippingNoteForCorrectionInput,
  user: DbUser,
): Promise<ShippingNoteDetail> {
  requireShippingNoteAccess(user, PERMISSIONS.SHIPPING_NOTES_REOPEN_SELLING_RATES);
  const parsedInput = reopenShippingNoteForCorrectionInputSchema.parse(input);

  const current = ensureReopenTransitionAccess(
    await getReopenTransitionSnapshot(parsedInput.id),
    parsedInput.expectedStatus,
  );

  try {
    return await db.transaction(async (tx) => {
      const reopenTime = new Date();
      const [updated] = await tx
        .update(shippingNotes)
        .set({
          status: "accounting_reviewing",
          checkedById: null,
          checkedAt: null,
          approvedById: null,
          approvedAt: null,
          sellingRateReopenedById: user.id,
          sellingRateReopenedAt: reopenTime,
          sellingRateReopenReason: parsedInput.reason,
          updatedAt: reopenTime,
        })
        .where(
          and(
            eq(shippingNotes.id, parsedInput.id),
            eq(shippingNotes.status, parsedInput.expectedStatus),
            isNull(shippingNotes.deletedAt),
          ),
        )
        .returning(shippingNoteDetailSelect);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note.selling_rate_reopened",
        entityType: "shipping_note",
        entityId: updated.id,
        before: {
          id: current.id,
          status: current.status,
          checkedById: current.checkedById,
          checkedAt: current.checkedAt,
          approvedById: current.approvedById,
          approvedAt: current.approvedAt,
          sellingRateReopenedById: null,
          sellingRateReopenedAt: null,
          sellingRateReopenReason: null,
        },
        after: {
          id: updated.id,
          status: "accounting_reviewing",
          checkedById: null,
          checkedAt: null,
          approvedById: null,
          approvedAt: null,
          sellingRateReopenedById: user.id,
          sellingRateReopenedAt: reopenTime,
          sellingRateReopenReason: parsedInput.reason,
        },
        reason: parsedInput.reason,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to reopen shipping note for correction.");
  }
}

// ---------------------------------------------------------------------------
// Selling charge mutations
// ---------------------------------------------------------------------------

/** Safe columns to return after charge mutation — mirrors query select. */
const chargeReturnColumns = {
  id: shippingNoteCharges.id,
  shippingNoteId: shippingNoteCharges.shippingNoteId,
  chargeName: shippingNoteCharges.chargeName,
  description: shippingNoteCharges.description,
  quantity: shippingNoteCharges.quantity,
  unit: shippingNoteCharges.unit,
  unitPrice: shippingNoteCharges.unitPrice,
  currency: shippingNoteCharges.currency,
  exchangeRate: shippingNoteCharges.exchangeRate,
  amountOriginal: shippingNoteCharges.amountOriginal,
  amountVnd: shippingNoteCharges.amountVnd,
  serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
  catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
  catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
  catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
  catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
  vatOverrideRate: shippingNoteCharges.vatOverrideRate,
  createdAt: shippingNoteCharges.createdAt,
  updatedAt: shippingNoteCharges.updatedAt,
} as const;

type ChargeMutationTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

async function loadChargeCatalogPersistence(
  tx: ChargeMutationTransaction,
  input: ChargeCatalogSelection,
): Promise<ChargeCatalogPersistence> {
  if (!input.serviceCatalogItemId) {
    return resolveChargeCatalogPersistence(input, null);
  }

  const [item] = await tx
    .select({
      id: serviceCatalogItems.id,
      code: serviceCatalogItems.code,
      name: serviceCatalogItems.name,
      primaryUnit: serviceCatalogItems.primaryUnit,
      vatRate: serviceCatalogItems.vatRate,
      isActive: serviceCatalogItems.isActive,
      deletedAt: serviceCatalogItems.deletedAt,
    })
    .from(serviceCatalogItems)
    .where(
      and(
        eq(serviceCatalogItems.id, input.serviceCatalogItemId),
        eq(serviceCatalogItems.isActive, true),
        isNull(serviceCatalogItems.deletedAt),
      ),
    )
    .limit(1);

  return resolveChargeCatalogPersistence(input, item ?? null);
}

const buyingChargeReturnColumns = {
  ...chargeReturnColumns,
  vendorOrAgentText: shippingNoteCharges.vendorOrAgentText,
} as const;

/**
 * Selling charges are mutable either under the original Draft rules or by an
 * Admin/Accountant while an explicit financial reopen is active.
 */
function ensureChargeMutationAccess(note: ShippingNoteDetail | null, user: DbUser): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (
    !canMutateSellingChargeForDraft(note, user) &&
    !canMutateReopenedSellingCharges(note, user)
  ) {
    throw new AuthorizationError();
  }

  return note;
}

function ensureBuyingChargeMutationAccess(
  note: ShippingNoteDetail | null,
  user: DbUser,
): ShippingNoteDetail {
  if (!note) {
    throw new AuthorizationError();
  }

  if (!canMutateBuyingChargeForActor(note.status, user)) {
    throw new AuthorizationError();
  }

  return note;
}

export async function createSellingChargeForNote(
  input: CreateSellingChargeInput,
  user: DbUser,
): Promise<SellingChargeDetail> {
  requireShippingNoteAccess(user, [
    PERMISSIONS.SHIPPING_NOTES_EDIT_OWN,
    PERMISSIONS.SHIPPING_NOTES_REOPEN_SELLING_RATES,
  ]);

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const [noteRow] = await tx
        .select(shippingNoteDetailSelect)
        .from(shippingNotes)
        .where(and(eq(shippingNotes.id, input.shippingNoteId), isNull(shippingNotes.deletedAt)))
        .limit(1)
        .for("update");
      const note = ensureChargeMutationAccess(noteRow ?? null, user);
      const catalog = await loadChargeCatalogPersistence(tx, input);
      const [created] = await tx
        .insert(shippingNoteCharges)
        .values({
          shippingNoteId: note.id,
          section: "selling",
          ...catalog,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
          vatPercent: "0",
          vatAmount: "0",
          vendorOrAgentText: null,
          isOverride: false,
          overrideReason: null,
          createdById: user.id,
        })
        .returning(chargeReturnColumns);

      if (!created) {
        throw new Error("Failed to create selling charge.");
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.create",
        entityType: "shipping_note_charge",
        entityId: created.id,
        after: created,
      });

      return created;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to create selling charge.");
  }
}

export async function updateSellingCharge(
  input: UpdateSellingChargeInput,
  user: DbUser,
): Promise<SellingChargeDetail> {
  requireShippingNoteAccess(user, [
    PERMISSIONS.SHIPPING_NOTES_EDIT_OWN,
    PERMISSIONS.SHIPPING_NOTES_REOPEN_SELLING_RATES,
  ]);

  // Load the existing charge and verify it is a non-deleted selling charge.
  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
      section: shippingNoteCharges.section,
      chargeName: shippingNoteCharges.chargeName,
      description: shippingNoteCharges.description,
      quantity: shippingNoteCharges.quantity,
      unit: shippingNoteCharges.unit,
      unitPrice: shippingNoteCharges.unitPrice,
      currency: shippingNoteCharges.currency,
      exchangeRate: shippingNoteCharges.exchangeRate,
      amountOriginal: shippingNoteCharges.amountOriginal,
      amountVnd: shippingNoteCharges.amountVnd,
      vatPercent: shippingNoteCharges.vatPercent,
      taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
      serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
      catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
      catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
      catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
      catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
      vatOverrideRate: shippingNoteCharges.vatOverrideRate,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, input.id),
        eq(shippingNoteCharges.section, "selling"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const [noteRow] = await tx
        .select(shippingNoteDetailSelect)
        .from(shippingNotes)
        .where(and(eq(shippingNotes.id, existingCharge.shippingNoteId), isNull(shippingNotes.deletedAt)))
        .limit(1)
        .for("update");
      ensureChargeMutationAccess(noteRow ?? null, user);
      const catalog = await loadChargeCatalogPersistence(tx, input);
      const [updated] = await tx
        .update(shippingNoteCharges)
        .set({
          ...catalog,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
          vatAmount: recomputeVatForCommercialChange({
            amountVnd: amounts.amountVnd,
            vatPercent: existingCharge.vatPercent,
            taxTreatmentSnapshot: existingCharge.taxTreatmentSnapshot,
          }),
        })
        .where(
          and(
            eq(shippingNoteCharges.id, input.id),
            eq(shippingNoteCharges.section, "selling"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning(chargeReturnColumns);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.update",
        entityType: "shipping_note_charge",
        entityId: updated.id,
        before: existingCharge,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to update selling charge.");
  }
}

export async function softDeleteSellingCharge(
  chargeId: string,
  shippingNoteId: string,
  user: DbUser,
): Promise<void> {
  requireShippingNoteAccess(user, [
    PERMISSIONS.SHIPPING_NOTES_EDIT_OWN,
    PERMISSIONS.SHIPPING_NOTES_REOPEN_SELLING_RATES,
  ]);

  // Load existing charge and verify it is a non-deleted selling charge.
  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
      section: shippingNoteCharges.section,
      chargeName: shippingNoteCharges.chargeName,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.shippingNoteId, shippingNoteId),
        eq(shippingNoteCharges.section, "selling"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  try {
    await db.transaction(async (tx) => {
      const [noteRow] = await tx
        .select(shippingNoteDetailSelect)
        .from(shippingNotes)
        .where(and(eq(shippingNotes.id, existingCharge.shippingNoteId), isNull(shippingNotes.deletedAt)))
        .limit(1)
        .for("update");
      ensureChargeMutationAccess(noteRow ?? null, user);
      const [deleted] = await tx
        .update(shippingNoteCharges)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(shippingNoteCharges.id, chargeId),
            eq(shippingNoteCharges.section, "selling"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning({ id: shippingNoteCharges.id });

      if (!deleted) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.delete",
        entityType: "shipping_note_charge",
        entityId: deleted.id,
        before: existingCharge,
      });
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to delete selling charge.");
  }
}

export async function createBuyingChargeForNote(
  noteId: string,
  input: CreateBuyingChargeInput,
  user: DbUser,
): Promise<BuyingChargeDetail> {
  requireShippingNoteAccess(user, [
    PERMISSIONS.BUYING_CHARGES_MANAGE,
    PERMISSIONS.BUYING_CHARGES_OPS_INPUT,
  ]);

  const note = ensureBuyingChargeMutationAccess(
    await getShippingNoteForUser(noteId, user),
    user,
  );

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const catalog = await loadChargeCatalogPersistence(tx, input);
      const [created] = await tx
        .insert(shippingNoteCharges)
        .values({
          shippingNoteId: note.id,
          section: "buying",
          ...catalog,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
          vatPercent: "0",
          vatAmount: "0",
          vendorOrAgentText: normalizeOptionalText(input.vendorOrAgentText),
          isOverride: false,
          overrideReason: null,
          createdById: user.id,
        })
        .returning(buyingChargeReturnColumns);

      if (!created) {
        throw new Error("Failed to create buying charge.");
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.buying.create",
        entityType: "shipping_note_charge",
        entityId: created.id,
        after: created,
      });

      return created;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to create buying charge.");
  }
}

export async function updateBuyingCharge(
  chargeId: string,
  input: UpdateBuyingChargeInput,
  user: DbUser,
): Promise<BuyingChargeDetail> {
  requireShippingNoteAccess(user, [
    PERMISSIONS.BUYING_CHARGES_MANAGE,
    PERMISSIONS.BUYING_CHARGES_OPS_INPUT,
  ]);

  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
      section: shippingNoteCharges.section,
      chargeName: shippingNoteCharges.chargeName,
      description: shippingNoteCharges.description,
      quantity: shippingNoteCharges.quantity,
      unit: shippingNoteCharges.unit,
      unitPrice: shippingNoteCharges.unitPrice,
      currency: shippingNoteCharges.currency,
      exchangeRate: shippingNoteCharges.exchangeRate,
      amountOriginal: shippingNoteCharges.amountOriginal,
      amountVnd: shippingNoteCharges.amountVnd,
      vendorOrAgentText: shippingNoteCharges.vendorOrAgentText,
      vatPercent: shippingNoteCharges.vatPercent,
      taxTreatmentSnapshot: shippingNoteCharges.taxTreatmentSnapshot,
      serviceCatalogItemId: shippingNoteCharges.serviceCatalogItemId,
      catalogCodeSnapshot: shippingNoteCharges.catalogCodeSnapshot,
      catalogNameSnapshot: shippingNoteCharges.catalogNameSnapshot,
      catalogUnitSnapshot: shippingNoteCharges.catalogUnitSnapshot,
      catalogVatRateSnapshot: shippingNoteCharges.catalogVatRateSnapshot,
      vatOverrideRate: shippingNoteCharges.vatOverrideRate,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.section, "buying"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  ensureBuyingChargeMutationAccess(
    await getShippingNoteForUser(existingCharge.shippingNoteId, user),
    user,
  );

  const amounts = calculateChargeAmounts({
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
  });

  try {
    return await db.transaction(async (tx) => {
      const catalog = await loadChargeCatalogPersistence(tx, input);
      const [updated] = await tx
        .update(shippingNoteCharges)
        .set({
          ...catalog,
          description: normalizeOptionalText(input.description),
          quantity: amounts.quantity,
          unitPrice: amounts.unitPrice,
          currency: input.currency,
          exchangeRate: amounts.exchangeRate,
          amountOriginal: amounts.amountOriginal,
          amountVnd: amounts.amountVnd,
          vendorOrAgentText: normalizeOptionalText(input.vendorOrAgentText),
          vatAmount: recomputeVatForCommercialChange({
            amountVnd: amounts.amountVnd,
            vatPercent: existingCharge.vatPercent,
            taxTreatmentSnapshot: existingCharge.taxTreatmentSnapshot,
          }),
        })
        .where(
          and(
            eq(shippingNoteCharges.id, chargeId),
            eq(shippingNoteCharges.section, "buying"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning(buyingChargeReturnColumns);

      if (!updated) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.buying.update",
        entityType: "shipping_note_charge",
        entityId: updated.id,
        before: existingCharge,
        after: updated,
      });

      return updated;
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to update buying charge.");
  }
}

export async function softDeleteBuyingCharge(
  chargeId: string,
  user: DbUser,
): Promise<string> {
  requireShippingNoteAccess(user, [
    PERMISSIONS.BUYING_CHARGES_MANAGE,
    PERMISSIONS.BUYING_CHARGES_OPS_INPUT,
  ]);

  const [existingCharge] = await db
    .select({
      id: shippingNoteCharges.id,
      shippingNoteId: shippingNoteCharges.shippingNoteId,
      section: shippingNoteCharges.section,
      chargeName: shippingNoteCharges.chargeName,
      vendorOrAgentText: shippingNoteCharges.vendorOrAgentText,
    })
    .from(shippingNoteCharges)
    .where(
      and(
        eq(shippingNoteCharges.id, chargeId),
        eq(shippingNoteCharges.section, "buying"),
        isNull(shippingNoteCharges.deletedAt),
      ),
    )
    .limit(1);

  if (!existingCharge) {
    throw new AuthorizationError();
  }

  ensureBuyingChargeMutationAccess(
    await getShippingNoteForUser(existingCharge.shippingNoteId, user),
    user,
  );

  try {
    await db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(shippingNoteCharges)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(shippingNoteCharges.id, chargeId),
            eq(shippingNoteCharges.section, "buying"),
            isNull(shippingNoteCharges.deletedAt),
          ),
        )
        .returning({ id: shippingNoteCharges.id });

      if (!deleted) {
        throw new AuthorizationError();
      }

      await logAuditEvent(tx, {
        actorUserId: user.id,
        action: "shipping_note_charge.buying.delete",
        entityType: "shipping_note_charge",
        entityId: deleted.id,
        before: existingCharge,
      });
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      throw error;
    }

    throw new Error("Failed to delete buying charge.");
  }

  return existingCharge.shippingNoteId;
}
