import React, { useState } from 'react';
import { Reservation } from '../types';
import { X, Ticket, FileText } from 'lucide-react';

interface ReservationModalProps {
  onClose: () => void;
  onSave: (res: Omit<Reservation, 'id'>) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({ onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Reservation['category']>('HOTEL');
  const [provider, setProvider] = useState('');
  const [confirmationNo, setConfirmationNo] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [details, setDetails] = useState('');
  const [price, setPrice] = useState('');
  const [fileName, setFileName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !confirmationNo.trim() || isSaving) return;

    setIsSaving(true);
    try {
      onSave({
        title: title.trim(),
        category,
        provider: provider.trim() || '온라인 예약',
        confirmationNo: confirmationNo.trim(),
        date: date.trim() || '일자 미정',
        time: time.trim(),
        details: details.trim(),
        price: Number(price) || 0,
        currency: 'KRW',
        fileName: fileName ? fileName : undefined
      });

      onClose();
    } catch (err) {
      console.error('상세 에러 (ReservationModal handleSubmit):', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-extrabold text-base">예약 서류 / 티켓 등록</h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">서류/티켓 이름 *</label>
            <input
              type="text"
              placeholder="예: 시부야 스트림 호텔 3박 바우처"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Reservation['category'])}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="HOTEL">숙소 바우처</option>
                <option value="FLIGHT">항공 E-티켓</option>
                <option value="ACTIVITY">입장권/투어 티켓</option>
                <option value="TRANSPORT">차량/패스 예약</option>
                <option value="OTHER">기타 서류</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">예약처 (대행사)</label>
              <input
                type="text"
                placeholder="예: 아고다, 클룩, 대한항공"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">예약 번호 (PNR / 확인번호) *</label>
            <input
              type="text"
              placeholder="예: AGD-9012384"
              value={confirmationNo}
              onChange={(e) => setConfirmationNo(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">예약 일자</label>
              <input
                type="text"
                placeholder="2026-09-10 ~ 09-13"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">시간 (선택)</label>
              <input
                type="text"
                placeholder="15:00 체크인"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">상세 정보 & 메모</label>
            <textarea
              placeholder="예: 디럭스 더블룸, 조식 불포함, 체크인 시 예약자 명의 여권 제시"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">첨부파일명 (선택)</label>
            <input
              type="text"
              placeholder="예: Hotel_Voucher_Tokyo.pdf"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isSaving ? '저장 중...' : '서류 저장'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
