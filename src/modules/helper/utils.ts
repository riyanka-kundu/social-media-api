export function normalizeFilename(str: string): string {
  const originalName = str.replace(/\s/g, '_');
  const extension = originalName.split('.').pop();
  if (!extension) {
    throw new Error('Failed to determine file extension');
  }
  const truncatedName = originalName.slice(0, 20 - (extension.length + 1));
  const timestamp = Date.now();

  return `${timestamp}_${truncatedName}.${extension}`;
}
