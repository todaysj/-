import React, { useEffect, useRef, useState } from 'react';
import { Trip, ScheduleItem } from '../types';
import L from 'leaflet';
import { MapPin, Navigation, ExternalLink, Calendar, Compass } from 'lucide-react';
import { getGoogleMapsUrl } from '../utils/placeSearch';
import {
  getTotalTripDays,
  formatDayDateShort,
  formatDayDateKorean,
  formatDayDateFull,
  formatTripNightsAndDays
} from '../utils/dateUtils';

interface MapViewProps {
  trip: Trip;
}

export const MapView: React.FC<MapViewProps> = ({ trip }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(0); // 0 = all

  // Clean up Leaflet instance when component unmounts
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Calculate dynamic total days from startDate, endDate, and existing schedule items
  const totalDays = trip ? getTotalTripDays(trip) : 1;
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Auto-adjust selectedDay if trip dates were shortened and selectedDay is out of bounds
  useEffect(() => {
    if (selectedDay > totalDays) {
      setSelectedDay(0);
    }
  }, [totalDays, selectedDay]);

  const scheduleList = trip?.schedule || [];

  // Items that have lat & lng for Leaflet rendering (sorted chronologically)
  const itemsWithCoords = scheduleList
    .filter((item) => (selectedDay === 0 ? item.day <= totalDays : item.day === selectedDay) && item.lat && item.lng)
    .sort((a, b) => (a.day !== b.day ? a.day - b.day : a.time.localeCompare(b.time)));

  // All items with a location name for list display
  const itemsWithLocation = scheduleList
    .filter((item) => (selectedDay === 0 ? item.day <= totalDays : item.day === selectedDay) && item.location && item.location.trim().length > 0)
    .sort((a, b) => (a.day !== b.day ? a.day - b.day : a.time.localeCompare(b.time)));

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center or Tokyo/Seoul default
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

    // Clear existing markers and polylines
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    if (itemsWithCoords.length === 0) return;

    const bounds = L.latLngBounds([]);

    // Draw route polyline between sequential spots
    if (itemsWithCoords.length >= 2) {
      const routePoints: [number, number][] = itemsWithCoords.map((item) => [item.lat!, item.lng!]);
      L.polyline(routePoints, {
        color: selectedDay === 0 ? '#0284c7' : '#0ea5e9',
        weight: 3.5,
        dashArray: '8, 8',
        opacity: 0.8,
        lineJoin: 'round'
      }).addTo(map);
    }

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

      const dateLabel = formatDayDateShort(trip.startDate, item.day);

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background-color: ${getCategoryColor(item.category)};
            color: white;
            font-weight: 800;
            font-size: 11px;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 8px -1px rgba(0, 0, 0, 0.35);
            border: 2px solid white;
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker(latLng, { icon: customIcon }).addTo(map);

      const googleMapsLink = getGoogleMapsUrl(item.location, item.lat, item.lng);

      const popupHtml = `
        <div style="font-family: sans-serif; min-width: 200px; padding: 4px;">
          <div style="font-size: 11px; font-weight: 700; color: #0284c7; margin-bottom: 2px;">
            DAY ${item.day} ${dateLabel ? `(${dateLabel})` : ''} • ${item.time}
          </div>
          <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">
            ${item.title}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
            📍 ${item.location}
          </div>
          ${item.notes ? `<div style="font-size: 11px; color: #0369a1; background: #f0f9ff; padding: 4px 8px; border-radius: 6px; margin-bottom: 6px;">💡 ${item.notes}</div>` : ''}
          <div style="margin-top: 6px; padding-top: 4px; border-top: 1px solid #e2e8f0; text-align: right;">
            <a href="${googleMapsLink}" target="_blank" rel="noreferrer" style="font-size: 11px; font-weight: 700; color: #0284c7; text-decoration: none;">
              Google 지도 열기 &rarr;
            </a>
          </div>
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

  }, [selectedDay, trip, itemsWithCoords]);

  return (
    <div className="space-y-4">
      {/* Map Control Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-2">
          <MapPin className="w-5 h-5 text-sky-600 shrink-0" />
          <div>
            <h2 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-1.5">
              <span>장소 및 동선 지도</span>
              <span className="text-xs font-semibold text-slate-500 hidden md:inline">
                ({trip.startDate} ~ {trip.endDate} • {formatTripNightsAndDays(trip.startDate, trip.endDate)})
              </span>
            </h2>
          </div>
        </div>

        {/* Day Filter Pills - Fully Synchronized with Trip Dates */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none touch-pan-x -mx-1 px-1">
          <button
            onClick={() => setSelectedDay(0)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
              selectedDay === 0
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 동선 ({itemsWithCoords.length}곳)
          </button>
          {dayNumbers.map((d) => {
            const dateLabel = formatDayDateShort(trip.startDate, d);
            return (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 flex items-center space-x-1 ${
                  selectedDay === d
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>Day {d}</span>
                {dateLabel && (
                  <span className={`text-[10px] ${selectedDay === d ? 'text-sky-100' : 'text-slate-400'}`}>
                    ({dateLabel})
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Map Canvas - Responsive Height */}
      <div className="relative rounded-2xl overflow-hidden shadow-md border border-slate-200 bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-[340px] sm:h-[460px] md:h-[540px] z-10" />
      </div>

      {/* Locations List below Map */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-800 flex items-center">
            <Navigation className="w-4 h-4 text-sky-600 mr-2 shrink-0" />
            {selectedDay === 0 ? (
              <span>전체 방문 장소 동선 ({itemsWithLocation.length}곳)</span>
            ) : (
              <span>
                Day {selectedDay} • {formatDayDateKorean(trip.startDate, selectedDay)} 방문 장소 ({itemsWithLocation.length}곳)
              </span>
            )}
          </h3>
          {selectedDay > 0 && (
            <span className="text-xs font-semibold text-slate-500">
              {formatDayDateFull(trip.startDate, selectedDay)}
            </span>
          )}
        </div>

        {itemsWithLocation.length === 0 ? (
          <div className="py-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <Compass className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-medium text-slate-500">
              {selectedDay === 0
                ? '등록된 방문 장소 정보가 없습니다.'
                : `Day ${selectedDay}(${formatDayDateKorean(trip.startDate, selectedDay)})에 등록된 장소가 없습니다.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {itemsWithLocation.map((item, idx) => {
              const dayDateLabel = formatDayDateShort(trip.startDate, item.day);
              return (
                <div
                  key={item.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-sky-300 transition flex items-start space-x-3 group shadow-2xs"
                >
                  <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-sky-600">
                        DAY {item.day} {dayDateLabel ? `(${dayDateLabel})` : ''} • {item.time}
                      </span>
                      <a
                        href={getGoogleMapsUrl(item.location, item.lat, item.lng)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-sky-600 hover:text-sky-800 font-bold inline-flex items-center gap-0.5 hover:underline"
                      >
                        <span>Google 지도</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                    <div className="font-bold text-slate-800 text-xs truncate mt-0.5">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      📍 {item.location}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

