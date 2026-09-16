export const ROUTING_LOCATION_TYPES = [
  "airport",
  "seaport",
  "inland",
  "other",
] as const;

export type RoutingLocationType = (typeof ROUTING_LOCATION_TYPES)[number];

export const ROUTING_LOCATION_LIFECYCLE_STATUSES = [
  "active",
  "inactive",
  "deleted",
  "all",
] as const;

export type RoutingLocationLifecycleStatus =
  (typeof ROUTING_LOCATION_LIFECYCLE_STATUSES)[number];
