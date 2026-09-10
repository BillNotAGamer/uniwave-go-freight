import { z } from "zod";

export const CUSTOMS_DECLARATION_NUMBER_MAX_LENGTH = 120;

export const addCustomsDeclarationInputSchema = z.object({
  shippingNoteId: z.string().trim().min(1),
  declarationNo: z
    .string()
    .trim()
    .min(1, "Customs Declaration No is required.")
    .max(CUSTOMS_DECLARATION_NUMBER_MAX_LENGTH),
});

export const removeCustomsDeclarationInputSchema = z.object({
  id: z.string().trim().min(1),
  shippingNoteId: z.string().trim().min(1),
});

export type AddCustomsDeclarationInput = z.infer<
  typeof addCustomsDeclarationInputSchema
>;
export type RemoveCustomsDeclarationInput = z.infer<
  typeof removeCustomsDeclarationInputSchema
>;

