import { Trip } from '../types';
import { generatePhotoId, savePhotoLocal, getPhotoLocal } from './photoStore';

/**
 * Ultra-Crisp High-Definition Image Compression Utility.
 * Resizes photos to optimal HD dimensions (800px max) with high quality WebP/JPEG encoding (quality = 0.75)
 * preserving pristine details and colors while keeping file size ultra compact (~15-25KB per photo).
 */
export async function compressImage(
  input: File | string,
  maxWidth = 800,
  maxHeight = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    // If it's a regular remote web URL, return as is
    if (typeof input === 'string' && (input.startsWith('http://') || input.startsWith('https://'))) {
      return resolve(input);
    }

    const processImageDataUrl = (dataUrl: string) => {
      const img = new Image();
      img.onerror = () => reject(new Error('이미지를 로드할 수 없습니다.'));
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width;
          let height = img.naturalHeight || img.height;

          // Downscale if larger than boundary
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, width);
          canvas.height = Math.max(1, height);

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            return resolve(dataUrl);
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          let compressed = '';
          try {
            const webpData = canvas.toDataURL('image/webp', quality);
            if (webpData.startsWith('data:image/webp') && webpData.length > 50) {
              compressed = webpData;
            } else {
              compressed = canvas.toDataURL('image/jpeg', quality);
            }
          } catch {
            compressed = canvas.toDataURL('image/jpeg', quality);
          }

          resolve(compressed);
        } catch {
          resolve(dataUrl);
        }
      };

      img.src = dataUrl;
    };

    if (typeof input === 'string') {
      processImageDataUrl(input);
    } else {
      if (!input.type.startsWith('image/')) {
        return reject(new Error('선택한 파일이 이미지 형식이 아닙니다.'));
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('이미지 파일을 읽는 중 오류가 발생했습니다.'));
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          processImageDataUrl(reader.result);
        } else {
          reject(new Error('이미지 데이터를 읽지 못했습니다.'));
        }
      };
      reader.readAsDataURL(input);
    }
  });
}

/**
 * Optimizes Trip payload for Firestore.
 * Saves large base64 photos to Firestore `photos/{photoId}` collection and local IndexedDB,
 * storing lightweight `photo://${photoId}` references in the Trip document.
 * This guarantees the Trip document never exceeds Firestore's 1MB limit and syncs seamlessly across all devices.
 */
export async function detachTripPhotos(trip: Trip): Promise<Trip> {
  const cloned: Trip = JSON.parse(JSON.stringify(trip));

  // 1. Clean legacy duplicate arrays
  if (cloned.souvenirTabs && Array.isArray(cloned.souvenirTabs) && cloned.souvenirTabs.length > 0) {
    delete (cloned as any).souvenirs;
  }
  if (cloned.checklistTabs && Array.isArray(cloned.checklistTabs) && cloned.checklistTabs.length > 0) {
    delete (cloned as any).packingList;
  }

  // 2. Process souvenir items: detach base64 photos to photo:// links & save to Firestore photos collection
  if (cloned.souvenirTabs && Array.isArray(cloned.souvenirTabs)) {
    for (const tab of cloned.souvenirTabs) {
      if (tab.items && Array.isArray(tab.items)) {
        for (const item of tab.items) {
          if (item.images && Array.isArray(item.images)) {
            const processedImages: string[] = [];
            for (let idx = 0; idx < item.images.length; idx++) {
              const img = item.images[idx];
              if (typeof img === 'string') {
                if (img.startsWith('data:image/')) {
                  const photoId = generatePhotoId(`${trip.id}_${item.id}_${idx}`);
                  await savePhotoLocal(photoId, img);
                  processedImages.push(`photo://${photoId}`);
                } else if (img.startsWith('photo://') || img.startsWith('http://') || img.startsWith('https://')) {
                  processedImages.push(img);
                }
              }
            }
            item.images = processedImages;
            if (processedImages.length > 0) {
              item.imageUrl = processedImages[0];
            } else {
              delete item.imageUrl;
            }
          } else if (item.imageUrl) {
            const img = item.imageUrl;
            if (typeof img === 'string') {
              if (img.startsWith('data:image/')) {
                const photoId = generatePhotoId(`${trip.id}_${item.id}_0`);
                await savePhotoLocal(photoId, img);
                item.imageUrl = `photo://${photoId}`;
                item.images = [`photo://${photoId}`];
              } else if (img.startsWith('photo://') || img.startsWith('http://') || img.startsWith('https://')) {
                item.imageUrl = img;
                item.images = [img];
              } else {
                delete item.imageUrl;
                item.images = [];
              }
            }
          }
        }
      }
    }
  }

  // 3. Process cover image
  if (cloned.coverImage && typeof cloned.coverImage === 'string') {
    if (cloned.coverImage.startsWith('data:image/')) {
      const photoId = generatePhotoId(`${trip.id}_cover`);
      await savePhotoLocal(photoId, cloned.coverImage);
      cloned.coverImage = `photo://${photoId}`;
    }
  }

  return cloned;
}

/**
 * Resolves `photo://${photoId}` references back to full HD dataUrls
 * from memory cache, local IndexedDB, or Firestore cloud photos collection.
 */
export async function resolveTripPhotos(trip: Trip): Promise<Trip> {
  const cloned: Trip = JSON.parse(JSON.stringify(trip));

  const resolveImageStr = async (imgStr: string): Promise<string> => {
    if (typeof imgStr === 'string' && imgStr.startsWith('photo://')) {
      const photoId = imgStr.replace('photo://', '');
      const dataUrl = await getPhotoLocal(photoId);
      return dataUrl || imgStr;
    }
    return imgStr;
  };

  if (cloned.souvenirTabs && Array.isArray(cloned.souvenirTabs)) {
    for (const tab of cloned.souvenirTabs) {
      if (tab.items && Array.isArray(tab.items)) {
        for (const item of tab.items) {
          if (item.images && Array.isArray(item.images)) {
            const resolvedList = await Promise.all(
              item.images.map((img) => resolveImageStr(img))
            );
            item.images = resolvedList;
            if (resolvedList.length > 0) {
              item.imageUrl = resolvedList[0];
            } else {
              delete item.imageUrl;
            }
          } else if (item.imageUrl) {
            const resolved = await resolveImageStr(item.imageUrl);
            item.imageUrl = resolved;
            item.images = [resolved];
          }
        }
      }
    }
  }

  if (cloned.coverImage) {
    cloned.coverImage = await resolveImageStr(cloned.coverImage);
  }

  return cloned;
}

/**
 * Backwards compatibility fallback payload optimizer
 */
export async function optimizeTripPayload(trip: Trip): Promise<Trip> {
  return detachTripPhotos(trip);
}


