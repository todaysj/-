import { createClient, SupabaseClient } from '@supabase/supabase-js';
import imageCompression from 'browser-image-compression';

// ----------------------------------------------------------------------------
// Supabase Configuration Management
// Resolves SUPABASE_URL and SUPABASE_ANON_KEY from environment or localStorage
// ----------------------------------------------------------------------------

const STORAGE_SUPABASE_URL_KEY = 'jplanner_supabase_url';
const STORAGE_SUPABASE_ANON_KEY = 'jplanner_supabase_anon_key';

// Default Supabase config resolution:
// 1. window / localStorage overrides
// 2. Vite environment variables (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// 3. process.env (injected via vite.config.ts define: SUPABASE_URL / SUPABASE_ANON_KEY)
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
    url =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
      (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
      (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
      '';
  }

  if (!anonKey) {
    anonKey =
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
      (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
      (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
      '';
  }

  return { url: url.trim(), anonKey: anonKey.trim() };
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
 * Recommended PostgreSQL schema for Supabase
 */
export const SUPABASE_SQL_SCHEMA = `-- [J플래너 Supabase 초기 세팅 SQL]
-- Supabase 대시보드 -> SQL Editor에 복사하여 붙여넣고 Run을 눌러주세요.

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

-- Realtime 활성화 (일행 간 실시간 동기화)
alter publication supabase_realtime add table public.trips;

-- 2. 브랜드 및 공통 설정(settings) 테이블 생성
create table if not exists public.settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at bigint default (extract(epoch from now()) * 1000)::bigint
);

-- Realtime 활성화
alter publication supabase_realtime add table public.settings;

-- 3. Storage 버킷 설정
-- Storage -> New bucket -> 버킷 이름을 'jplan-photos' 로 생성하고 Public bucket 옵션을 켜주세요.
`;
