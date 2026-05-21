// Payout types for Rosovia – creator_payouts table

export type PayoutStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export type PayoutProvider = 'razorpay' | 'manual';

export interface CreatorPayout {
  id: string;
  creator_id: string;
  order_id: string;
  payment_id: string | null;
  amount: number;
  currency: string;
  status: PayoutStatus;
  provider: PayoutProvider;
  provider_transfer_id: string | null;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PayoutListParams {
  status?: PayoutStatus;
  page?: number;
}
