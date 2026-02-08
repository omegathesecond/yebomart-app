import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, QrCodeIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { BarcodeScanner } from '@/components/scanner/BarcodeScanner';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import { PRODUCT_CATEGORIES } from '@/types';

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
    unit: 'each'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Get products from store
  const { products } = useInventoryStore();

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
          unit: product.unit
        });
      }
    }
  }, [isEdit, id, products]);

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
      const productData = {
        shopId: shop.id,
        name: formData.name.trim(),
        category: formData.category || undefined,
        barcode: formData.barcode || undefined,
        costPrice: parseFloat(formData.costPrice),
        sellPrice: parseFloat(formData.sellPrice),
        quantity: parseInt(formData.quantity),
        reorderAt: parseInt(formData.reorderAt) || 10,
        unit: formData.unit,
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
                ...PRODUCT_CATEGORIES.map(cat => ({ value: cat, label: cat }))
              ]}
            />
            
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
