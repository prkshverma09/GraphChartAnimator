
export const fileToBase64 = (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Strips the "data:mime/type;base64," prefix from a data URL.
 * @param dataUrl The full data URL string.
 * @returns The raw base64 encoded string.
 */
export const getRawBase64 = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    if (parts.length > 1) {
        return parts[1];
    }
    // Assume it might already be raw base64 if no prefix is found
    return dataUrl;
}