'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CategoryForm } from '~/components/admin/category-form';
import { AdminStatusBadge } from '~/components/admin/admin-status-badge';
import type { DbCategory } from '@rosovia/core';
import { Button } from '@rosovia/ui';

interface CategoriesClientProps {
  categories: DbCategory[];
}

export function CategoriesClient({ categories }: CategoriesClientProps) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage listing categories on the platform.</p>
        </div>
        <Button onClick={() => { setShowCreate(true); setEditingId(null); }}>
          + New Category
        </Button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Create Category</h2>
          <CategoryForm
            onSuccess={() => { setShowCreate(false); router.refresh(); }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {categories.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-10 text-center">
          <p className="text-sm text-gray-500">No categories found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => (
            <div key={cat.id}>
              <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{cat.name}</span>
                    <AdminStatusBadge status={cat.is_active ? 'active' : 'suspended'} />
                    <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">{cat.type}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    /{cat.slug} · Priority {cat.priority}
                    {cat.icon_name && ` · icon: ${cat.icon_name}`}
                  </div>
                  {cat.description && (
                    <p className="text-xs text-gray-500 mt-1 truncate max-w-lg">{cat.description}</p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingId(editingId === cat.id ? null : cat.id)}
                >
                  {editingId === cat.id ? 'Cancel' : 'Edit'}
                </Button>
              </div>
              {editingId === cat.id && (
                <div className="rounded-b-xl border border-t-0 border-gray-200 bg-gray-50 p-6">
                  <CategoryForm
                    existing={cat}
                    onSuccess={() => { setEditingId(null); router.refresh(); }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
