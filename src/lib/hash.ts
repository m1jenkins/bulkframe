export function hamming(a: string, b: string): number {
  if (!a || !b || a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i] ?? '0', 16) ^ parseInt(b[i] ?? '0', 16);
    while (x) {
      dist += x & 1;
      x >>= 1;
    }
  }
  return dist;
}

export async function dHashFromBlob(blob: Blob): Promise<string | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(9, 8);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;
    ctx.drawImage(bitmap, 0, 0, 9, 8);
    const { data } = ctx.getImageData(0, 0, 9, 8);
    const gray: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
      gray.push(0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0));
    }
    let bits = '';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        bits += (gray[y * 9 + x] ?? 0) > (gray[y * 9 + x + 1] ?? 0) ? '1' : '0';
      }
    }
    let hex = '';
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    bitmap.close();
    return hex;
  } catch {
    return undefined;
  }
}

export function duplicateIds(images: { id: string; url: string; hash?: string }[], threshold = 8): Set<string> {
  const hidden = new Set<string>();
  const byUrl = new Map<string, string>();
  for (const img of images) {
    const key = img.url.split('?')[0] ?? img.url;
    const prev = byUrl.get(key);
    if (prev) hidden.add(img.id);
    else byUrl.set(key, img.id);
  }
  const hashed = images.filter((i) => i.hash);
  for (let i = 0; i < hashed.length; i++) {
    for (let j = i + 1; j < hashed.length; j++) {
      const left = hashed[i];
      const right = hashed[j];
      if (!left?.hash || !right?.hash) continue;
      if (hamming(left.hash, right.hash) <= threshold) {
        hidden.add(right.id);
      }
    }
  }
  return hidden;
}

export function similarGroups(
  images: { id: string; hash?: string }[],
  threshold = 12,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const hashed = images.filter((i) => i.hash);
  const assigned = new Set<string>();
  hashed.forEach((img, i) => {
    if (assigned.has(img.id)) return;
    const members = [img.id];
    for (let j = i + 1; j < hashed.length; j++) {
      const other = hashed[j];
      if (!other || assigned.has(other.id) || !img.hash || !other.hash) continue;
      if (hamming(img.hash, other.hash) <= threshold) {
        members.push(other.id);
        assigned.add(other.id);
      }
    }
    if (members.length > 1) {
      assigned.add(img.id);
      groups.set(img.id, members);
    }
  });
  return groups;
}
