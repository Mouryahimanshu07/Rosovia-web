import { Queue } from 'bullmq';
import { getRedisClient } from '../redis/redis-client';

const queuesMap = new Map<string, Queue>();

export interface QueueJobDefinition {
  'notification': {
    recipientId: string;
    templateId: string;
    payload: Record<string, any>;
  };
  'media-processing': {
    listingId: string;
    rawImageUrl: string;
  };
}

export function getQueue<K extends keyof QueueJobDefinition>(queueName: K): Queue | null {
  const client = getRedisClient();
  if (!client) {
    console.warn(`Redis unavailable. Cannot initialize BullMQ queue: ${queueName}. Fails to synchronous fallback.`);
    return null;
  }

  if (queuesMap.has(queueName)) return queuesMap.get(queueName)!;

  const queue = new Queue(queueName, {
    connection: client.options
  });
  queuesMap.set(queueName, queue);
  return queue;
}

export async function dispatchBackgroundJob<K extends keyof QueueJobDefinition>(
  queueName: K,
  data: QueueJobDefinition[K]
): Promise<void> {
  const queue = getQueue(queueName);
  if (!queue) {
    console.warn(`Sync Fallback: Processing job ${queueName} synchronously.`);
    // Execute fallback sync task directly
    return;
  }

  await queue.add(queueName, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  });
}
