import { useState, useEffect, useRef } from 'react';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  MinusIcon,
  TrashIcon,
  QrCodeIcon,
  BanknotesIcon,
  CheckCircleIcon,
  LockClosedIcon,
  PrinterIcon,
  XMarkIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useCartStore, useCartTotal, useCartSubtotal, useCartDiscount } from '@/stores/cartStore';
import { formatSZL, type Product, PAYMENT_METHODS } from '@/types';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { FeatureGate, FeatureCheck } from '@/components/subscription/FeatureGate';
import { TIERS } from '@/stores/subscriptionStore';

// Discount reasons for quick selection
const DISCOUNT_REASONS = [
  'Loyal customer',
  'Negotiated price',
  'Bulk purchase',
  'Damaged item',
  'Price match',
  'Promotion',
  'Other'
];

export function POS() {
  const { user, shop } = useAuthStore();
  const { products, loadAll, getProductByBarcode } = useInventoryStore();
  const { 
    items, addItem, removeItem, updateQuantity, setPaymentMethod, checkout, clear,
    setDiscountPercent, setDiscountAmount, clearDiscount
  } = useCartStore();
  const cartTotal = useCartTotal();
  const cartSubtotal = useCartSubtotal();
  const discount = useCartDiscount();

  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<{ total: number; subtotal: number; discount: number; items: any[]; id: string; receiptNumber?: string; date: Date } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  
  // Discount modal state
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  
  // Check if user can apply discounts
  const canDiscount = user?.role === 'owner' || user?.role === 'manager' || user?.canDiscount;
  const maxDiscountPercent = user?.role === 'owner' ? 100 : (user?.maxDiscountPercent ?? 20);

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
      alert(`Product not found: ${barcode}`);
    }
  };

  // Direct checkout with payment method
  const handlePayment = async (method: 'cash' | 'card' | 'momo' | 'emali') => {
    // Debug: check why payment might not work
    if (!user) {
      alert('Please log in first');
      return;
    }
    if (!shop) {
      alert('Shop not loaded');
      return;
    }
    if (items.length === 0) {
      alert('Cart is empty');
      return;
    }
    
    setPaymentMethod(method);
    setIsProcessing(true);
    
    try {
      const sale = await checkout(user.id, shop.id);
      setIsProcessing(false);
      
      if (sale) {
        setLastSale({ 
          total: sale.totalAmount,
          subtotal: sale.subtotal || sale.totalAmount,
          discount: sale.discount || 0,
          items: sale.items,
          id: sale.id,
          receiptNumber: sale.receiptNumber,
          date: new Date()
        });
        setShowReceipt(true);
      } else {
        // Show error from cart store
        const error = useCartStore.getState().error;
        alert(error || 'Sale failed. Please try again.');
      }
    } catch (err: any) {
      setIsProcessing(false);
      alert(err.message || 'An error occurred');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setLastSale(null);
  };

  // Handle quantity input change
  const handleQuantityChange = (productId: string, value: string) => {
    const qty = parseInt(value) || 0;
    if (qty <= 0) {
      removeItem(productId);
    } else {
      updateQuantity(productId, qty);
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
                  const inCart = items.find(i => i.productId === product.id && !i.isPack);
                  const inCartPack = items.find(i => i.productId === product.id && i.isPack);
                  const isLowStock = product.quantity <= product.reorderAt;
                  const isOutOfStock = product.quantity === 0;
                  const hasPack = product.packSize && product.packPrice;
                  const canSellPack = hasPack && product.quantity >= (product.packSize || 0);

                  return (
                    <div key={product.id} className="flex flex-col">
                      <button
                        onClick={() => !isOutOfStock && addItem(product)}
                        disabled={isOutOfStock}
                        className={`pos-product-card text-left flex-1 ${
                          inCart ? 'border-amber-500 ring-1 ring-amber-500/30' : ''
                        } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''} ${
                          hasPack ? 'rounded-b-none' : ''
                        }`}
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
                      {/* Pack option */}
                      {hasPack && (
                        <button
                          onClick={() => canSellPack && addItem(product, true)}
                          disabled={!canSellPack}
                          className={`px-3 py-1.5 text-xs font-medium rounded-b-xl border border-t-0 transition-colors ${
                            inCartPack 
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' 
                              : 'bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-700'
                          } ${!canSellPack ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="flex items-center justify-between">
                            <span>📦 {product.packSize}-Pack</span>
                            <span className="font-bold">{formatSZL(product.packPrice!)}</span>
                            {inCartPack && (
                              <span className="ml-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center">
                                {inCartPack.quantity}
                              </span>
                            )}
                          </span>
                        </button>
                      )}
                    </div>
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
            items.map((item) => {
              const unitPrice = item.isPack && item.product.packPrice 
                ? item.product.packPrice 
                : item.product.sellPrice;
              const itemKey = `${item.productId}-${item.isPack ? 'pack' : 'single'}`;
              const maxQty = item.isPack && item.product.packSize
                ? Math.floor(item.product.quantity / item.product.packSize)
                : item.product.quantity;

              return (
                <div key={itemKey} className="pos-cart-item">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-white truncate">
                      {item.product.name}
                      {item.isPack && item.product.packSize && (
                        <span className="ml-1 text-emerald-400 text-sm">({item.product.packSize}-Pack)</span>
                      )}
                    </h4>
                    <p className="text-sm text-slate-400">
                      {formatSZL(unitPrice)} {item.isPack ? 'per pack' : 'each'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.isPack)}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300"
                    >
                      <MinusIcon className="w-4 h-4" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxQty}
                      value={item.quantity}
                      onChange={(e) => {
                        const qty = parseInt(e.target.value) || 0;
                        if (qty <= 0) {
                          removeItem(item.productId, item.isPack);
                        } else {
                          updateQuantity(item.productId, qty, item.isPack);
                        }
                      }}
                      className="w-14 text-center font-medium text-white bg-slate-700 border border-slate-600 rounded-lg py-1 px-1 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.isPack)}
                      disabled={item.quantity >= maxQty}
                      className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.productId, item.isPack)}
                      className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 ml-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="font-semibold text-amber-400 w-20 text-right">
                    {formatSZL(unitPrice * item.quantity)}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer - Payment Buttons */}
        {items.length > 0 && (
          <div className="p-4 border-t border-slate-700 space-y-3">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">Subtotal</span>
              <span className="text-slate-300">{formatSZL(cartSubtotal)}</span>
            </div>
            
            {/* Discount Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">Discount</span>
                {canDiscount && (
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    {discount ? 'Edit' : '+ Add'}
                  </button>
                )}
              </div>
              {discount ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 font-medium">
                    -{formatSZL(discount.amount)}
                    {discount.percent && <span className="text-xs ml-1">({discount.percent}%)</span>}
                  </span>
                  <button 
                    onClick={clearDiscount}
                    className="text-red-400 hover:text-red-300"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <span className="text-slate-500 text-sm">-</span>
              )}
            </div>
            
            {/* Total */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-600">
              <span className="text-white font-medium">Total</span>
              <span className="text-2xl font-bold text-white">
                {formatSZL(cartTotal)}
              </span>
            </div>
            
            {/* Payment Method Buttons */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <Button 
                variant="success" 
                size="lg"
                className="w-full"
                onClick={() => handlePayment('cash')}
                isLoading={isProcessing}
              >
                💵 Cash
              </Button>
              <Button 
                variant="primary" 
                size="lg"
                className="w-full"
                onClick={() => handlePayment('card')}
                isLoading={isProcessing}
              >
                💳 Card
              </Button>
              <Button 
                variant="secondary" 
                size="lg"
                className="w-full"
                onClick={() => handlePayment('momo')}
                isLoading={isProcessing}
              >
                📱 MoMo
              </Button>
              <Button 
                variant="secondary" 
                size="lg"
                className="w-full"
                onClick={() => handlePayment('emali')}
                isLoading={isProcessing}
              >
                📲 eMali
              </Button>
            </div>
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

      {/* Receipt Modal */}
      <Modal 
        isOpen={showReceipt} 
        onClose={handleCloseReceipt}
        title="Sale Complete!"
        size="md"
      >
        <div className="space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircleIcon className="w-10 h-10 text-green-500" />
            </div>
          </div>

          {/* Receipt Preview */}
          {lastSale && (
            <div className="bg-white text-black p-4 rounded-lg font-mono text-sm print:shadow-none" id="receipt">
              <div className="text-center border-b border-dashed border-gray-300 pb-3 mb-3">
                <h3 className="font-bold text-lg">{shop?.name || 'YeboMart'}</h3>
                <p className="text-xs text-gray-500">{shop?.address || ''}</p>
                <p className="text-xs text-gray-500">Tel: {shop?.ownerPhone || ''}</p>
              </div>
              
              <div className="text-xs text-gray-500 mb-3">
                <p>Date: {lastSale.date.toLocaleDateString()} {lastSale.date.toLocaleTimeString()}</p>
                <p className="font-bold text-black">Receipt #: {lastSale.receiptNumber || lastSale.id.slice(-8).toUpperCase()}</p>
              </div>

              <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
                {lastSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="flex-1">{item.productName}</span>
                    <span className="w-8 text-center">x{item.quantity}</span>
                    <span className="w-20 text-right">{formatSZL(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatSZL(lastSale.subtotal || lastSale.total)}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatSZL(lastSale.discount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2">
                <span>TOTAL</span>
                <span>{formatSZL(lastSale.total)}</span>
              </div>

              <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-300">
                <p className="text-xs text-gray-500">Thank you for shopping with us!</p>
                <p className="text-xs text-gray-400">Powered by YeboMart</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button 
              variant="secondary" 
              size="lg"
              className="flex-1"
              onClick={handleCloseReceipt}
            >
              <XMarkIcon className="w-5 h-5" />
              Close
            </Button>
            <Button 
              variant="primary" 
              size="lg"
              className="flex-1"
              onClick={handlePrint}
            >
              <PrinterIcon className="w-5 h-5" />
              Print Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Discount Modal */}
      <Modal
        isOpen={showDiscountModal}
        onClose={() => {
          setShowDiscountModal(false);
          setDiscountValue('');
          setDiscountReason('');
        }}
        title="Apply Discount"
        size="sm"
      >
        <div className="space-y-4">
          {/* Discount Type Toggle */}
          <div className="flex rounded-lg bg-slate-700/50 p-1">
            <button
              onClick={() => setDiscountType('percent')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                discountType === 'percent' 
                  ? 'bg-amber-500 text-white' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Percentage (%)
            </button>
            <button
              onClick={() => setDiscountType('amount')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                discountType === 'amount' 
                  ? 'bg-amber-500 text-white' 
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Fixed Amount (E)
            </button>
          </div>

          {/* Discount Value Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              {discountType === 'percent' ? 'Discount Percentage' : 'Discount Amount'}
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max={discountType === 'percent' ? maxDiscountPercent : cartSubtotal}
                step={discountType === 'percent' ? '1' : '0.01'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === 'percent' ? 'e.g., 10' : 'e.g., 50.00'}
                className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                {discountType === 'percent' ? '%' : 'E'}
              </span>
            </div>
            {discountType === 'percent' && maxDiscountPercent < 100 && (
              <p className="text-xs text-slate-400 mt-1">
                Maximum discount allowed: {maxDiscountPercent}%
              </p>
            )}
          </div>

          {/* Quick Discount Buttons */}
          {discountType === 'percent' && (
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 15, 20].filter(p => p <= maxDiscountPercent).map(percent => (
                <button
                  key={percent}
                  onClick={() => setDiscountValue(percent.toString())}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    discountValue === percent.toString()
                      ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                      : 'border-slate-600 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {percent}%
                </button>
              ))}
            </div>
          )}

          {/* Discount Reason */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Reason (required)
            </label>
            <select
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select reason...</option>
              {DISCOUNT_REASONS.map(reason => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {discountValue && (
            <div className="bg-slate-700/30 rounded-lg p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Subtotal</span>
                <span className="text-white">{formatSZL(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Discount</span>
                <span className="text-emerald-400">
                  -{formatSZL(
                    discountType === 'percent' 
                      ? cartSubtotal * (parseFloat(discountValue) || 0) / 100
                      : parseFloat(discountValue) || 0
                  )}
                </span>
              </div>
              <div className="flex justify-between font-medium border-t border-slate-600 pt-1">
                <span className="text-white">New Total</span>
                <span className="text-white">
                  {formatSZL(Math.max(0, 
                    cartSubtotal - (discountType === 'percent' 
                      ? cartSubtotal * (parseFloat(discountValue) || 0) / 100
                      : parseFloat(discountValue) || 0)
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowDiscountModal(false);
                setDiscountValue('');
                setDiscountReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              disabled={!discountValue || !discountReason || parseFloat(discountValue) <= 0}
              onClick={() => {
                const value = parseFloat(discountValue);
                if (value > 0 && discountReason) {
                  if (discountType === 'percent') {
                    // Check if within allowed limit
                    if (value > maxDiscountPercent) {
                      alert(`Maximum discount is ${maxDiscountPercent}%`);
                      return;
                    }
                    setDiscountPercent(value, discountReason);
                  } else {
                    // Check if amount exceeds subtotal
                    if (value > cartSubtotal) {
                      alert('Discount cannot exceed subtotal');
                      return;
                    }
                    setDiscountAmount(value, discountReason);
                  }
                  setShowDiscountModal(false);
                  setDiscountValue('');
                  setDiscountReason('');
                }
              }}
            >
              Apply Discount
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
