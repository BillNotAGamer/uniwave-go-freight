"use server";

import { revalidatePath } from "next/cache";

import { requireAuthenticatedUser } from "@/lib/auth/session";

import {
  RoutingLocationConflictError,
  createRoutingLocation,
  deactivateRoutingLocation,
  restoreRoutingLocation,
  updateRoutingLocation,
} from "./mutations";
import {
  createRoutingLocationInputSchema,
  updateRoutingLocationInputSchema,
} from "./validators";

export type LocationAdminActionResult = {
  ok: boolean;
  message?: string;
  error?: string;
  locationId?: string;
};

function readString(formData: Pick<FormData, "get">, key: string): string | undefined {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStrings(formData: Pick<FormData, "getAll">, key: string): string[] {
  return formData.getAll(key).filter((value): value is string => typeof value === "string");
}

function revalidateLocations(id?: string): void {
  revalidatePath("/admin/master-data/locations");
  revalidatePath("/admin/master-data/locations/new");
  if (id) revalidatePath(`/admin/master-data/locations/${id}`);
}

function actionError(error: unknown, fallback: string): LocationAdminActionResult {
  if (error instanceof RoutingLocationConflictError) {
    return { ok: false, error: "A Location with this type and code already exists." };
  }
  if (error instanceof Error && "issues" in error) {
    return { ok: false, error: "Please correct the Location details and try again." };
  }
  return { ok: false, error: fallback };
}

export async function createRoutingLocationAdminAction(
  _state: LocationAdminActionResult,
  formData: FormData,
): Promise<LocationAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = createRoutingLocationInputSchema.safeParse({
    code: readString(formData, "code"),
    name: readString(formData, "name"),
    type: readString(formData, "type"),
    countryCode: readString(formData, "countryCode"),
    subdivision: readString(formData, "subdivision"),
    applicabilities: readStrings(formData, "applicabilities"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid Location details." };
  }
  try {
    const location = await createRoutingLocation(parsed.data, user);
    revalidateLocations(location.id);
    return { ok: true, message: "Location created.", locationId: location.id };
  } catch (error) {
    return actionError(error, "Location could not be created.");
  }
}

export async function updateRoutingLocationAdminAction(
  _state: LocationAdminActionResult,
  formData: FormData,
): Promise<LocationAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const parsed = updateRoutingLocationInputSchema.safeParse({
    id: readString(formData, "id"),
    code: readString(formData, "code"),
    name: readString(formData, "name"),
    type: readString(formData, "type"),
    countryCode: readString(formData, "countryCode"),
    subdivision: readString(formData, "subdivision"),
    applicabilities: readStrings(formData, "applicabilities"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid Location details." };
  }
  try {
    await updateRoutingLocation(parsed.data.id, parsed.data, user);
    revalidateLocations(parsed.data.id);
    return { ok: true, message: "Location updated." };
  } catch (error) {
    return actionError(error, "Location could not be updated.");
  }
}

export async function deactivateRoutingLocationAdminAction(
  _state: LocationAdminActionResult,
  formData: FormData,
): Promise<LocationAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const id = readString(formData, "id");
  if (!id || readString(formData, "confirmation") !== "confirmed") {
    return { ok: false, error: "Confirmation is required before deactivating this Location." };
  }
  try {
    await deactivateRoutingLocation(id, user);
    revalidateLocations(id);
    return { ok: true, message: "Location deactivated." };
  } catch (error) {
    return actionError(error, "Location could not be deactivated.");
  }
}

export async function restoreRoutingLocationAdminAction(
  _state: LocationAdminActionResult,
  formData: FormData,
): Promise<LocationAdminActionResult> {
  const { user } = await requireAuthenticatedUser();
  const id = readString(formData, "id");
  if (!id) return { ok: false, error: "Location ID is required." };
  try {
    await restoreRoutingLocation(id, user);
    revalidateLocations(id);
    return { ok: true, message: "Location reactivated." };
  } catch (error) {
    return actionError(error, "Location could not be reactivated.");
  }
}
