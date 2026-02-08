import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';
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
        <div className="absolute bottom-full right-0 mb-2 p-3 bg-slate-800 rounded-xl shadow-xl border border-slate-700 w-48 animate-slide-up">
          <button 
            onClick={() => setShowTooltip(false)}
            className="absolute top-2 right-2 text-slate-400 hover:text-white"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
          <p className="text-sm text-white font-medium">
            Ask {shop?.assistantName || 'Yebo'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Your AI assistant is ready to help!
          </p>
        </div>
      )}

      {/* Button */}
      <button
        onClick={handleClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="ai-fab group"
      >
        <SparklesIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
        
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full bg-purple-500 animate-ping opacity-25" />
      </button>
    </div>
  );
}
