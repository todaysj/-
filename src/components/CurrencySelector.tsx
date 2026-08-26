import React, { useState } from 'react';
import { getAllCurrencies, getCurrencyInfo } from '../utils/currencyUtils';
import { Plus, Coins } from 'lucide-react';
import { AddCurrencyModal } from './AddCurrencyModal';

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  customExchangeRates?: Record<string, number>;
  onAddCustomCurrency?: (code: string, rate: number) => void;
  className?: string;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value,
  onChange,
  customExchangeRates,
  onAddCustomCurrency,
  className = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none'
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const currencies = getAllCurrencies(customExchangeRates);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === '__ADD_NEW__') {
      setIsAddModalOpen(true);
    } else {
      onChange(selected);
    }
  };

  const handleAddCurrency = (newCode: string, newRate: number) => {
    if (onAddCustomCurrency) {
      onAddCustomCurrency(newCode, newRate);
    }
    onChange(newCode);
  };

  return (
    <>
      <div className="relative flex items-center">
        <select
          value={value}
          onChange={handleSelectChange}
          className={className}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} ({c.name} {c.symbol ? `${c.symbol}` : ''}) - 1단위 약 {c.rate >= 1 ? `${Math.round(c.rate).toLocaleString()}원` : `${c.rate}원`}
            </option>
          ))}
          <option value="__ADD_NEW__" className="font-bold text-sky-600">
            ➕ + 새 통화 직접 추가하기...
          </option>
        </select>
      </div>

      <AddCurrencyModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddCurrency}
      />
    </>
  );
};
