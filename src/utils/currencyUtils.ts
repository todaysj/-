export interface CurrencyOption {
  code: string;
  name: string;
  symbol: string;
  defaultRate: number; // 1 unit = ? KRW
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: 'KRW', name: '대한민국 원', symbol: '₩', defaultRate: 1 },
  { code: 'JPY', name: '일본 엔', symbol: '¥', defaultRate: 9.0 },
  { code: 'USD', name: '미국 달러', symbol: '$', defaultRate: 1350.0 },
  { code: 'EUR', name: '유로', symbol: '€', defaultRate: 1450.0 },
  { code: 'CNY', name: '중국 위안', symbol: '¥', defaultRate: 185.0 },
  { code: 'TWD', name: '대만 달러', symbol: 'NT$', defaultRate: 42.0 },
  { code: 'HKD', name: '홍콩 달러', symbol: 'HK$', defaultRate: 172.0 },
  { code: 'THB', name: '태국 바트', symbol: '฿', defaultRate: 38.0 },
  { code: 'VND', name: '베트남 동', symbol: '₫', defaultRate: 0.055 },
  { code: 'GBP', name: '영국 파운드', symbol: '£', defaultRate: 1720.0 },
  { code: 'SGD', name: '싱가포르 달러', symbol: 'S$', defaultRate: 1020.0 },
  { code: 'AUD', name: '호주 달러', symbol: 'A$', defaultRate: 890.0 },
  { code: 'CAD', name: '캐나다 달러', symbol: 'C$', defaultRate: 990.0 },
  { code: 'CHF', name: '스위스 프랑', symbol: 'Fr', defaultRate: 1520.0 },
  { code: 'PHP', name: '필리핀 페소', symbol: '₱', defaultRate: 24.0 },
  { code: 'MYR', name: '말레이시아 링깃', symbol: 'RM', defaultRate: 300.0 },
  { code: 'MOP', name: '마카오 파타카', symbol: 'MOP$', defaultRate: 168.0 },
  { code: 'IDR', name: '인도네시아 루피아', symbol: 'Rp', defaultRate: 0.085 },
  { code: 'CZK', name: '체코 코루나', symbol: 'Kč', defaultRate: 58.0 },
  { code: 'HUF', name: '헝가리 포린트', symbol: 'Ft', defaultRate: 3.7 },
  { code: 'NZD', name: '뉴질랜드 달러', symbol: 'NZ$', defaultRate: 820.0 },
  { code: 'TRY', name: '튀르키예 리라', symbol: '₺', defaultRate: 40.0 }
];

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = SUPPORTED_CURRENCIES.reduce(
  (acc, curr) => {
    acc[curr.code] = curr.defaultRate;
    return acc;
  },
  {} as Record<string, number>
);

export function getCurrencyInfo(code?: string): { code: string; name: string; symbol: string } {
  if (!code) return { code: 'KRW', name: '대한민국 원', symbol: '₩' };
  const clean = code.trim().toUpperCase();
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === clean);
  if (found) return found;
  return { code: clean, name: clean, symbol: clean };
}

export function getAllCurrencies(customRates?: Record<string, number>): Array<{ code: string; name: string; symbol: string; rate: number }> {
  const list: Array<{ code: string; name: string; symbol: string; rate: number }> = SUPPORTED_CURRENCIES.map((c) => ({
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    rate: customRates && customRates[c.code] !== undefined ? customRates[c.code] : c.defaultRate
  }));

  if (customRates) {
    for (const [code, rate] of Object.entries(customRates)) {
      const clean = code.trim().toUpperCase();
      if (!list.some((item) => item.code === clean)) {
        list.push({
          code: clean,
          name: `${clean} (사용자 추가)`,
          symbol: clean,
          rate
        });
      }
    }
  }

  return list;
}

export function getExchangeRate(currency?: string, customRates?: Record<string, number>): number {
  if (!currency) return 1;
  const clean = currency.trim().toUpperCase();
  if (customRates && customRates[clean] !== undefined) {
    return customRates[clean];
  }
  return DEFAULT_EXCHANGE_RATES[clean] ?? 1;
}

export function convertToKRW(amount: number, currency?: string, customRates?: Record<string, number>): number {
  if (!amount || isNaN(amount)) return 0;
  return amount * getExchangeRate(currency, customRates);
}

export function calculateEventDate(startDate: string, day: number): string {
  try {
    if (!startDate) return new Date().toISOString().split('T')[0];
    const d = new Date(startDate);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    d.setDate(d.getDate() + (Math.max(1, day) - 1));
    return d.toISOString().split('T')[0];
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
}
