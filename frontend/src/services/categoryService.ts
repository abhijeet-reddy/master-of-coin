import apiClient from '@/lib/axios';
import type { Category, ApiResponse } from '@/types';

/**
 * Get all categories for the current user
 */
export async function getCategories(): Promise<Category[]> {
  const response = await apiClient.get<ApiResponse<Category[]>>('/categories');
  return response.data.data;
}

/**
 * Get a single category by ID
 */
export async function getCategory(id: string): Promise<Category> {
  const response = await apiClient.get<ApiResponse<Category>>(`/categories/${id}`);
  return response.data.data;
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
  const response = await apiClient.post<ApiResponse<Category>>('/categories', data);
  return response.data.data;
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
  }>
): Promise<Category> {
  const response = await apiClient.put<ApiResponse<Category>>(`/categories/${id}`, data);
  return response.data.data;
}

/**
 * Delete a category
 */
export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
