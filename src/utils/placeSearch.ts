export interface PlaceSearchResult {
  id: string;
  name: string;
  displayName: string;
  address: string;
  lat: number;
  lng: number;
  type?: string;
  category?: 'SIGHTSEEING' | 'FOOD' | 'ACCOMMODATION' | 'SHOPPING' | 'TRANSPORT' | 'OTHER';
  source?: 'direct_coords' | 'gmaps_link' | 'preset_database' | 'photon' | 'nominatim' | 'map_pin';
}

// Built-in Top Travel Spots Knowledge Base for Instant Zero-Latency Lookup
export const POPULAR_TRAVEL_SPOTS: Array<{
  name: string;
  aliases: string[];
  city: string;
  country: string;
  address: string;
  lat: number;
  lng: number;
  category: 'SIGHTSEEING' | 'FOOD' | 'ACCOMMODATION' | 'SHOPPING' | 'TRANSPORT' | 'OTHER';
}> = [
  // --- TOKYO ---
  {
    name: '시부야 스카이 (SHIBUYA SKY)',
    aliases: ['시부야 스카이', '시부야스카이', 'shibuya sky', '渋谷スカイ', '시부야스크램블스퀘어'],
    city: '도쿄',
    country: '일본',
    address: '2 Chome-24-12 Shibuya, Shibuya City, Tokyo 150-0002 일본',
    lat: 35.6585,
    lng: 139.7022,
    category: 'SIGHTSEEING'
  },
  {
    name: '도쿄 타워 (Tokyo Tower)',
    aliases: ['도쿄 타워', '도쿄타워', 'tokyo tower', '東京タワー'],
    city: '도쿄',
    country: '일본',
    address: '4 Chome-2-8 Shibakoen, Minato City, Tokyo 105-0011 일본',
    lat: 35.6586,
    lng: 139.7454,
    category: 'SIGHTSEEING'
  },
  {
    name: '도쿄 스카이트리 (Tokyo Skytree)',
    aliases: ['도쿄 스카이트리', '스카이트리', 'tokyo skytree', '東京スカイツリー'],
    city: '도쿄',
    country: '일본',
    address: '1 Chome-1-2 Oshiage, Sumida City, Tokyo 131-0045 일본',
    lat: 35.7100,
    lng: 139.8107,
    category: 'SIGHTSEEING'
  },
  {
    name: '센소지 (아사쿠사 신사)',
    aliases: ['센소지', '센소지 신사', '아사쿠사 센소지', '아사쿠사', 'sensoji', '浅草寺'],
    city: '도쿄',
    country: '일본',
    address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032 일본',
    lat: 35.7148,
    lng: 139.7967,
    category: 'SIGHTSEEING'
  },
  {
    name: '신주쿠 교엔 국립정원',
    aliases: ['신주쿠 교엔', '신주쿠교엔', 'shinjuku gyoen', '新宿御苑'],
    city: '도쿄',
    country: '일본',
    address: '11 Naitomachi, Shinjuku City, Tokyo 160-0014 일본',
    lat: 35.6852,
    lng: 139.7100,
    category: 'SIGHTSEEING'
  },
  {
    name: '메이지 신궁 (Meiji Jingu)',
    aliases: ['메이지 신궁', '메이지신궁', 'meiji jingu', '明治神宮', '하라주쿠 신궁'],
    city: '도쿄',
    country: '일본',
    address: '1-1 Yoyogikamizonocho, Shibuya City, Tokyo 151-8557 일본',
    lat: 35.6764,
    lng: 139.6993,
    category: 'SIGHTSEEING'
  },
  {
    name: '도쿄 디즈니랜드 (Tokyo Disneyland)',
    aliases: ['도쿄 디즈니랜드', '디즈니랜드', 'tokyo disneyland', '東京ディズニーランド'],
    city: '도쿄',
    country: '일본',
    address: '1-1 Maihama, Urayasu, Chiba 279-0031 일본',
    lat: 35.6329,
    lng: 139.8804,
    category: 'SIGHTSEEING'
  },
  {
    name: '도쿄 디즈니씨 (Tokyo DisneySea)',
    aliases: ['도쿄 디즈니씨', '디즈니씨', 'tokyo disneysea', '東京ディズニーシー'],
    city: '도쿄',
    country: '일본',
    address: '1-13 Maihama, Urayasu, Chiba 279-0031 일본',
    lat: 35.6267,
    lng: 139.8851,
    category: 'SIGHTSEEING'
  },
  {
    name: '팀랩 플래닛 도쿄 (teamLab Planets)',
    aliases: ['팀랩', '팀랩 플래닛', '팀랩플래닛', 'teamlab planets', 'チームラボ プラネッツ'],
    city: '도쿄',
    country: '일본',
    address: '6 Chome-1-16 Toyosu, Koto City, Tokyo 135-0061 일본',
    lat: 35.6491,
    lng: 139.7898,
    category: 'SIGHTSEEING'
  },
  {
    name: '츠키지 장외시장 (Tsukiji Outer Market)',
    aliases: ['츠키지 시장', '츠키지 장외시장', '쓰키지 시장', 'tsukiji market', '築地場外市場'],
    city: '도쿄',
    country: '일본',
    address: '4 Chome-16-2 Tsukiji, Chuo City, Tokyo 104-0045 일본',
    lat: 35.6655,
    lng: 139.7708,
    category: 'FOOD'
  },
  {
    name: '이치란 시부야점 (Ichiran Ramen Shibuya)',
    aliases: ['이치란 시부야', '이치란 시부야점', '이치란 라멘', 'ichiran shibuya', '一蘭 渋谷店'],
    city: '도쿄',
    country: '일본',
    address: '1 Chome-22-7 Jinnan, Shibuya City, Tokyo 150-0041 일본',
    lat: 35.6619,
    lng: 139.7008,
    category: 'FOOD'
  },
  {
    name: '규카츠 모토무라 신주쿠점 (Gyukatsu Motomura)',
    aliases: ['모토무라 규카츠', '규카츠 모토무라', '규카츠모토무라', 'gyukatsu motomura', '牛かつ もと村'],
    city: '도쿄',
    country: '일본',
    address: '3 Chome-32-2 Shinjuku, Shinjuku City, Tokyo 160-0022 일본',
    lat: 35.6901,
    lng: 139.7029,
    category: 'FOOD'
  },
  {
    name: '돈키호테 메가 시부야본점 (MEGA Don Quijote Shibuya)',
    aliases: ['돈키호테 시부야', '시부야 돈키호테', '돈키호테', 'don quijote shibuya', 'MEGAドン・キホーテ 渋谷本店'],
    city: '도쿄',
    country: '일본',
    address: '28-6 Udagawacho, Shibuya City, Tokyo 150-0042 일본',
    lat: 35.6601,
    lng: 139.6975,
    category: 'SHOPPING'
  },
  {
    name: '돈키호테 신주쿠 가부키초점 (Don Quijote Shinjuku)',
    aliases: ['신주쿠 돈키호테', '돈키호테 신주쿠', 'don quijote shinjuku', 'ドン・キホーテ 新宿歌舞伎町店'],
    city: '도쿄',
    country: '일본',
    address: '1 Chome-16-5 Kabukicho, Shinjuku City, Tokyo 160-0021 일본',
    lat: 35.6938,
    lng: 139.7018,
    category: 'SHOPPING'
  },
  {
    name: '롯폰기 힐즈 (Roppongi Hills)',
    aliases: ['롯폰기 힐즈', '롯폰기힐즈', 'roppongi hills', '六本木ヒルズ', '모리 타워'],
    city: '도쿄',
    country: '일본',
    address: '6 Chome-10-1 Roppongi, Minato City, Tokyo 106-6108 일본',
    lat: 35.6605,
    lng: 139.7292,
    category: 'SIGHTSEEING'
  },
  {
    name: '오모테산도 힐즈 (Omotesando Hills)',
    aliases: ['오모테산도 힐즈', '오모테산도', 'omotesando hills', '表参道ヒルズ'],
    city: '도쿄',
    country: '일본',
    address: '4 Chome-12-10 Jingumae, Shibuya City, Tokyo 150-0001 일본',
    lat: 35.6672,
    lng: 139.7099,
    category: 'SHOPPING'
  },
  {
    name: '긴자 식스 (GINZA SIX)',
    aliases: ['긴자 식스', '긴자식스', 'ginza six', '긴자 백화점', 'ギンザ シックス'],
    city: '도쿄',
    country: '일본',
    address: '6 Chome-10-1 Ginza, Chuo City, Tokyo 104-0061 일본',
    lat: 35.6696,
    lng: 139.7640,
    category: 'SHOPPING'
  },
  {
    name: '도쿄역 (Tokyo Station)',
    aliases: ['도쿄역', '도쿄 역', 'tokyo station', '東京駅'],
    city: '도쿄',
    country: '일본',
    address: '1 Chome Marunouchi, Chiyoda City, Tokyo 100-0005 일본',
    lat: 35.6812,
    lng: 139.7671,
    category: 'TRANSPORT'
  },
  {
    name: '하네다 국제공항 (Haneda Airport)',
    aliases: ['하네다 공항', '하네다공항', '하네다', 'haneda airport', '羽田空港'],
    city: '도쿄',
    country: '일본',
    address: 'Hanedakuko, Ota City, Tokyo 144-0041 일본',
    lat: 35.5494,
    lng: 139.7798,
    category: 'TRANSPORT'
  },
  {
    name: '나리타 국제공항 (Narita Airport)',
    aliases: ['나리타 공항', '나리타공항', '나리타', 'narita airport', '成田国際空港'],
    city: '도쿄',
    country: '일본',
    address: '1-1 Furugome, Narita, Chiba 282-0004 일본',
    lat: 35.7720,
    lng: 140.3929,
    category: 'TRANSPORT'
  },

  // --- OSAKA ---
  {
    name: '도톤보리 (Dotonbori)',
    aliases: ['도톤보리', '도톤보리 글리코상', '글리코상', 'dotonbori', '道頓堀'],
    city: '오사카',
    country: '일본',
    address: '1 Chome Dotonbori, Chuo Ward, Osaka, 542-0071 일본',
    lat: 34.6687,
    lng: 135.5013,
    category: 'SIGHTSEEING'
  },
  {
    name: '오사카 성 (Osaka Castle)',
    aliases: ['오사카 성', '오사카성', 'osaka castle', '大阪城'],
    city: '오사카',
    country: '일본',
    address: '1-1 Osakajo, Chuo Ward, Osaka, 540-0002 일본',
    lat: 34.6873,
    lng: 135.5262,
    category: 'SIGHTSEEING'
  },
  {
    name: '유니버설 스튜디오 재팬 (USJ)',
    aliases: ['유니버설 스튜디오 재팬', '유니버셜 스튜디오 재팬', '유니버셜 스튜디오', 'usj', 'universal studios japan', 'ユニバーサル・スタジオ・ジャパン'],
    city: '오사카',
    country: '일본',
    address: '2 Chome-1-33 Sakurajima, Konohana Ward, Osaka, 554-0031 일본',
    lat: 34.6654,
    lng: 135.4323,
    category: 'SIGHTSEEING'
  },
  {
    name: '우메다 공중정원 (Umeda Sky Building)',
    aliases: ['우메다 공중정원', '우메다 스카이빌딩', 'umeda sky building', '梅田スカイビル'],
    city: '오사카',
    country: '일본',
    address: '1 Chome-1-88 Oyodonaka, Kita Ward, Osaka, 531-6023 일본',
    lat: 34.7059,
    lng: 135.4904,
    category: 'SIGHTSEEING'
  },
  {
    name: '하루카스 300 (Abeno Harukas 300)',
    aliases: ['하루카스 300', '아베노 하루카스', 'harukas 300', 'あべのハルカス'],
    city: '오사카',
    country: '일본',
    address: '1 Chome-1-43 Abenosuji, Abeno Ward, Osaka, 545-6016 일본',
    lat: 34.6459,
    lng: 135.5140,
    category: 'SIGHTSEEING'
  },
  {
    name: '구로몬 시장 (Kuromon Market)',
    aliases: ['구로몬 시장', '구로몬시장', '쿠로몬 시장', 'kuromon market', '黒門市場'],
    city: '오사카',
    country: '일본',
    address: '2 Chome-4-1 Nipponbashi, Chuo Ward, Osaka, 542-0073 일본',
    lat: 34.6657,
    lng: 135.5070,
    category: 'FOOD'
  },
  {
    name: '난바 파크스 (Namba Parks)',
    aliases: ['난바 파크스', '난바파크스', 'namba parks', 'なんばパークス'],
    city: '오사카',
    country: '일본',
    address: '2 Chome-10-70 Nanbanaka, Naniwa Ward, Osaka, 556-0011 일본',
    lat: 34.6616,
    lng: 135.5019,
    category: 'SHOPPING'
  },
  {
    name: '간사이 국제공항 (Kansai Airport)',
    aliases: ['간사이 공항', '간사이공항', '오사카 공항', 'kansai airport', '関西国際空港'],
    city: '오사카',
    country: '일본',
    address: '1 Senshukukokita, Izumisano, Osaka 549-0001 일본',
    lat: 34.4320,
    lng: 135.2304,
    category: 'TRANSPORT'
  },

  // --- KYOTO ---
  {
    name: '후시미 이나리 신사 (여우 신사)',
    aliases: ['후시미 이나리', '후시미이나리', '여우 신사', 'fushimi inari', '伏見稲荷大社'],
    city: '교토',
    country: '일본',
    address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto, 612-0882 일본',
    lat: 34.9671,
    lng: 135.7727,
    category: 'SIGHTSEEING'
  },
  {
    name: '기요미즈데라 (청수사)',
    aliases: ['청수사', '기요미즈데라', 'kiyomizu dera', 'kiyomizudera', '清水寺'],
    city: '교토',
    country: '일본',
    address: '1 Chome-294 Kiyomizu, Higashiyama Ward, Kyoto, 605-0862 일본',
    lat: 34.9949,
    lng: 135.7850,
    category: 'SIGHTSEEING'
  },
  {
    name: '금각사 (킨카쿠지)',
    aliases: ['금각사', '킨카쿠지', 'kinkakuji', '金閣寺'],
    city: '교토',
    country: '일본',
    address: '1 Kinkakujicho, Kita Ward, Kyoto, 603-8361 일본',
    lat: 35.0394,
    lng: 135.7292,
    category: 'SIGHTSEEING'
  },
  {
    name: '아라시야마 대나무숲 (치쿠린)',
    aliases: ['아라시야마', '아라시야마 대나무숲', '치쿠린', 'arashiyama bamboo', '嵐山 竹林の小径'],
    city: '교토',
    country: '일본',
    address: 'Sagatenryuji Tabuchicho, Ukyo Ward, Kyoto, 616-8385 일본',
    lat: 35.0169,
    lng: 135.6713,
    category: 'SIGHTSEEING'
  },
  {
    name: '니시키 시장 (Nishiki Market)',
    aliases: ['니시키 시장', '니시키시장', 'nishiki market', '錦市場'],
    city: '교토',
    country: '일본',
    address: 'Nakagyo Ward, Kyoto, 604-8054 일본',
    lat: 35.0050,
    lng: 135.7649,
    category: 'FOOD'
  },

  // --- FUKUOKA ---
  {
    name: '후쿠오카 타워 (Fukuoka Tower)',
    aliases: ['후쿠오카 타워', '후쿠오카타워', 'fukuoka tower', '福岡タワー'],
    city: '후쿠오카',
    country: '일본',
    address: '2 Chome-3-26 Momochihama, Sawara Ward, Fukuoka, 814-0001 일본',
    lat: 33.5933,
    lng: 130.3515,
    category: 'SIGHTSEEING'
  },
  {
    name: '오호리 공원 (Ohori Park)',
    aliases: ['오호리 공원', '오호리공원', 'ohori park', '大濠公園'],
    city: '후쿠오카',
    country: '일본',
    address: '1 Ohorikoen, Chuo Ward, Fukuoka, 810-0051 일본',
    lat: 33.5861,
    lng: 130.3764,
    category: 'SIGHTSEEING'
  },
  {
    name: '다자이후 텐만구 (Dazaifu Tenmangu)',
    aliases: ['다자이후', '다자이후 텐만구', 'dazaifu tenmangu', '太宰府天満宮'],
    city: '후쿠오카',
    country: '일본',
    address: '4 Chome-7-1 Saifu, Dazaifu, Fukuoka 818-0117 일본',
    lat: 33.5215,
    lng: 130.5349,
    category: 'SIGHTSEEING'
  },
  {
    name: '캐널시티 하카타 (Canal City Hakata)',
    aliases: ['캐널시티', '캐널시티 하카타', 'canal city hakata', 'キャナルシティ博多'],
    city: '후쿠오카',
    country: '일본',
    address: '1 Chome-2 Sumiyoshi, Hakata Ward, Fukuoka, 812-0018 일본',
    lat: 33.5898,
    lng: 130.4109,
    category: 'SHOPPING'
  },
  {
    name: '후쿠오카 국제공항 (Fukuoka Airport)',
    aliases: ['후쿠오카 공항', '후쿠오카공항', 'fukuoka airport', '福岡空港'],
    city: '후쿠오카',
    country: '일본',
    address: '778-1 Shimousui, Hakata Ward, Fukuoka, 812-0003 일본',
    lat: 33.5859,
    lng: 130.4507,
    category: 'TRANSPORT'
  },

  // --- SAPPORO / HOKKAIDO ---
  {
    name: '오도리 공원 (Odori Park)',
    aliases: ['오도리 공원', '오도리공원', 'odori park', '大通公園'],
    city: '삿포로',
    country: '일본',
    address: 'Odori Nishi, Chuo Ward, Sapporo, Hokkaido 060-0042 일본',
    lat: 43.0601,
    lng: 141.3534,
    category: 'SIGHTSEEING'
  },
  {
    name: '삿포로 TV타워 (Sapporo TV Tower)',
    aliases: ['삿포로 TV타워', '삿포로 티비타워', '삿포로타워', 'sapporo tv tower', 'さっぽろテレビ塔'],
    city: '삿포로',
    country: '일본',
    address: '1 Chome Odorinishi, Chuo Ward, Sapporo, Hokkaido 060-0042 일본',
    lat: 43.0611,
    lng: 141.3564,
    category: 'SIGHTSEEING'
  },
  {
    name: '오타루 운하 (Otaru Canal)',
    aliases: ['오타루 운하', '오타루운하', '오타루', 'otaru canal', '小樽運河'],
    city: '삿포로',
    country: '일본',
    address: 'Minatomachi, Otaru, Hokkaido 047-0007 일본',
    lat: 43.1996,
    lng: 140.9996,
    category: 'SIGHTSEEING'
  },

  // --- JEJU & KOREA ---
  {
    name: '성산일출봉 (Seongsan Ilchulbong)',
    aliases: ['성산일출봉', '성산 일출봉', 'seongsan ilchulbong'],
    city: '제주',
    country: '대한민국',
    address: '제주특별자치도 서귀포시 성산읍 성산리 1',
    lat: 33.4581,
    lng: 126.9426,
    category: 'SIGHTSEEING'
  },
  {
    name: '협재해수욕장 (Hyeopjae Beach)',
    aliases: ['협재해수욕장', '협재 해수욕장', '협재 해변', 'hyeopjae beach'],
    city: '제주',
    country: '대한민국',
    address: '제주특별자치도 제주시 한림읍 한림로 329-10',
    lat: 33.3938,
    lng: 126.2396,
    category: 'SIGHTSEEING'
  },
  {
    name: '함덕해수욕장 (Hamdeok Beach)',
    aliases: ['함덕해수욕장', '함덕 해수욕장', '함덕 해변', 'hamdeok beach'],
    city: '제주',
    country: '대한민국',
    address: '제주특별자치도 제주시 조천읍 조함해안로 525',
    lat: 33.5434,
    lng: 126.6692,
    category: 'SIGHTSEEING'
  },
  {
    name: '동문재래시장 (Dongmun Traditional Market)',
    aliases: ['동문시장', '동문재래시장', 'dongmun market'],
    city: '제주',
    country: '대한민국',
    address: '제주특별자치도 제주시 동문로 16',
    lat: 33.5126,
    lng: 126.5283,
    category: 'FOOD'
  },
  {
    name: '경복궁 (Gyeongbokgung Palace)',
    aliases: ['경복궁', 'gyeongbokgung palace', '경복궁 야간개장'],
    city: '서울',
    country: '대한민국',
    address: '서울특별시 종로구 사직로 161',
    lat: 37.5796,
    lng: 126.9770,
    category: 'SIGHTSEEING'
  },
  {
    name: 'N서울타워 (남산타워)',
    aliases: ['N서울타워', '남산타워', '남산 서울타워', 'n seoul tower'],
    city: '서울',
    country: '대한민국',
    address: '서울특별시 용산구 남산공원길 105',
    lat: 37.5512,
    lng: 126.9882,
    category: 'SIGHTSEEING'
  },
  {
    name: '롯데월드타워 (Lotte World Tower)',
    aliases: ['롯데월드타워', '롯데타워', '서울스카이', 'lotte world tower'],
    city: '서울',
    country: '대한민국',
    address: '서울특별시 송파구 올림픽로 300',
    lat: 37.5126,
    lng: 127.1025,
    category: 'SIGHTSEEING'
  }
];

/**
 * 1. Checks if the input is a Google Maps URL, Share URL, or raw coordinates
 */
export function parseGoogleMapsUrlOrCoords(input: string): {
  name?: string;
  lat: number;
  lng: number;
} | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Pattern 1: Raw numbers "35.6585, 139.7454" or "35.6585 139.7454"
  const rawCoordsRegex = /^(-?\d+(\.\d+)?)[,\s]+(-?\d+(\.\d+)?)$/;
  const rawMatch = trimmed.match(rawCoordsRegex);
  if (rawMatch) {
    const lat = parseFloat(rawMatch[1]);
    const lng = parseFloat(rawMatch[3]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Pattern 2: Google Maps URL containing @lat,lng e.g. /@35.6585805,139.7454329,17z
  const atCoordsRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const atMatch = trimmed.match(atCoordsRegex);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);

    // Try extracting place name from path /maps/place/Place+Name/@...
    let name: string | undefined;
    const placeNameMatch = trimmed.match(/\/place\/([^/@]+)/);
    if (placeNameMatch && placeNameMatch[1]) {
      name = decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '));
    }

    return { name, lat, lng };
  }

  // Pattern 3: query=lat,lng or ll=lat,lng or q=lat,lng
  const queryParamRegex = /[?&](query|ll|q)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/;
  const paramMatch = trimmed.match(queryParamRegex);
  if (paramMatch) {
    return {
      lat: parseFloat(paramMatch[2]),
      lng: parseFloat(paramMatch[3])
    };
  }

  return null;
}

/**
 * 2. Search Photon Komoot Geocoder (OSM-based Elasticsearch, very forgiving & fast)
 */
async function searchPhoton(query: string, limit = 8): Promise<PlaceSearchResult[]> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=${limit}&lang=default`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) return [];
    const data = await response.json();

    if (!data || !Array.isArray(data.features)) return [];

    return data.features
      .filter((f: any) => f.geometry && Array.isArray(f.geometry.coordinates))
      .map((f: any, index: number) => {
        const [lng, lat] = f.geometry.coordinates;
        const props = f.properties || {};
        const name = props.name || props.street || query;

        const addressParts = [
          props.name,
          props.street ? `${props.street} ${props.housenumber || ''}`.trim() : '',
          props.district || props.suburb,
          props.city,
          props.state,
          props.country
        ].filter(Boolean);

        const fullAddress = Array.from(new Set(addressParts)).join(', ');

        let category: PlaceSearchResult['category'] = 'SIGHTSEEING';
        const osmValue = (props.osm_value || '').toLowerCase();
        const osmKey = (props.osm_key || '').toLowerCase();

        if (osmKey === 'amenity' && (osmValue === 'restaurant' || osmValue === 'cafe' || osmValue === 'fast_food' || osmValue === 'bar')) {
          category = 'FOOD';
        } else if (osmKey === 'tourism' && (osmValue === 'hotel' || osmValue === 'hostel' || osmValue === 'guest_house')) {
          category = 'ACCOMMODATION';
        } else if (osmKey === 'shop' || osmValue === 'mall' || osmValue === 'supermarket') {
          category = 'SHOPPING';
        } else if (osmKey === 'highway' || osmKey === 'railway' || osmValue === 'station' || osmValue === 'airport') {
          category = 'TRANSPORT';
        }

        return {
          id: `photon-${props.osm_id || index}-${lat}-${lng}`,
          name: name,
          displayName: fullAddress,
          address: fullAddress,
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          type: osmValue || osmKey,
          category,
          source: 'photon'
        };
      });
  } catch (err) {
    console.error('상세 에러 (Photon search):', err);
    return [];
  }
}

/**
 * 3. Search Nominatim OSM with retry strategies
 */
async function searchNominatim(query: string, limit = 6): Promise<PlaceSearchResult[]> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query
    )}&format=json&addressdetails=1&limit=${limit}&accept-language=ko,ja,en,zh`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((item: any) => {
      let category: PlaceSearchResult['category'] = 'SIGHTSEEING';
      const type = (item.type || '').toLowerCase();
      const categoryClass = (item.class || '').toLowerCase();

      if (categoryClass === 'amenity' && (type === 'restaurant' || type === 'cafe' || type === 'fast_food' || type === 'bar')) {
        category = 'FOOD';
      } else if (categoryClass === 'tourism' && (type === 'hotel' || type === 'hostel' || type === 'guest_house')) {
        category = 'ACCOMMODATION';
      } else if (categoryClass === 'shop' || type === 'mall' || type === 'supermarket') {
        category = 'SHOPPING';
      } else if (categoryClass === 'highway' || categoryClass === 'railway' || type === 'station' || type === 'airport') {
        category = 'TRANSPORT';
      }

      let cleanName = item.name || '';
      if (!cleanName && item.address) {
        cleanName = item.address.tourism || item.address.amenity || item.address.building || item.address.road || item.display_name.split(',')[0];
      }
      if (!cleanName) {
        cleanName = item.display_name.split(',')[0] || query;
      }

      return {
        id: `nominatim-${item.place_id || Math.random()}`,
        name: cleanName,
        displayName: item.display_name,
        address: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || item.class,
        category,
        source: 'nominatim'
      };
    });
  } catch (err) {
    console.error('상세 에러 (Nominatim search):', err);
    return [];
  }
}

/**
 * 4. Reverse Geocode coordinate into clean human-readable address
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  name: string;
  address: string;
}> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ko,ja,en`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    if (response.ok) {
      const data = await response.json();
      if (data && data.display_name) {
        const parts = data.display_name.split(',');
        return {
          name: data.name || parts[0]?.trim() || `좌표 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          address: data.display_name
        };
      }
    }
  } catch (err) {
    console.error('상세 에러 (reverseGeocode):', err);
  }

  return {
    name: `지정 위치 (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    address: `위도: ${lat.toFixed(6)}, 경도: ${lng.toFixed(6)}`
  };
}

/**
 * 5. Main Unified Multi-Engine Place Search
 */
export async function searchPlacesMultiEngine(
  rawQuery: string,
  destination = ''
): Promise<PlaceSearchResult[]> {
  const cleaned = rawQuery.replace(/\]\(.*?\)/g, '').trim();
  if (!cleaned) return [];

  // A. Check if user entered / pasted Google Maps URL or Coordinates
  const parsedCoords = parseGoogleMapsUrlOrCoords(cleaned);
  if (parsedCoords) {
    const rev = await reverseGeocode(parsedCoords.lat, parsedCoords.lng);
    return [
      {
        id: `direct-coords-${parsedCoords.lat}-${parsedCoords.lng}`,
        name: parsedCoords.name || rev.name || cleaned,
        displayName: rev.address,
        address: rev.address,
        lat: parsedCoords.lat,
        lng: parsedCoords.lng,
        category: 'SIGHTSEEING',
        source: 'gmaps_link'
      }
    ];
  }

  const results: PlaceSearchResult[] = [];
  const seenKeys = new Set<string>();

  const addResult = (res: PlaceSearchResult) => {
    // Unique key rounded to 3 decimal places (~100 meters)
    const key = `${res.lat.toFixed(3)}_${res.lng.toFixed(3)}_${res.name.toLowerCase().trim()}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      results.push(res);
    }
  };

  const normalizedQuery = cleaned.toLowerCase().replace(/\s+/g, '');

  // B. Fast Match from Local Knowledge Base
  for (const spot of POPULAR_TRAVEL_SPOTS) {
    const isNameMatch = spot.name.toLowerCase().replace(/\s+/g, '').includes(normalizedQuery);
    const isAliasMatch = spot.aliases.some((alias) =>
      alias.toLowerCase().replace(/\s+/g, '').includes(normalizedQuery) ||
      normalizedQuery.includes(alias.toLowerCase().replace(/\s+/g, ''))
    );

    if (isNameMatch || isAliasMatch) {
      addResult({
        id: `preset-${spot.name}`,
        name: spot.name,
        displayName: `${spot.name} - ${spot.address}`,
        address: spot.address,
        lat: spot.lat,
        lng: spot.lng,
        category: spot.category,
        source: 'preset_database'
      });
    }
  }

  // C. Execute Photon and Nominatim in Parallel for Wide-Coverage Search
  const queryVariants = [cleaned];
  
  // If destination is available (e.g. 도쿄, 오사카, 후쿠오카, 제주), create destination-boosted queries
  if (destination && !cleaned.includes(destination)) {
    queryVariants.push(`${cleaned} ${destination}`);
  }

  // Strip branch name suffix e.g. "시부야점" -> "시부야" or "본점"
  const strippedSuffix = cleaned.replace(/(본점|지점|점|역)$/, '').trim();
  if (strippedSuffix && strippedSuffix !== cleaned && strippedSuffix.length >= 2) {
    queryVariants.push(strippedSuffix);
  }

  try {
    const promises: Promise<PlaceSearchResult[]>[] = [];

    // Query Photon for main and variant queries
    for (const q of queryVariants.slice(0, 2)) {
      promises.push(searchPhoton(q, 8));
    }

    // Query Nominatim
    promises.push(searchNominatim(cleaned, 6));
    if (queryVariants[1]) {
      promises.push(searchNominatim(queryVariants[1], 4));
    }

    const settled = await Promise.allSettled(promises);

    settled.forEach((res) => {
      if (res.status === 'fulfilled' && Array.isArray(res.value)) {
        res.value.forEach((item) => addResult(item));
      }
    });
  } catch (err) {
    console.error('상세 에러 (searchPlacesMultiEngine multi-query):', err);
  }

  return results;
}

/**
 * 6. Generate Google Maps Universal URL for any query or coordinate
 */
export function getGoogleMapsUrl(queryOrLocation: string, lat?: number, lng?: number): string {
  if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  const clean = (queryOrLocation || '').trim();
  if (!clean) return 'https://www.google.com/maps';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clean)}`;
}

