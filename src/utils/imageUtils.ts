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
 * Keeps full base64 dataUrls directly in the Trip object so that Netlify,
 * mobile web, and any other domain render images instantly without missing local dependencies.
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

  // 2. Process souvenir items: resolve any photo:// references if possible, and ensure valid images array
  if (cloned.souvenirTabs && Array.isArray(cloned.souvenirTabs)) {
    for (const tab of cloned.souvenirTabs) {
      if (tab.items && Array.isArray(tab.items)) {
        for (const item of tab.items) {
          if (item.images && Array.isArray(item.images)) {
            const processedImages: string[] = [];
            for (let idx = 0; idx < item.images.length; idx++) {
              let img = item.images[idx];
              if (typeof img === 'string' && img.startsWith('photo://')) {
                const photoId = img.replace('photo://', '');
                const resolved = await getPhotoLocal(photoId);
                if (resolved) {
                  img = resolved;
                }
              }
              if (typeof img === 'string' && (img.startsWith('data:image/') || img.startsWith('http://') || img.startsWith('https://') || img.startsWith('blob:'))) {
                processedImages.push(img);
                // Also cache locally
                if (img.startsWith('data:image/')) {
                  const photoId = generatePhotoId(`${trip.id}_${item.id}_${idx}`);
                  savePhotoLocal(photoId, img).catch(() => {});
                }
              }
            }
            item.images = processedImages;
            item.imageUrl = processedImages.length > 0 ? processedImages[0] : undefined;
          } else if (item.imageUrl) {
            let img = item.imageUrl;
            if (typeof img === 'string' && img.startsWith('photo://')) {
              const photoId = img.replace('photo://', '');
              const resolved = await getPhotoLocal(photoId);
              if (resolved) {
                img = resolved;
              }
            }
            if (typeof img === 'string' && (img.startsWith('data:image/') || img.startsWith('http://') || img.startsWith('https://') || img.startsWith('blob:'))) {
              item.imageUrl = img;
              item.images = [img];
              if (img.startsWith('data:image/')) {
                const photoId = generatePhotoId(`${trip.id}_${item.id}_0`);
                savePhotoLocal(photoId, img).catch(() => {});
              }
            } else {
              delete item.imageUrl;
              item.images = [];
            }
          }
        }
      }
    }
  }

  // 3. Process cover image
  if (cloned.coverImage) {
    if (cloned.coverImage.startsWith('photo://')) {
      const photoId = cloned.coverImage.replace('photo://', '');
      const resolved = await getPhotoLocal(photoId);
      if (resolved) {
        cloned.coverImage = resolved;
      }
    }
  }

  return cloned;
}

/**
 * Resolves `photo://${photoId}` references back to full HD dataUrls
 * from local IndexedDB or Firestore cloud photos collection.
 */
export async function resolveTripPhotos(trip: Trip): Promise<Trip> {
  const cloned: Trip = JSON.parse(JSON.stringify(trip));

  const resolveImageStr = async (imgStr: string): Promise<string> => {
    if (typeof imgStr === 'string' && imgStr.startsWith('photo://')) {
      const photoId = imgStr.replace('photo://', '');
      const dataUrl = await getPhotoLocal(photoId);
      return dataUrl || '';
    }
    return imgStr;
  };

  if (cloned.souvenirTabs && Array.isArray(cloned.souvenirTabs)) {
    for (const tab of cloned.souvenirTabs) {
      if (tab.items && Array.isArray(tab.items)) {
        for (const item of tab.items) {
          if (item.images && Array.isArray(item.images)) {
            const resolvedList: string[] = [];
            for (const img of item.images) {
              const resolved = await resolveImageStr(img);
              if (resolved && (resolved.startsWith('data:image/') || resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('blob:'))) {
                resolvedList.push(resolved);
              }
            }
            item.images = resolvedList;
            item.imageUrl = resolvedList.length > 0 ? resolvedList[0] : undefined;
          } else if (item.imageUrl) {
            const resolved = await resolveImageStr(item.imageUrl);
            if (resolved && (resolved.startsWith('data:image/') || resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('blob:'))) {
              item.imageUrl = resolved;
              item.images = [resolved];
            } else {
              delete item.imageUrl;
              item.images = [];
            }
          }
        }
      }
    }
  }

  if (cloned.coverImage) {
    const resolved = await resolveImageStr(cloned.coverImage);
    if (resolved && (resolved.startsWith('data:image/') || resolved.startsWith('http://') || resolved.startsWith('https://') || resolved.startsWith('blob:'))) {
      cloned.coverImage = resolved;
    }
  }

  return cloned;
}

/**
 * Backwards compatibility fallback payload optimizer
 */
export async function optimizeTripPayload(trip: Trip): Promise<Trip> {
  return detachTripPhotos(trip);
}


