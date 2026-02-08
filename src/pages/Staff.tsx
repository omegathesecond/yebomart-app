import { useState, useEffect } from 'react';
import {
  UserPlusIcon,
  PencilIcon,
  TrashIcon,
  UserCircleIcon,
  PhoneIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAuthStore } from '@/stores/authStore';
import { useInventoryStore } from '@/stores/inventoryStore';
import type { User } from '@/types';

export function Staff() {
  const { shop } = useAuthStore();
  const { staff, loadAll, addStaff, updateStaff, deleteStaff } = useInventoryStore();
  
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    pin: '',
    role: 'cashier' as 'owner' | 'manager' | 'cashier'
  });

  useEffect(() => {
    if (shop) {
      loadAll(shop.id);
    }
  }, [shop, loadAll]);

  const openAddModal = () => {
    setEditingStaff(null);
    setFormData({ name: '', phone: '', pin: '', role: 'cashier' });
    setErrors({});
    setShowModal(true);
  };

  const openEditModal = (member: User) => {
    setEditingStaff(member);
    setFormData({
      name: member.name,
      phone: member.phone,
      pin: member.pin || '',
      role: member.role
    });
    setErrors({});
    setShowModal(true);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone is required';
    } else if (formData.phone.length < 7) {
      newErrors.phone = 'Enter a valid phone number';
    }
    
    if (!formData.pin) {
      newErrors.pin = 'PIN is required';
    } else if (!/^\d{4}$/.test(formData.pin)) {
      newErrors.pin = 'PIN must be exactly 4 digits';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!shop || !validateForm()) return;
    
    setIsSubmitting(true);
    setErrors({});
    
    try {
      if (editingStaff) {
        await updateStaff(editingStaff.id, {
          name: formData.name,
          phone: formData.phone,
          pin: formData.pin,
          role: formData.role
        });
      } else {
        await addStaff({
          shopId: shop.id,
          name: formData.name,
          phone: formData.phone,
          pin: formData.pin,
          role: formData.role,
          isActive: true
        });
      }
      setShowModal(false);
    } catch (e: any) {
      console.error('Failed to save staff:', e);
      // Handle API validation errors
      if (e.details && Array.isArray(e.details)) {
        const apiErrors: Record<string, string> = {};
        e.details.forEach((err: { field: string; message: string }) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      } else {
        setErrors({ _form: e.message || 'Failed to save staff' });
      }
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this staff member?')) return;
    await deleteStaff(id);
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return <Badge variant="success">Owner</Badge>;
      case 'manager':
        return <Badge variant="warning">Manager</Badge>;
      default:
        return <Badge variant="default">Cashier</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Staff Management</h1>
          <p className="text-slate-400 mt-1">Manage your team members and permissions</p>
        </div>
        <Button variant="primary" leftIcon={<UserPlusIcon className="w-5 h-5" />} onClick={openAddModal}>
          Add Staff
        </Button>
      </div>

      {/* Staff List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {staff.map((member) => (
          <Card key={member.id} className="relative">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <span className="text-xl font-bold text-white">
                  {member.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white">{member.name}</h3>
                <div className="flex items-center gap-2 text-sm text-slate-400 mt-1">
                  <PhoneIcon className="w-4 h-4" />
                  {member.phone}
                </div>
                <div className="mt-2">
                  {getRoleBadge(member.role)}
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4 pt-4 border-t border-slate-700">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={() => openEditModal(member)}
              >
                <PencilIcon className="w-4 h-4" />
                Edit
              </Button>
              {member.role !== 'owner' && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(member.id)}
                >
                  <TrashIcon className="w-4 h-4" />
                </Button>
              )}
            </div>
          </Card>
        ))}

        {staff.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <div className="text-center py-8">
              <UserCircleIcon className="w-16 h-16 mx-auto text-slate-600 mb-4" />
              <h3 className="text-lg font-medium text-white mb-2">No staff members yet</h3>
              <p className="text-slate-400 mb-4">Add your team members to manage your shop together</p>
              <Button variant="primary" onClick={openAddModal}>
                <UserPlusIcon className="w-5 h-5" />
                Add First Staff
              </Button>
            </div>
          </Card>
        )}
      </div>

      {/* Permissions Info */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <ShieldCheckIcon className="w-5 h-5 text-amber-500" />
          Role Permissions
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <h4 className="font-medium text-emerald-400 mb-2">Owner</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>✓ Full access to everything</li>
              <li>✓ Manage staff & permissions</li>
              <li>✓ View reports & analytics</li>
              <li>✓ Manage billing</li>
            </ul>
          </div>
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <h4 className="font-medium text-amber-400 mb-2">Manager</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>✓ POS & sales</li>
              <li>✓ Manage products & stock</li>
              <li>✓ View reports</li>
              <li>✗ Manage billing</li>
            </ul>
          </div>
          <div className="p-4 bg-slate-700/30 rounded-lg">
            <h4 className="font-medium text-slate-400 mb-2">Cashier</h4>
            <ul className="text-sm text-slate-400 space-y-1">
              <li>✓ POS & sales only</li>
              <li>✓ View products</li>
              <li>✗ Manage stock</li>
              <li>✗ View reports</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        size="md"
      >
        <div className="space-y-4">
          {errors._form && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {errors._form}
            </div>
          )}
          
          <Input
            label="Full Name"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (errors.name) setErrors({ ...errors, name: '' });
            }}
            placeholder="e.g., John Dlamini"
            error={errors.name}
          />
          
          <Input
            label="Phone Number"
            value={formData.phone}
            onChange={(e) => {
              setFormData({ ...formData, phone: e.target.value });
              if (errors.phone) setErrors({ ...errors, phone: '' });
            }}
            placeholder="+26876123456"
            error={errors.phone}
          />
          
          <Input
            label="PIN (4 digits)"
            type="password"
            maxLength={4}
            value={formData.pin}
            onChange={(e) => {
              setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '') });
              if (errors.pin) setErrors({ ...errors, pin: '' });
            }}
            placeholder="••••"
            error={errors.pin}
          />
          
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-xl text-white"
            >
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" className="flex-1" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleSubmit}
              isLoading={isSubmitting}
              disabled={!formData.name || !formData.phone}
            >
              {editingStaff ? 'Save Changes' : 'Add Staff'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
