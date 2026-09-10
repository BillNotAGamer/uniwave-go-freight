export const PARTNER_CATEGORY_CODES = [
  "factory_sea",
  "air_factory",
  "airline",
  "co_loader_buying",
  "co_loader_selling",
  "oversea_agent_selling",
  "oversea_agent_buying",
] as const;

export type PartnerCategoryCode = (typeof PARTNER_CATEGORY_CODES)[number];

export interface CanonicalPartnerCategory {
  readonly code: PartnerCategoryCode;
  readonly name: string;
  readonly description: string;
}

export const CANONICAL_PARTNER_CATEGORIES: readonly CanonicalPartnerCategory[] = [
  {
    code: "factory_sea",
    name: "FACTORY SEA",
    description: "Sea freight factory / direct shipper partners",
  },
  {
    code: "air_factory",
    name: "AIR FACTORY DATA",
    description: "Air freight factory / direct shipper partners",
  },
  {
    code: "airline",
    name: "DATA HÃNG BAY",
    description: "Airlines and direct air carriers",
  },
  {
    code: "co_loader_buying",
    name: "CO_LOADER BUYING",
    description: "Co-loader vendors / buying rate partners",
  },
  {
    code: "co_loader_selling",
    name: "CO_LOADER SELLING",
    description: "Co-loader customer / selling rate partners",
  },
  {
    code: "oversea_agent_selling",
    name: "AGENT OVERSEA SELLING",
    description: "Overseas agents (selling / customer side)",
  },
  {
    code: "oversea_agent_buying",
    name: "AGENT OVERSEA BUYING",
    description: "Overseas agents (buying / vendor side)",
  },
] as const;

export const PARTNER_CATEGORY_LABELS: Record<PartnerCategoryCode, string> = {
  factory_sea: "FACTORY SEA",
  air_factory: "AIR FACTORY DATA",
  airline: "DATA HÃNG BAY",
  co_loader_buying: "CO_LOADER BUYING",
  co_loader_selling: "CO_LOADER SELLING",
  oversea_agent_selling: "AGENT OVERSEA SELLING",
  oversea_agent_buying: "AGENT OVERSEA BUYING",
};
