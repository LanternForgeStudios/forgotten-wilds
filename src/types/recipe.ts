export interface RecipeMaterial {
  /** Any of these item ids count toward this slot's `quantity`, summed across whichever ones the
   *  player actually has - see functions/src/data/recipes.ts's identical field for the full
   *  rationale (this is a display copy). */
  itemIds: string[];
  quantity: number;
}

export interface Recipe {
  outputItemId: string;
  materials: RecipeMaterial[];
}
