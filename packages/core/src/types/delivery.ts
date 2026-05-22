// Delivery types for Rosovia Module: Delivery Confirmation

export type DeliveryStatus =
  | 'pending'
  | 'shipped'
  | 'delivered'
  | 'buyer_confirmed'
  | 'disputed'
  | 'cancelled';

export type DeliveryType = 'manual' | 'courier' | 'digital';

export interface OrderDelivery {
  id: string;
  order_id: string;
  creator_id: string;
  buyer_id: string;
  delivery_type: DeliveryType;
  tracking_reference: string | null;
  delivery_note: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  buyer_confirmed_at: string | null;
  status: DeliveryStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface CreatorShipInput {
  orderId: string;
  deliveryType?: DeliveryType;
  trackingReference?: string;
  deliveryNote?: string;
}

export interface CreatorDeliverInput {
  orderId: string;
  deliveryNote?: string;
}

export interface BuyerConfirmDeliveryInput {
  orderId: string;
}
