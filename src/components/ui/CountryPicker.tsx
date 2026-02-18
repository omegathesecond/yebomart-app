import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  CheckIcon,
  GlobeAltIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useLocaleStore, COUNTRIES, type Country, type Language } from '@/stores/localeStore';
import { getCountriesGroupedByRegion, REGION_LABELS, LANGUAGE_LABELS, type Region } from '@/lib/countries';

interface CountryPickerProps {
  variant?: 'button' | 'card' | 'minimal';
  showCurrency?: boolean;
  showLanguage?: boolean;
  onSelect?: (country: Country) => void;
}

export function CountryPicker({
  variant = 'button',
  showCurrency = true,
  showLanguage = true,
  onSelect
}: CountryPickerProps) {
  const { t } = useTranslation();
  const { country, countryCode, language, setCountry, setLanguage } = useLocaleStore();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRegions, setExpandedRegions] = useState<Region[]>(['southern', 'east', 'west', 'central', 'north']);
  const modalRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Close modal on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Focus search input when modal opens
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
  const filteredByRegion: Record<Region, Country[]> = {} as Record<Region, Country[]>;
  
  const regions: Region[] = ['southern', 'east', 'west', 'central', 'north'];
  regions.forEach(region => {
    const filtered = countriesByRegion[region].filter(c => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      const name = language === 'fr' && c.nameFr ? c.nameFr : c.name;
      return (
        name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.currency.toLowerCase().includes(q) ||
        c.currencyName.toLowerCase().includes(q)
      );
    });
    filteredByRegion[region] = filtered;
  });

  const hasResults = Object.values(filteredByRegion).some(arr => arr.length > 0);

  const handleSelectCountry = (c: Country) => {
    setCountry(c.code);
    onSelect?.(c);
    setIsOpen(false);
    setSearchQuery('');
  };

  const toggleRegion = (region: Region) => {
    setExpandedRegions(prev =>
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  // Render trigger button
  const renderTrigger = () => {
    if (variant === 'minimal') {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-700/50 transition"
        >
          <span className="text-2xl">{country?.flag}</span>
          <ChevronDownIcon className="w-4 h-4 text-slate-400" />
        </button>
      );
    }

    if (variant === 'card') {
      return (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full p-4 bg-slate-700/30 hover:bg-slate-700/50 border border-slate-600 rounded-xl transition text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center bg-slate-800 rounded-xl text-3xl">
              {country?.flag || '🌍'}
            </div>
            <div className="flex-1">
              <p className="text-sm text-slate-400">{t('countryPicker.currentCountry')}</p>
              <h3 className="text-lg font-semibold text-white">
                {language === 'fr' && country?.nameFr ? country.nameFr : country?.name}
              </h3>
              {showCurrency && country && (
                <p className="text-sm text-amber-400">
                  {country.currencySymbol} {country.currencyName}
                </p>
              )}
            </div>
            <ChevronDownIcon className="w-5 h-5 text-slate-400" />
          </div>
        </button>
      );
    }

    // Default button variant
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl transition"
      >
        <span className="text-2xl">{country?.flag || '🌍'}</span>
        <div className="text-left">
          <p className="text-white font-medium">
            {language === 'fr' && country?.nameFr ? country.nameFr : country?.name}
          </p>
          {showCurrency && country && (
            <p className="text-xs text-slate-400">{country.currencySymbol} {country.currency}</p>
          )}
        </div>
        <ChevronDownIcon className="w-4 h-4 text-slate-400 ml-2" />
      </button>
    );
  };

  return (
    <>
      {renderTrigger()}

      {/* Modal Backdrop */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          {/* Modal */}
          <div
            ref={modalRef}
            className="w-full max-w-lg max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 z-10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                    <GlobeAltIcon className="w-5 h-5 text-amber-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white">{t('countryPicker.title')}</h2>
                </div>
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
                  placeholder={t('countryPicker.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded"
                  >
                    <XMarkIcon className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Country List */}
            <div className="overflow-y-auto max-h-[calc(85vh-180px)] p-2">
              {!hasResults ? (
                <div className="text-center py-12">
                  <GlobeAltIcon className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-400">{t('common.noResults')}</p>
                </div>
              ) : (
                regions.map(region => {
                  const countries = filteredByRegion[region];
                  if (countries.length === 0) return null;
                  
                  const isExpanded = expandedRegions.includes(region);
                  const regionLabel = language === 'fr' 
                    ? REGION_LABELS[region].fr 
                    : REGION_LABELS[region].en;

                  return (
                    <div key={region} className="mb-2">
                      {/* Region Header */}
                      <button
                        onClick={() => toggleRegion(region)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-semibold text-slate-400 hover:text-slate-300 transition"
                      >
                        <ChevronDownIcon
                          className={`w-4 h-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                        />
                        <span>{regionLabel}</span>
                        <span className="text-xs text-slate-500">({countries.length})</span>
                      </button>

                      {/* Countries */}
                      {isExpanded && (
                        <div className="space-y-1 pl-2">
                          {countries.map(c => {
                            const isSelected = c.code === countryCode;
                            const displayName = language === 'fr' && c.nameFr ? c.nameFr : c.name;
                            
                            return (
                              <button
                                key={c.code}
                                onClick={() => handleSelectCountry(c)}
                                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition ${
                                  isSelected
                                    ? 'bg-amber-500/20 border border-amber-500/50'
                                    : 'hover:bg-slate-800 border border-transparent'
                                }`}
                              >
                                <span className="text-3xl">{c.flag}</span>
                                <div className="flex-1 text-left">
                                  <p className={`font-medium ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                                    {displayName}
                                  </p>
                                  <p className="text-sm text-slate-400">
                                    {c.currencySymbol} {c.currencyName}
                                  </p>
                                </div>
                                {isSelected && (
                                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
                                    <CheckIcon className="w-4 h-4 text-white" />
                                  </div>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with Language Switcher */}
            {showLanguage && country && country.languages.length > 1 && (
              <div className="sticky bottom-0 bg-slate-800/80 backdrop-blur border-t border-slate-700 p-4">
                <p className="text-sm text-slate-400 mb-2">{t('settings.language')}</p>
                <div className="flex gap-2">
                  {country.languages.map(lang => (
                    <button
                      key={lang}
                      onClick={() => setLanguage(lang)}
                      className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                        language === lang
                          ? 'bg-amber-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {LANGUAGE_LABELS[lang].native}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// Compact flag-only picker for navigation
export function CountryFlagPicker() {
  return <CountryPicker variant="minimal" showCurrency={false} showLanguage={false} />;
}

// Language switcher standalone component
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { language, setLanguage, country } = useLocaleStore();
  
  const availableLanguages = country?.languages || ['en'];
  
  if (availableLanguages.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {availableLanguages.map(lang => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            language === lang
              ? 'bg-amber-500 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          {LANGUAGE_LABELS[lang].native}
        </button>
      ))}
    </div>
  );
}
