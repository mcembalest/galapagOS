// File utilities (galapagOS platform)

/**
 * Read a File object as a base64 string (without the data URL prefix).
 * @param {File} file
 * @returns {Promise<string>} base64 contents
 */
export function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target.result || '').toString().split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


