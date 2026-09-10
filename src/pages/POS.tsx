import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  QrCodeIcon,
  BanknotesIcon,
  XMarkIcon,
  DevicePhoneMobileIcon,
  UserPlusIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { CustomerPicker } from '@/components/CustomerPicker';
import { ReceiptModal } from '@/components/pos/ReceiptModal';
import { TillBanner } from '@/components/TillBanner';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useCartStore, useCartSubtotal, useCartDiscount, useCartTaxBreakdown } from '@/stores/cartStore';
import { computeChange } from '@/lib/money';
import { formatCurrency, type Product, PAYMENT_METHODS } from '@/types';
import { PaymentMethodIcon } from '@/components/ui/PaymentMethodIcon';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';

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
    setDiscountPercent, setDiscountAmount, clearDiscount,
    customer, setCustomer
  } = useCartStore();
  const cartSubtotal = useCartSubtotal();
  const discount = useCartDiscount();
  // Non-blocking feedback channel for a touchscreen POS — replaces native
  // alert() which freezes the till. Failures stay loud (error toasts).
  const { toast, showToast, dismissToast } = useToast();
  // Tax-aware money breakdown { subtotal, discount, tax, total }. `total` is the
  // amount actually collected (includes VAT when the shop charges it exclusively).
  const taxBreakdown = useCartTaxBreakdown();
  const cartTotal = taxBreakdown.total;

  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<{
    total: number;
    subtotal: number;
    discount: number;
    tax: number;
    items: any[];
    id: string; 
    receiptNumber?: string;
    date: Date;
    paymentMethod?: string;
    cashReceived?: number;
    changeGiven?: number;
    pendingSync?: boolean;
    // Credit ("on the book") sales: who it's booked to and their new balance owing.
    customerName?: string;
    customerBalance?: number;
  } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  
  // Discount modal state
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<'percent' | 'amount'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  
  // Cash payment modal state
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashReceived, setCashReceived] = useState('');
  const [changeAmount, setChangeAmount] = useState(0);

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
      showToast(`Product not found: ${barcode}`, 'error');
    }
  };

  // Handle cash payment - show modal for change calculation
  const handleCashPayment = () => {
    if (!user || !shop || items.length === 0) {
      showToast('Cart is empty or not logged in', 'error');
      return;
    }
    setCashReceived('');
    setChangeAmount(0);
    setShowCashModal(true);
  };

  // Calculate change when cash received changes
  const handleCashReceivedChange = (value: string) => {
    setCashReceived(value);
    const received = parseFloat(value) || 0;
    setChangeAmount(computeChange(cartTotal, received));
  };

  // Process cash payment after receiving cash
  const processCashPayment = async () => {
    const received = parseFloat(cashReceived) || 0;
    if (received < cartTotal) {
      showToast('Insufficient cash received', 'error');
      return;
    }
    
    setShowCashModal(false);
    await processPayment('cash', received, changeAmount);
  };

  // Direct checkout with payment method
  const handlePayment = async (method: 'cash' | 'card' | 'momo' | 'emali' | 'credit') => {
    // Debug: check why payment might not work
    if (!user) {
      showToast('Please log in first', 'error');
      return;
    }
    if (!shop) {
      showToast('Shop not loaded', 'error');
      return;
    }
    if (items.length === 0) {
      showToast('Cart is empty', 'error');
      return;
    }

    // For cash, show the cash modal first
    if (method === 'cash') {
      handleCashPayment();
      return;
    }

    // Credit ("on the book") requires an attached customer — the sale lands on
    // their ledger. Nudge the cashier to pick one instead of failing silently.
    if (method === 'credit' && !customer) {
      showToast('Attach a customer before selling on credit', 'error');
      setShowCustomerPicker(true);
      return;
    }

    await processPayment(method);
  };

  // Process the actual payment
  const processPayment = async (method: 'cash' | 'card' | 'momo' | 'emali' | 'credit', cashReceived?: number, changeGiven?: number) => {
    // Capture the booked-to customer's name before checkout clears the cart, so
    // the credit receipt can name them.
    const creditCustomerName = method === 'credit' ? customer?.name : undefined;

    setPaymentMethod(method);
    setIsProcessing(true);

    try {
      const sale = await checkout(user!.id, shop!.id);
      setIsProcessing(false);

      if (sale) {
        setLastSale({
          total: sale.totalAmount,
          subtotal: sale.subtotal || sale.totalAmount,
          discount: sale.discount || 0,
          tax: sale.tax || 0,
          items: sale.items,
          id: sale.id,
          receiptNumber: sale.receiptNumber,
          date: new Date(),
          paymentMethod: method,
          cashReceived: cashReceived,
          changeGiven: changeGiven,
          pendingSync: sale.pendingSync,
          customerName: creditCustomerName,
          customerBalance: sale.customerBalance,
        });
        setShowReceipt(true);
      } else {
        // Show error from cart store
        const error = useCartStore.getState().error;
        showToast(error || 'Sale failed. Please try again.', 'error');
      }
    } catch (err: any) {
      setIsProcessing(false);
      showToast(err.message || 'An error occurred', 'error');
    }
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
        {/* Cash-drawer status — open till / cash up */}
        <TillBanner />
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
          <Button
            variant="secondary"
            onClick={() => setShowScanner(true)}
            className="px-4"
            title="Scan barcode"
          >
            <QrCodeIcon className="w-5 h-5" />
          </Button>
          {/* Mobile POS link - scan-centric mode */}
          <Link
            to="/pos/mobile"
            className="px-4 py-2 bg-brand hover:bg-brand text-ink rounded-sharp flex items-center gap-2 transition-colors md:hidden"
            title="Mobile Scan Mode"
          >
            <DevicePhoneMobileIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Scan Mode</span>
          </Link>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {Object.entries(productsByCategory).map(([category, categoryProducts]) => (
            <div key={category}>
              <h3 className="text-sm font-medium text-mute mb-2 sticky top-0 bg-cream py-1">
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
                          inCart ? 'border-ink ring-1 ring-ink/30' : ''
                        } ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : ''} ${
                          hasPack ? 'rounded-b-none' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-medium text-ink text-sm line-clamp-2">
                            {product.name}
                          </h4>
                          {inCart && (
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-brand text-ink text-xs flex items-center justify-center font-bold">
                              {inCart.quantity}
                            </span>
                          )}
                        </div>
                        <div className="mt-2 flex items-end justify-between">
                          <span className="m text-lg font-bold text-brick">
                            {formatCurrency(product.sellPrice)}
                          </span>
                          <span className={`text-xs ${
                            isOutOfStock ? 'text-bad' :
                            isLowStock ? 'text-brick' : 'text-mist'
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
                          className={`px-3 py-1.5 text-xs font-medium rounded-b-sharp border border-t-0 transition-colors ${
                            inCartPack 
                              ? 'bg-ok/20 border-ok text-ok' 
                              : 'bg-shade/50 border-line-strong text-body hover:bg-shade'
                          } ${!canSellPack ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span className="flex items-center justify-between">
                            <span>{product.packSize}-Pack</span>
                            <span className="m font-bold">{formatCurrency(product.packPrice!)}</span>
                            {inCartPack && (
                              <span className="ml-1 w-4 h-4 rounded-full bg-ok text-cream text-xs flex items-center justify-center">
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
              <MagnifyingGlassIcon className="w-12 h-12 text-mist mb-3" />
              <p className="text-mute">No products found</p>
              <p className="text-sm text-mist">Try a different search term</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="lg:w-96 flex flex-col bg-sand/50 rounded-sharp border border-line/50">
        {/* Cart Header */}
        <div className="p-4 border-b border-line space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-ink">Cart</h2>
            {items.length > 0 && (
              <button
                onClick={clear}
                className="text-sm text-bad hover:text-bad"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Customer attach */}
          {customer ? (
            <div className="flex items-center gap-2 bg-shade/50 rounded-sharp px-3 py-2">
              <UserCircleIcon className="w-5 h-5 text-brick shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">{customer.name}</p>
                {customer.phone && (
                  <p className="text-xs text-mute truncate">{customer.phone}</p>
                )}
              </div>
              <button
                onClick={() => setCustomer(null)}
                className="p-1 rounded-sharp hover:bg-shade text-mute hover:text-bad"
                title="Remove customer"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-sharp border border-dashed border-line-strong text-mute hover:border-ink/50 hover:text-brick transition-colors text-sm"
            >
              <UserPlusIcon className="w-5 h-5" />
              Attach customer (optional)
            </button>
          )}
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="w-16 h-16 rounded-full bg-shade/50 flex items-center justify-center mb-3">
                <BanknotesIcon className="w-8 h-8 text-mist" />
              </div>
              <p className="text-mute">Cart is empty</p>
              <p className="text-sm text-mist">Tap products to add them</p>
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
                    <h4 className="font-medium text-ink truncate">
                      {item.product.name}
                      {item.isPack && item.product.packSize && (
                        <span className="ml-1 text-ok text-sm">({item.product.packSize}-Pack)</span>
                      )}
                    </h4>
                    <p className="text-sm text-mute">
                      {formatCurrency(unitPrice)} {item.isPack ? 'per pack' : 'each'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1, item.isPack)}
                      className="p-1.5 rounded-sharp bg-shade hover:bg-shade text-body"
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
                      className="w-14 text-center font-medium text-ink bg-shade border border-line-strong rounded-sharp py-1 px-1 focus:outline-none focus:ring-2 focus:ring-ink"
                    />
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1, item.isPack)}
                      disabled={item.quantity >= maxQty}
                      className="p-1.5 rounded-sharp bg-shade hover:bg-shade text-body disabled:opacity-50"
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeItem(item.productId, item.isPack)}
                      className="p-1.5 rounded-sharp bg-bad/20 hover:bg-bad/30 text-bad ml-1"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="m font-semibold text-brick w-20 text-right">
                    {formatCurrency(unitPrice * item.quantity)}
                  </p>
                </div>
              );
            })
          )}
        </div>

        {/* Cart Footer - Payment Buttons */}
        {items.length > 0 && (
          <div className="p-4 border-t border-line space-y-3">
            {/* Subtotal */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-mute">Subtotal</span>
              <span className="m text-body">{formatCurrency(cartSubtotal)}</span>
            </div>
            
            {/* Discount Row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-mute text-sm">Discount</span>
                {canDiscount && (
                  <button
                    onClick={() => setShowDiscountModal(true)}
                    className="text-xs text-brick hover:text-brick"
                  >
                    {discount ? 'Edit' : '+ Add'}
                  </button>
                )}
              </div>
              {discount ? (
                <div className="flex items-center gap-2">
                  <span className="m font-medium text-ok">
                    -{formatCurrency(discount.amount)}
                    {discount.percent && <span className="text-xs ml-1">({discount.percent}%)</span>}
                  </span>
                  <button 
                    onClick={clearDiscount}
                    className="text-bad hover:text-bad"
                  >
                    <XMarkIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <span className="text-mist text-sm">-</span>
              )}
            </div>
            
            {/* Tax / VAT — only shown when the shop charges tax */}
            {taxBreakdown.tax > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-mute">
                  VAT ({shop?.taxRate}%{shop?.taxInclusive ? ' incl.' : ''})
                </span>
                <span className="m text-body">{formatCurrency(taxBreakdown.tax)}</span>
              </div>
            )}

            {/* Amount due — the one ink band on the till. */}
            <div className="pos-total-band -mx-4">
              <span className="m text-[11px] uppercase tracking-[0.14em] text-mist">
                Amount due
              </span>
              <span className="m text-[28px] font-semibold tracking-[-0.02em]">
                {formatCurrency(cartTotal)}
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
                <PaymentMethodIcon method="cash" />
                Cash
              </Button>
              <Button 
                variant="primary" 
                size="lg"
                className="w-full"
                onClick={() => handlePayment('card')}
                isLoading={isProcessing}
              >
                <PaymentMethodIcon method="card" />
                Card
              </Button>
              <Button 
                variant="secondary" 
                size="lg"
                className="w-full"
                onClick={() => handlePayment('momo')}
                isLoading={isProcessing}
              >
                <PaymentMethodIcon method="momo" />
                MoMo
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => handlePayment('emali')}
                isLoading={isProcessing}
              >
                <PaymentMethodIcon method="emali" />
                eMali
              </Button>
            </div>

            {/* Credit / pay-later — books the sale to a customer's account.
                Requires an attached customer (enforced in handlePayment). */}
            <button
              onClick={() => handlePayment('credit')}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-sharp border border-ink/40 bg-wash text-brick font-medium hover:bg-wash transition-colors disabled:opacity-50"
            >
              <PaymentMethodIcon method="credit" />
              Credit / On the book
              {customer && (
                <span className="text-xs text-brick/80">({customer.name.split(' ')[0]})</span>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Barcode Scanner Modal */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Customer Picker */}
      <CustomerPicker
        isOpen={showCustomerPicker}
        onClose={() => setShowCustomerPicker(false)}
        onSelect={(c) => {
          setCustomer(c);
          setShowCustomerPicker(false);
        }}
      />

      {/* Receipt Modal (shared with the mobile POS) */}
      <ReceiptModal
        isOpen={showReceipt}
        onClose={handleCloseReceipt}
        sale={lastSale}
        shop={shop}
        customerPhone={customer?.phone || undefined}
      />

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
          <div className="flex rounded-sharp bg-shade/50 p-1">
            <button
              onClick={() => setDiscountType('percent')}
              className={`flex-1 py-2 px-4 rounded-sharp text-sm font-medium transition-colors ${
                discountType === 'percent' 
                  ? 'bg-brand text-ink' 
                  : 'text-body hover:text-ink'
              }`}
            >
              Percentage (%)
            </button>
            <button
              onClick={() => setDiscountType('amount')}
              className={`flex-1 py-2 px-4 rounded-sharp text-sm font-medium transition-colors ${
                discountType === 'amount' 
                  ? 'bg-brand text-ink' 
                  : 'text-body hover:text-ink'
              }`}
            >
              Fixed Amount (E)
            </button>
          </div>

          {/* Discount Value Input */}
          <div>
            <label className="block text-sm font-medium text-body mb-2">
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
                className="w-full px-4 py-3 bg-shade border border-line-strong rounded-sharp text-ink placeholder-mist focus:outline-none focus:ring-2 focus:ring-ink"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-mute">
                {discountType === 'percent' ? '%' : 'E'}
              </span>
            </div>
            {discountType === 'percent' && maxDiscountPercent < 100 && (
              <p className="text-xs text-mute mt-1">
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
                  className={`px-3 py-1.5 rounded-sharp text-sm font-medium border transition-colors ${
                    discountValue === percent.toString()
                      ? 'bg-wash border-ink text-brick'
                      : 'border-line-strong text-body hover:border-line-strong'
                  }`}
                >
                  {percent}%
                </button>
              ))}
            </div>
          )}

          {/* Discount Reason */}
          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Reason (required)
            </label>
            <select
              value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              className="w-full px-4 py-3 bg-shade border border-line-strong rounded-sharp text-ink focus:outline-none focus:ring-2 focus:ring-ink"
            >
              <option value="">Select reason...</option>
              {DISCOUNT_REASONS.map(reason => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>

          {/* Preview */}
          {discountValue && (
            <div className="bg-shade/30 rounded-sharp p-3 space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-mute">Subtotal</span>
                <span className="m text-ink">{formatCurrency(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-mute">Discount</span>
                <span className="text-ok">
                  -{formatCurrency(
                    discountType === 'percent' 
                      ? cartSubtotal * (parseFloat(discountValue) || 0) / 100
                      : parseFloat(discountValue) || 0
                  )}
                </span>
              </div>
              <div className="flex justify-between font-medium border-t border-line-strong pt-1">
                <span className="text-ink">New Total</span>
                <span className="m text-ink">
                  {formatCurrency(Math.max(0, 
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
                      showToast(`Maximum discount is ${maxDiscountPercent}%`, 'error');
                      return;
                    }
                    setDiscountPercent(value, discountReason);
                  } else {
                    // Check if amount exceeds subtotal
                    if (value > cartSubtotal) {
                      showToast('Discount cannot exceed subtotal', 'error');
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

      {/* Cash Payment Modal */}
      <Modal
        isOpen={showCashModal}
        onClose={() => setShowCashModal(false)}
        title="Cash Payment"
        size="sm"
      >
        <div className="space-y-6">
          {/* Total Due */}
          <div className="bg-shade/50 rounded-sharp p-4 text-center">
            <p className="text-sm text-mute mb-1">Total Due</p>
            <p className="m text-3xl font-bold text-ink">{formatCurrency(cartTotal)}</p>
          </div>

          {/* Cash Received Input */}
          <div>
            <label className="block text-sm font-medium text-body mb-2">
              Cash Received
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-mute font-medium">E</span>
              <input
                type="number"
                min={cartTotal}
                step="0.01"
                value={cashReceived}
                onChange={(e) => handleCashReceivedChange(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full pl-8 pr-4 py-4 text-2xl font-bold bg-shade border border-line-strong rounded-sharp text-ink placeholder-mist focus:outline-none focus:ring-2 focus:ring-ink text-center"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[50, 100, 200, 500].map(amount => (
              <button
                key={amount}
                onClick={() => handleCashReceivedChange(amount.toString())}
                className={`py-2 px-3 rounded-sharp text-sm font-medium border transition-colors ${
                  parseFloat(cashReceived) === amount
                    ? 'bg-wash border-ink text-brick'
                    : 'border-line-strong text-body hover:border-line-strong'
                }`}
              >
                E{amount}
              </button>
            ))}
          </div>

          {/* Exact Amount Button */}
          <button
            onClick={() => handleCashReceivedChange(cartTotal.toFixed(2))}
            className={`w-full py-2 rounded-sharp text-sm font-medium border transition-colors ${
              parseFloat(cashReceived) === cartTotal
                ? 'bg-ok/20 border-ok text-ok'
                : 'border-line-strong text-body hover:border-line-strong'
            }`}
          >
            Exact Amount ({formatCurrency(cartTotal)})
          </button>

          {/* Change Display */}
          {parseFloat(cashReceived) >= cartTotal && (
            <div className="bg-ok/20 border border-ok/30 rounded-sharp p-4 text-center">
              <p className="text-sm text-ok mb-1">Change Due</p>
              <p className="m text-3xl font-bold text-ok">{formatCurrency(changeAmount)}</p>
            </div>
          )}

          {/* Insufficient Warning */}
          {cashReceived && parseFloat(cashReceived) < cartTotal && (
            <div className="bg-bad/20 border border-bad/30 rounded-sharp p-3 text-center">
              <p className="text-bad text-sm">
                Insufficient amount. Need {formatCurrency(cartTotal - (parseFloat(cashReceived) || 0))} more.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onClick={() => setShowCashModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="success"
              size="lg"
              className="flex-1"
              onClick={processCashPayment}
              disabled={!cashReceived || parseFloat(cashReceived) < cartTotal}
              isLoading={isProcessing}
            >
              <PaymentMethodIcon method="cash" />
              Complete Sale
            </Button>
          </div>
        </div>
      </Modal>

      {/* Non-blocking feedback — rendered last so it paints above any open modal */}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
