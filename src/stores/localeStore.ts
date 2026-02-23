import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { setCurrencyConfig } from '@/types';
import i18n from '@/lib/i18n';
import {
  type Country,
  type Language,
  COUNTRIES,
  getCountryByCode,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_LANGUAGE
} from '@/lib/countries';

interface LocaleState {
  countryCode: string;
  language: Language;
  country: Country | undefined;
  
  // Actions
  setCountry: (code: string) => void;
  setLanguage: (lang: Language) => void;
  
  // Currency formatting
  formatCurrency: (amount: number) => string;
  formatCurrencyCompact: (amount: number) => string;
  getCurrencySymbol: () => string;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      countryCode: DEFAULT_COUNTRY_CODE,
      language: DEFAULT_LANGUAGE,
      country: getCountryByCode(DEFAULT_COUNTRY_CODE),
      
      setCountry: (code: string) => {
        const country = getCountryByCode(code);
        if (country) {
          // Auto-switch language if current language isn't supported
          const currentLang = get().language;
          const newLang = country.languages.includes(currentLang)
            ? currentLang
            : country.languages[0];
          
          // Update i18n language
          if (newLang !== currentLang) {
            i18n.changeLanguage(newLang);
          }
          
          set({
            countryCode: code,
            country,
            language: newLang
          });
          
          // Sync global currency formatter
          setCurrencyConfig(country.currencySymbol, country.decimalPlaces);
        }
      },
      
      setLanguage: (lang: Language) => {
        const country = get().country;
        // Only allow supported languages for the country
        if (country && country.languages.includes(lang)) {
          i18n.changeLanguage(lang);
          set({ language: lang });
        } else if (!country) {
          // No country set, just change language
          i18n.changeLanguage(lang);
          set({ language: lang });
        }
      },
      
      formatCurrency: (amount: number) => {
        const { country } = get();
        if (!country) return `${amount.toFixed(2)}`;
        
        const formatter = new Intl.NumberFormat(
          country.languages[0] === 'fr' ? 'fr-FR' : 'en-US',
          {
            minimumFractionDigits: country.decimalPlaces,
            maximumFractionDigits: country.decimalPlaces
          }
        );
        
        return `${country.currencySymbol}${formatter.format(amount)}`;
      },
      
      formatCurrencyCompact: (amount: number) => {
        const { country } = get();
        if (!country) return `${amount}`;
        
        // For large numbers, use compact notation
        if (amount >= 1000000) {
          return `${country.currencySymbol}${(amount / 1000000).toFixed(1)}M`;
        }
        if (amount >= 1000) {
          return `${country.currencySymbol}${(amount / 1000).toFixed(1)}K`;
        }
        
        return get().formatCurrency(amount);
      },
      
      getCurrencySymbol: () => {
        const { country } = get();
        return country?.currencySymbol || '$';
      }
    }),
    {
      name: 'yebomart-locale',
      partialize: (state) => ({
        countryCode: state.countryCode,
        language: state.language
      }),
      onRehydrateStorage: () => (state) => {
        // After rehydrating from localStorage, update the country object
        if (state) {
          const country = getCountryByCode(state.countryCode);
          if (country) {
            state.country = country;
            // Sync i18n language
            i18n.changeLanguage(state.language);
            // Sync global currency formatter
            setCurrencyConfig(country.currencySymbol, country.decimalPlaces);
          }
        }
      }
    }
  )
);

// Export list of all countries for pickers
export { COUNTRIES, type Country, type Language };
