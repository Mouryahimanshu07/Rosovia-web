import { z } from 'zod';

export const conversationCreateSchema = z.object({
  creatorId: z.string().uuid('Creator ID must be a valid UUID'),
  orderId: z.string().uuid('Order ID must be a valid UUID').nullish(),
  inquiryId: z.string().uuid('Inquiry ID must be a valid UUID').nullish(),
});

export const messageSendSchema = z.object({
  conversationId: z.string().uuid('Conversation ID must be a valid UUID'),
  body: z
    .string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be 2000 characters or fewer'),
});

export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;
export type MessageSendInput = z.infer<typeof messageSendSchema>;
