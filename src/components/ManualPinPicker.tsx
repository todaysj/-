import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Check, X, MousePointerClick, Compass, RefreshCw, Navigation } from 'lucide-react';
import { reverseGeocode } from '../utils/placeSearch';

interface ManualPinPickerProps {
  initialLat?: number;
  initialLng?: number;
  locationName?: string;
  tripDestination?: string;
  onApply: (result: { lat: number; lng: number; address?: string }) => void;
  onClose?: () => void;
}

const DESTINATION_COORDS: Record<string, [number, number]> = {
  '도쿄': [35.6762, 139.6503],
  '오사카': [34.6937, 135.5023],
  '교토': [35.0116, 135.7681],
  '후쿠오카': [33.5904, 130.4017],
  '삿포로': [43.0618, 141.3545],
  '오키나와': [26.2124, 127.6809],
  '제주': [33.4996, 126.5312],
  '서울': [37.5665, 126.9780],
  '부산': [35.1796, 129.0756],
  '다낭': [16.0544, 108.2022],
  '방콕': [13.7563, 100.5018],
  '타이베이': [25.0330, 121.5654]
};

export const ManualPinPicker: React.FC<ManualPinPickerProps> = ({
  initialLat,
  initialLng,
  locationName = '',
  tripDestination = '',
  onApply,
  onClose
}) => {
  // Determine fallback coordinates based on trip destination
  const getFallbackCoords = (): [number, number] => {
    for (const [city, coords] of Object.entries(DESTINATION_COORDS)) {
      if (tripDestination.includes(city) || city.includes(tripDestination)) {
        return coords;
      }
    }
    return [35.6762, 139.6503]; // Tokyo fallback
  };

  const defaultCoords = getFallbackCoords();
  const [currentLat, setCurrentLat] = useState<number>(
    initialLat !== undefined && !isNaN(initialLat) ? initialLat : defaultCoords[0]
  );
  const [currentLng, setCurrentLng] = useState<number>(
    initialLng !== undefined && !isNaN(initialLng) ? initialLng : defaultCoords[1]
  );
  const [resolvedAddress, setResolvedAddress] = useState<string>('');
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [inputLat, setInputLat] = useState<string>(currentLat.toFixed(5));
  const [inputLng, setInputLng] = useState<string>(currentLng.toFixed(5));

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Reverse geocode whenever lat/lng updates
  const updateAddress = async (lat: number, lng: number) => {
    setIsReverseGeocoding(true);
    try {
      const res = await reverseGeocode(lat, lng);
      setResolvedAddress(res.address);
    } catch {
      setResolvedAddress(`위도: ${lat.toFixed(5)}, 경도: ${lng.toFixed(5)}`);
    } finally {
      setIsReverseGeocoding(false);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([currentLat, currentLng], initialLat ? 16 : 14);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: 'custom-manual-pin',
        html: `
          <div style="
            background-color: #0284c7;
            color: white;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.4);
            font-size: 18px;
            cursor: grab;
          ">
            📍
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([currentLat, currentLng], {
        icon: pinIcon,
        draggable: true
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-size:12px; font-weight:bold; padding:2px 0;">
          ${locationName || '지정 핀 위치'}
        </div>
        <div style="font-size:10px; color:#0284c7; font-weight:bold;">
          (핀을 드래그하여 정확한 위치로 이동)
        </div>
      `).openPopup();

      // Handle Drag
      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setCurrentLat(pos.lat);
        setCurrentLng(pos.lng);
        setInputLat(pos.lat.toFixed(5));
        setInputLng(pos.lng.toFixed(5));
        updateAddress(pos.lat, pos.lng);
      });

      // Handle Click on map
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setCurrentLat(lat);
        setCurrentLng(lng);
        setInputLat(lat.toFixed(5));
        setInputLng(lng.toFixed(5));
        marker.setLatLng([lat, lng]);
        marker.openPopup();
        updateAddress(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // Initial reverse geocode
      updateAddress(currentLat, currentLng);
    }

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // Update marker position if coordinates change from inputs
  const handleApplyManualInputs = () => {
    const latNum = parseFloat(inputLat);
    const lngNum = parseFloat(inputLng);
    if (!isNaN(latNum) && !isNaN(lngNum)) {
      setCurrentLat(latNum);
      setCurrentLng(lngNum);
      if (markerRef.current) {
        markerRef.current.setLatLng([latNum, lngNum]);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView([latNum, lngNum], 16);
      }
      updateAddress(latNum, lngNum);
    }
  };

  const handleQuickJump = (coords: [number, number]) => {
    setCurrentLat(coords[0]);
    setCurrentLng(coords[1]);
    setInputLat(coords[0].toFixed(5));
    setInputLng(coords[1].toFixed(5));
    if (markerRef.current) {
      markerRef.current.setLatLng(coords);
    }
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(coords, 14);
    }
    updateAddress(coords[0], coords[1]);
  };

  const handleConfirm = () => {
    onApply({
      lat: currentLat,
      lng: currentLng,
      address: resolvedAddress
    });
    if (onClose) onClose();
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-3.5 sm:p-4 space-y-3 border border-slate-700 shadow-xl animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-500/30">
            <MapPin className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>장소 핀 위치 수동 조정 (지도 클릭 & 드래그)</span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.2 rounded border border-sky-400/30 font-semibold">
                위치 정밀 설정
              </span>
            </h4>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Guide Banner */}
      <div className="bg-sky-950/70 border border-sky-700/50 rounded-xl p-2.5 text-[11px] text-sky-200 flex items-start space-x-2">
        <MousePointerClick className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div className="leading-tight">
          <p className="font-bold text-sky-100">
            지도를 클릭하거나 핀(📍)을 드래그하여 정확한 위치(건물 출입구, 주차장 등)로 옮기세요.
          </p>
          <p className="text-[10px] text-sky-300/80 mt-0.5">
            이동한 위치의 위도/경도가 일정 및 동선 지도에 정확히 반영됩니다.
          </p>
        </div>
      </div>

      {/* Interactive Leaflet Map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-700 h-52 sm:h-60 w-full shadow-inner bg-slate-950">
        <div ref={mapContainerRef} className="w-full h-full" />
      </div>

      {/* Quick City Jumps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
        <span className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
          <Compass className="w-3 h-3 text-sky-400" /> 지역 이동:
        </span>
        {Object.entries(DESTINATION_COORDS).slice(0, 7).map(([city, coords]) => (
          <button
            key={city}
            type="button"
            onClick={() => handleQuickJump(coords)}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-[10px] font-medium border border-slate-700 transition shrink-0 cursor-pointer"
          >
            {city}
          </button>
        ))}
      </div>

      {/* Coordinates & Direct Numeric Inputs */}
      <div className="bg-slate-800/90 rounded-xl p-2.5 border border-slate-700/80 space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-slate-400">현재 지정된 주소:</span>
          {isReverseGeocoding ? (
            <span className="text-sky-400 font-medium animate-pulse text-[10px]">주소 변환 중...</span>
          ) : (
            <span className="text-slate-200 font-bold truncate max-w-[200px] text-right">
              {resolvedAddress || `${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}`}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-700">
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">위도 (Latitude)</label>
            <input
              type="text"
              value={inputLat}
              onChange={(e) => setInputLat(e.target.value)}
              onBlur={handleApplyManualInputs}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-sky-300 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-400 font-bold mb-0.5">경도 (Longitude)</label>
            <input
              type="text"
              value={inputLng}
              onChange={(e) => setInputLng(e.target.value)}
              onBlur={handleApplyManualInputs}
              className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-sky-300 focus:ring-1 focus:ring-sky-500 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
          >
            취소
          </button>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          className="ml-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-extrabold rounded-xl transition flex items-center space-x-1.5 shadow-md cursor-pointer"
        >
          <Check className="w-3.5 h-3.5" />
          <span>이 위치로 핀 확정 적용</span>
        </button>
      </div>
    </div>
  );
};
