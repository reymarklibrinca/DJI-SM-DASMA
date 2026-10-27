import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface SwipeableCardProps {
  id: string;
  onDelete: (id: string) => void;
  children: React.ReactNode;
}

export const SwipeableCard: React.FC<SwipeableCardProps> = ({ id, onDelete, children }) => {
  const [offsetX, setOffsetX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const startXRef = useRef(0);
  const currentOffsetRef = useRef(0);

  // Touch handlers (Mobile / Tablet)
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentOffsetRef.current = offsetX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const diffX = e.touches[0].clientX - startXRef.current;
    // Only allow swiping to the left (negative offset)
    const newOffset = Math.min(0, Math.max(-140, currentOffsetRef.current + diffX));
    setOffsetX(newOffset);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);

    // If swiped past threshold (-85px), trigger delete
    if (offsetX < -85) {
      triggerDelete();
    } else if (offsetX < -35) {
      // Snap open to show delete tray (-80px)
      setOffsetX(-80);
    } else {
      // Snap closed
      setOffsetX(0);
    }
  };

  // Pointer / Mouse Drag handlers (Desktop / Mouse)
  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button, input, textarea, a, select')) return;
    startXRef.current = e.clientX;
    currentOffsetRef.current = offsetX;
    setIsDragging(true);
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const diffX = e.clientX - startXRef.current;
    const newOffset = Math.min(0, Math.max(-140, currentOffsetRef.current + diffX));
    setOffsetX(newOffset);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (offsetX < -85) {
      triggerDelete();
    } else if (offsetX < -35) {
      setOffsetX(-80);
    } else {
      setOffsetX(0);
    }
  };

  const triggerDelete = () => {
    setIsDeleting(true);
    setOffsetX(-320);
    setTimeout(() => {
      onDelete(id);
    }, 180);
  };

  return (
    <div
      className={`relative overflow-hidden rounded-xl transition-all duration-200 select-none ${
        isDeleting ? 'max-h-0 opacity-0 my-0 py-0 border-0 pointer-events-none' : 'max-h-[350px]'
      }`}
    >
      {/* Background Revealed Delete Action Tray */}
      <div
        onClick={triggerDelete}
        className="absolute inset-y-0 right-0 w-24 bg-rose-600 hover:bg-rose-700 text-white flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors z-0"
        title="Tap to Delete"
      >
        <Trash2 className="w-4 h-4 text-white animate-in zoom-in-50 duration-150" />
        <span className="text-[10px] font-black uppercase tracking-wider">Delete</span>
      </div>

      {/* Foreground Swipeable Card */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isDragging ? 'none' : 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative z-10 bg-white touch-pan-y shadow-2xs"
      >
        {children}
      </div>
    </div>
  );
};
