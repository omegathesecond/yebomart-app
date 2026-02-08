import { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  MinusIcon,
  TrashIcon,
  QrCodeIcon,
  CreditCardIcon,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  LockClosedIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Card } from '@/components/ui/Card';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useCartStore, useCartTotal } from '@/stores/cartStore';
import { formatSZL, type PaymentMethod, type Product, PAYMENT_METHODS } from '@/types';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { FeatureGate, FeatureCheck } from '@/components/subscription/FeatureGate';
import { TIERS } from '@/stores/subscriptionStore';

export function POS() {
  const { user, shop } = useAuthStore();
  const { products, loadAll, getProductByBarcode } = useInventoryStore();
  const { items, addItem, removeItem, updateQuantity, setPaymentMethod, checkout, clear, paymentMethod } = useCartStore();
  const cartTotal = useCartTotal();

  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<{ total: number; items: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  // Filter products by search
  const filteredProducts = searchQuery
    ? products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.includes(searchQuery)
      )
    : products;

  // Group products by category
  const productsByCategory = filteredProducts.reduce((acc, product) => {
    const category = product.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const handleBarcodeScan = (barcode: string) => {
    const product = getProductByBarcode(barcode);
    if (product) {
      addItem(product);
      setShowScanner(false);
    } else {
      // Show not found message
      alert(`Product not found: ${barcode}`);
    }
  };

  const handleCheckout = async () => {
    if (!user || !shop || items.length === 0) return;
    
    setIsProcessing(true);
    const sale = await checkout(user.id, shop.id);
    setIsProcessing(false);
    
    if (sale) {
      setLastSale({ total: sale.totalAmount, items: sale.items.length });
      setShowCheckout(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-100px)] flex flex-col lg:flex-row gap-4">
      {/* Products Section */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1">
            <Input
              ref={searchRef}
              placeholder="Search products or scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<MagnifyingGlassIcon className="w-5 h-5" />}
            />
          </div>
          <FeatureCheck feature="barcode_scanning">
            {({ isAvailable, requiredTier }) => (
              <Button 
                variant="secondary" 
                onClick={isAvailable ? () => setShowScanner(true) : undefined}
                className={`px-4 relative ${!isAvailable ? 'opacity-60' : ''}`}
                title={isAvailable ? 'Scan barcode' : `Upgrade to ${requiredTier ? TIERS[requiredTier].name : 'unlock'}`}
              >
                <QrCodeIcon className="w-5 h-5" />
                {!isAvailable && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                    <LockClosedIcon className="w-2.5 h-2.5 text-white" />
                  </span>
                )}
              </Button>
            )}
          </FeatureCheck>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-slate-400 mb-2 sticky top-0 bg-slate-900 py-1">
                {category}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {categoryProducts.map((product) => {
                  const inCart = items.find(i => i.productId === product.id);
                  const isLowStock = product.quantity <= product.reorderAt;
                  const isOutOfStock = product.quantity === 0;

                  return (
                    <button
                      key={product.id}
                      onClick={() => !isOutOfStock && addItem(product)}
                      disabled={isOutOfStock}
                      className={`pos-product-card text-left ${
                        inCart ? 'border-amber-500 ring-1 ring-amber-500/30' : ''
                      } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-medium text-white text-sm line-clamp-2">
                          {product.name}
                        </h4>
                        {inCart && (
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">
                            {inCart.quantity}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex items-end justify-between">
                        <span className="text-lg font-bold text-amber-400">
                          {formatSZL(product.sellPrice)}
                        </span>
                        <span className={`text-xs ${
                          isOutOfStock ? 'text-red-400' :
                          isLowStock ? 'text-amber-400' : 'text-slate-500'
                        }`}>
                          {isOutOfStock ? 'Out' : `${product.quantity} left`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-slate-600 mb-3" />
              <p className="text-slate-400">No products found</p>
              <p className="text-sm text-slate-500">Try a different search term</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="lg:w-96 flex flex-col bg-slate-800/50 rounded-2xl border border-slate-700/50">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Cart</h2>
            {items.length > 0 && (
              <button 
                onClick={clear}
                className="text-sm text-red-400 hover:text-red-300"
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-3">
                <BanknotesIcon className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-slate-400">Cart is empty</p>
              <p className="text-sm text-slate-500">Tap products to add them</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="pos-cart-item">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-white truncate">{item.product.name}</h4>
                  <p className="text-sm text-slate-400">
                    {formatSZL(item.product.sellPrice)} each
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                  >
                    <MinusIcon className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium text-white">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                    disabled={item.quantity >= item.product.quantity}
                    className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50"
                  >
                    <PlusIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
                <p className="font-semibold text-amber-400 w-20 text-right">
                  {formatSZL(item.product.sellPrice * item.quantity)}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Cart Footer */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Total</span>
              <span className="text-2xl font-bold text-white">
                {formatSZL(cartTotal)}
              </span>
            </div>
            <Button 
              variant="primary" 
              size="lg"
              className="w-full"
              onClick={() => setShowCheckout(true)}
            >
              Checkout
            </Button>
          </div>
        )}
      </div>

      {/* Barcode Scanner Modal */}
      <FeatureGate feature="barcode_scanning" fallback="hidden">
        {showScanner && (
          <BarcodeScanner
            onScan={handleBarcodeScan}
            onClose={() => setShowScanner(false)}
          />
        )}
      </FeatureGate>

      {/* Checkout Modal */}
      <Modal 
        isOpen={showCheckout} 
        onClose={() => setShowCheckout(false)}
        title="Complete Sale"
        size="md"
      >
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="p-4 bg-slate-700/30 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Items</span>
              <span className="text-white">{items.length}</span>
            </div>
            <div className="flex justify-between items-center mt-2">
              <span className="text-lg font-semibold text-white">Total</span>
              <span className="text-2xl font-bold text-amber-400">{formatSZL(cartTotal)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-3">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.value}
                  onClick={() => setPaymentMethod(method.value)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    paymentMethod === method.value
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <span className="text-2xl mb-2 block">{method.icon}</span>
                  <span className={`font-medium ${
                    paymentMethod === method.value ? 'text-amber-400' : 'text-white'
                  }`}>
                    {method.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Complete Button */}
          <Button 
            variant="success" 
            size="lg" 
            className="w-full"
            onClick={handleCheckout}
            isLoading={isProcessing}
          >
            <CheckCircleIcon className="w-5 h-5" />
            Complete Sale - {formatSZL(cartTotal)}
          </Button>
        </div>
      </Modal>

      {/* Success Toast */}
      {showSuccess && lastSale && (
        <div className="toast-success">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-6 h-6" />
            <div>
              <p className="font-semibold">Sale Complete!</p>
              <p className="text-sm opacity-90">
                {lastSale.items} item{lastSale.items > 1 ? 's' : ''} • {formatSZL(lastSale.total)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
