import { createClient, SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

// ----------------------------------------------------------------------------
// Supabase Configuration Management
// Resolves SUPABASE_URL and SUPABASE_ANON_KEY from environment or localStorage
// ----------------------------------------------------------------------------

const STORAGE_SUPABASE_URL_KEY = 'jplanner_supabase_url';
const STORAGE_SUPABASE_ANON_KEY = 'jplanner_supabase_anon_key';

declare const __SUPABASE_URL__: string | undefined;
declare const __SUPABASE_ANON_KEY__: string | undefined;

// Default Supabase config resolution:
// 1. window / localStorage overrides
// 2. Injected build defines (__SUPABASE_URL__ / __SUPABASE_ANON_KEY__)
// 3. Vite environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// 4. Server hub endpoint /api/config/supabase auto-fetch
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  let url = '';
  let anonKey = '';

  if (typeof window !== 'undefined') {
    try {
      url = localStorage.getItem(STORAGE_SUPABASE_URL_KEY) || '';
      anonKey = localStorage.getItem(STORAGE_SUPABASE_ANON_KEY) || '';
    } catch {}
  }

  if (!url) {
    if (typeof __SUPABASE_URL__ !== 'undefined' && __SUPABASE_URL__) {
      url = __SUPABASE_URL__;
    } else if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) {
      url = (import.meta as any).env.VITE_SUPABASE_URL;
    }
  }

  if (!anonKey) {
    if (typeof __SUPABASE_ANON_KEY__ !== 'undefined' && __SUPABASE_ANON_KEY__) {
      anonKey = __SUPABASE_ANON_KEY__;
    } else if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) {
      anonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;
    }
  }

  return { url: (url || '').trim(), anonKey: (anonKey || '').trim() };
}

// Auto-discover credentials from server endpoint /api/config/supabase
if (typeof window !== 'undefined') {
  fetch('/api/config/supabase')
    .then((res) => (res.ok ? res.json() : null))
    .then((data) => {
      if (data && data.supabaseUrl && data.supabaseAnonKey) {
        const current = getSupabaseCredentials();
        if (!current.url || !current.anonKey) {
          try {
            localStorage.setItem(STORAGE_SUPABASE_URL_KEY, data.supabaseUrl);
            localStorage.setItem(STORAGE_SUPABASE_ANON_KEY, data.supabaseAnonKey);
            cachedClient = null;
            lastClientKey = '';
            window.dispatchEvent(new CustomEvent('supabase-config-changed'));
          } catch {}
        }
      }
    })
    .catch(() => {});
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseCredentials();
  return Boolean(url && anonKey && url.startsWith('http'));
}

let cachedClient: SupabaseClient | null = null;
let lastClientKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return null;
  }

  const currentKey = `${url}:${anonKey}`;
  if (cachedClient && lastClientKey === currentKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    lastClientKey = currentKey;
    return cachedClient;
  } catch (err) {
    console.warn('[Supabase] Failed to initialize client:', err);
    return null;
  }
}

export function setSupabaseCredentials(url: string, anonKey: string): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_SUPABASE_URL_KEY, url.trim());
      localStorage.setItem(STORAGE_SUPABASE_ANON_KEY, anonKey.trim());
    } catch {}
  }
  cachedClient = null;
  lastClientKey = '';
  // Dispatch custom event to notify listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase-config-changed'));
  }
}

export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(STORAGE_SUPABASE_URL_KEY);
      localStorage.removeItem(STORAGE_SUPABASE_ANON_KEY);
    } catch {}
  }
  cachedClient = null;
  lastClientKey = '';
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('supabase-config-changed'));
  }
}

// ----------------------------------------------------------------------------
// Supabase Storage & Image Compression Helper
// Bucket: 'jplan-photos'
// Automatic compression to <= 500KB using browser-image-compression
// ----------------------------------------------------------------------------

export const SUPABASE_STORAGE_BUCKET = 'jplan-photos';

export interface UploadPhotoResult {
  publicUrl: string;
  storagePath?: string;
  isFallbackDataUrl?: boolean;
}

/**
 * Compresses an image file to <= 500KB using browser-image-compression,
 * then uploads to Supabase Storage bucket 'jplan-photos' and retrieves its publicUrl.
 * If Supabase is not configured or upload fails, falls back safely to compressed dataUrl.
 */
export async function compressAndUploadPhoto(
  file: File | Blob,
  folder = 'general',
  fileNamePrefix = 'photo'
): Promise<UploadPhotoResult> {
  // 1. Compress image to 500KB or less with browser-image-compression
  let compressedBlob: Blob = file;
  let fileToCompress: File;

  if (file instanceof File) {
    fileToCompress = file;
  } else {
    fileToCompress = new File([file], `${fileNamePrefix}.jpg`, { type: file.type || 'image/jpeg' });
  }

  try {
    const compressionOptions = {
      maxSizeMB: 0.5, // 500KB 이하
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.82,
    };
    compressedBlob = await imageCompression(fileToCompress, compressionOptions);
  } catch (err) {
    console.warn('[ImageCompression] Compression error, using original file:', err);
    compressedBlob = file;
  }

  // 2. Prepare upload path
  const sanitizedFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '_');
  const randomSuffix = Math.random().toString(36).substring(2, 9);
  const time = Date.now();
  const filePath = `${sanitizedFolder}/${fileNamePrefix}_${time}_${randomSuffix}.jpg`;

  // 3. Attempt Supabase Storage upload
  const supabase = getSupabase();
  if (supabase && isSupabaseConfigured()) {
    try {
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(filePath, compressedBlob, {
          cacheControl: '31536000',
          upsert: true,
          contentType: 'image/jpeg',
        });

      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage
          .from(SUPABASE_STORAGE_BUCKET)
          .getPublicUrl(filePath);

        if (urlData && urlData.publicUrl) {
          return {
            publicUrl: urlData.publicUrl,
            storagePath: filePath,
            isFallbackDataUrl: false,
          };
        }
      } else if (uploadError) {
        console.warn('[Supabase Storage] Upload error:', uploadError.message);
      }
    } catch (storageErr) {
      console.warn('[Supabase Storage] Upload exception:', storageErr);
    }
  }

  // 4. Safe fallback: convert compressed image to dataUrl so user data is never lost
  const dataUrl = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(compressedBlob);
  });

  return {
    publicUrl: dataUrl || '',
    isFallbackDataUrl: true,
  };
}

/**
 * Extract Supabase Project Ref from URL (e.g. ithokuexnohwzhvobnlf from https://ithokuexnohwzhvobnlf.supabase.co)
 */
export function getSupabaseProjectRef(): string {
  const { url } = getSupabaseCredentials();
  try {
    if (!url) return '';
    const parsed = new URL(url);
    const hostParts = parsed.hostname.split('.');
    if (hostParts.length >= 3 && hostParts[1] === 'supabase') {
      return hostParts[0];
    }
  } catch {}
  return '';
}

/**
 * Check if the required Supabase tables (trips, settings) exist
 */
export async function checkSupabaseTablesExist(): Promise<{ ok: boolean; missingTables: string[]; error?: string }> {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) {
    return { ok: false, missingTables: ['trips', 'settings'], error: 'Supabase 설정이 구성되지 않았습니다.' };
  }

  const missing: string[] = [];
  try {
    const { error: tripsErr } = await supabase.from('trips').select('id').limit(1);
    if (tripsErr && tripsErr.code === 'PGRST205') {
      missing.push('trips');
    }

    const { error: settingsErr } = await supabase.from('settings').select('id').limit(1);
    if (settingsErr && settingsErr.code === 'PGRST205') {
      missing.push('settings');
    }

    if (missing.length > 0) {
      return { ok: false, missingTables: missing, error: '테이블 미생성' };
    }

    return { ok: true, missingTables: [] };
  } catch (err: any) {
    return { ok: false, missingTables: ['trips', 'settings'], error: err?.message || '연결 확인 오류' };
  }
}

/**
 * Complete, battle-tested PostgreSQL schema for Supabase
 * Includes table creation, RLS permissions, Realtime publication, and Storage bucket policies.
 */
export const SUPABASE_SQL_SCHEMA = `-- ============================================================================
-- [J플래너] Supabase 원클릭 전체 세팅 SQL
-- Supabase 대시보드 -> SQL Editor -> New Query에 붙여넣고 [Run]을 클릭해 주세요!
-- ============================================================================

-- 1. 여행 일정(trips) 테이블 생성
create table if not exists public.trips (
  id text primary key,
  title text,
  destination text,
  start_date text,
  end_date text,
  data jsonb not null default '{}'::jsonb,
  is_deleted boolean default false,
  updated_at bigint default (extract(epoch from now()) * 1000)::bigint
);

-- RLS 활성화 및 여행 일행 읽기/쓰기/삭제 전체 허용 정책
alter table public.trips enable row level security;
drop policy if exists "Allow public all access on trips" on public.trips;
create policy "Allow public all access on trips" on public.trips for all using (true) with check (true);

-- Realtime 실시간 동기화 활성화
alter publication supabase_realtime add table public.trips;

-- 2. 브랜드 및 공통 설정(settings) 테이블 생성
create table if not exists public.settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint default (extract(epoch from now()) * 1000)::bigint
);

alter table public.settings enable row level security;
drop policy if exists "Allow public all access on settings" on public.settings;
create policy "Allow public all access on settings" on public.settings for all using (true) with check (true);

alter publication supabase_realtime add table public.settings;

-- 3. 여행 사진 저장소 (jplan-photos 버킷) 자동 생성 및 공개 권한 부여
insert into storage.buckets (id, name, public) 
values ('jplan-photos', 'jplan-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Public Access to jplan-photos" on storage.objects;
create policy "Public Access to jplan-photos" on storage.objects 
for all using (bucket_id = 'jplan-photos') with check (bucket_id = 'jplan-photos');
`;
