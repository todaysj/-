import React, { useEffect, useRef, useState } from 'react';
import { Trip, ScheduleItem } from '../types';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

interface MapViewProps {
  trip: Trip;
}

export const MapView: React.FC<MapViewProps> = ({ trip }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = all

  // Items that have lat & lng
  const itemsWithCoords = trip.schedule.filter(
    (item) => (selectedDay === 0 || item.day === selectedDay) && item.lat && item.lng
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center or Tokyo/Jeju default
    const defaultLat = itemsWithCoords.length > 0 ? itemsWithCoords[0].lat! : 35.6762;
    const defaultLng = itemsWithCoords.length > 0 ? itemsWithCoords[0].lng! : 139.6503;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([defaultLat, defaultLng], 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    if (itemsWithCoords.length === 0) return;

    const bounds = L.latLngBounds([]);

    itemsWithCoords.forEach((item, idx) => {
      if (!item.lat || !item.lng) return;

      const latLng: [number, number] = [item.lat, item.lng];
      bounds.extend(latLng);

      // Custom DivIcon for Leaflet Pin
      const getCategoryColor = (cat: string) => {
        switch (cat) {
          case 'FLIGHT': return '#6366f1';
          case 'ACCOMMODATION': return '#f59e0b';
          case 'FOOD': return '#10b981';
          case 'SIGHTSEEING': return '#0284c7';
          case 'SHOPPING': return '#a855f7';
          case 'TRANSPORT': return '#f97316';
          default: return '#64748b';
        }
      };

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background-color: ${getCategoryColor(item.category)};
            color: white;
            font-weight: 800;
            font-size: 11px;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
            border: 2px solid white;
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 180px; padding: 4px;">
          <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 2px;">
            DAY ${item.day} • ${item.time}
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
            ${item.title}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
            📍 ${item.location}
          </div>
          ${item.notes ? `<div style="font-size: 10px; color: #0284c7; background: #f0f9ff; padding: 4px 6px; border-radius: 4px;">💡 ${item.notes}</div>` : ''}
        </div>
      `;

      marker.bindPopup(popupHtml);
    });

    if (itemsWithCoords.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    // Handle map resize dynamically across screen sizes / rotations
    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };

  }, [selectedDay, trip]);

  return (
    <div className="space-y-4">
      {/* Map Control Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-sky-600 shrink-0" />
          <h2 className="font-bold text-slate-800 text-sm sm:text-base">
            장소 및 동선 지도
          </h2>
        </div>

        {/* Day Filter Pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none touch-pan-x -mx-1 px-1">
          <button
            onClick={() => setSelectedDay(0)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
              selectedDay === 0
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 지점 ({itemsWithCoords.length})
          </button>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].slice(0, Math.max(3, trip.schedule.reduce((max, s) => Math.max(max, s.day), 1))).map((d) => (
            <button
              key={d}
              onClick={() => setSelectedDay(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
                selectedDay === d
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Day {d}
            </button>
          ))}
        </div>
      </div>

      {/* Map Canvas - Responsive Height */}
      <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-[340px] sm:h-[460px] md:h-[540px] z-10" />
      </div>

      {/* Locations List below Map */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="font-bold text-sm text-slate-800 mb-3 flex items-center">
          <Navigation className="w-4 h-4 text-sky-600 mr-2 shrink-0" />
          {selectedDay === 0 ? '전체 방문 장소 목록' : `Day ${selectedDay} 방문 장소 목록`}
        </h3>

        {itemsWithCoords.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            해당 일차에 등록된 위치 좌표 정보가 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {itemsWithCoords.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-sky-300 transition flex items-start space-x-3"
              >
                <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-bold text-sky-600">
                    DAY {item.day} • {item.time}
                  </div>
                  <div className="font-bold text-slate-800 text-xs truncate">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {item.location}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
