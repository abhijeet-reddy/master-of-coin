import { apiClient } from './client';
import type { Category } from './types';

/** Fields the server accepts on create and update. Empty icon or colour means none. */
export interface CategoryWrite {
  name: string;
  icon?: string | null;
  color?: string | null;
  parent_id?: string | null;
}

/**
 * Get all categories for the current user. There is no GET /categories/:id;
 * a single category is found in this list.
 */
export async function getCategories(): Promise<Category[]> {
  const response = await apiClient.get<Category[]>('/categories');
  return response.data;
}

export async function createCategory(data: CategoryWrite): Promise<Category> {
  const response = await apiClient.post<Category>('/categories', data);
  return response.data;
}

export async function updateCategory(
  id: string,
  data: Partial<CategoryWrite & { is_excluded_from_analysis: boolean }>
): Promise<Category> {
  const response = await apiClient.put<Category>(`/categories/${id}`, data);
  return response.data;
}

/** Transactions keep their rows; their category is cleared. */
export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
