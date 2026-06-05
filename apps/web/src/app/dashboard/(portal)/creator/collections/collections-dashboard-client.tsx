'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Edit3, Check, X, FolderKanban, Info, Eye, Layers } from 'lucide-react';
import type { CollectionWithItems, Listing } from '@rosovia/core';
import {
  createCollectionAction,
  updateCollectionAction,
  deleteCollectionAction,
  addListingToCollectionAction,
  removeListingFromCollectionAction,
} from '~/app/actions/creator-collections';

interface CollectionsDashboardClientProps {
  initialCollections: CollectionWithItems[];
  listings: Listing[];
}

export function CollectionsDashboardClient({
  initialCollections,
  listings,
}: CollectionsDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Dialog State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedCollection, setSelectedCollection] = useState<CollectionWithItems | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Item management state
  const [manageItemsOpen, setManageItemsOpen] = useState(false);
  const [activeCollectionForItems, setActiveCollectionForItems] = useState<CollectionWithItems | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedCollection(null);
    setName('');
    setDescription('');
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (collection: CollectionWithItems) => {
    setModalMode('edit');
    setSelectedCollection(collection);
    setName(collection.name);
    setDescription(collection.description || '');
    setErrorMsg('');
    setModalOpen(true);
  };

  const handleSaveCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Collection name is required');
      return;
    }

    startTransition(async () => {
      setErrorMsg('');
      let result;
      if (modalMode === 'create') {
        result = await createCollectionAction(name, description);
      } else {
        if (!selectedCollection) return;
        result = await updateCollectionAction(selectedCollection.id, {
          name,
          description,
        });
      }

      if (result.success) {
        setModalOpen(false);
        router.refresh();
      } else {
        setErrorMsg(result.error);
      }
    });
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (!confirm('Are you sure you want to delete this collection? Listings will not be deleted.')) {
      return;
    }

    startTransition(async () => {
      const result = await deleteCollectionAction(collectionId);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error);
      }
    });
  };

  const openManageItems = (collection: CollectionWithItems) => {
    setActiveCollectionForItems(collection);
    setManageItemsOpen(true);
  };

  const toggleListingInCollection = async (listingId: string, isInCollection: boolean) => {
    if (!activeCollectionForItems) return;
    setActionLoadingId(listingId);

    try {
      let result;
      if (isInCollection) {
        // Remove it
        result = await removeListingFromCollectionAction(activeCollectionForItems.id, listingId);
      } else {
        // Add it
        result = await addListingToCollectionAction(activeCollectionForItems.id, listingId);
      }

      if (result.success) {
        // Update local state temporarily for smooth feel before refresh
        const updatedItems = isInCollection
          ? activeCollectionForItems.items.filter((item) => item.listing_id !== listingId)
          : [
              ...activeCollectionForItems.items,
              {
                id: Math.random().toString(),
                collection_id: activeCollectionForItems.id,
                listing_id: listingId,
                sort_order: 0,
                created_at: new Date().toISOString(),
                listings: listings.find((l) => l.id === listingId) as any,
              },
            ];

        const updatedCollection = {
          ...activeCollectionForItems,
          items: updatedItems,
        };

        setActiveCollectionForItems(updatedCollection);
        router.refresh();
      } else {
        alert(result.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/40 backdrop-blur-md p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Showcase Creator</h2>
            <p className="text-xs text-gray-500">Group listings to feature on your public profile</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-xs font-semibold text-white px-4 py-2 shadow-sm transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Create Collection
        </button>
      </div>

      {/* Grid of collections */}
      {initialCollections.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white/50 backdrop-blur-sm p-16 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center text-gray-400 mb-4 border border-gray-100">
            <FolderKanban className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">No Featured Collections</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-6">
            Group your selected custom services or products together to tell a story or feature a specific set of skills.
          </p>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white px-4 py-2 transition"
          >
            Create Your First Showcase
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {initialCollections.map((collection) => (
            <div
              key={collection.id}
              className="group relative flex flex-col justify-between rounded-2xl border border-gray-100 bg-white/70 backdrop-blur-sm hover:bg-white hover:shadow-md hover:border-gray-200/80 transition-all duration-300 p-5 shadow-sm overflow-hidden"
            >
              {/* Top Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-60 group-hover:opacity-100 transition-opacity" />

              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {collection.name}
                    </h3>
                    <span className="inline-flex items-center text-[10px] text-gray-400 font-mono mt-0.5">
                      /{collection.slug}
                    </span>
                  </div>

                  {/* Badges/Counts */}
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 border border-indigo-100/50">
                    {collection.items?.length || 0} listings
                  </span>
                </div>

                <p className="text-xs text-gray-500 line-clamp-2 min-h-[2rem]">
                  {collection.description || 'No description provided.'}
                </p>

                {/* Sublist of nested items */}
                {collection.items && collection.items.length > 0 ? (
                  <div className="pt-2 border-t border-gray-50">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-gray-400 mb-2">
                      Included Listings
                    </p>
                    <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {collection.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex justify-between items-center bg-gray-50/60 p-2 rounded-lg text-xs"
                        >
                          <span className="text-gray-700 font-medium truncate max-w-[70%]">
                            {item.listings?.title}
                          </span>
                          <span className="text-[10px] text-gray-400 bg-gray-100/80 px-1.5 py-0.5 rounded font-mono">
                            {item.listings?.price !== null
                              ? `${item.listings?.currency} ${item.listings?.price}`
                              : 'Free'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="pt-2 border-t border-gray-50 flex items-center gap-1.5 text-amber-600">
                    <Info className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">Empty showcase. Add listings to show on your profile.</span>
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex justify-between items-center border-t border-gray-100 pt-4 mt-5">
                <button
                  onClick={() => openManageItems(collection)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 active:scale-95 text-xs font-semibold text-gray-700 px-3 py-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5 text-gray-500" />
                  Manage Items
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => openEditModal(collection)}
                    className="p-1.5 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-gray-50 active:scale-95 transition-all"
                    title="Edit name/description"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteCollection(collection.id)}
                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-gray-50 active:scale-95 transition-all"
                    title="Delete Showcase"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Creation/Editing Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden transform scale-100 transition-all">
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-gray-900">
                {modalMode === 'create' ? 'Create Featured Showcase' : 'Edit Showcase Details'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCollection} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 bg-rose-50 text-xs font-semibold text-rose-700 rounded-lg border border-rose-100 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  {errorMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Showcase Name</label>
                <input
                  type="text"
                  placeholder="e.g. Handmade Terracotta Pots"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  disabled={isPending}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700">Description</label>
                <textarea
                  placeholder="Tell buyers why you grouped these items or what makes this custom set unique..."
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition resize-none"
                  disabled={isPending}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 transition"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 shadow-sm transition"
                  disabled={isPending}
                >
                  {isPending ? 'Saving...' : 'Save Showcase'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Management Modal */}
      {manageItemsOpen && activeCollectionForItems && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  Manage Listings inside: {activeCollectionForItems.name}
                </h3>
                <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                  Select approved listings to group under this Showcase
                </p>
              </div>
              <button
                onClick={() => setManageItemsOpen(false)}
                className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1.5 rounded-lg transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {listings.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <p className="text-xs font-medium text-gray-600">No active, approved listings found.</p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Only approved listings can be added to featured showcases.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {listings.map((listing) => {
                    const isInCollection = activeCollectionForItems.items.some(
                      (item) => item.listing_id === listing.id
                    );
                    const isLoading = actionLoadingId === listing.id;

                    return (
                      <div
                        key={listing.id}
                        onClick={() => !isLoading && toggleListingInCollection(listing.id, isInCollection)}
                        className={`flex justify-between items-center border p-3 rounded-xl cursor-pointer hover:border-indigo-400 transition-all duration-200 ${
                          isInCollection
                            ? 'border-indigo-200 bg-indigo-50/20'
                            : 'border-gray-100 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 max-w-[80%]">
                          <div
                            className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                              isInCollection
                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                : 'border-gray-300 bg-white text-transparent'
                            }`}
                          >
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-900 truncate">
                              {listing.title}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400 capitalize">
                                {listing.listing_type}
                              </span>
                              <span className="text-[10px] text-gray-300">•</span>
                              <span className="text-[10px] font-semibold text-indigo-600">
                                {listing.price !== null
                                  ? `${listing.currency} ${listing.price}`
                                  : 'Free'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {isLoading && (
                          <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-gray-50 border-t border-gray-100 px-6 py-4 flex justify-end shrink-0">
              <button
                onClick={() => setManageItemsOpen(false)}
                className="px-5 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
