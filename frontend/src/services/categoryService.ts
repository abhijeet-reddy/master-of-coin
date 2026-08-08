import apiClient from '@/lib/axios';
import type { Category } from '@/types';

/**
 * Get all categories for the current user
 */
export async function getCategories(): Promise<Category[]> {
  const response = await apiClient.get<Category[]>('/categories');
  return response.data;
}

/**
 * Get a single category by ID
 */
export async function getCategory(id: string): Promise<Category> {
  const response = await apiClient.get<Category>(`/categories/${id}`);
  return response.data;
}

/**
 * Create a new category
 */
export async function createCategory(data: {
  name: string;
  icon: string;
  color: string;
  parent_category_id?: string;
}): Promise<Category> {
  const response = await apiClient.post<Category>('/categories', data);
  return response.data;
}

/**
 * Update an existing category
 */
export async function updateCategory(
  id: string,
  data: Partial<{
    name: string;
    icon: string;
    color: string;
    parent_category_id: string;
    is_excluded_from_analysis: boolean;
  }>
): Promise<Category> {
  const response = await apiClient.put<Category>(`/categories/${id}`, data);
  return response.data;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
