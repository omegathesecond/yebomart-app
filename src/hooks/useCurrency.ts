import { useCallback } from 'react';
import { useLocaleStore } from '@/stores/localeStore';

/**
 * Hook for formatting currency based on user's selected country
 * 
 * Usage:
 *   const { format, formatCompact, symbol } = useCurrency();
 *   format(1234.56) => "E1,234.56" (for Eswatini)
 *   formatCompact(1500000) => "E1.5M"
 */
export function useCurrency() {
  const { formatCurrency, formatCurrencyCompact, getCurrencySymbol, country } = useLocaleStore();
  
  const format = useCallback((amount: number) => {
    return formatCurrency(amount);
  }, [formatCurrency]);
  
  const formatCompact = useCallback((amount: number) => {
    return formatCurrencyCompact(amount);
  }, [formatCurrencyCompact]);
  
  const symbol = getCurrencySymbol();
  
  const formatWithoutSymbol = useCallback((amount: number) => {
    if (!country) return amount.toFixed(2);
    
    const formatter = new Intl.NumberFormat(
      country.languages[0] === 'fr' ? 'fr-FR' : 'en-US',
      {
        minimumFractionDigits: country.decimalPlaces,
        maximumFractionDigits: country.decimalPlaces
      }
    );
    
    return formatter.format(amount);
  }, [country]);
  
  // Parse a currency string back to number
  const parse = useCallback((value: string) => {
    // Remove currency symbol and thousands separators
    const cleaned = value
      .replace(symbol, '')
      .replace(/[,\s]/g, '')
      .replace(/\./g, (m, offset, str) => {
        // Keep only the last dot as decimal separator
        return offset === str.lastIndexOf('.') ? '.' : '';
      });
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }, [symbol]);
  
  return {
    format,
    formatCompact,
    formatWithoutSymbol,
    parse,
    symbol,
    currency: country?.currency || 'USD',
    currencyName: country?.currencyName || 'US Dollar',
    decimalPlaces: country?.decimalPlaces ?? 2
  };
}

// Re-export the store for direct access
export { useLocaleStore } from '@/stores/localeStore';
