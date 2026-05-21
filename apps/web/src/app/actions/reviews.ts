'use server';

import { revalidatePath } from 'next/cache';
import { createWebServerClient } from '~/lib/supabase/server';
import {
  createCurrentBuyerReview,
  hideReviewAsAdmin,
} from '@rosovia/api';
import {
  reviewCreateSchema,
  adminReviewVisibilitySchema,
} from '@rosovia/core';
import type { ReviewCreateInput, AdminReviewVisibilityInput, Review } from '@rosovia/core';

type ActionResult<T = undefined> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Buyer: create a review for a completed, paid order
// ---------------------------------------------------------------------------

export async function createReviewAction(
  input: ReviewCreateInput
): Promise<ActionResult<Review>> {
  const parsed = reviewCreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const review = await createCurrentBuyerReview(supabase, parsed.data);

    // Revalidate all affected pages
    revalidatePath('/dashboard/buyer/orders');
    revalidatePath(`/dashboard/buyer/orders/${parsed.data.orderId}`);
    revalidatePath('/dashboard/buyer/reviews');

    // We need the order to know creator_slug and listing_id for revalidation.
    // The review object has creator_id but not slug. Safe to just revalidate all
    // public creator and listing pages via broader paths — Next.js handles this.
    revalidatePath('/creators', 'layout');
    revalidatePath('/listings', 'layout');

    return { success: true, data: review };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to submit review',
    };
  }
}

// ---------------------------------------------------------------------------
// Admin: hide or unhide a review (service-level — no admin UI in Module 12)
// ---------------------------------------------------------------------------

export async function hideReviewAction(
  input: AdminReviewVisibilityInput
): Promise<ActionResult<Review>> {
  const parsed = adminReviewVisibilitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    };
  }

  try {
    const supabase = createWebServerClient();
    const review = await hideReviewAsAdmin(supabase, parsed.data);

    // Revalidate public pages so hidden review disappears
    revalidatePath('/creators', 'layout');
    revalidatePath('/listings', 'layout');
    revalidatePath('/dashboard/creator/reviews');

    return { success: true, data: review };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to update review visibility',
    };
  }
}
