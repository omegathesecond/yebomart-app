import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  BoltIcon,
  XMarkIcon,
  ShoppingCartIcon,
  ArrowLeftIcon
} from '@heroicons/react/24/outline';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useCartStore, useCartSubtotal, useCartTaxBreakdown } from '@/stores/cartStore';
import { formatCurrency, type Product } from '@/types';

export function MobilePOS() {
  const navigate = useNavigate();
  const { user, shop } = useAuthStore();
  const { products, loadAll, getProductByBarcode, searchProducts } = useInventoryStore();
  const { items, addItem, updateQuantity, removeItem, checkout, clear } = useCartStore();
  const cartSubtotal = useCartSubtotal();
  const taxBreakdown = useCartTaxBreakdown();
  const cartTotal = taxBreakdown.total;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load products on mount
  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  // Initialize barcode scanner
  useEffect(() => {
    let mounted = true;
    let scanner: Html5Qrcode | null = null;

    const initScanner = async () => {
      try {
        if (!scannerContainerRef.current) return;

        scanner = new Html5Qrcode('mobile-scanner-region');
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 120 },
          aspectRatio: 1.777,
          disableFlip: false,
        };

        await scanner.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            if (mounted) {
              handleBarcodeScan(decodedText);
            }
          },
          () => {
            // QR code parsing failure - ignore
          }
        );

        if (mounted) {
          setScannerReady(true);
          setScannerError(null);
        }
      } catch (err: any) {
        console.error('Scanner init failed:', err);
        if (mounted) {
          setScannerError(
            err.name === 'NotAllowedError'
              ? 'Camera permission denied. Please allow camera access.'
              : 'Could not start camera. Try manual search below.'
          );
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(initScanner, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scanner && scanner.getState() === Html5QrcodeScannerState.SCANNING) {
        scanner.stop().catch(() => {});
      }
    };
  }, []);

  // Handle barcode scan with debounce
  const handleBarcodeScan = useCallback((barcode: string) => {
    // Debounce repeated scans of the same code
    if (barcode === lastScannedCode) return;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setLastScannedCode(barcode);

    debounceTimerRef.current = setTimeout(() => {
      setLastScannedCode(null);
    }, 2000);

    const product = getProductByBarcode(barcode);
    
    // Clear previous feedback timer
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }

    if (product) {
      addItem(product);
      setScanFeedback({ type: 'success', message: `Added: ${product.name}` });
      // Haptic feedback if available
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
    } else {
      setScanFeedback({ type: 'error', message: `Not found: ${barcode}` });
      if (navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
    }

    // Clear feedback after 2 seconds
    feedbackTimerRef.current = setTimeout(() => {
      setScanFeedback(null);
    }, 2000);
  }, [getProductByBarcode, addItem, lastScannedCode]);

  // Toggle flashlight
  const toggleFlashlight = async () => {
    if (scannerRef.current) {
      try {
        const track = scannerRef.current.getRunningTrackCameraCapabilities?.();
        if (track && (track as any).torch) {
          const newState = !flashlightOn;
          await (track as any).torch.apply(newState);
          setFlashlightOn(newState);
        }
      } catch (err) {
        console.error('Flashlight toggle failed:', err);
      }
    }
  };

  // Search products
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim().length >= 2) {
      const results = searchProducts(value);
      setSearchResults(results.slice(0, 5));
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Add product from search
  const handleAddFromSearch = (product: Product) => {
    addItem(product);
    setSearchQuery('');
    setShowSearchResults(false);
    setScanFeedback({ type: 'success', message: `Added: ${product.name}` });
    
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = setTimeout(() => {
      setScanFeedback(null);
    }, 2000);
  };

  // Checkout
  const handleCheckout = async () => {
    if (!user || !shop || items.length === 0) return;
    
    setIsProcessing(true);
    try {
      const sale = await checkout(user.id, shop.id);
      if (sale) {
        // Show success feedback
        setScanFeedback({ type: 'success', message: 'Order created successfully!' });
        if (feedbackTimerRef.current) {
          clearTimeout(feedbackTimerRef.current);
        }
        feedbackTimerRef.current = setTimeout(() => {
          setScanFeedback(null);
        }, 3000);
      }
    } catch (err) {
      console.error('Checkout failed:', err);
      setScanFeedback({ type: 'error', message: 'Checkout failed. Try again.' });
    }
    setIsProcessing(false);
  };

  // Get total items count
  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      {/* Scanner Section - ~25% of screen */}
      <div className="relative h-[28vh] min-h-[180px] bg-black flex-shrink-0">
        {/* Scanner container */}
        <div 
          ref={scannerContainerRef}
          id="mobile-scanner-region" 
          className="w-full h-full"
        />
        
        {/* Scanner overlay UI */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top bar with back button and flashlight */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/pos')}
                className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <span className="text-white text-sm font-medium">Scan Product Code</span>
            </div>
            <button
              onClick={toggleFlashlight}
              className={`p-2 rounded-full transition-colors ${
                flashlightOn 
                  ? 'bg-amber-500 text-white' 
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <BoltIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Scanning frame overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative w-64 h-28 border-2 border-teal-400/50 rounded-lg">
              {/* Corner accents */}
              <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-teal-400 rounded-tl-lg" />
              <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-teal-400 rounded-tr-lg" />
              <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-teal-400 rounded-bl-lg" />
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-teal-400 rounded-br-lg" />
              
              {/* Scanning line animation */}
              <div className="absolute inset-x-2 top-1/2 h-0.5 bg-teal-400 animate-pulse" />
            </div>
          </div>

          {/* Scan feedback toast */}
          {scanFeedback && (
            <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-sm font-medium shadow-lg pointer-events-auto ${
              scanFeedback.type === 'success' 
                ? 'bg-teal-500 text-white' 
                : 'bg-red-500 text-white'
            }`}>
              {scanFeedback.message}
            </div>
          )}
        </div>

        {/* Scanner error state */}
        {scannerError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800/90 p-4">
            <div className="text-center">
              <p className="text-slate-300 text-sm mb-2">{scannerError}</p>
              <p className="text-slate-500 text-xs">Use manual search below</p>
            </div>
          </div>
        )}
      </div>

      {/* Search Section */}
      <div className="relative px-4 py-3 bg-slate-800 border-b border-slate-700 flex-shrink-0">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search product name or code..."
            className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setShowSearchResults(false);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute left-4 right-4 top-full mt-1 bg-slate-700 border border-slate-600 rounded-xl shadow-xl z-50 overflow-hidden">
            {searchResults.map((product) => (
              <button
                key={product.id}
                onClick={() => handleAddFromSearch(product)}
                className="w-full flex items-center gap-3 p-3 hover:bg-slate-600 transition-colors border-b border-slate-600 last:border-0"
              >
                {/* Product thumbnail placeholder */}
                <div className="w-10 h-10 rounded-full bg-slate-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{product.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium text-sm">{product.name}</p>
                  <p className="text-amber-400 text-sm">{formatCurrency(product.sellPrice)}</p>
                </div>
                <PlusIcon className="w-5 h-5 text-teal-400" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Order Items Section */}
      <div className="flex-1 flex flex-col min-h-0 bg-slate-900">
        {/* Section Header */}
        <div className="px-4 py-2 flex items-center justify-between bg-slate-800/50 border-b border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShoppingCartIcon className="w-5 h-5 text-slate-400" />
            <span className="text-white font-medium">Order Items</span>
            {totalItemsCount > 0 && (
              <span className="px-2 py-0.5 bg-teal-500 text-white text-xs font-bold rounded-full">
                {totalItemsCount}
              </span>
            )}
          </div>
          {items.length > 0 && (
            <button
              onClick={clear}
              className="text-red-400 text-sm hover:text-red-300"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                <ShoppingCartIcon className="w-8 h-8 text-slate-600" />
              </div>
              <p className="text-slate-400 text-sm">No items yet</p>
              <p className="text-slate-500 text-xs mt-1">Scan products to add them</p>
            </div>
          ) : (
            items.map((item) => {
              const unitPrice = item.isPack && item.product.packPrice 
                ? item.product.packPrice 
                : item.product.sellPrice;
              const itemKey = `${item.productId}-${item.isPack ? 'pack' : 'single'}`;

              return (
                <div 
                  key={itemKey} 
                  className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl border border-slate-700"
                >
                  {/* Product thumbnail */}
                  <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {item.product.imageUrl ? (
                      <img 
                        src={item.product.imageUrl} 
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl text-slate-400">
                        {item.product.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Product info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm truncate">
                      {item.product.name}
                      {item.isPack && item.product.packSize && (
                        <span className="text-teal-400 ml-1">({item.product.packSize}-Pack)</span>
                      )}
                    </p>
                    <p className="text-amber-400 text-sm font-medium">
                      {formatCurrency(unitPrice)}
                    </p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.isPack)}
                      className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center hover:bg-teal-500/30 transition-colors"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center text-white font-medium">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.isPack)}
                      className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center hover:bg-teal-500/30 transition-colors"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Fixed Bottom Section */}
      <div className="flex-shrink-0 p-4 bg-slate-800 border-t border-slate-700 safe-area-bottom">
        {/* VAT breakdown — only when the shop charges tax */}
        {taxBreakdown.tax > 0 && (
          <div className="space-y-1 mb-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-slate-300">{formatCurrency(cartSubtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">
                VAT ({shop?.taxRate}%{shop?.taxInclusive ? ' incl.' : ''})
              </span>
              <span className="text-slate-300">{formatCurrency(taxBreakdown.tax)}</span>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-slate-400">Total</span>
          <span className="text-2xl font-bold text-white">
            {formatCurrency(cartTotal)}
          </span>
        </div>

        {/* Create Order Button */}
        <button
          onClick={handleCheckout}
          disabled={items.length === 0 || isProcessing}
          className={`w-full py-4 rounded-2xl font-semibold text-lg transition-all ${
            items.length === 0 || isProcessing
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-teal-500 text-white hover:bg-teal-400 active:scale-[0.98]'
          }`}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Processing...
            </span>
          ) : (
            'Create order'
          )}
        </button>
      </div>
    </div>
  );
}

export default MobilePOS;
