import { useState, useRef, useEffect, forwardRef } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { COUNTRIES, type Country, getCountriesGroupedByRegion, REGION_LABELS, type Region } from '@/lib/countries';

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (value: string, countryCode: string, fullNumber: string) => void;
  defaultCountryCode?: string;
  error?: string;
  hint?: string;
  placeholder?: string;
  className?: string;
}

export const PhoneInput = forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ 
    label, 
    value, 
    onChange, 
    defaultCountryCode = 'SZ',
    error, 
    hint, 
    placeholder = 'Phone number',
    className 
  }, ref) => {
    const [selectedCountry, setSelectedCountry] = useState<Country>(
      COUNTRIES.find(c => c.code === defaultCountryCode) || COUNTRIES[0]
    );
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const modalRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close on outside click
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      }
      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        setTimeout(() => searchRef.current?.focus(), 100);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Close on escape
    useEffect(() => {
      function handleEscape(event: KeyboardEvent) {
        if (event.key === 'Escape') setIsOpen(false);
      }
      if (isOpen) {
        document.addEventListener('keydown', handleEscape);
      }
      return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen]);

    // Filter countries by search
    const countriesByRegion = getCountriesGroupedByRegion();
    const regions: Region[] = ['southern', 'east', 'west', 'central', 'north'];
    
    const filteredByRegion: Record<Region, Country[]> = {} as Record<Region, Country[]>;
    regions.forEach(region => {
      const filtered = countriesByRegion[region].filter(c => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q) ||
          c.phonePrefix.includes(q)
        );
      });
      filteredByRegion[region] = filtered;
    });

    const hasResults = Object.values(filteredByRegion).some(arr => arr.length > 0);

    const handleSelectCountry = (country: Country) => {
      setSelectedCountry(country);
      setIsOpen(false);
      setSearchQuery('');
      // Trigger onChange with new country
      const fullNumber = `${country.phonePrefix}${value.replace(/^0+/, '')}`;
      onChange(value, country.code, fullNumber);
    };

    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let phone = e.target.value.replace(/[^\d]/g, '');
      // Remove leading zero if present (will be added by country code)
      const fullNumber = `${selectedCountry.phonePrefix}${phone.replace(/^0+/, '')}`;
      onChange(phone, selectedCountry.code, fullNumber);
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex">
          {/* Country picker button */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={clsx(
              'flex items-center gap-2 px-3 py-3 bg-slate-700 border border-slate-600 rounded-l-xl',
              'hover:bg-slate-600 transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
              error && 'border-red-500'
            )}
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm text-slate-300">{selectedCountry.phonePrefix}</span>
            <ChevronDownIcon className="w-4 h-4 text-slate-400" />
          </button>

          {/* Phone input */}
          <input
            ref={ref}
            type="tel"
            value={value}
            onChange={handlePhoneChange}
            placeholder={placeholder}
            className={clsx(
              'flex-1 px-4 py-3 bg-slate-800 border border-l-0 border-slate-600 rounded-r-xl',
              'text-white placeholder-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className
            )}
          />
        </div>

        {error && (
          <p className="mt-1.5 text-sm text-red-400">{error}</p>
        )}
        {hint && !error && (
          <p className="mt-1.5 text-sm text-slate-500">{hint}</p>
        )}

        {/* Country picker modal */}
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              ref={modalRef}
              className="w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            >
              {/* Header */}
              <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 z-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Select Country Code</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition"
                  >
                    <XMarkIcon className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                {/* Search */}
                <div className="relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search countries..."
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Country list */}
              <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-2">
                {!hasResults ? (
                  <div className="text-center py-8 text-slate-400">
                    No countries found
                  </div>
                ) : (
                  regions.map(region => {
                    const countries = filteredByRegion[region];
                    if (countries.length === 0) return null;
                    
                    return (
                      <div key={region} className="mb-2">
                        <div className="px-3 py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                          {REGION_LABELS[region].en}
                        </div>
                        <div className="space-y-1">
                          {countries.map(country => {
                            const isSelected = country.code === selectedCountry.code;
                            return (
                              <button
                                key={country.code}
                                onClick={() => handleSelectCountry(country)}
                                className={clsx(
                                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl transition',
                                  isSelected
                                    ? 'bg-amber-500/20 border border-amber-500/50'
                                    : 'hover:bg-slate-800 border border-transparent'
                                )}
                              >
                                <span className="text-2xl">{country.flag}</span>
                                <div className="flex-1 text-left">
                                  <p className={clsx(
                                    'font-medium',
                                    isSelected ? 'text-amber-400' : 'text-white'
                                  )}>
                                    {country.name}
                                  </p>
                                </div>
                                <span className="text-sm text-slate-400">
                                  {country.phonePrefix}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

PhoneInput.displayName = 'PhoneInput';
