export const SHIPPING_NOTE_PARTY_ROLES = [
  "shipper",
  "consignee",
  "customer",
  "agent",
] as const;

export type ShippingNotePartyRole = (typeof SHIPPING_NOTE_PARTY_ROLES)[number];

export type ShippingNotePartyInput = {
  shipperPartnerId?: string;
  shipperText?: string;
  consigneePartnerId?: string;
  consigneeText?: string;
  customerPartnerId?: string;
  customerText?: string;
  agentPartnerId?: string;
  agentText?: string;
};

export type ShippingNotePartyPartner = {
  id: string;
  companyName: string;
  isActive: boolean;
  deletedAt: Date | null;
};

export type ShippingNotePartyPersistence = {
  shipperPartnerId: string | null;
  shipperText: string | null;
  consigneePartnerId: string | null;
  consigneeText: string | null;
  customerPartnerId: string | null;
  customerText: string | null;
  agentPartnerId: string | null;
  agentText: string | null;
};

function optionalText(value: string | undefined): string | null {
  return value ?? null;
}

export function getRequestedShippingNotePartnerIds(
  input: ShippingNotePartyInput,
): string[] {
  return Array.from(
    new Set(
      SHIPPING_NOTE_PARTY_ROLES.flatMap((role) => {
        const partnerId = input[`${role}PartnerId`];
        return partnerId ? [partnerId] : [];
      }),
    ),
  );
}

/**
 * Builds frozen Shipping Note party snapshots from explicitly selected Partners.
 * Text-only legacy input remains valid and is never fuzzy-matched to Partner Master.
 */
export function resolveShippingNotePartySnapshots(
  input: ShippingNotePartyInput,
  partners: ShippingNotePartyPartner[],
): ShippingNotePartyPersistence {
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));
  const resolved = {} as ShippingNotePartyPersistence;

  for (const role of SHIPPING_NOTE_PARTY_ROLES) {
    const partnerIdKey = `${role}PartnerId` as const;
    const textKey = `${role}Text` as const;
    const partnerId = input[partnerIdKey];

    if (!partnerId) {
      resolved[partnerIdKey] = null;
      resolved[textKey] = optionalText(input[textKey]);
      continue;
    }

    const partner = partnerById.get(partnerId);
    if (!partner || !partner.isActive || partner.deletedAt !== null) {
      throw new Error(
        `Selected ${role} Partner is missing, inactive, or deleted.`,
      );
    }

    resolved[partnerIdKey] = partner.id;
    resolved[textKey] = partner.companyName;
  }

  return resolved;
}
