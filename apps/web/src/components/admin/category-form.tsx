'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { adminCategoryFormSchema } from '@rosovia/core';
import type { AdminCategoryFormInput, DbCategory } from '@rosovia/core';
import { createCategoryAction, updateCategoryAction } from '~/app/dashboard/admin/categories/actions';
import { Button } from '@rosovia/ui';

interface CategoryFormProps {
  existing?: DbCategory;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CATEGORY_TYPES = ['product', 'service', 'learning', 'performance', 'mixed'] as const;

export function CategoryForm({ existing, onSuccess, onCancel }: CategoryFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!existing;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AdminCategoryFormInput>({
    resolver: zodResolver(adminCategoryFormSchema),
    defaultValues: {
      name: existing?.name ?? '',
      slug: existing?.slug ?? '',
      description: existing?.description ?? '',
      type: (existing?.type as AdminCategoryFormInput['type']) ?? 'service',
      iconName: existing?.icon_name ?? '',
      priority: existing?.priority ?? 0,
      isActive: existing?.is_active ?? true,
    },
  });

  const onSubmit = async (data: AdminCategoryFormInput) => {
    setServerError(null);

    const result = isEdit
      ? await updateCategoryAction({ ...data, categoryId: existing!.id })
      : await createCategoryAction(data);

    if (result.success) {
      onSuccess?.();
    } else {
      setServerError(result.error);
    }
  };


  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{serverError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
          <input
            {...register('name')}
            className="w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g. Photography"
          />
          {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
          <input
            {...register('slug')}
            className="w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g. photography"
          />
          {errors.slug && <p className="mt-1 text-xs text-red-500">{errors.slug.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            {...register('type')}
            className="w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            {CATEGORY_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Icon Name</label>
          <input
            {...register('iconName')}
            className="w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
            placeholder="e.g. camera"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
          <input
            type="number"
            {...register('priority', { valueAsNumber: true })}
            className="w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-5">
          <input
            type="checkbox"
            id="isActive"
            {...register('isActive')}
            className="rounded border-gray-300 text-indigo-600"
          />
          <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active</label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full rounded-md border-gray-300 py-2 px-3 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          placeholder="Short description of this category"
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>Cancel</Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : isEdit ? 'Update Category' : 'Create Category'}
        </Button>
      </div>
    </form>
  );
}
