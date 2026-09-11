import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, QrCodeIcon, CheckIcon, PlusIcon, XMarkIcon, BuildingStorefrontIcon, ExclamationTriangleIcon, PhotoIcon } from '@heroicons/react/24/outline';
import { formatCurrency } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { getDefaultCategories, getCategoryAttributes, hasAttributes, type AttributeField } from '@/data/shopTypes';
import { api } from '@/api/client';

export function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { shop } = useAuthStore();
  const { addProduct, updateProduct } = useInventoryStore();
  
  const isEdit = !!id;
  const [showScanner, setShowScanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [supplierLinkFailed, setSupplierLinkFailed] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    barcode: '',
    costPrice: '',
    sellPrice: '',
    wholesalePrice: '',
    wholesaleMinQty: '',
    quantity: '',
    reorderAt: '10',
    unit: 'each',
    packSize: '',
    packPrice: ''
  });
  
  // Product photo. imageUrl is the persisted R2 url (saved on submit);
  // imagePreviewUrl is a local blob preview shown only while a new file is
  // uploading, then discarded in favor of the real url.
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadError, setImageUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Dynamic attributes state
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [customAttributes, setCustomAttributes] = useState<Array<{ key: string; value: string }>>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');
  
  // Supplier state
  const [suppliers, setSuppliers] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());

  // Get products from store
  const { products } = useInventoryStore();
  
  // Get dynamic categories based on shop's business type
  const categories = useMemo(() => {
    return shop?.businessType ? getDefaultCategories(shop.businessType) : getDefaultCategories('general');
  }, [shop?.businessType]);
  
  // Get attribute fields for the selected category
  const categoryAttributeFields = useMemo(() => {
    return formData.category ? getCategoryAttributes(formData.category) : [];
  }, [formData.category]);

  // Load product data if editing (from store)
  useEffect(() => {
    if (isEdit && id) {
      const product = products.find(p => p.id === id);
      if (product) {
        setFormData({
          name: product.name,
          category: product.category || '',
          barcode: product.barcode || '',
          costPrice: product.costPrice.toString(),
          sellPrice: product.sellPrice.toString(),
          wholesalePrice: product.wholesalePrice?.toString() || '',
          wholesaleMinQty: product.wholesaleMinQty?.toString() || '',
          quantity: product.quantity.toString(),
          reorderAt: product.reorderAt.toString(),
          unit: product.unit,
          packSize: product.packSize?.toString() || '',
          packPrice: product.packPrice?.toString() || ''
        });
        setImageUrl(product.imageUrl || '');

        // Load existing attributes
        if (product.attributes) {
          const definedFields = getCategoryAttributes(product.category || '');
          const definedKeys = definedFields.map(f => f.key);
          
          // Separate defined attributes from custom ones
          const defined: Record<string, string> = {};
          const custom: Array<{ key: string; value: string }> = [];
          
          Object.entries(product.attributes).forEach(([key, value]) => {
            if (definedKeys.includes(key)) {
              defined[key] = String(value);
            } else {
              custom.push({ key, value: String(value) });
            }
          });
          
          setAttributes(defined);
          setCustomAttributes(custom);
        }
      }
    }
  }, [isEdit, id, products]);
  
  // Reset attributes when category changes (but keep custom ones)
  useEffect(() => {
    if (!isEdit) {
      setAttributes({});
    }
  }, [formData.category, isEdit]);

  // Load suppliers
  useEffect(() => {
    const loadSuppliers = async () => {
      try {
        const response = await api.getSuppliers();
        setSuppliers(response.data || []);
      } catch (error) {
        console.error('Failed to load suppliers:', error);
      }
    };
    loadSuppliers();
  }, []);

  // Load product's suppliers when editing
  useEffect(() => {
    const loadProductSuppliers = async () => {
      if (isEdit && id) {
        try {
          const response = await api.getProductSuppliers(id);
          if (response.data) {
            setSelectedSupplierIds(new Set(response.data.map((sp: any) => sp.supplier?.id || sp.supplierId)));
          }
        } catch (error) {
          console.error('Failed to load product suppliers:', error);
        }
      }
    };
    loadProductSuppliers();
  }, [isEdit, id]);

  const toggleSupplier = (supplierId: string) => {
    const newSet = new Set(selectedSupplierIds);
    if (newSet.has(supplierId)) {
      newSet.delete(supplierId);
    } else {
      newSet.add(supplierId);
    }
    setSelectedSupplierIds(newSet);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleBarcodeScan = (barcode: string) => {
    setFormData(prev => ({ ...prev, barcode }));
    setShowScanner(false);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file after a failure
    if (!file) return;

    setImageUploadError('');
    const objectUrl = URL.createObjectURL(file);
    setImagePreviewUrl(objectUrl);
    setIsUploadingImage(true);

    try {
      const response = await api.uploadImage(file);
      if (response.data?.url) {
        setImageUrl(response.data.url);
      } else {
        // Upload failed — surface loudly, keep whatever image was there
        // before, never fabricate a fallback url.
        setImageUploadError(response.error || 'Failed to upload image. Please try again.');
      }
    } finally {
      setIsUploadingImage(false);
      setImagePreviewUrl(null);
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleRemoveImage = () => {
    setImageUrl('');
    setImageUploadError('');
  };

  const displayImageUrl = imagePreviewUrl || imageUrl;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Product name is required';
    }
    if (!formData.costPrice || parseFloat(formData.costPrice) < 0) {
      newErrors.costPrice = 'Valid cost price is required';
    }
    if (!formData.sellPrice || parseFloat(formData.sellPrice) < 0) {
      newErrors.sellPrice = 'Valid sell price is required';
    }
    if (parseFloat(formData.sellPrice) < parseFloat(formData.costPrice)) {
      newErrors.sellPrice = 'Sell price should be higher than cost price';
    }
    if (!formData.quantity || parseInt(formData.quantity) < 0) {
      newErrors.quantity = 'Valid quantity is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate() || !shop) return;

    setIsSaving(true);
    // Clear any prior submit error from a previous attempt
    setErrors(prev => ({ ...prev, submit: '' }));
    setSupplierLinkFailed(false);

    try {
      // Combine defined attributes and custom attributes
      const allAttributes: Record<string, string | number> = { ...attributes };
      customAttributes.forEach(attr => {
        if (attr.key && attr.value) {
          allAttributes[attr.key] = attr.value;
        }
      });
      
      const productData = {
        shopId: shop.id,
        name: formData.name.trim(),
        category: formData.category || undefined,
        barcode: formData.barcode || undefined,
        attributes: Object.keys(allAttributes).length > 0 ? allAttributes : undefined,
        costPrice: parseFloat(formData.costPrice),
        sellPrice: parseFloat(formData.sellPrice),
        wholesalePrice: formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : undefined,
        wholesaleMinQty: formData.wholesaleMinQty ? parseInt(formData.wholesaleMinQty) : undefined,
        quantity: parseInt(formData.quantity),
        reorderAt: parseInt(formData.reorderAt) || 10,
        unit: formData.unit,
        // On create, the API's create schema rejects an empty-string
        // imageUrl (must be a valid uri or omitted) — only send it when set.
        // On update, an empty string is explicitly allowed and is how a
        // removed photo actually clears the stored value (omitting the key
        // entirely is a no-op for Prisma's update).
        ...(isEdit ? { imageUrl } : imageUrl ? { imageUrl } : {}),
        packSize: formData.packSize ? parseInt(formData.packSize) : undefined,
        packPrice: formData.packPrice ? parseFloat(formData.packPrice) : undefined,
        isActive: true
      };

      let productId = id;
      
      if (isEdit && id) {
        await updateProduct(id, productData);
      } else {
        productId = await addProduct(productData);
      }

      // Save suppliers if any selected. A supplier-link failure is a PARTIAL
      // failure: the product itself saved, so surface a non-blocking warning
      // rather than failing the whole save (or pretending it fully succeeded).
      let supplierFailed = false;
      if (productId && selectedSupplierIds.size > 0) {
        try {
          await api.setProductSuppliers(productId, Array.from(selectedSupplierIds));
        } catch (error) {
          console.error('Failed to save suppliers:', error);
          supplierFailed = true;
        }
      }

      setSupplierLinkFailed(supplierFailed);
      setShowSuccess(true);
      // Give the warning a little longer on screen so the user can read it.
      setTimeout(() => {
        navigate('/products');
      }, supplierFailed ? 2500 : 1500);
    } catch (error) {
      // The product save itself failed (duplicate barcode, validation, auth,
      // 5xx, …). Surface it loudly — do NOT navigate away or show success.
      console.error('Failed to save product:', error);
      setErrors(prev => ({
        ...prev,
        submit: error instanceof Error && error.message
          ? error.message
          : 'Failed to save product. Please try again.',
      }));
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate margin
  const costPrice = parseFloat(formData.costPrice) || 0;
  const sellPrice = parseFloat(formData.sellPrice) || 0;
  const margin = sellPrice > 0 ? ((sellPrice - costPrice) / sellPrice * 100).toFixed(0) : 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-sand rounded-sharp"
        >
          <ArrowLeftIcon className="w-5 h-5 text-mute" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ink">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h1>
          <p className="text-mute mt-1">
            {isEdit ? 'Update product details' : 'Add a new product to your catalog'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-6">
          {/* Photo */}
          <div className="space-y-4">
            <h3 className="font-semibold text-ink">Product Photo</h3>

            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 rounded-sharp bg-shade/50 border border-line-strong overflow-hidden flex items-center justify-center shrink-0">
                {displayImageUrl ? (
                  <img
                    src={displayImageUrl}
                    alt="Product preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <PhotoIcon className="w-8 h-8 text-mist" />
                )}
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <span className="w-4 h-4 border-2 border-cream border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-start gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isUploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {isUploadingImage ? 'Uploading…' : displayImageUrl ? 'Replace Photo' : 'Add Photo'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleImageSelect}
                  aria-label="Product photo"
                />
                {imageUrl && !isUploadingImage && (
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="text-sm text-bad hover:text-bad"
                  >
                    Remove photo
                  </button>
                )}
              </div>
            </div>

            {imageUploadError && (
              <div
                role="alert"
                className="flex items-start gap-3 p-3 rounded-sharp bg-bad/10 border border-bad/30"
              >
                <ExclamationTriangleIcon className="w-5 h-5 text-bad shrink-0 mt-0.5" />
                <p className="text-sm text-bad">{imageUploadError}</p>
              </div>
            )}
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-ink">Basic Information</h3>

            <Input
              label="Product Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Bread (White)"
              error={errors.name}
            />
            
            <Select
              label="Category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              options={[
                { value: '', label: 'Select category' },
                ...categories.map(cat => ({ value: cat, label: cat }))
              ]}
            />
            
            {/* Dynamic Attributes based on Category */}
            {formData.category && categoryAttributeFields.length > 0 && (
              <div className="p-4 bg-shade/30 rounded-sharp space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-brick">
                    {formData.category} Details
                  </h4>
                  <span className="text-xs text-mist">Optional</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {categoryAttributeFields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-mute mb-1">
                        {field.label} {field.unit && <span className="text-mist">({field.unit})</span>}
                      </label>
                      {field.type === 'select' && field.options ? (
                        <select
                          value={attributes[field.key] || ''}
                          onChange={(e) => setAttributes(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 bg-shade border border-line-strong rounded-sharp text-ink text-sm focus:outline-none focus:ring-2 focus:ring-ink"
                        >
                          <option value="">Select...</option>
                          {field.options.map(opt => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          value={attributes[field.key] || ''}
                          onChange={(e) => setAttributes(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 bg-shade border border-line-strong rounded-sharp text-ink text-sm placeholder-mist focus:outline-none focus:ring-2 focus:ring-ink"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Custom Attributes */}
            {formData.category && (
              <div className="space-y-3">
                {customAttributes.map((attr, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <label className="block text-xs text-mute mb-1">Attribute</label>
                      <input
                        type="text"
                        value={attr.key}
                        onChange={(e) => {
                          const updated = [...customAttributes];
                          updated[idx].key = e.target.value;
                          setCustomAttributes(updated);
                        }}
                        placeholder="e.g., Color"
                        className="w-full px-3 py-2 bg-shade border border-line-strong rounded-sharp text-ink text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-mute mb-1">Value</label>
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => {
                          const updated = [...customAttributes];
                          updated[idx].value = e.target.value;
                          setCustomAttributes(updated);
                        }}
                        placeholder="e.g., Black"
                        className="w-full px-3 py-2 bg-shade border border-line-strong rounded-sharp text-ink text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomAttributes(prev => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-bad hover:bg-bad/20 rounded-sharp"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => setCustomAttributes(prev => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-2 text-sm text-brick hover:text-brick"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add custom attribute
                </button>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-body mb-1.5">
                Barcode (Optional)
              </label>
              <div className="flex gap-2">
                <Input
                  name="barcode"
                  value={formData.barcode}
                  onChange={handleChange}
                  placeholder="Scan or enter barcode"
                  className="flex-1"
                />
                <Button 
                  type="button"
                  variant="secondary"
                  onClick={() => setShowScanner(true)}
                >
                  <QrCodeIcon className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h3 className="font-semibold text-ink">Pricing</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cost Price (E)"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.costPrice}
                onChange={handleChange}
                placeholder="0.00"
                error={errors.costPrice}
              />
              
              <Input
                label="Sell Price (E)"
                name="sellPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.sellPrice}
                onChange={handleChange}
                placeholder="0.00"
                error={errors.sellPrice}
              />
            </div>
            
            {sellPrice > 0 && (
              <div className="p-3 bg-shade/30 rounded-sharp">
                <div className="flex justify-between items-center">
                  <span className="text-mute">Profit per unit</span>
                  <span className="font-semibold text-ok">
                    E{(sellPrice - costPrice).toFixed(2)} ({margin}% margin)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Stock */}
          <div className="space-y-4">
            <h3 className="font-semibold text-ink">Stock</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Current Quantity"
                name="quantity"
                type="number"
                min="0"
                value={formData.quantity}
                onChange={handleChange}
                placeholder="0"
                error={errors.quantity}
              />
              
              <Input
                label="Reorder At"
                name="reorderAt"
                type="number"
                min="0"
                value={formData.reorderAt}
                onChange={handleChange}
                placeholder="10"
                hint="Low stock alert threshold"
              />
            </div>
            
            <Select
              label="Unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              options={[
                { value: 'each', label: 'Each' },
                { value: 'kg', label: 'Kilogram (kg)' },
                { value: 'g', label: 'Gram (g)' },
                { value: 'L', label: 'Litre (L)' },
                { value: 'ml', label: 'Millilitre (ml)' },
                { value: 'pack', label: 'Pack' },
                { value: 'box', label: 'Box' }
              ]}
            />
          </div>

          {/* Wholesale Pricing (Optional) */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-ink">Wholesale Pricing</h3>
              <p className="text-sm text-mute mt-1">
                Optional: Set bulk pricing for wholesale customers
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Wholesale Price (E)"
                name="wholesalePrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.wholesalePrice}
                onChange={handleChange}
                placeholder="e.g., 8.50"
                hint="Bulk price per unit"
              />
              
              <Input
                label="Min. Quantity"
                name="wholesaleMinQty"
                type="number"
                min="1"
                value={formData.wholesaleMinQty}
                onChange={handleChange}
                placeholder="e.g., 10"
                hint="Min qty for wholesale"
              />
            </div>
            
            {formData.wholesalePrice && formData.wholesaleMinQty && formData.sellPrice && (
              <div className="p-3 bg-shade/30 rounded-sharp">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-mute">Wholesale discount</span>
                  <span className="font-semibold text-body">
                    {(() => {
                      const retail = parseFloat(formData.sellPrice);
                      const wholesale = parseFloat(formData.wholesalePrice);
                      const discount = ((retail - wholesale) / retail * 100).toFixed(0);
                      return wholesale < retail 
                        ? `${discount}% off retail (${formatCurrency(retail - wholesale)} savings/unit)`
                        : 'No discount';
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Pack Pricing (Optional) */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-ink">Pack Pricing</h3>
              <p className="text-sm text-mute mt-1">
                Optional: Configure if this product can be sold in packs (e.g., 6-pack of drinks)
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Pack Size"
                name="packSize"
                type="number"
                min="2"
                value={formData.packSize}
                onChange={handleChange}
                placeholder="e.g., 6"
                hint="Units per pack"
              />
              
              <Input
                label="Pack Price (E)"
                name="packPrice"
                type="number"
                step="0.01"
                min="0"
                value={formData.packPrice}
                onChange={handleChange}
                placeholder="e.g., 80.00"
                hint="Price for full pack"
              />
            </div>
            
            {formData.packSize && formData.packPrice && formData.sellPrice && (
              <div className="p-3 bg-shade/30 rounded-sharp">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-mute">Pack savings</span>
                  <span className="font-semibold text-ok">
                    {(() => {
                      const singleTotal = parseFloat(formData.sellPrice) * parseInt(formData.packSize);
                      const packPrice = parseFloat(formData.packPrice);
                      const savings = singleTotal - packPrice;
                      const savingsPercent = ((savings / singleTotal) * 100).toFixed(0);
                      return savings > 0 
                        ? `${formatCurrency(savings)} off (${savingsPercent}% discount)`
                        : savings < 0 
                          ? `${formatCurrency(Math.abs(savings))} premium`
                          : 'No discount';
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Suppliers (Optional) */}
          {suppliers.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-ink flex items-center gap-2">
                  <BuildingStorefrontIcon className="w-5 h-5 text-brick" />
                  Suppliers
                </h3>
                <p className="text-sm text-mute mt-1">
                  Select suppliers that provide this product
                </p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                {suppliers.map((supplier) => {
                  const isSelected = selectedSupplierIds.has(supplier.id);
                  return (
                    <div
                      key={supplier.id}
                      onClick={() => toggleSupplier(supplier.id)}
                      className={`p-2 rounded-sharp border cursor-pointer transition-colors flex items-center gap-2 ${
                        isSelected
                          ? 'bg-wash border-ink/50'
                          : 'bg-sand border-line hover:border-line-strong'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-5 h-5 bg-brand rounded-full flex items-center justify-center shrink-0">
                          <CheckIcon className="w-3 h-3 text-ink" />
                        </div>
                      )}
                      <span className={`text-sm truncate ${isSelected ? 'text-brick' : 'text-body'}`}>
                        {supplier.name}
                      </span>
                    </div>
                  );
                })}
              </div>
              
              {selectedSupplierIds.size > 0 && (
                <p className="text-xs text-brick">
                  {selectedSupplierIds.size} supplier{selectedSupplierIds.size !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* Submit error */}
          {errors.submit && (
            <div
              role="alert"
              className="flex items-start gap-3 p-3 rounded-sharp bg-bad/10 border border-bad/30"
            >
              <ExclamationTriangleIcon className="w-5 h-5 text-bad shrink-0 mt-0.5" />
              <p className="text-sm text-bad">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-line">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(-1)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={isSaving}
              className="flex-1"
            >
              {isEdit ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </Card>
      </form>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Success / partial-success Toast */}
      {showSuccess && (
        <div className={supplierLinkFailed ? 'toast-warning' : 'toast-success'}>
          <div className="flex items-center gap-3">
            {supplierLinkFailed ? (
              <ExclamationTriangleIcon className="w-6 h-6" />
            ) : (
              <CheckIcon className="w-6 h-6" />
            )}
            <span className="font-medium">
              {supplierLinkFailed
                ? `Product ${isEdit ? 'updated' : 'saved'}, but suppliers couldn't be linked`
                : `Product ${isEdit ? 'updated' : 'added'} successfully!`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
