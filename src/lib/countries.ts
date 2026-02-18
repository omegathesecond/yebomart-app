// African Countries Configuration for YeboMart
// Complete localization data for each supported country

export type Region = 'southern' | 'east' | 'west' | 'central' | 'north';
export type Language = 'en' | 'fr' | 'pt' | 'ar' | 'am';

export interface Country {
  code: string;           // ISO 3166-1 alpha-2
  name: string;           // English name
  nameFr?: string;        // French name (if different)
  nameLocal?: string;     // Local language name
  flag: string;           // Flag emoji
  currency: string;       // ISO 4217 currency code
  currencySymbol: string; // Currency symbol
  currencyName: string;   // Full currency name
  decimalPlaces: number;  // Decimal places for currency
  languages: Language[];  // Supported languages
  phonePrefix: string;    // International dialing code
  region: Region;         // African region
}

export const COUNTRIES: Country[] = [
  // Southern Africa
  {
    code: 'SZ',
    name: 'Eswatini',
    nameLocal: 'eSwatini',
    flag: '🇸🇿',
    currency: 'SZL',
    currencySymbol: 'E',
    currencyName: 'Swazi Lilangeni',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+268',
    region: 'southern'
  },
  {
    code: 'ZA',
    name: 'South Africa',
    nameFr: 'Afrique du Sud',
    flag: '🇿🇦',
    currency: 'ZAR',
    currencySymbol: 'R',
    currencyName: 'South African Rand',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+27',
    region: 'southern'
  },
  {
    code: 'BW',
    name: 'Botswana',
    flag: '🇧🇼',
    currency: 'BWP',
    currencySymbol: 'P',
    currencyName: 'Botswana Pula',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+267',
    region: 'southern'
  },
  {
    code: 'ZM',
    name: 'Zambia',
    nameFr: 'Zambie',
    flag: '🇿🇲',
    currency: 'ZMW',
    currencySymbol: 'K',
    currencyName: 'Zambian Kwacha',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+260',
    region: 'southern'
  },
  {
    code: 'ZW',
    name: 'Zimbabwe',
    flag: '🇿🇼',
    currency: 'USD',
    currencySymbol: '$',
    currencyName: 'US Dollar',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+263',
    region: 'southern'
  },
  {
    code: 'MZ',
    name: 'Mozambique',
    flag: '🇲🇿',
    currency: 'MZN',
    currencySymbol: 'MT',
    currencyName: 'Mozambican Metical',
    decimalPlaces: 2,
    languages: ['pt'],
    phonePrefix: '+258',
    region: 'southern'
  },
  {
    code: 'MW',
    name: 'Malawi',
    flag: '🇲🇼',
    currency: 'MWK',
    currencySymbol: 'MK',
    currencyName: 'Malawian Kwacha',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+265',
    region: 'southern'
  },
  {
    code: 'LS',
    name: 'Lesotho',
    flag: '🇱🇸',
    currency: 'LSL',
    currencySymbol: 'L',
    currencyName: 'Lesotho Loti',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+266',
    region: 'southern'
  },
  {
    code: 'NA',
    name: 'Namibia',
    nameFr: 'Namibie',
    flag: '🇳🇦',
    currency: 'NAD',
    currencySymbol: 'N$',
    currencyName: 'Namibian Dollar',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+264',
    region: 'southern'
  },
  
  // East Africa
  {
    code: 'KE',
    name: 'Kenya',
    flag: '🇰🇪',
    currency: 'KES',
    currencySymbol: 'KSh',
    currencyName: 'Kenyan Shilling',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+254',
    region: 'east'
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    nameFr: 'Tanzanie',
    flag: '🇹🇿',
    currency: 'TZS',
    currencySymbol: 'TSh',
    currencyName: 'Tanzanian Shilling',
    decimalPlaces: 0,
    languages: ['en'],
    phonePrefix: '+255',
    region: 'east'
  },
  {
    code: 'UG',
    name: 'Uganda',
    nameFr: 'Ouganda',
    flag: '🇺🇬',
    currency: 'UGX',
    currencySymbol: 'USh',
    currencyName: 'Ugandan Shilling',
    decimalPlaces: 0,
    languages: ['en'],
    phonePrefix: '+256',
    region: 'east'
  },
  {
    code: 'RW',
    name: 'Rwanda',
    flag: '🇷🇼',
    currency: 'RWF',
    currencySymbol: 'FRw',
    currencyName: 'Rwandan Franc',
    decimalPlaces: 0,
    languages: ['en', 'fr'],
    phonePrefix: '+250',
    region: 'east'
  },
  {
    code: 'ET',
    name: 'Ethiopia',
    nameFr: 'Éthiopie',
    nameLocal: 'ኢትዮጵያ',
    flag: '🇪🇹',
    currency: 'ETB',
    currencySymbol: 'Br',
    currencyName: 'Ethiopian Birr',
    decimalPlaces: 2,
    languages: ['am', 'en'],
    phonePrefix: '+251',
    region: 'east'
  },
  
  // West Africa
  {
    code: 'NG',
    name: 'Nigeria',
    nameFr: 'Nigéria',
    flag: '🇳🇬',
    currency: 'NGN',
    currencySymbol: '₦',
    currencyName: 'Nigerian Naira',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+234',
    region: 'west'
  },
  {
    code: 'GH',
    name: 'Ghana',
    flag: '🇬🇭',
    currency: 'GHS',
    currencySymbol: 'GH₵',
    currencyName: 'Ghanaian Cedi',
    decimalPlaces: 2,
    languages: ['en'],
    phonePrefix: '+233',
    region: 'west'
  },
  {
    code: 'SN',
    name: 'Senegal',
    nameFr: 'Sénégal',
    flag: '🇸🇳',
    currency: 'XOF',
    currencySymbol: 'CFA',
    currencyName: 'West African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+221',
    region: 'west'
  },
  {
    code: 'CI',
    name: 'Ivory Coast',
    nameFr: "Côte d'Ivoire",
    flag: '🇨🇮',
    currency: 'XOF',
    currencySymbol: 'CFA',
    currencyName: 'West African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+225',
    region: 'west'
  },
  {
    code: 'ML',
    name: 'Mali',
    flag: '🇲🇱',
    currency: 'XOF',
    currencySymbol: 'CFA',
    currencyName: 'West African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+223',
    region: 'west'
  },
  {
    code: 'BF',
    name: 'Burkina Faso',
    flag: '🇧🇫',
    currency: 'XOF',
    currencySymbol: 'CFA',
    currencyName: 'West African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+226',
    region: 'west'
  },
  {
    code: 'NE',
    name: 'Niger',
    flag: '🇳🇪',
    currency: 'XOF',
    currencySymbol: 'CFA',
    currencyName: 'West African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+227',
    region: 'west'
  },
  {
    code: 'BJ',
    name: 'Benin',
    nameFr: 'Bénin',
    flag: '🇧🇯',
    currency: 'XOF',
    currencySymbol: 'CFA',
    currencyName: 'West African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+229',
    region: 'west'
  },
  {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    currency: 'XOF',
    currencySymbol: 'CFA',
    currencyName: 'West African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+228',
    region: 'west'
  },
  
  // Central Africa
  {
    code: 'CM',
    name: 'Cameroon',
    nameFr: 'Cameroun',
    flag: '🇨🇲',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    currencyName: 'Central African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr', 'en'],
    phonePrefix: '+237',
    region: 'central'
  },
  {
    code: 'CD',
    name: 'DR Congo',
    nameFr: 'RD Congo',
    flag: '🇨🇩',
    currency: 'CDF',
    currencySymbol: 'FC',
    currencyName: 'Congolese Franc',
    decimalPlaces: 2,
    languages: ['fr'],
    phonePrefix: '+243',
    region: 'central'
  },
  {
    code: 'CG',
    name: 'Congo',
    flag: '🇨🇬',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    currencyName: 'Central African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+242',
    region: 'central'
  },
  {
    code: 'GA',
    name: 'Gabon',
    flag: '🇬🇦',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    currencyName: 'Central African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+241',
    region: 'central'
  },
  {
    code: 'TD',
    name: 'Chad',
    nameFr: 'Tchad',
    flag: '🇹🇩',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    currencyName: 'Central African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr', 'ar'],
    phonePrefix: '+235',
    region: 'central'
  },
  {
    code: 'CF',
    name: 'Central African Republic',
    nameFr: 'République Centrafricaine',
    flag: '🇨🇫',
    currency: 'XAF',
    currencySymbol: 'FCFA',
    currencyName: 'Central African CFA Franc',
    decimalPlaces: 0,
    languages: ['fr'],
    phonePrefix: '+236',
    region: 'central'
  },
  
  // North Africa
  {
    code: 'MA',
    name: 'Morocco',
    nameFr: 'Maroc',
    nameLocal: 'المغرب',
    flag: '🇲🇦',
    currency: 'MAD',
    currencySymbol: 'DH',
    currencyName: 'Moroccan Dirham',
    decimalPlaces: 2,
    languages: ['fr', 'ar'],
    phonePrefix: '+212',
    region: 'north'
  },
  {
    code: 'EG',
    name: 'Egypt',
    nameFr: 'Égypte',
    nameLocal: 'مصر',
    flag: '🇪🇬',
    currency: 'EGP',
    currencySymbol: 'E£',
    currencyName: 'Egyptian Pound',
    decimalPlaces: 2,
    languages: ['ar', 'en'],
    phonePrefix: '+20',
    region: 'north'
  },
  {
    code: 'TN',
    name: 'Tunisia',
    nameFr: 'Tunisie',
    nameLocal: 'تونس',
    flag: '🇹🇳',
    currency: 'TND',
    currencySymbol: 'DT',
    currencyName: 'Tunisian Dinar',
    decimalPlaces: 3,
    languages: ['fr', 'ar'],
    phonePrefix: '+216',
    region: 'north'
  },
  {
    code: 'DZ',
    name: 'Algeria',
    nameFr: 'Algérie',
    nameLocal: 'الجزائر',
    flag: '🇩🇿',
    currency: 'DZD',
    currencySymbol: 'DA',
    currencyName: 'Algerian Dinar',
    decimalPlaces: 2,
    languages: ['fr', 'ar'],
    phonePrefix: '+213',
    region: 'north'
  }
];

// Region labels
export const REGION_LABELS: Record<Region, { en: string; fr: string }> = {
  southern: { en: 'Southern Africa', fr: 'Afrique Australe' },
  east: { en: 'East Africa', fr: 'Afrique de l\'Est' },
  west: { en: 'West Africa', fr: 'Afrique de l\'Ouest' },
  central: { en: 'Central Africa', fr: 'Afrique Centrale' },
  north: { en: 'North Africa', fr: 'Afrique du Nord' }
};

// Language labels
export const LANGUAGE_LABELS: Record<Language, { en: string; native: string }> = {
  en: { en: 'English', native: 'English' },
  fr: { en: 'French', native: 'Français' },
  pt: { en: 'Portuguese', native: 'Português' },
  ar: { en: 'Arabic', native: 'العربية' },
  am: { en: 'Amharic', native: 'አማርኛ' }
};

// Helper functions
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code);
}

export function getCountriesByRegion(region: Region): Country[] {
  return COUNTRIES.filter(c => c.region === region);
}

export function getCountriesByLanguage(language: Language): Country[] {
  return COUNTRIES.filter(c => c.languages.includes(language));
}

export function getCountriesByCurrency(currency: string): Country[] {
  return COUNTRIES.filter(c => c.currency === currency);
}

export function searchCountries(query: string, language: Language = 'en'): Country[] {
  const q = query.toLowerCase();
  return COUNTRIES.filter(c => {
    const name = language === 'fr' && c.nameFr ? c.nameFr : c.name;
    return (
      name.toLowerCase().includes(q) ||
      c.code.toLowerCase().includes(q) ||
      c.currency.toLowerCase().includes(q) ||
      c.currencyName.toLowerCase().includes(q)
    );
  });
}

// Group countries by region
export function getCountriesGroupedByRegion(): Record<Region, Country[]> {
  return {
    southern: getCountriesByRegion('southern'),
    east: getCountriesByRegion('east'),
    west: getCountriesByRegion('west'),
    central: getCountriesByRegion('central'),
    north: getCountriesByRegion('north')
  };
}

// Default country (Eswatini)
export const DEFAULT_COUNTRY_CODE = 'SZ';
export const DEFAULT_LANGUAGE: Language = 'en';
