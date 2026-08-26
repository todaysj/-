import React, { useState } from 'react';
import { Trip, Reservation } from '../types';
import { Ticket, Plane, Hotel, Compass, Car, Copy, Check, QrCode, FileText, Plus, ExternalLink, Download } from 'lucide-react';

interface ReservationsViewProps {
  trip: Trip;
  onOpenAddModal: () => void;
}

export const ReservationsView: React.FC<ReservationsViewProps> = ({ trip, onOpenAddModal }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeQrUrl, setActiveQrUrl] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getCategoryIcon = (category: Reservation['category']) => {
    switch (category) {
      case 'FLIGHT':
        return <Plane className="w-5 h-5 text-indigo-600" />;
      case 'HOTEL':
        return <Hotel className="w-5 h-5 text-amber-600" />;
      case 'ACTIVITY':
        return <Compass className="w-5 h-5 text-sky-600" />;
      case 'TRANSPORT':
        return <Car className="w-5 h-5 text-emerald-600" />;
      default:
        return <Ticket className="w-5 h-5 text-slate-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Ticket className="w-6 h-6 text-sky-600" />
            <h2 className="text-lg font-extrabold text-slate-800">예약 서류 & E-티켓 보관함</h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            항공권, 호텔 바우처, 현지 티켓, 차량 예약 번호를 한 곳에서 관리하세요.
          </p>
        </div>

        <button
          onClick={onOpenAddModal}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>예약 서류 추가</span>
        </button>
      </div>

      {/* Reservation Cards List */}
      {trip.reservations.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-slate-300">
          <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 mb-1">등록된 예약 서류가 없습니다</h3>
          <p className="text-xs text-slate-500 mb-4">
            항공권 바우처나 숙소 예약 정보를 미리 등록해두시면 여행지에서 빠르게 확인할 수 있습니다.
          </p>
          <button
            onClick={onOpenAddModal}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-sky-500"
          >
            <Plus className="w-4 h-4" />
            <span>서류 등록하기</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {trip.reservations.map((res) => (
            <div
              key={res.id}
              className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                {/* Header Badge & Category */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className="p-2 bg-slate-100 rounded-xl">
                      {getCategoryIcon(res.category)}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wide">
                        {res.provider}
                      </span>
                      <h3 className="font-bold text-slate-800 text-base leading-snug">
                        {res.title}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Details Section */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-2 text-xs mb-4">
                  {/* Confirmation Number */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">예약 번호 (PNR)</span>
                    <div className="flex items-center space-x-1.5">
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {res.confirmationNo}
                      </span>
                      <button
                        onClick={() => copyToClipboard(res.confirmationNo, res.id)}
                        className="p-1 text-slate-400 hover:text-sky-600 transition"
                        title="예약번호 복사"
                      >
                        {copiedId === res.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Date & Time */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">일시</span>
                    <span className="font-bold text-slate-800">
                      {res.date} {res.time && `(${res.time})`}
                    </span>
                  </div>

                  {/* Details */}
                  {res.details && (
                    <div className="pt-1 text-slate-600 border-t border-slate-200/60">
                      {res.details}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions: QR Code or File Download */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                {res.price ? (
                  <span className="text-xs font-extrabold text-slate-900">
                    결제 금액: {res.price.toLocaleString()} {res.currency || 'KRW'}
                  </span>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  {res.qrCodeUrl && (
                    <button
                      onClick={() => setActiveQrUrl(res.qrCodeUrl!)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-sky-50 text-sky-700 border border-sky-200 text-xs font-bold rounded-lg hover:bg-sky-100 transition"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR코드</span>
                    </button>
                  )}

                  {res.fileName && (
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        alert(`'${res.fileName}' 다운로드를 시작합니다.`);
                      }}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-200 transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>{res.fileName}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* QR Code Preview Modal */}
      {activeQrUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <h3 className="font-extrabold text-slate-800 text-lg">모바일 입장 QR코드</h3>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block">
              <img src={activeQrUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <p className="text-xs text-slate-500">
              현지 가이드 또는 입장 게이트 스캐너에 이 화면을 보여주세요.
            </p>
            <button
              onClick={() => setActiveQrUrl(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-sm rounded-xl hover:bg-slate-800 transition"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
