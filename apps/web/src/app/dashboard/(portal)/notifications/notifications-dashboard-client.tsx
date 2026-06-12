'use client';

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Inbox,
  ClipboardList,
  CreditCard,
  AlertTriangle,
  Star,
  Shield,
  Bell,
  Check,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { Notification } from '@rosovia/core';
import {
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from '~/app/actions/notifications';

interface NotificationsDashboardClientProps {
  initialNotifications: Notification[];
  userRole: string;
}

export function NotificationsDashboardClient({
  initialNotifications,
  userRole,
}: NotificationsDashboardClientProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [isPending, startTransition] = useTransition();

  // Helper: Get notification color/icon theme
  const getTheme = (type: string) => {
    switch (type) {
      case 'message_received':
        return {
          icon: MessageSquare,
          bgClass: 'bg-blue-50 text-blue-600 border-blue-100',
          borderAccent: 'border-l-blue-500',
        };
      case 'inquiry_received':
      case 'inquiry_replied':
        return {
          icon: Inbox,
          bgClass: 'bg-amber-50 text-amber-600 border-amber-100',
          borderAccent: 'border-l-amber-500',
        };
      case 'custom_order_received':
      case 'custom_order_status_changed':
        return {
          icon: ClipboardList,
          bgClass: 'bg-emerald-50 text-emerald-600 border-emerald-100',
          borderAccent: 'border-l-emerald-500',
        };
      case 'order_created':
      case 'order_status_changed':
      case 'payment_received':
        return {
          icon: CreditCard,
          bgClass: 'bg-indigo-50 text-indigo-600 border-indigo-100',
          borderAccent: 'border-l-indigo-500',
        };
      case 'refund_requested':
      case 'dispute_opened':
        return {
          icon: AlertTriangle,
          bgClass: 'bg-rose-50 text-rose-600 border-rose-100',
          borderAccent: 'border-l-rose-500',
        };
      case 'review_received':
        return {
          icon: Star,
          bgClass: 'bg-yellow-50 text-yellow-600 border-yellow-100',
          borderAccent: 'border-l-yellow-500',
        };
      case 'verification_updated':
      case 'admin_action':
        return {
          icon: Shield,
          bgClass: 'bg-purple-50 text-purple-600 border-purple-100',
          borderAccent: 'border-l-purple-500',
        };
      default:
        return {
          icon: Bell,
          bgClass: 'bg-gray-50 text-gray-600 border-gray-100',
          borderAccent: 'border-l-gray-500',
        };
    }
  };

  // Helper: Deep link resolver
  const getNotificationUrl = (notification: Notification, role: string): string => {
    const { type, entity_id } = notification;
    switch (type) {
      case 'message_received':
        return `/messages?id=${entity_id}&role=${role}`;
      case 'inquiry_received':
        return `/dashboard/creator/inquiries`;
      case 'inquiry_replied':
        return `/dashboard/buyer/inquiries`;
      case 'custom_order_received':
        return `/dashboard/creator/custom-orders`;
      case 'custom_order_status_changed':
        return role === 'creator'
          ? `/dashboard/creator/custom-orders`
          : `/dashboard/buyer/custom-orders`;
      case 'order_created':
      case 'order_status_changed':
      case 'payment_received':
        return role === 'creator'
          ? `/dashboard/creator/orders`
          : `/dashboard/buyer/orders`;
      case 'refund_requested':
        return role === 'creator'
          ? `/dashboard/creator/refunds`
          : `/dashboard/buyer/refunds`;
      case 'dispute_opened':
        return role === 'creator'
          ? `/dashboard/creator/orders`
          : `/dashboard/buyer/orders`;
      case 'review_received':
        return `/dashboard/creator/reviews`;
      case 'verification_updated':
        return `/dashboard/creator`;
      case 'admin_action':
        return `/dashboard`;
      default:
        return `/dashboard`;
    }
  };

  // Helper: Time Ago formatting
  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Memoized stats & filtered rows
  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read_at).length,
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return notifications.filter((n) => !n.read_at);
    }
    return notifications;
  }, [notifications, activeTab]);

  // Actions
  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) return;

    // Optimistic UI update
    const previousState = [...notifications];
    const nowStr = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.read_at ? n : { ...n, read_at: nowStr }))
    );

    startTransition(async () => {
      const res = await markAllNotificationsAsReadAction();
      if (!res.success) {
        // Revert on failure
        setNotifications(previousState);
        alert(res.error || 'Failed to mark notifications as read.');
      } else {
        router.refresh();
      }
    });
  };

  const handleMarkSingleAsRead = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Avoid card click redirect

    const target = notifications.find((n) => n.id === id);
    if (!target || target.read_at) return;

    // Optimistic UI update
    const previousState = [...notifications];
    const nowStr = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: nowStr } : n))
    );

    const res = await markNotificationAsReadAction(id);
    if (!res.success) {
      setNotifications(previousState);
      alert(res.error || 'Failed to mark notification as read.');
    } else {
      router.refresh();
    }
  };

  const handleCardClick = async (notification: Notification) => {
    const targetUrl = getNotificationUrl(notification, userRole);

    // If unread, mark read first before navigating
    if (!notification.read_at) {
      const previousState = [...notifications];
      const nowStr = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read_at: nowStr } : n))
      );

      const res = await markNotificationAsReadAction(notification.id);
      if (!res.success) {
        setNotifications(previousState);
        // Fallback: still navigate even if marking read fails
      }
    }

    router.push(targetUrl);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Topbar / Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              activeTab === 'all'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            All Notifications
            <span className="ml-2 text-xs opacity-75">
              ({notifications.length})
            </span>
          </button>
          <button
            onClick={() => setActiveTab('unread')}
            className={`px-4 py-2 text-sm font-medium rounded-full transition-all ${
              activeTab === 'unread'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            Unread Only
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors disabled:opacity-50"
            id="mark-all-read-button"
          >
            <Check className="h-4 w-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Grid List of Notifications */}
      {filteredNotifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50 backdrop-blur-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 mb-4">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-gray-950">No notifications found</h3>
          <p className="mt-1 text-sm text-gray-500 max-w-sm">
            {activeTab === 'unread'
              ? "You have caught up with all updates! There are no unread notifications right now."
              : "We will notify you here when you receive new orders, inquiries, or custom work proposals."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filteredNotifications.map((notification) => {
            const { icon: IconComponent, bgClass, borderAccent } = getTheme(notification.type);
            const isUnread = !notification.read_at;

            return (
              <div
                key={notification.id}
                onClick={() => handleCardClick(notification)}
                className={`group relative flex items-start gap-4 p-5 hover:bg-gray-50/70 transition-all cursor-pointer border-l-4 ${borderAccent} ${
                  isUnread ? 'bg-indigo-50/15' : ''
                }`}
              >
                {/* Custom Icon Badge */}
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${bgClass} shadow-sm group-hover:scale-105 transition-transform duration-200`}>
                  <IconComponent className="h-5 w-5" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-sm font-semibold truncate ${
                      isUnread ? 'text-gray-950 font-bold' : 'text-gray-800'
                    }`}>
                      {notification.title}
                    </h4>
                    {isUnread && (
                      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                    )}
                  </div>
                  {notification.body && (
                    <p className={`text-sm line-clamp-2 ${
                      isUnread ? 'text-gray-700' : 'text-gray-500'
                    }`}>
                      {notification.body}
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatTimeAgo(notification.created_at)}</span>
                  </div>
                </div>

                {/* Action Controls */}
                <div className="absolute right-5 top-5 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isUnread && (
                    <button
                      onClick={(e) => handleMarkSingleAsRead(e, notification.id)}
                      className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                      title="Mark as read"
                      aria-label="Mark as read"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="p-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                    <ArrowRight className="h-4 w-4 transform group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
