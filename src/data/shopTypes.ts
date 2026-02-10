import {
  ShoppingBagIcon,
  WrenchScrewdriverIcon,
  BuildingStorefrontIcon,
  BeakerIcon,
  ScissorsIcon,
  HomeModernIcon,
  DevicePhoneMobileIcon,
  ShoppingCartIcon,
  CakeIcon,
  SparklesIcon,
  CubeIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';

export interface ShopType {
  id: string;
  name: string;
  description: string;
  icon: any;
  color: string;
  categories: string[];
}

export const shopTypes: ShopType[] = [
  {
    id: 'spaza',
    name: 'Spaza / Tuckshop',
    description: 'Small convenience store with everyday essentials',
    icon: ShoppingCartIcon,
    color: 'from-amber-500 to-orange-600',
    categories: [
      'Beverages',
      'Snacks & Sweets',
      'Bread & Bakery',
      'Dairy & Eggs',
      'Canned Goods',
      'Toiletries',
      'Cleaning Supplies',
      'Airtime & Data',
      'Cigarettes',
      'Other'
    ]
  },
  {
    id: 'grocery',
    name: 'Grocery Store',
    description: 'Full grocery with fresh produce and household items',
    icon: ShoppingBagIcon,
    color: 'from-green-500 to-emerald-600',
    categories: [
      'Fresh Produce',
      'Meat & Poultry',
      'Dairy & Eggs',
      'Bread & Bakery',
      'Beverages',
      'Canned & Packaged',
      'Frozen Foods',
      'Snacks & Confectionery',
      'Household & Cleaning',
      'Personal Care',
      'Baby Products',
      'Pet Supplies',
      'Other'
    ]
  },
  {
    id: 'tyre',
    name: 'Tyre Shop',
    description: 'Tyre sales, repairs and automotive accessories',
    icon: TruckIcon,
    color: 'from-slate-600 to-gray-800',
    categories: [
      'New Tyres - Car',
      'New Tyres - Truck',
      'New Tyres - Motorcycle',
      'Used Tyres',
      'Tyre Repairs',
      'Wheel Alignment',
      'Wheel Balancing',
      'Rims & Mags',
      'Tubes',
      'Batteries',
      'Oil & Lubricants',
      'Accessories',
      'Services'
    ]
  },
  {
    id: 'hardware',
    name: 'Hardware Store',
    description: 'Building materials, tools and DIY supplies',
    icon: WrenchScrewdriverIcon,
    color: 'from-orange-500 to-red-600',
    categories: [
      'Power Tools',
      'Hand Tools',
      'Plumbing',
      'Electrical',
      'Paint & Supplies',
      'Building Materials',
      'Fasteners & Fixings',
      'Safety Equipment',
      'Garden & Outdoor',
      'Adhesives & Sealants',
      'Doors & Windows',
      'Other'
    ]
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    description: 'Medicines, health and beauty products',
    icon: BeakerIcon,
    color: 'from-blue-500 to-cyan-600',
    categories: [
      'Prescription Medicines',
      'Over-the-Counter',
      'Pain Relief',
      'Cold & Flu',
      'Vitamins & Supplements',
      'First Aid',
      'Personal Care',
      'Baby Care',
      'Skincare',
      'Hair Care',
      'Oral Care',
      'Medical Devices',
      'Other'
    ]
  },
  {
    id: 'salon',
    name: 'Salon / Barbershop',
    description: 'Hair, beauty and grooming services',
    icon: ScissorsIcon,
    color: 'from-pink-500 to-rose-600',
    categories: [
      'Haircuts - Men',
      'Haircuts - Women',
      'Haircuts - Kids',
      'Hair Styling',
      'Hair Colouring',
      'Braiding & Weaves',
      'Treatments',
      'Nails',
      'Facial & Skincare',
      'Hair Products',
      'Beauty Products',
      'Other Services'
    ]
  },
  {
    id: 'restaurant',
    name: 'Restaurant / Fast Food',
    description: 'Food service, takeaway and catering',
    icon: CakeIcon,
    color: 'from-red-500 to-orange-600',
    categories: [
      'Breakfast',
      'Lunch Specials',
      'Dinner',
      'Burgers & Sandwiches',
      'Chicken',
      'Pizza',
      'Sides',
      'Beverages',
      'Desserts',
      'Combos / Meals',
      'Catering',
      'Other'
    ]
  },
  {
    id: 'clothing',
    name: 'Clothing Store',
    description: 'Fashion, apparel and accessories',
    icon: SparklesIcon,
    color: 'from-purple-500 to-violet-600',
    categories: [
      'Men\'s Wear',
      'Women\'s Wear',
      'Kids\' Wear',
      'Shoes - Men',
      'Shoes - Women',
      'Shoes - Kids',
      'Accessories',
      'Bags & Luggage',
      'Underwear & Socks',
      'Sportswear',
      'Traditional Wear',
      'Other'
    ]
  },
  {
    id: 'electronics',
    name: 'Electronics Shop',
    description: 'Phones, accessories and gadgets',
    icon: DevicePhoneMobileIcon,
    color: 'from-indigo-500 to-blue-600',
    categories: [
      'Smartphones',
      'Feature Phones',
      'Phone Accessories',
      'Chargers & Cables',
      'Headphones & Earbuds',
      'Power Banks',
      'Tablets',
      'Laptops',
      'TVs & Audio',
      'Gaming',
      'Repairs & Services',
      'Airtime & Data',
      'Other'
    ]
  },
  {
    id: 'butchery',
    name: 'Butchery',
    description: 'Fresh meat, poultry and related products',
    icon: CubeIcon,
    color: 'from-red-600 to-red-800',
    categories: [
      'Beef',
      'Pork',
      'Chicken',
      'Lamb & Mutton',
      'Offal',
      'Mince & Sausages',
      'Marinated Meats',
      'Braai Packs',
      'Frozen Meats',
      'Deli & Cold Cuts',
      'Other'
    ]
  },
  {
    id: 'general',
    name: 'General Store',
    description: 'Mixed retail - customize your own categories',
    icon: BuildingStorefrontIcon,
    color: 'from-gray-500 to-slate-600',
    categories: [
      'Category 1',
      'Category 2',
      'Category 3',
      'Category 4',
      'Category 5',
      'Other'
    ]
  }
];

export const getShopType = (id: string): ShopType | undefined => {
  return shopTypes.find(t => t.id === id);
};

export const getDefaultCategories = (shopTypeId: string): string[] => {
  const shopType = getShopType(shopTypeId);
  return shopType?.categories || shopTypes.find(t => t.id === 'general')?.categories || [];
};
