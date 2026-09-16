import type {
  RoutingLocationLifecycleStatus,
  RoutingLocationType,
} from "./constants";

export interface RoutingLocationDetail {
  id: string;
  code: string;
  name: string;
  type: RoutingLocationType;
  countryCode: string | null;
  subdivision: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type RoutingLocationListItem = RoutingLocationDetail;

export interface ListRoutingLocationsFilter {
  search?: string;
  type?: RoutingLocationType;
  status?: RoutingLocationLifecycleStatus;
  limit?: number;
  offset?: number;
}
