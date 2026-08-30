import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  ExternalLink,
  X,
  Navigation,
  Check,
  Loader2,
  Compass,
  Building2,
  Utensils,
  Hotel,
  Sparkles,
  Map as MapIcon,
  MousePointerClick,
  Copy,
  Info
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  PlaceSearchResult,
  searchPlacesMultiEngine,
  reverseGeocode,
  parseGoogleMapsUrlOrCoords
} from '../utils/placeSearch';

interface GooglePlaceSearchModalProps {
  initialQuery?: string;
  destination?: string;
  onClose: () => void;
  onSelectPlace: (result: { name: string; address: string; lat: number; lng: number; category?: string }) => void;
}

const DESTINATION_QUICK_TAGS: Record<string, string[]> = {
  '도쿄': ['시부야 스카이', '도쿄 타워', '센소지', '신주쿠 교엔', '츠키지 장외시장', '팀랩 플래닛', '이치란 시부야점', '규카츠 모토무라'],
  '오사카': ['도톤보리', '오사카 성', '유니버설 스튜디오 재팬', '우메다 공중정원', '구로몬 시장', '하루카스 300', '난바 파크스'],
  '교토': ['후시미 이나리 신사', '청수사 (기요미즈데라)', '금각사', '아라시야마 대나무숲', '니시키 시장'],
  '후쿠오카': ['후쿠오카 타워', '오호리 공원', '다자이후 텐만구', '캐널시티 하카타', '나카스 포장마차거리'],
  '삿포로': ['오도리 공원', '삿포로 TV타워', '스스키노', '오타루 운하', '삿포로 맥주 박물관'],
  '제주': ['성산일출봉', '협재해수욕장', '함덕해수욕장', '섭지코지', '우도', '동문시장'],
  '서울': ['경복궁', 'N서울타워', '명동', '성수동 카페거리', '홍대입구', '더현대 서울', '롯데월드타워']
};

export const GooglePlaceSearchModal: React.FC<GooglePlaceSearchModalProps> = ({
  initialQuery = '',
  destination = '',
  onClose,
  onSelectPlace
}) => {
  const [query, setQuery] = useState(initialQuery || '');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [isPinningMode, setIsPinningMode] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const previewMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Quick suggestions depending on destination
  const getQuickTags = () => {
    for (const [key, tags] of Object.entries(DESTINATION_QUICK_TAGS)) {
      if (destination.includes(key) || key.includes(destination)) {
        return tags;
      }
    }
    return ['시부야 스카이', '도쿄 타워', '도톤보리', '오사카 성', '청수사', '성산일출봉'];
  };

  const quickTags = getQuickTags();

  // Search function using global multi-engine resolver
  const performSearch = async (searchQuery: string) => {
    const cleanedQuery = searchQuery.trim();
    if (!cleanedQuery) return;

    setIsLoading(true);
    setHasSearched(true);
    setStatusMessage(null);

    try {
      // 1. Direct coordinate / URL detection
      const parsedCoords = parseGoogleMapsUrlOrCoords(cleanedQuery);
      if (parsedCoords) {
        setStatusMessage('구글 지도 링크/좌표가 감지되어 해당 위치를 바로 불러왔습니다.');
      }

      // 2. Multi-engine search (Preset DB + Photon + Nominatim)
      const searchResults = await searchPlacesMultiEngine(cleanedQuery, destination);

      setResults(searchResults);
      if (searchResults.length > 0) {
        setSelectedPlace(searchResults[0]);
      } else {
        setSelectedPlace(null);
      }
    } catch (err) {
      console.error('상세 에러 (GooglePlaceSearchModal performSearch):', err);
      setResults([]);
      setSelectedPlace(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Perform search on mount if initial query or destination provided
  useEffect(() => {
    if (initialQuery && initialQuery.trim()) {
      performSearch(initialQuery.trim());
    } else if (destination && destination.trim()) {
      performSearch(destination.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize or update Leaflet preview map
  useEffect(() => {
    if (!previewMapRef.current) return;

    const defaultLat = selectedPlace ? selectedPlace.lat : destination.includes('오사카') ? 34.6937 : destination.includes('후쿠오카') ? 33.5904 : destination.includes('제주') ? 33.4996 : 35.6762;
    const defaultLng = selectedPlace ? selectedPlace.lng : destination.includes('오사카') ? 135.5023 : destination.includes('후쿠오카') ? 130.4017 : destination.includes('제주') ? 126.5312 : 139.6503;

    if (!mapInstanceRef.current) {
      const map = L.map(previewMapRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView([defaultLat, defaultLng], selectedPlace ? 15 : 12);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      // Enable clicking on the map to pin a custom location!
      map.on('click', async (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        setStatusMessage('지도에서 직접 핀 위치를 지정했습니다.');
        
        const rev = await reverseGeocode(lat, lng);
        const customPinPlace: PlaceSearchResult = {
          id: `pin-${Date.now()}`,
          name: query.trim() || rev.name || '지정된 위치',
          displayName: rev.address,
          address: rev.address,
          lat,
          lng,
          category: 'SIGHTSEEING',
          source: 'map_pin'
        };

        setSelectedPlace(customPinPlace);
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    if (selectedPlace) {
      const { lat, lng, name } = selectedPlace;
      map.setView([lat, lng], 15);

      if (markerRef.current) {
        map.removeLayer(markerRef.current);
      }

      const pinIcon = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="
            background-color: #0284c7;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2.5px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.35);
            font-size: 16px;
            cursor: grab;
          ">
            📍
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([lat, lng], {
        icon: pinIcon,
        draggable: true
      }).addTo(map);

      marker.bindPopup(`<div style="font-size:12px; font-weight:bold; padding:2px 0;">${name}</div><div style="font-size:10px; color:#64748b;">(핀을 드래그하여 미세 조정 가능)</div>`).openPopup();

      marker.on('dragend', async () => {
        const position = marker.getLatLng();
        const rev = await reverseGeocode(position.lat, position.lng);
        setStatusMessage('핀 위치가 드래그로 미세 조정되었습니다.');
        setSelectedPlace((prev) => ({
          id: prev ? prev.id : `drag-${Date.now()}`,
          name: prev?.name || rev.name,
          displayName: rev.address,
          address: rev.address,
          lat: position.lat,
          lng: position.lng,
          category: prev?.category || 'SIGHTSEEING',
          source: 'map_pin'
        }));
      });

      markerRef.current = marker;
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 150);
  }, [selectedPlace, destination]);

  // Clean up Leaflet map on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const handleConfirmSelect = (place: PlaceSearchResult) => {
    onSelectPlace({
      name: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      category: place.category
    });
    onClose();
  };

  const handleCustomManualApply = () => {
    if (!query.trim()) return;

    // Use currently pinned coordinates or default destination coords
    const fallbackLat = selectedPlace ? selectedPlace.lat : destination.includes('오사카') ? 34.6937 : destination.includes('제주') ? 33.4996 : 35.6762;
    const fallbackLng = selectedPlace ? selectedPlace.lng : destination.includes('오사카') ? 135.5023 : destination.includes('제주') ? 126.5312 : 139.6503;

    onSelectPlace({
      name: query.trim(),
      address: selectedPlace?.address || query.trim(),
      lat: selectedPlace ? selectedPlace.lat : fallbackLat,
      lng: selectedPlace ? selectedPlace.lng : fallbackLng,
      category: selectedPlace?.category || 'SIGHTSEEING'
    });
    onClose();
  };

  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query || destination || 'Google Maps'
  )}`;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base">
                  구글 지도 장소 검색 & 위치 지정
                </h3>
                <span className="text-[10px] font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full border border-sky-400/30">
                  Google Maps 연동
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                장소명, 맛집, 호텔 검색은 물론 구글지도 링크 붙여넣기 및 지도 위 핀 찍기가 모두 지원됩니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-xl transition text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Quick Tags */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              performSearch(query);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="장소명, 상호, 주소 또는 구글지도 링크/좌표 붙여넣기 (예: 시부야 스카이, 이치란, 도쿄 타워)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none shadow-xs"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>검색</span>
            </button>
          </form>

          {/* Quick Instant Apply Banner if User typed something */}
          {query.trim() && (
            <div className="flex items-center justify-between p-2.5 bg-sky-100/90 border border-sky-300/80 rounded-xl text-xs text-sky-900 shadow-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="font-bold truncate">
                  📍 &quot;{query.trim()}&quot; (으)로 구글 지도 자동 연동
                </span>
              </div>
              <button
                type="button"
                onClick={handleCustomManualApply}
                className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg text-xs transition shrink-0 cursor-pointer shadow-xs"
              >
                즉시 적용하기
              </button>
            </div>
          )}

          {/* Quick Destination Search Chips & Help */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> 추천 키워드:
              </span>
              {quickTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setQuery(tag);
                    performSearch(tag);
                  }}
                  className="px-2.5 py-1 bg-white hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 border border-slate-200 rounded-lg text-slate-600 text-[11px] font-medium transition shrink-0 shadow-xs cursor-pointer"
                >
                  {tag}
                </button>
              ))}
            </div>

            <a
              href={googleMapsSearchUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition border border-sky-200/60 shrink-0"
              title="Google 지도 공식 사이트/앱에서 직접 검색"
            >
              <span>구글지도 앱/웹 검색</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Status / Alert Banner if any */}
        {statusMessage && (
          <div className="px-4 py-2 bg-sky-50 border-b border-sky-100 text-xs text-sky-800 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium">
              <Info className="w-3.5 h-3.5 text-sky-600 shrink-0" />
              {statusMessage}
            </span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-sky-600 hover:text-sky-800 text-[11px] font-bold"
            >
              닫기
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Results List Column */}
          <div className="space-y-2.5 flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-0.5">
              <span>검색 결과 ({results.length})</span>
              <span className="text-[11px] font-normal text-slate-400">
                원하는 장소를 클릭하여 선택하세요
              </span>
            </div>

            {isLoading ? (
              <div className="py-14 flex flex-col items-center justify-center text-slate-400 space-y-2 bg-slate-50 rounded-xl border border-slate-100">
                <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                <p className="text-xs font-semibold text-slate-600">다양한 지도 데이터베이스에서 검색 중...</p>
                <p className="text-[11px] text-slate-400">구글 지도 데이터 & POI 검색 동시 실행</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {results.map((place) => {
                  const isSelected = selectedPlace?.id === place.id;
                  return (
                    <div
                      key={place.id}
                      onClick={() => setSelectedPlace(place)}
                      className={`p-3 rounded-xl border transition cursor-pointer text-left flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/80 shadow-xs ring-1 ring-sky-400'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {place.category === 'FOOD' ? (
                          <Utensils className="w-3.5 h-3.5" />
                        ) : place.category === 'ACCOMMODATION' ? (
                          <Hotel className="w-3.5 h-3.5" />
                        ) : place.category === 'SHOPPING' ? (
                          <Building2 className="w-3.5 h-3.5" />
                        ) : (
                          <MapPin className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-xs text-slate-900 truncate">
                            {place.name}
                          </h4>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded-full shrink-0">
                              선택됨
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                          {place.address}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-100">
                          <span>📍 {place.lat.toFixed(4)}, {place.lng.toFixed(4)}</span>
                          {place.source === 'preset_database' && (
                            <span className="text-emerald-600 font-sans font-bold bg-emerald-50 px-1.5 py-0.2 rounded text-[9px]">인기 랜드마크</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : hasSearched ? (
              <div className="py-6 bg-slate-50 rounded-xl border-2 border-dashed border-sky-200 p-4 text-center space-y-3">
                <Compass className="w-8 h-8 text-sky-500 mx-auto animate-bounce" />
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    &quot;{query}&quot; 구글 지도 연동 바로 적용
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    지도 데이터베이스에 등록되지 않은 소규모 상호명도 일정에 저장하면 <strong>구글 지도 검색</strong>으로 100% 정상 연결됩니다!
                  </p>
                </div>
                {query && (
                  <div className="pt-1 flex flex-col gap-2 items-center justify-center">
                    <button
                      type="button"
                      onClick={handleCustomManualApply}
                      className="w-full sm:w-auto px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-extrabold transition shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>📍 &quot;{query}&quot; (으)로 일정에 바로 적용하기</span>
                    </button>
                    <a
                      href={googleMapsSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-600 hover:text-sky-800 hover:underline inline-flex items-center gap-1 font-bold pt-1"
                    >
                      <span>Google 지도 앱/웹에서 이 장소 검색 결과 확인</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs space-y-1 bg-slate-50 rounded-xl border border-slate-100 p-4">
                <MapIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="font-semibold text-slate-600">방문할 장소명을 검색해보세요</p>
                <p className="text-[11px]">관광명소, 식당, 카페, 호텔, 공항 등을 검색하거나</p>
                <p className="text-[11px]">오른쪽 지도를 클릭하여 위치를 바로 지정할 수 있습니다.</p>
              </div>
            )}
          </div>

          {/* Interactive Map Preview Column */}
          <div className="flex flex-col space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5">
                <MousePointerClick className="w-3.5 h-3.5 text-sky-600" />
                지도 미리보기 & 핀 수동 조정
              </span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                클릭 & 드래그 가능
              </span>
            </div>

            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-48 sm:h-56 w-full shadow-inner">
              <div ref={previewMapRef} className="w-full h-full" />
              <div className="absolute top-2 left-2 right-2 bg-slate-900/80 backdrop-blur-xs text-white text-[10px] sm:text-[11px] py-1.5 px-2.5 rounded-lg shadow-md pointer-events-none flex items-center justify-between z-1000">
                <span>📍 지도를 클릭하거나 핀을 드래그해 위치를 미세 조정하세요.</span>
              </div>
            </div>

            {selectedPlace ? (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 truncate">
                    {selectedPlace.name}
                  </span>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedPlace.lat},${selectedPlace.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-bold inline-flex items-center gap-1"
                  >
                    Google 지도 보기 <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                  {selectedPlace.address}
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] text-slate-500 font-mono">
                  <span>위도: {selectedPlace.lat.toFixed(5)}</span>
                  <span>경도: {selectedPlace.lng.toFixed(5)}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center space-y-1">
                <p className="font-semibold text-slate-600">선택된 장소가 없습니다</p>
                <p className="text-[11px]">검색 결과에서 선택하거나, 지도 위를 클릭해 핀을 지정하세요.</p>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            닫기
          </button>

          <div className="flex items-center gap-2">
            {query && (
              <button
                type="button"
                onClick={handleCustomManualApply}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs"
              >
                입력한 장소명으로 적용
              </button>
            )}

            <button
              type="button"
              disabled={!selectedPlace}
              onClick={() => {
                if (selectedPlace) {
                  handleConfirmSelect(selectedPlace);
                }
              }}
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>선택한 장소 일정에 적용</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
