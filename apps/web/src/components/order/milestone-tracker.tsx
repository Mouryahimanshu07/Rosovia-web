'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { updateOrderMetadataAction, updateOrderStatusAction } from '~/app/actions/orders';
import type { Order } from '@rosovia/core';

interface MilestoneTrackerProps {
  order: Order;
  role: 'buyer' | 'creator';
}

export function MilestoneTracker({ order, role }: MilestoneTrackerProps) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [inputUrl, setInputUrl] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Safely parse order metadata
  const metadata = (order.metadata as Record<string, any>) || {};

  const gate1SketchUrl = metadata.gate_1_sketch_url || null;
  const gate1Approved = !!metadata.gate_1_approved;
  const gate1ApprovedAt = metadata.gate_1_approved_at || null;

  const gate2WipUrl = metadata.gate_2_wip_url || null;
  const gate2Approved = !!metadata.gate_2_approved;
  const gate2ApprovedAt = metadata.gate_2_approved_at || null;

  const isBuyer = role === 'buyer';
  const isCreator = role === 'creator';

  const handleCreatorUpload = (gate: 1 | 2) => {
    if (!inputUrl.trim()) {
      setError('Please provide a valid image or file URL.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const field = gate === 1 ? 'gate_1_sketch_url' : 'gate_2_wip_url';
      const result = await updateOrderMetadataAction(order.id, { [field]: inputUrl.trim() });
      if (!result.success) {
        setError(result.error);
      } else {
        setInputUrl('');
        router.refresh();
      }
    });
  };

  const handleBuyerApprove = (gate: 1 | 2) => {
    setError(null);
    startTransition(async () => {
      const prefix = gate === 1 ? 'gate_1' : 'gate_2';
      const result = await updateOrderMetadataAction(order.id, {
        [`${prefix}_approved`]: true,
        [`${prefix}_approved_at`]: new Date().toISOString(),
      });
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  const handleBuyerCompleteOrder = () => {
    setError(null);
    startTransition(async () => {
      const result = await updateOrderStatusAction({
        orderId: order.id,
        action: 'mark_completed',
      });
      if (!result.success) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="w-full rounded-2xl bg-gradient-to-b from-gray-900 to-indigo-950 p-6 text-white shadow-xl border border-indigo-900/60 overflow-hidden">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-base font-extrabold tracking-wide bg-gradient-to-r from-indigo-200 to-teal-200 bg-clip-text text-transparent">
            Three-Gate Escrow milestone Tracker
          </h3>
          <p className="text-[11px] text-indigo-200 mt-0.5">
            Your funds are held securely in escrow and released progressively as milestones are approved.
          </p>
        </div>
        <span className="rounded-full bg-indigo-900/60 px-3 py-1 text-[10px] font-bold text-indigo-300 border border-indigo-700 uppercase tracking-widest">
          Active Escrow
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-500/25 bg-red-950/40 p-3 text-xs font-medium text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* THREE-GATE VISUAL TRACKER GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {/* GATE 1: Layout/Sketch */}
        <div className={`relative rounded-xl p-4 border transition-all duration-300 ${
          gate1Approved
            ? 'bg-indigo-950/20 border-teal-500/40'
            : gate1SketchUrl
            ? 'bg-indigo-950/40 border-indigo-500/40 animate-pulse-subtle'
            : 'bg-gray-950/40 border-gray-800'
        }`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider">Gate 01</span>
              <h4 className="text-xs font-bold text-white mt-0.5">Layout & Sketch Approval</h4>
            </div>
            {gate1Approved ? (
              <span className="text-xs text-teal-400 font-extrabold flex items-center gap-1">✓ Approved</span>
            ) : gate1SketchUrl ? (
              <span className="text-xs text-indigo-400 font-extrabold">Pending Approval</span>
            ) : (
              <span className="text-xs text-gray-500 font-medium">In Draft</span>
            )}
          </div>

          <div className="space-y-3">
            {/* Show Sketch Image Mockup */}
            {gate1SketchUrl ? (
              <div className="relative group overflow-hidden rounded-lg border border-indigo-900 bg-gray-950">
                <img
                  src={gate1SketchUrl}
                  alt="Gate 1 Layout Sketch"
                  className="w-full h-32 object-cover transition duration-300 group-hover:scale-105"
                  onError={(e) => {
                    // Fallback visual placeholder if image url is custom text
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="p-2 bg-indigo-950/80 border-t border-indigo-900 text-[10px] text-indigo-200 truncate">
                  🔗 <a href={gate1SketchUrl} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold">{gate1SketchUrl}</a>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-800 p-4 text-center text-xs text-gray-500">
                🎨 Sketch mockup draft not uploaded yet.
              </div>
            )}

            {/* Controls */}
            {!gate1Approved && (
              <>
                {isCreator && !gate1SketchUrl && (
                  <div className="space-y-2 mt-2">
                    <label className="block text-[9px] font-bold text-indigo-300 uppercase tracking-wider">Upload Sketch Mockup URL</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="https://example.com/sketch.jpg"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        disabled={isPending}
                        className="flex-1 rounded bg-gray-950 border border-gray-800 px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                      />
                      <button
                        onClick={() => handleCreatorUpload(1)}
                        disabled={isPending}
                        className="rounded bg-indigo-600 hover:bg-indigo-700 px-3 py-1 text-[11px] font-bold text-white shadow transition"
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                )}
                {isBuyer && gate1SketchUrl && (
                  <button
                    onClick={() => handleBuyerApprove(1)}
                    disabled={isPending}
                    className="w-full rounded bg-teal-500 hover:bg-teal-600 py-1.5 text-xs font-bold text-white shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 transition duration-300"
                  >
                    ✓ Approve Sketch Layout
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* GATE 2: WIP Proof */}
        <div className={`relative rounded-xl p-4 border transition-all duration-300 ${
          gate2Approved
            ? 'bg-indigo-950/20 border-teal-500/40'
            : gate2WipUrl
            ? 'bg-indigo-950/40 border-indigo-500/40 animate-pulse-subtle'
            : 'bg-gray-950/40 border-gray-800 opacity-60'
        }`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider">Gate 02</span>
              <h4 className="text-xs font-bold text-white mt-0.5">WIP Progress Approved</h4>
            </div>
            {gate2Approved ? (
              <span className="text-xs text-teal-400 font-extrabold flex items-center gap-1">✓ Approved</span>
            ) : gate2WipUrl ? (
              <span className="text-xs text-indigo-400 font-extrabold">Pending Approval</span>
            ) : (
              <span className="text-xs text-gray-500 font-medium">Locked</span>
            )}
          </div>

          <div className="space-y-3">
            {/* Show WIP Image Mockup */}
            {gate2WipUrl ? (
              <div className="relative group overflow-hidden rounded-lg border border-indigo-900 bg-gray-950">
                <img
                  src={gate2WipUrl}
                  alt="Gate 2 WIP Progress"
                  className="w-full h-32 object-cover transition duration-300 group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="p-2 bg-indigo-950/80 border-t border-indigo-900 text-[10px] text-indigo-200 truncate">
                  🔗 <a href={gate2WipUrl} target="_blank" rel="noopener noreferrer" className="hover:underline font-semibold">{gate2WipUrl}</a>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-800 p-4 text-center text-xs text-gray-500">
                {gate1Approved ? '🎨 Awaiting creator mid-point progress proof.' : '🔒 Unlock by approving Gate 1 sketch.'}
              </div>
            )}

            {/* Controls */}
            {gate1Approved && !gate2Approved && (
              <>
                {isCreator && !gate2WipUrl && (
                  <div className="space-y-2 mt-2">
                    <label className="block text-[9px] font-bold text-indigo-300 uppercase tracking-wider">Upload WIP Proof URL</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        placeholder="https://example.com/wip.jpg"
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        disabled={isPending}
                        className="flex-1 rounded bg-gray-950 border border-gray-800 px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-60"
                      />
                      <button
                        onClick={() => handleCreatorUpload(2)}
                        disabled={isPending}
                        className="rounded bg-indigo-600 hover:bg-indigo-700 px-3 py-1 text-[11px] font-bold text-white shadow transition"
                      >
                        Upload
                      </button>
                    </div>
                  </div>
                )}
                {isBuyer && gate2WipUrl && (
                  <button
                    onClick={() => handleBuyerApprove(2)}
                    disabled={isPending}
                    className="w-full rounded bg-teal-500 hover:bg-teal-600 py-1.5 text-xs font-bold text-white shadow-lg shadow-teal-500/10 hover:shadow-teal-500/20 transition duration-300"
                  >
                    ✓ Approve WIP Proof
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* GATE 3: Final Delivery & Release Escrow */}
        <div className={`relative rounded-xl p-4 border transition-all duration-300 ${
          order.order_status === 'completed'
            ? 'bg-indigo-950/20 border-teal-500/40'
            : gate2Approved
            ? 'bg-indigo-950/40 border-indigo-500/40 animate-pulse-subtle'
            : 'bg-gray-950/40 border-gray-800 opacity-60'
        }`}>
          <div className="flex items-start justify-between mb-3">
            <div>
              <span className="block text-[10px] font-bold text-teal-400 uppercase tracking-wider">Gate 03</span>
              <h4 className="text-xs font-bold text-white mt-0.5">Escrow Release & Completed</h4>
            </div>
            {order.order_status === 'completed' ? (
              <span className="text-xs text-teal-400 font-extrabold flex items-center gap-1">⚡ Released</span>
            ) : (
              <span className="text-xs text-gray-500 font-medium">Pending Release</span>
            )}
          </div>

          <div className="space-y-3">
            {/* Status mapping */}
            <div className="rounded-lg bg-gray-950/80 p-3 border border-indigo-950/60 text-xs">
              <span className="block font-bold text-indigo-300 mb-1">Fulfillment Status:</span>
              <span className="inline-flex items-center rounded-full bg-indigo-900/60 px-2 py-0.5 text-[10px] font-bold text-indigo-200 border border-indigo-700 capitalize">
                {order.order_status}
              </span>
              <p className="text-[11px] text-gray-400 mt-2">
                {order.order_status === 'completed'
                  ? 'Fulfillment fully complete. Funds successfully transferred to creator.'
                  : order.order_status === 'delivered'
                  ? 'Item delivered! Buyer, please review and release escrow.'
                  : order.order_status === 'shipped'
                  ? 'Item is currently in-transit to delivery destination.'
                  : gate2Approved
                  ? 'Fulfillment unlocked! Creator is working on final output.'
                  : 'Fulfillment locked until Gate 2 is approved.'}
              </p>
            </div>

            {/* Buyer Release Control */}
            {gate2Approved && order.order_status === 'delivered' && isBuyer && (
              <button
                onClick={handleBuyerCompleteOrder}
                disabled={isPending}
                className="w-full rounded bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 py-2 text-xs font-extrabold text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                ✓ Release Escrow & Complete Order
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
