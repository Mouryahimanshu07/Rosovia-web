import { z } from 'zod';

export const creatorShipSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  deliveryType: z.enum(['manual', 'courier', 'digital']).default('manual'),
  trackingReference: z.string().max(200, 'Tracking reference must be 200 characters or fewer').optional().nullish(),
  deliveryNote: z.string().max(2000, 'Delivery note must be 2000 characters or fewer').optional().nullish(),
});

export const creatorDeliverSchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
  deliveryNote: z.string().max(2000, 'Delivery note must be 2000 characters or fewer').optional().nullish(),
});

export const buyerConfirmDeliverySchema = z.object({
  orderId: z.string().uuid('Order ID must be a valid UUID'),
});
