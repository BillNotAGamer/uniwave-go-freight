import type {
  ShippingNotePartyPartner,
  ShippingNotePartyPersistence,
} from "./party-snapshots";
import { resolveShippingNotePartySnapshots } from "./party-snapshots";
import type { ShippingNoteActor, ShippingNoteDetail } from "./types";
import {
  createShippingNoteDraftInputSchema,
  type CreateShippingNoteDraftInput,
} from "./validators";

export type ShippingNoteDuplicationDraft = {
  input: CreateShippingNoteDraftInput;
  partyPersistence: ShippingNotePartyPersistence;
};

function optional<T>(value: T | null | undefined): T | undefined {
  return value ?? undefined;
}

export function canDuplicateShippingNote(
  source: Pick<ShippingNoteDetail, "createdById">,
  actor: ShippingNoteActor,
): boolean {
  if (actor.role === "admin") {
    return true;
  }

  return (
    (actor.role === "sale" || actor.role === "ops") &&
    source.createdById === actor.id
  );
}

/**
 * Produces the same canonical input used by new Draft creation. Partner links
 * survive only while the referenced Partner is currently active; otherwise the
 * source note's frozen text remains as a legacy-safe snapshot.
 */
export function buildShippingNoteDuplicationDraft(
  source: ShippingNoteDetail,
  newJobsheetNo: string,
  partners: ShippingNotePartyPartner[],
): ShippingNoteDuplicationDraft {
  const activePartnerIds = new Set(
    partners
      .filter((partner) => partner.isActive && partner.deletedAt === null)
      .map((partner) => partner.id),
  );

  const input = createShippingNoteDraftInputSchema.parse({
    jobsheetNo: newJobsheetNo,
    commodityHsCode: optional(source.commodityHsCode),
    commodity: optional(source.commodity),
    hsCode: optional(source.hsCode),
    containerType: optional(source.containerType),
    containerNo: optional(source.containerNo),
    sealNo: optional(source.sealNo),
    carrierName: optional(source.carrierName),
    grossWeight: optional(source.grossWeight),
    chargeableWeight: optional(source.chargeableWeight),
    licensePlate: optional(source.licensePlate),
    driverInformation: optional(source.driverInformation),
    vehiclePayloadCapacity: optional(source.vehiclePayloadCapacity),
    shippingMode: source.shippingMode,
    mawbHawbNo: optional(source.mawbHawbNo),
    shipperPartnerId:
      source.shipperPartnerId && activePartnerIds.has(source.shipperPartnerId)
        ? source.shipperPartnerId
        : undefined,
    shipperText: optional(source.shipperText),
    consigneePartnerId:
      source.consigneePartnerId && activePartnerIds.has(source.consigneePartnerId)
        ? source.consigneePartnerId
        : undefined,
    consigneeText: optional(source.consigneeText),
    customerPartnerId:
      source.customerPartnerId && activePartnerIds.has(source.customerPartnerId)
        ? source.customerPartnerId
        : undefined,
    customerText: optional(source.customerText),
    agentPartnerId:
      source.agentPartnerId && activePartnerIds.has(source.agentPartnerId)
        ? source.agentPartnerId
        : undefined,
    agentText: optional(source.agentText),
    domesticOrigin: optional(source.domesticOrigin),
    domesticDestination: optional(source.domesticDestination),
    customModeName: optional(source.customModeName),
    customOrigin: optional(source.customOrigin),
    customDestination: optional(source.customDestination),
    aol: optional(source.aol),
    aod: optional(source.aod),
    portOfLoading: optional(source.portOfLoading),
    portOfDischarge: optional(source.portOfDischarge),
    finalDestination: optional(source.finalDestination),
    mawbNo: optional(source.mawbNo),
    hawbNo: optional(source.hawbNo),
    mblNo: optional(source.mblNo),
    hblNo: optional(source.hblNo),
    flightNo: optional(source.flightNo),
    vesselName: optional(source.vesselName),
    voyageNo: optional(source.voyageNo),
    etd: optional(source.etd),
    eta: optional(source.eta),
    volumeValue: optional(source.volumeValue),
    volumeUnit: optional(source.volumeUnit),
    // A duplicate intentionally receives the standard new-Draft default of 1.
    exchangeRate: undefined,
  });

  return {
    input,
    partyPersistence: resolveShippingNotePartySnapshots(input, partners),
  };
}
