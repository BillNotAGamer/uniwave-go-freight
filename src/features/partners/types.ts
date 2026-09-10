import type { PartnerCategoryCode } from "./constants";

export interface PartnerContactDetail {
  id: string;
  partnerId: string;
  picName: string | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PartnerCategoryDetail {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface BusinessPartnerDetail {
  id: string;
  vendorCode: string | null;
  companyName: string;
  address: string | null;
  taxId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  contacts: PartnerContactDetail[];
  categories: PartnerCategoryDetail[];
}

export interface BusinessPartnerListItem {
  id: string;
  vendorCode: string | null;
  companyName: string;
  address: string | null;
  taxId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  categories: PartnerCategoryDetail[];
}

export interface ListPartnersFilter {
  activeOnly?: boolean;
  categoryCode?: PartnerCategoryCode;
  search?: string;
  limit?: number;
  offset?: number;
}
