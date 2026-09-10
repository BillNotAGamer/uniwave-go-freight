import type {
  ChargeSection,
  ShippingMode,
  TaxTreatment,
} from "@/features/shipping-notes/constants";

export type TaxRuleDetail = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  shippingMode: ShippingMode;
  chargeSection: ChargeSection;
  chargeNamePattern: string;
  taxTreatment: TaxTreatment;
  vatPercent: string;
  isActive: boolean;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
