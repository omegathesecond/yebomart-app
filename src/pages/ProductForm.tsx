import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, QrCodeIcon, CheckIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { getDefaultCategories, getCategoryAttributes, hasAttributes, type AttributeField } from '@/data/shopTypes';

export function ProductForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { shop } = useAuthStore();
  const { addProduct, updateProduct } = useInventoryStore();
  
  const isEdit = !!id;
  const [showScanner, setShowScanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    barcode: '',
    costPrice: '',
    sellPrice: '',
    quantity: '',
    reorderAt: '10',
    unit: 'each',
    packSize: '',
    packPrice: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Dynamic attributes state
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [customAttributes, setCustomAttributes] = useState<Array<{ key: string; value: string }>>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomValue, setNewCustomValue] = useState('');

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
          quantity: product.quantity.toString(),
          reorderAt: product.reorderAt.toString(),
          unit: product.unit,
          packSize: product.packSize?.toString() || '',
          packPrice: product.packPrice?.toString() || ''
        });
        
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
        quantity: parseInt(formData.quantity),
        reorderAt: parseInt(formData.reorderAt) || 10,
        unit: formData.unit,
        packSize: formData.packSize ? parseInt(formData.packSize) : undefined,
        packPrice: formData.packPrice ? parseFloat(formData.packPrice) : undefined,
        isActive: true
      };

      if (isEdit && id) {
        await updateProduct(id, productData);
      } else {
        await addProduct(productData);
      }

      setShowSuccess(true);
      setTimeout(() => {
        navigate('/products');
      }, 1500);
    } catch (error) {
      console.error('Failed to save product:', error);
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
          className="p-2 hover:bg-slate-800 rounded-lg"
        >
          <ArrowLeftIcon className="w-5 h-5 text-slate-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h1>
          <p className="text-slate-400 mt-1">
            {isEdit ? 'Update product details' : 'Add a new product to your catalog'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Basic Information</h3>
            
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
              <div className="p-4 bg-slate-700/30 rounded-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-amber-400">
                    📋 {formData.category} Details
                  </h4>
                  <span className="text-xs text-slate-500">Optional</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {categoryAttributeFields.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        {field.label} {field.unit && <span className="text-slate-500">({field.unit})</span>}
                      </label>
                      {field.type === 'select' && field.options ? (
                        <select
                          value={attributes[field.key] || ''}
                          onChange={(e) => setAttributes(prev => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                      <label className="block text-xs text-slate-400 mb-1">Attribute</label>
                      <input
                        type="text"
                        value={attr.key}
                        onChange={(e) => {
                          const updated = [...customAttributes];
                          updated[idx].key = e.target.value;
                          setCustomAttributes(updated);
                        }}
                        placeholder="e.g., Color"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Value</label>
                      <input
                        type="text"
                        value={attr.value}
                        onChange={(e) => {
                          const updated = [...customAttributes];
                          updated[idx].value = e.target.value;
                          setCustomAttributes(updated);
                        }}
                        placeholder="e.g., Black"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomAttributes(prev => prev.filter((_, i) => i !== idx))}
                      className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => setCustomAttributes(prev => [...prev, { key: '', value: '' }])}
                  className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add custom attribute
                </button>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
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
            <h3 className="font-semibold text-white">Pricing</h3>
            
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
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Profit per unit</span>
                  <span className="font-semibold text-emerald-400">
                    E{(sellPrice - costPrice).toFixed(2)} ({margin}% margin)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Stock */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white">Stock</h3>
            
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

          {/* Pack Pricing (Optional) */}
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-white">Pack Pricing</h3>
              <p className="text-sm text-slate-400 mt-1">
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
              <div className="p-3 bg-slate-700/30 rounded-lg">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Pack savings</span>
                  <span className="font-semibold text-emerald-400">
                    {(() => {
                      const singleTotal = parseFloat(formData.sellPrice) * parseInt(formData.packSize);
                      const packPrice = parseFloat(formData.packPrice);
                      const savings = singleTotal - packPrice;
                      const savingsPercent = ((savings / singleTotal) * 100).toFixed(0);
                      return savings > 0 
                        ? `E${savings.toFixed(2)} off (${savingsPercent}% discount)`
                        : savings < 0 
                          ? `E${Math.abs(savings).toFixed(2)} premium`
                          : 'No discount';
                    })()}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
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

      {/* Success Toast */}
      {showSuccess && (
        <div className="toast-success">
          <div className="flex items-center gap-3">
            <CheckIcon className="w-6 h-6" />
            <span className="font-medium">
              Product {isEdit ? 'updated' : 'added'} successfully!
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
