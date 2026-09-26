import { CONTAINER_TYPE_GROUPS } from "../constants";

const controlClassName =
  "mt-1 h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export function ContainerTypeSelect({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <label className="text-sm font-medium text-foreground" htmlFor="containerType">
      Container Type
      <select
        className={controlClassName}
        defaultValue={defaultValue ?? ""}
        id="containerType"
        name="containerType"
      >
        <option value="">Select container type</option>
        {CONTAINER_TYPE_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
