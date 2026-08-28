import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, ExternalLink, X, Navigation, Check, Loader2, Compass, Building2, Utensils, Hotel, Sparkles, Map as MapIcon } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface PlaceSearchResult {
  id: string;
  name: string;
  displayName: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
  category?: 'SIGHTSEEING' | 'FOOD' | 'ACCOMMODATION' | 'SHOPPING' | 'TRANSPORT' | 'OTHER';
}

interface GooglePlaceSearchModalProps {
  initialQuery?: string;
  destination?: string;
  onClose: () => void;
  onSelectPlace: (result: { name: string; address: string; lat: number; lng: number; category?: string }) => void;
}

const DESTINATION_QUICK_TAGS: Record<string, string[]> = {
  '도쿄': ['시부야 스카이', '도쿄 타워', '센소지', '신주쿠 교엔', '츠키지 장외시장', '팀랩 플래닛', '롯폰기 힐즈', '이치란 시부야점'],
  '오사카': ['도톤보리', '오사카 성', '유니버설 스튜디오 재팬', '우메다 공중정원', '구로몬 시장', '하루카스 300', '난바 파크스'],
  '교토': ['후시미 이나리 신사', '청수사 (기요미즈데라)', '금각사', '아라시야마 대나무숲', '기온 거리', '니시키 시장'],
  '후쿠오카': ['후쿠오카 타워', '오호리 공원', '다자이후 텐만구', '캐널시티 하카타', '이토시마', '나카스 포장마차거리'],
  '삿포로': ['오도리 공원', '삿포로 TV타워', '스스키노', '오타루 운하', '삿포로 맥주 박물관', '모이와야마 전망대'],
  '제주': ['성산일출봉', '협재해수욕장', '함덕해수욕장', '섭지코지', '우도', '한라산 백록담', '동문시장', '카멜리아힐'],
  '서울': ['경복궁', 'N서울타워', '명동', '성수동 카페거리', '홍대입구', '더현대 서울', '롯데월드타워']
};

export const GooglePlaceSearchModal: React.FC<GooglePlaceSearchModalProps> = ({
  initialQuery = '',
  destination = '',
  onClose,
  onSelectPlace
}) => {
  const [query, setQuery] = useState(initialQuery || destination || '');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<PlaceSearchResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

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
    return ['도쿄 타워', '시부야 스카이', '오사카 성', '성산일출봉', '에펠탑', '자유의 여신상'];
  };

  const quickTags = getQuickTags();

  // Search function using global multi-language geocoding + place details
  const performSearch = async (searchQuery: string) => {
    // 마크다운 괄호나 이상 문자열 정제
    const cleanedQuery = searchQuery.replace(/\]\(.*?\)/g, '').trim();
    if (!cleanedQuery) return;

    setIsLoading(true);
    setHasSearched(true);
    setPreviewError(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        cleanedQuery
      )}&format=json&addressdetails=1&limit=8&accept-language=ko,ja,en,zh`;

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`검색 요청에 실패했습니다. (상태 코드: ${response.status})`);
      }

      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const formatted: PlaceSearchResult[] = data.map((item: any) => {
          let category: PlaceSearchResult['category'] = 'SIGHTSEEING';
          const type = (item.type || '').toLowerCase();
          const categoryClass = (item.class || '').toLowerCase();

          if (categoryClass === 'amenity' && (type === 'restaurant' || type === 'cafe' || type === 'fast_food' || type === 'bar')) {
            category = 'FOOD';
          } else if (categoryClass === 'tourism' && (type === 'hotel' || type === 'hostel' || type === 'guest_house' || type === 'motel')) {
            category = 'ACCOMMODATION';
          } else if (categoryClass === 'shop' || type === 'mall' || type === 'supermarket') {
            category = 'SHOPPING';
          } else if (categoryClass === 'highway' || categoryClass === 'railway' || type === 'station' || type === 'airport' || type === 'subway_entrance') {
            category = 'TRANSPORT';
          }

          let cleanName = item.name || '';
          if (!cleanName && item.address) {
            cleanName = item.address.tourism || item.address.amenity || item.address.building || item.address.road || item.display_name.split(',')[0];
          }
          if (!cleanName) {
            cleanName = item.display_name.split(',')[0] || cleanedQuery;
          }

          return {
            id: `place-${item.place_id || Math.random()}`,
            name: cleanName,
            displayName: item.display_name,
            address: item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            type: item.type || item.class,
            category
          };
        });

        setResults(formatted);
        if (formatted.length > 0) {
          setSelectedPlace(formatted[0]);
        }
      } else {
        setResults([]);
        setSelectedPlace(null);
      }
    } catch (err: any) {
      console.error('Place search error:', err);
      setPreviewError('장소를 검색하는 중 오류가 발생했습니다. 아래 Google 지도로 직접 검색을 이용하실 수 있습니다.');
      setResults([]);
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

  // Update preview map whenever selectedPlace changes
  useEffect(() => {
    if (!previewMapRef.current || !selectedPlace) return;

    const { lat, lng, name } = selectedPlace;

    if (!mapInstanceRef.current) {
      const map = L.map(previewMapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([lat, lng], 15);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView([lat, lng], 15);
    }

    const map = mapInstanceRef.current;

    if (markerRef.current) {
      map.removeLayer(markerRef.current);
    }

    const pinIcon = L.divIcon({
      className: 'custom-pin',
      html: `
        <div style="
          background-color: #0284c7;
          color: white;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        ">
          📍
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14]
    });

    const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);
    marker.bindPopup(`<b style="font-size:12px;">${name}</b>`).openPopup();
    markerRef.current = marker;

    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [selectedPlace]);

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
    onSelectPlace({
      name: query.trim(),
      address: query.trim(),
      lat: selectedPlace ? selectedPlace.lat : 0,
      lng: selectedPlace ? selectedPlace.lng : 0,
      category: selectedPlace?.category
    });
    onClose();
  };

  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    query || destination || 'Google Maps'
  )}`;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 border border-slate-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-1.5">
                구글 지도 장소 검색
                <span className="text-[10px] font-semibold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full border border-sky-400/30">
                  Google Maps 연동
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                방문할 관광지, 식당, 카페, 호텔 등을 검색하여 위치와 좌표를 일정에 바로 연결합니다.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-xl transition text-slate-400 hover:text-white"
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
                placeholder="장소명, 랜드마크, 상호, 주소 검색 (예: 시부야 스카이, 도쿄 타워)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none shadow-xs"
                autoFocus
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading || !query.trim()}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs sm:text-sm rounded-xl transition flex items-center gap-1.5 shadow-xs shrink-0"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>검색</span>
            </button>
          </form>

          {/* Quick Destination Search Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
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
                className="px-2.5 py-1 bg-white hover:bg-sky-50 hover:text-sky-700 hover:border-sky-300 border border-slate-200 rounded-lg text-slate-600 text-[11px] font-medium transition shrink-0 shadow-xs"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Results List */}
          <div className="space-y-2.5 flex flex-col">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
              <span>검색 결과 ({results.length})</span>
              {query && (
                <a
                  href={googleMapsSearchUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-1 text-[11px] hover:underline"
                >
                  <span>Google 지도 새 탭 검색</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {isLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                <p className="text-xs font-medium">Google 지도 데이터 검색 중...</p>
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                {results.map((place) => {
                  const isSelected = selectedPlace?.id === place.id;
                  return (
                    <div
                      key={place.id}
                      onClick={() => setSelectedPlace(place)}
                      className={`p-3 rounded-xl border transition cursor-pointer text-left flex items-start gap-2.5 ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/70 shadow-xs'
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
                            <span className="text-[10px] font-bold text-sky-600 bg-sky-100 px-1.5 py-0.2 rounded shrink-0">
                              선택됨
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                          {place.address}
                        </p>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          📍 {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : hasSearched ? (
              <div className="py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 p-4 text-center space-y-2">
                <Compass className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">검색 결과가 없습니다</p>
                <p className="text-[11px] text-slate-500">
                  철자를 확인하거나 다른 랜드마크 키워드로 검색해보세요.
                </p>
                {query && (
                  <div className="pt-2 flex flex-col gap-2 items-center justify-center">
                    <button
                      type="button"
                      onClick={handleCustomManualApply}
                      className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-700 transition"
                    >
                      &quot;{query}&quot; (으)로 텍스트 직접 입력
                    </button>
                    <a
                      href={googleMapsSearchUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-sky-600 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      Google 지도에서 검색 열기 <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs space-y-1">
                <MapIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>위의 검색창에 방문할 장소를 입력하거나</p>
                <p>추천 키워드를 눌러 검색을 시작해보세요.</p>
              </div>
            )}
          </div>

          {/* Map Preview Column */}
          <div className="flex flex-col space-y-2.5">
            <div className="text-xs font-bold text-slate-700">위치 미리보기 & 좌표</div>

            <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 h-44 sm:h-52 w-full">
              <div ref={previewMapRef} className="w-full h-full" />
              {!selectedPlace && (
                <div className="absolute inset-0 bg-slate-100/90 flex flex-col items-center justify-center text-slate-400 p-4 text-center text-xs">
                  <MapPin className="w-6 h-6 text-slate-300 mb-1" />
                  장소를 검색하고 선택하면 지도에 위치가 표시됩니다.
                </div>
              )}
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
                    className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold inline-flex items-center gap-0.5"
                  >
                    Google 지도 <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <p className="text-[11px] text-slate-600 line-clamp-2">
                  {selectedPlace.address}
                </p>
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 text-[10px] text-slate-500">
                  <span>위도: {selectedPlace.lat.toFixed(6)}</span>
                  <span>경도: {selectedPlace.lng.toFixed(6)}</span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                선택된 장소가 없습니다.
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition"
          >
            닫기
          </button>

          <div className="flex items-center gap-2">
            {query && !selectedPlace && (
              <button
                type="button"
                onClick={handleCustomManualApply}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
              >
                검색어 텍스트로 적용
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
              className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white font-bold text-xs rounded-xl transition shadow-xs flex items-center gap-1.5"
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