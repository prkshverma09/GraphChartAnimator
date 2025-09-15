
export const fileToBase64 = (file: File): Promise<string | null> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Fetches a local asset (like an image or video) and converts it to a Base64 Data URL.
 * This is a robust way to load assets in environments where direct pathing is unreliable.
 * @param url The relative path to the asset.
 * @param overrideMimeType Optionally, a MIME type to force for the output Data URL.
 * @returns A promise that resolves to the asset as a Base64 Data URL.
 */
export const fetchAssetAsBase64 = async (url: string, overrideMimeType?: string): Promise<string> => {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Network response was not ok. Status: ${response.status} ${response.statusText}`);
    }
    const originalBlob = await response.blob();

    // If an override MIME type is provided, create a new blob with the correct type.
    // This is the key to fixing the video playback issue, as the server may not provide the correct Content-Type.
    const blobToRead = overrideMimeType
      ? new Blob([originalBlob], { type: overrideMimeType })
      : originalBlob;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.error) {
          reject(reader.error);
        } else {
          resolve(reader.result as string);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blobToRead);
    });
  } catch (error) {
    console.error(`Failed to fetch and encode asset at ${url}:`, error);
    // Re-throw the error so the calling function can handle it, e.g., by showing a UI message.
    throw new Error(`Could not load asset: ${url}. ${error instanceof Error ? error.message : ''}`);
  }
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
