import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  QrCodeIcon,
  BanknotesIcon,
  CheckCircleIcon,
  PrinterIcon,
  XMarkIcon,
  ReceiptPercentIcon,
  EnvelopeIcon,
  DevicePhoneMobileIcon,
  UserPlusIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';
import api from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Toast, useToast } from '@/components/ui/Toast';
import { CustomerPicker } from '@/components/CustomerPicker';
import { TillBanner } from '@/components/TillBanner';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { useCartStore, useCartTotal, useCartSubtotal, useCartDiscount } from '@/stores/cartStore';
import { computeChange } from '@/lib/money';
import { formatCurrency, type Product, PAYMENT_METHODS } from '@/types';
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
  const cartTotal = useCartTotal();
  const cartSubtotal = useCartSubtotal();
  const discount = useCartDiscount();
  // Non-blocking feedback channel for a touchscreen POS — replaces native
  // alert() which freezes the till. Failures stay loud (error toasts).
  const { toast, showToast, dismissToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSale, setLastSale] = useState<{ 
    total: number; 
    subtotal: number; 
    discount: number; 
    items: any[]; 
    id: string; 
    receiptNumber?: string;
    date: Date;
    paymentMethod?: string;
    cashReceived?: number;
    changeGiven?: number;
    pendingSync?: boolean;
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
  
  // Email receipt modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [customerEmail, setCustomerEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  
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
  const handlePayment = async (method: 'cash' | 'card' | 'momo' | 'emali') => {
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
    
    await processPayment(method);
  };

  // Process the actual payment
  const processPayment = async (method: 'cash' | 'card' | 'momo' | 'emali', cashReceived?: number, changeGiven?: number) => {
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
          items: sale.items,
          id: sale.id,
          receiptNumber: sale.receiptNumber,
          date: new Date(),
          paymentMethod: method,
          cashReceived: cashReceived,
          changeGiven: changeGiven,
          pendingSync: sale.pendingSync
        });
        setShowReceipt(true);
        setEmailSent(false); // Reset email sent status
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

  // Send receipt via email
  const handleSendEmail = async () => {
    if (!customerEmail || !lastSale) return;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    
    setIsSendingEmail(true);
    try {
      await api.sendReceiptEmail({
        saleId: lastSale.id,
        email: customerEmail,
        shopName: shop?.name || 'YeboMart',
        receiptNumber: lastSale.receiptNumber || lastSale.id.slice(-8).toUpperCase(),
        items: lastSale.items,
        subtotal: lastSale.subtotal,
        discount: lastSale.discount,
        total: lastSale.total,
        date: lastSale.date.toISOString()
      });
      setEmailSent(true);
      setShowEmailModal(false);
      setCustomerEmail('');
      showToast('Receipt emailed successfully', 'success');
    } catch (err: any) {
      showToast('Failed to send email. Please try again.', 'error');
    }
    setIsSendingEmail(false);
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
            className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-white rounded-xl flex items-center gap-2 transition-colors md:hidden"
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
                            {formatCurrency(product.sellPrice)}
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
                            <span className="font-bold">{formatCurrency(product.packPrice!)}</span>
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
        <div className="p-4 border-b border-slate-700 space-y-3">
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

          {/* Customer attach */}
          {customer ? (
            <div className="flex items-center gap-2 bg-slate-700/50 rounded-xl px-3 py-2">
              <UserCircleIcon className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{customer.name}</p>
                {customer.phone && (
                  <p className="text-xs text-slate-400 truncate">{customer.phone}</p>
                )}
              </div>
              <button
                onClick={() => setCustomer(null)}
                className="p-1 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-red-400"
                title="Remove customer"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomerPicker(true)}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border border-dashed border-slate-600 text-slate-400 hover:border-amber-500/50 hover:text-amber-400 transition-colors text-sm"
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
                      {formatCurrency(unitPrice)} {item.isPack ? 'per pack' : 'each'}
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
                    {formatCurrency(unitPrice * item.quantity)}
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
              <span className="text-slate-300">{formatCurrency(cartSubtotal)}</span>
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
                    -{formatCurrency(discount.amount)}
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

              {lastSale.pendingSync && (
                <div className="mb-3 rounded bg-amber-100 border border-amber-300 px-2 py-1.5 text-xs text-amber-800">
                  Saved offline — this sale will sync automatically when you're back online.
                </div>
              )}

              <div className="border-b border-dashed border-gray-300 pb-3 mb-3">
                {lastSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between py-1">
                    <span className="flex-1">{item.productName}</span>
                    <span className="w-8 text-center">x{item.quantity}</span>
                    <span className="w-20 text-right">{formatCurrency(item.totalPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 mb-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>{formatCurrency(lastSale.subtotal || lastSale.total)}</span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(lastSale.discount)}</span>
                  </div>
                )}
              </div>

              <div className="flex justify-between font-bold text-lg border-t border-gray-300 pt-2">
                <span>TOTAL</span>
                <span>{formatCurrency(lastSale.total)}</span>
              </div>

              {/* Cash Payment Details */}
              {lastSale.paymentMethod === 'cash' && lastSale.cashReceived && (
                <div className="mt-3 pt-3 border-t border-dashed border-gray-300 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Cash Received</span>
                    <span>{formatCurrency(lastSale.cashReceived)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg text-green-600">
                    <span>CHANGE</span>
                    <span>{formatCurrency(lastSale.changeGiven || 0)}</span>
                  </div>
                </div>
              )}

              <div className="text-center mt-4 pt-3 border-t border-dashed border-gray-300">
                <p className="text-xs text-gray-500">Thank you for shopping with us!</p>
                <p className="text-xs text-gray-400">Powered by YeboMart</p>
              </div>
            </div>
          )}

          {/* Email Sent Confirmation */}
          {emailSent && (
            <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-500/10 rounded-lg px-4 py-2">
              <CheckCircleIcon className="w-5 h-5" />
              Receipt emailed successfully!
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <Button 
              variant="secondary" 
              size="lg"
              className="w-full"
              onClick={handleCloseReceipt}
            >
              <XMarkIcon className="w-5 h-5" />
              Close
            </Button>
            <Button 
              variant="secondary" 
              size="lg"
              className="w-full"
              onClick={() => setShowEmailModal(true)}
              disabled={emailSent}
            >
              <EnvelopeIcon className="w-5 h-5" />
              Email
            </Button>
            <Button 
              variant="primary" 
              size="lg"
              className="w-full"
              onClick={handlePrint}
            >
              <PrinterIcon className="w-5 h-5" />
              Print
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
                <span className="text-white">{formatCurrency(cartSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Discount</span>
                <span className="text-emerald-400">
                  -{formatCurrency(
                    discountType === 'percent' 
                      ? cartSubtotal * (parseFloat(discountValue) || 0) / 100
                      : parseFloat(discountValue) || 0
                  )}
                </span>
              </div>
              <div className="flex justify-between font-medium border-t border-slate-600 pt-1">
                <span className="text-white">New Total</span>
                <span className="text-white">
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
          <div className="bg-slate-700/50 rounded-xl p-4 text-center">
            <p className="text-sm text-slate-400 mb-1">Total Due</p>
            <p className="text-3xl font-bold text-white">{formatCurrency(cartTotal)}</p>
          </div>

          {/* Cash Received Input */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Cash Received
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">E</span>
              <input
                type="number"
                min={cartTotal}
                step="0.01"
                value={cashReceived}
                onChange={(e) => handleCashReceivedChange(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full pl-8 pr-4 py-4 text-2xl font-bold bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 text-center"
              />
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[50, 100, 200, 500].map(amount => (
              <button
                key={amount}
                onClick={() => handleCashReceivedChange(amount.toString())}
                className={`py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  parseFloat(cashReceived) === amount
                    ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                    : 'border-slate-600 text-slate-300 hover:border-slate-500'
                }`}
              >
                E{amount}
              </button>
            ))}
          </div>

          {/* Exact Amount Button */}
          <button
            onClick={() => handleCashReceivedChange(cartTotal.toFixed(2))}
            className={`w-full py-2 rounded-lg text-sm font-medium border transition-colors ${
              parseFloat(cashReceived) === cartTotal
                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                : 'border-slate-600 text-slate-300 hover:border-slate-500'
            }`}
          >
            Exact Amount ({formatCurrency(cartTotal)})
          </button>

          {/* Change Display */}
          {parseFloat(cashReceived) >= cartTotal && (
            <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-xl p-4 text-center">
              <p className="text-sm text-emerald-400 mb-1">Change Due</p>
              <p className="text-3xl font-bold text-emerald-400">{formatCurrency(changeAmount)}</p>
            </div>
          )}

          {/* Insufficient Warning */}
          {cashReceived && parseFloat(cashReceived) < cartTotal && (
            <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-3 text-center">
              <p className="text-red-400 text-sm">
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
              💵 Complete Sale
            </Button>
          </div>
        </div>
      </Modal>

      {/* Email Receipt Modal */}
      <Modal
        isOpen={showEmailModal}
        onClose={() => {
          setShowEmailModal(false);
          setCustomerEmail('');
        }}
        title="Email Receipt"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-slate-400 text-sm">
            Send a copy of the receipt to the customer's email address.
          </p>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Customer Email
            </label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="customer@example.com"
              autoFocus
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                setShowEmailModal(false);
                setCustomerEmail('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSendEmail}
              disabled={!customerEmail || isSendingEmail}
              isLoading={isSendingEmail}
            >
              <EnvelopeIcon className="w-5 h-5" />
              Send Receipt
            </Button>
          </div>
        </div>
      </Modal>

      {/* Non-blocking feedback — rendered last so it paints above any open modal */}
      <Toast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
