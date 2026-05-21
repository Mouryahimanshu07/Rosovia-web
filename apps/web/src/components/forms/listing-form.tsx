'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  listingFormSchema,
  LISTING_TYPES,
  type ListingFormInput,
  type Listing,
  type DbCategory,
} from '@rosovia/core';
import {
  createListingAction,
  updateListingAction,
} from '~/app/dashboard/creator/listings/actions';
import { Button, Input } from '@rosovia/ui';

interface ListingFormProps {
  mode: 'create' | 'edit';
  categories: DbCategory[];
  existingListing?: Listing | null;
}

const LISTING_TYPE_LABELS: Record<string, string> = {
  product: 'Physical Product',
  service: 'Service',
  mentorship: 'Mentorship',
  workshop: 'Workshop',
  event_booking: 'Event Booking',
  portfolio: 'Portfolio Item',
};

function Field({ label, hint, error, children }: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function CheckboxField({ label, hint, id, ...rest }: {
  label: string; hint?: string; id: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 cursor-pointer">
      <input id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900" {...rest} />
      <div>
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    </label>
  );
}

export function ListingForm({ mode, categories, existingListing }: ListingFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const defaults: Partial<ListingFormInput> = existingListing
    ? {
        categoryId: existingListing.category_id,
        listingType: existingListing.listing_type as ListingFormInput['listingType'],
        title: existingListing.title,
        description: existingListing.description ?? '',
        price: existingListing.price !== null ? String(existingListing.price) : '',
        currency: existingListing.currency,
        stock: existingListing.stock !== null ? String(existingListing.stock) : '',
        city: existingListing.city ?? '',
        state: existingListing.state ?? '',
        customOrderAvailable: existingListing.custom_order_available,
        deliveryAvailable: existingListing.delivery_available,
        onlineAvailable: existingListing.online_available,
        offlineAvailable: existingListing.offline_available,
        deliveryDays: existingListing.metadata?.deliveryDays !== undefined ? String(existingListing.metadata.deliveryDays) : '',
        material: String(existingListing.metadata?.material ?? ''),
        techStack: String(existingListing.metadata?.techStack ?? ''),
        revisionCount: existingListing.metadata?.revisionCount !== undefined ? String(existingListing.metadata.revisionCount) : '',
        fileFormats: String(existingListing.metadata?.fileFormats ?? ''),
      }
    : {
        currency: 'INR',
        customOrderAvailable: false,
        deliveryAvailable: false,
        onlineAvailable: false,
        offlineAvailable: false,
      };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ListingFormInput>({
    resolver: zodResolver(listingFormSchema),
    defaultValues: defaults,
  });

  const onSubmit = async (values: ListingFormInput) => {
    setServerError(null);

    const price = values.price ? parseFloat(values.price) : undefined;
    const stock = values.stock ? parseInt(values.stock, 10) : undefined;
    const deliveryDays = values.deliveryDays ? parseInt(values.deliveryDays, 10) : undefined;
    const revisionCount = values.revisionCount ? parseInt(values.revisionCount, 10) : undefined;

    const metadata: Record<string, unknown> = {};
    if (deliveryDays !== undefined && !isNaN(deliveryDays)) metadata.deliveryDays = deliveryDays;
    if (values.material) metadata.material = values.material;
    if (values.techStack) metadata.techStack = values.techStack;
    if (revisionCount !== undefined && !isNaN(revisionCount)) metadata.revisionCount = revisionCount;
    if (values.fileFormats) metadata.fileFormats = values.fileFormats;

    const input = {
      categoryId: values.categoryId,
      listingType: values.listingType,
      title: values.title,
      description: values.description || undefined,
      price: price !== undefined && !isNaN(price) ? price : undefined,
      currency: values.currency || 'INR',
      stock: stock !== undefined && !isNaN(stock) ? stock : undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      customOrderAvailable: values.customOrderAvailable,
      deliveryAvailable: values.deliveryAvailable,
      onlineAvailable: values.onlineAvailable,
      offlineAvailable: values.offlineAvailable,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    };

    let result: { success: boolean; error?: string };
    if (mode === 'create') {
      result = await createListingAction(input as Parameters<typeof createListingAction>[0]);
    } else {
      if (!existingListing) { setServerError('No listing to update'); return; }
      result = await updateListingAction(existingListing.id, input as Parameters<typeof updateListingAction>[1]);
    }

    if (!result.success) {
      setServerError(result.error ?? 'Something went wrong');
      return;
    }

    router.push('/dashboard/creator/listings');
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {/* Basic info */}
      <div className="space-y-4">
        <Field label="Title *" error={errors.title?.message}>
          <Input id="title" placeholder="e.g. Handmade Clay Pot" {...register('title')} />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Listing Type *" error={errors.listingType?.message}>
            <select id="listingType" {...register('listingType')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="">Select type…</option>
              {LISTING_TYPES.map((t) => (
                <option key={t} value={t}>{LISTING_TYPE_LABELS[t] ?? t}</option>
              ))}
            </select>
          </Field>

          <Field label="Category *" error={errors.categoryId?.message}>
            <select id="categoryId" {...register('categoryId')}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="">Select category…</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description" hint="Max 3000 characters" error={errors.description?.message}>
          <textarea id="description" rows={4} placeholder="Describe your listing…"
            {...register('description')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </Field>
      </div>

      {/* Pricing */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Price" hint="Leave empty for price on request" error={errors.price?.message}>
          <Input id="price" type="number" min="0" step="0.01" placeholder="0.00" {...register('price')} />
        </Field>
        <Field label="Currency" error={errors.currency?.message}>
          <Input id="currency" placeholder="INR" {...register('currency')} />
        </Field>
        <Field label="Stock" hint="Leave empty for unlimited" error={errors.stock?.message}>
          <Input id="stock" type="number" min="0" step="1" placeholder="Unlimited" {...register('stock')} />
        </Field>
      </div>

      {/* Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="City" error={errors.city?.message}>
          <Input id="city" placeholder="Mumbai" {...register('city')} />
        </Field>
        <Field label="State" error={errors.state?.message}>
          <Input id="state" placeholder="Maharashtra" {...register('state')} />
        </Field>
      </div>

      {/* Availability */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-3">Availability</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CheckboxField id="customOrderAvailable" label="Accept Custom Orders" hint="Buyers can request customized versions" {...register('customOrderAvailable')} />
          <CheckboxField id="deliveryAvailable" label="Delivery Available" hint="Can ship to buyer's location" {...register('deliveryAvailable')} />
          <CheckboxField id="onlineAvailable" label="Online / Remote" hint="Service or session can be done online" {...register('onlineAvailable')} />
          <CheckboxField id="offlineAvailable" label="In-Person / Offline" hint="Available for in-person interaction" {...register('offlineAvailable')} />
        </div>
      </div>

      {/* Metadata */}
      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <p className="text-sm font-medium text-gray-700">Additional Details <span className="text-gray-400 font-normal">(optional)</span></p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Delivery Days" hint="Estimated delivery/completion time" error={errors.deliveryDays?.message}>
            <Input id="deliveryDays" type="number" min="0" placeholder="e.g. 7" {...register('deliveryDays')} />
          </Field>
          <Field label="Revision Count" hint="Number of revisions included" error={errors.revisionCount?.message}>
            <Input id="revisionCount" type="number" min="0" placeholder="e.g. 2" {...register('revisionCount')} />
          </Field>
          <Field label="Material" error={errors.material?.message}>
            <Input id="material" placeholder="e.g. Terracotta, Clay" {...register('material')} />
          </Field>
          <Field label="Tech Stack" error={errors.techStack?.message}>
            <Input id="techStack" placeholder="e.g. React, Node.js, PostgreSQL" {...register('techStack')} />
          </Field>
          <Field label="File Formats" hint="Deliverable file types" error={errors.fileFormats?.message}>
            <Input id="fileFormats" placeholder="e.g. PDF, PNG, SVG" {...register('fileFormats')} />
          </Field>
        </div>
      </div>

      {serverError && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-600">{serverError}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create Listing' : 'Save Changes'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push('/dashboard/creator/listings')} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
