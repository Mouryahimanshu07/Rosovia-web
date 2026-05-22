// Payout types for Rosovia – creator_payouts table

export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'paid'
  | 'failed'
  | 'on_hold'
  | 'cancelled';

export type PayoutProvider = 'manual' | 'razorpayx' | 'bank_transfer';

export interface CreatorPayout {
  id: string;
  creator_id: string;
  order_id: string;
  payment_id: string | null;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider | null;
  provider_reference: string | null;
  scheduled_at: string | null;
  processing_started_at: string | null;
  paid_at: string | null;
  failure_reason: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PayoutListParams {
  status?: PayoutStatus;
  page?: number;
}

