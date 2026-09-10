import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChatBubbleLeftRightIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';

export function AIFloatingButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { shop } = useAuthStore();
  const [showTooltip, setShowTooltip] = useState(false);

  // Don't show on assistant page
  if (location.pathname === '/assistant') return null;

  const handleClick = () => {
    navigate('/assistant');
  };

  return (
    <div className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40">
      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full right-0 mb-2 p-3 w-52 rounded-sharp border border-line-strong bg-cream shadow-[0_1px_2px_rgba(26,24,20,0.04),0_10px_30px_-12px_rgba(26,24,20,0.18)] animate-slide-up">
          <button 
            onClick={() => setShowTooltip(false)}
            className="absolute top-2 right-2 text-mute hover:text-ink"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
          <p className="text-sm text-ink font-medium">
            Ask {shop?.assistantName || 'Yebo'}
          </p>
          <p className="text-xs text-mute mt-1">
            Ask about today's takings, stock or a slow line.
          </p>
        </div>
      )}

      {/* Button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="ai-fab"
        aria-label="Ask the assistant"
      >
        <ChatBubbleLeftRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
