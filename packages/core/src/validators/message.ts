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
    .max(2000, 'Message must be 2000 characters or fewer')
    .optional()
    .or(z.literal('')),
  attachmentUrl: z.string().optional().nullable(),
  messageType: z.string().optional(),
}).refine(data => (data.body && data.body.trim().length > 0) || data.attachmentUrl, {
  message: 'Message cannot be empty',
  path: ['body'],
});

export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;
export type MessageSendInput = z.infer<typeof messageSendSchema>;
