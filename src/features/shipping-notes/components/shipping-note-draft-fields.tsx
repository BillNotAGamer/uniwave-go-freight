import {
  SHIPPING_MODES,
  VOLUME_UNITS,
} from "../constants";
import type { ShippingNoteDetail } from "../types";

type ShippingNoteDraftFieldValues = Partial<
  Pick<
    ShippingNoteDetail,
    | "jobsheetNo"
    | "shippingMode"
    | "mawbHawbNo"
    | "shipperText"
    | "consigneeText"
    | "customerText"
    | "agentText"
    | "aol"
    | "aod"
    | "finalDestination"
    | "etd"
    | "eta"
    | "volumeValue"
    | "volumeUnit"
    | "exchangeRate"
  >
>;

function formatDatetimeLocalValue(value: Date | null | undefined): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function inputClassName() {
  return "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";
}

function labelClassName() {
  return "block text-sm font-medium text-slate-700";
}

type ShippingNoteDraftFieldsProps = {
  values?: ShippingNoteDraftFieldValues;
  includeJobsheetNo?: boolean;
};

export function ShippingNoteDraftFields({
  values,
  includeJobsheetNo = true,
}: ShippingNoteDraftFieldsProps) {
  return (
    <>
      {includeJobsheetNo ? (
        <label className={labelClassName()} htmlFor="jobsheetNo">
          Jobsheet No
          <input
            className={inputClassName()}
            id="jobsheetNo"
            name="jobsheetNo"
            type="text"
            defaultValue={values?.jobsheetNo ?? ""}
            required
          />
        </label>
      ) : null}

      <label className={labelClassName()} htmlFor="shippingMode">
        Shipping Mode
        <select
          className={inputClassName()}
          id="shippingMode"
          name="shippingMode"
          defaultValue={values?.shippingMode ?? SHIPPING_MODES[0]}
          required
        >
          {SHIPPING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName()} htmlFor="mawbHawbNo">
        MAWB / HAWB No
        <input
          className={inputClassName()}
          id="mawbHawbNo"
          name="mawbHawbNo"
          type="text"
          defaultValue={values?.mawbHawbNo ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="shipperText">
        Shipper
        <input
          className={inputClassName()}
          id="shipperText"
          name="shipperText"
          type="text"
          defaultValue={values?.shipperText ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="consigneeText">
        Consignee
        <input
          className={inputClassName()}
          id="consigneeText"
          name="consigneeText"
          type="text"
          defaultValue={values?.consigneeText ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="customerText">
        Customer
        <input
          className={inputClassName()}
          id="customerText"
          name="customerText"
          type="text"
          defaultValue={values?.customerText ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="agentText">
        Agent
        <input
          className={inputClassName()}
          id="agentText"
          name="agentText"
          type="text"
          defaultValue={values?.agentText ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="aol">
        AOL
        <input
          className={inputClassName()}
          id="aol"
          name="aol"
          type="text"
          defaultValue={values?.aol ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="aod">
        AOD
        <input
          className={inputClassName()}
          id="aod"
          name="aod"
          type="text"
          defaultValue={values?.aod ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="finalDestination">
        Final Destination
        <input
          className={inputClassName()}
          id="finalDestination"
          name="finalDestination"
          type="text"
          defaultValue={values?.finalDestination ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="etd">
        ETD
        <input
          className={inputClassName()}
          id="etd"
          name="etd"
          type="datetime-local"
          defaultValue={formatDatetimeLocalValue(values?.etd)}
        />
      </label>

      <label className={labelClassName()} htmlFor="eta">
        ETA
        <input
          className={inputClassName()}
          id="eta"
          name="eta"
          type="datetime-local"
          defaultValue={formatDatetimeLocalValue(values?.eta)}
        />
      </label>

      <label className={labelClassName()} htmlFor="volumeValue">
        Volume Value
        <input
          className={inputClassName()}
          id="volumeValue"
          name="volumeValue"
          type="number"
          min="0"
          step="0.001"
          defaultValue={values?.volumeValue ?? ""}
        />
      </label>

      <label className={labelClassName()} htmlFor="volumeUnit">
        Volume Unit
        <select
          className={inputClassName()}
          id="volumeUnit"
          name="volumeUnit"
          defaultValue={values?.volumeUnit ?? ""}
        >
          <option value="">Select volume unit</option>
          {VOLUME_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
      </label>

      <label className={labelClassName()} htmlFor="exchangeRate">
        Exchange Rate
        <input
          className={inputClassName()}
          id="exchangeRate"
          name="exchangeRate"
          type="number"
          min="0"
          step="0.000001"
          defaultValue={values?.exchangeRate ?? "1"}
        />
      </label>
    </>
  );
}
