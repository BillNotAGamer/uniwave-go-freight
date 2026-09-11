export const ROUTING_LOCATION_TYPES = [
  "airport",
  "seaport",
  "inland",
  "other",
] as const;

export const ROUTING_LOCATION_APPLICABILITIES = [
  "sea_pol",
  "sea_pod",
  "sea_final_destination",
  "air_aol",
  "air_aod",
  "air_final_destination",
  "domestic_origin",
  "domestic_destination",
  "custom_origin",
  "custom_destination",
] as const;

export type RoutingLocationType = (typeof ROUTING_LOCATION_TYPES)[number];
export type RoutingLocationApplicability =
  (typeof ROUTING_LOCATION_APPLICABILITIES)[number];

export const ROUTING_LOCATION_LIFECYCLE_STATUSES = [
  "active",
  "inactive",
  "deleted",
  "all",
] as const;

export type RoutingLocationLifecycleStatus =
  (typeof ROUTING_LOCATION_LIFECYCLE_STATUSES)[number];
