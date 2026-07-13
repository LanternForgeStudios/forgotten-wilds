export interface RecipeMaterial {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  outputItemId: string;
  materials: RecipeMaterial[];
}
