import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon, MagnifyingGlassIcon, XMarkIcon, GlobeAltIcon, CheckIcon } from '@heroicons/react/24/outline';
import { clsx } from 'clsx';
import { COUNTRIES, type Country, getCountriesGroupedByRegion, REGION_LABELS, type Region } from '@/lib/countries';

interface ShopCountryPickerProps {
  label?: string;
  value: string; // Country code
  onChange: (country: Country) => void;
  error?: string;
  hint?: string;
  className?: string;
}

export function ShopCountryPicker({
  label,
  value,
  onChange,
  error,
  hint,
  className
}: ShopCountryPickerProps) {
  const selectedCountry = COUNTRIES.find(c => c.code === value) || COUNTRIES[0];
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
        c.currency.toLowerCase().includes(q)
      );
    });
    filteredByRegion[region] = filtered;
  });

  const hasResults = Object.values(filteredByRegion).some(arr => arr.length > 0);

  const handleSelectCountry = (country: Country) => {
    onChange(country);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div className={clsx('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-body mb-1.5">
          {label}
        </label>
      )}
      
      {/* Picker button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={clsx(
          'w-full flex items-center gap-4 px-4 py-3 bg-sand border border-line-strong rounded-sharp',
          'hover:bg-shade transition-colors text-left',
          'focus:outline-none focus:ring-2 focus:ring-ink/50 focus:border-ink',
          error && 'border-bad'
        )}
      >
        <div className="w-10 h-10 flex items-center justify-center bg-shade rounded-sharp text-2xl">
          {selectedCountry.flag}
        </div>
        <div className="flex-1">
          <p className="text-ink font-medium">{selectedCountry.name}</p>
          <p className="text-sm text-brick">
            {selectedCountry.currencySymbol} {selectedCountry.currencyName}
          </p>
        </div>
        <ChevronDownIcon className="w-5 h-5 text-mute" />
      </button>

      {error && (
        <p className="mt-1.5 text-sm text-bad">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-sm text-mist">{hint}</p>
      )}

      {/* Country picker modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-in fade-in duration-200">
          <div
            ref={modalRef}
            className="w-full max-w-lg max-h-[85vh] bg-cream border border-line rounded-sharp shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="sticky top-0 bg-cream border-b border-line p-4 z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-wash rounded-full flex items-center justify-center">
                    <GlobeAltIcon className="w-5 h-5 text-brick" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-ink">Shop Country</h2>
                    <p className="text-sm text-mute">Where is your shop located?</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-shade rounded-sharp transition"
                >
                  <XMarkIcon className="w-5 h-5 text-mute" />
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-mute" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search countries..."
                  className="w-full pl-10 pr-4 py-3 bg-sand border border-line-strong rounded-sharp text-ink placeholder-mist focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </div>
            </div>

            {/* Info banner */}
            <div className="px-4 py-3 bg-wash border-b border-ink/20">
              <p className="text-sm text-brick">
                💡 Your shop's country determines the currency, tax settings, and payment methods.
              </p>
            </div>

            {/* Country list */}
            <div className="overflow-y-auto max-h-[calc(85vh-220px)] p-2">
              {!hasResults ? (
                <div className="text-center py-8 text-mute">
                  No countries found
                </div>
              ) : (
                regions.map(region => {
                  const countries = filteredByRegion[region];
                  if (countries.length === 0) return null;
                  
                  return (
                    <div key={region} className="mb-2">
                      <div className="px-3 py-2 text-xs font-semibold text-mute uppercase tracking-wide">
                        {REGION_LABELS[region].en}
                      </div>
                      <div className="space-y-1">
                        {countries.map(country => {
                          const isSelected = country.code === value;
                          return (
                            <button
                              key={country.code}
                              onClick={() => handleSelectCountry(country)}
                              className={clsx(
                                'w-full flex items-center gap-3 px-3 py-3 rounded-sharp transition',
                                isSelected
                                  ? 'bg-wash border border-ink/50'
                                  : 'hover:bg-sand border border-transparent'
                              )}
                            >
                              <span className="text-3xl">{country.flag}</span>
                              <div className="flex-1 text-left">
                                <p className={clsx(
                                  'font-medium',
                                  isSelected ? 'text-brick' : 'text-ink'
                                )}>
                                  {country.name}
                                </p>
                                <p className="text-sm text-mute">
                                  {country.currencySymbol} {country.currencyName}
                                </p>
                              </div>
                              {isSelected && (
                                <div className="w-6 h-6 bg-brand rounded-full flex items-center justify-center">
                                  <CheckIcon className="w-4 h-4 text-ink" />
                                </div>
                              )}
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
