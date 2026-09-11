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
          <label className="block text-sm font-medium text-body mb-1.5">
            {label}
          </label>
        )}
        <div className="relative flex">
          {/* Country picker button */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={clsx(
              'flex items-center gap-2 px-3 py-3 bg-shade border border-line-strong rounded-l-sharp',
              'hover:bg-shade transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ink/50',
              error && 'border-bad'
            )}
          >
            <span className="text-xl">{selectedCountry.flag}</span>
            <span className="text-sm text-body">{selectedCountry.phonePrefix}</span>
            <ChevronDownIcon className="w-4 h-4 text-mute" />
          </button>

          {/* Phone input */}
          <input
            ref={ref}
            type="tel"
            value={value}
            onChange={handlePhoneChange}
            placeholder={placeholder}
            className={clsx(
              'flex-1 px-4 py-3 bg-sand border border-l-0 border-line-strong rounded-r-sharp',
              'text-ink placeholder-mist',
              'focus:outline-none focus:ring-2 focus:ring-ink/50 focus:border-ink',
              error && 'border-bad focus:border-bad focus:ring-bad/20',
              className
            )}
          />
        </div>

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
                  <h2 className="text-xl font-bold text-ink">Select Country Code</h2>
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

              {/* Country list */}
              <div className="overflow-y-auto max-h-[calc(85vh-140px)] p-2">
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
                            const isSelected = country.code === selectedCountry.code;
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
                                <span className="text-2xl">{country.flag}</span>
                                <div className="flex-1 text-left">
                                  <p className={clsx(
                                    'font-medium',
                                    isSelected ? 'text-brick' : 'text-ink'
                                  )}>
                                    {country.name}
                                  </p>
                                </div>
                                <span className="text-sm text-mute">
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
