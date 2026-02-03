export interface PhoneModel {
  name: string;
  width: number;
  height: number;
  category: "iPhone" | "Samsung" | "Google" | "Other";
}

export interface ScreenResolution {
  name: string;
  width: number;
  height: number;
}

export const PHONE_MODELS: PhoneModel[] = [
  // iPhones
  { name: "iPhone 15 Pro Max", width: 430, height: 932, category: "iPhone" },
  { name: "iPhone 15 Pro", width: 393, height: 852, category: "iPhone" },
  { name: "iPhone 15", width: 393, height: 852, category: "iPhone" },
  { name: "iPhone 14 Pro Max", width: 430, height: 932, category: "iPhone" },
  { name: "iPhone 14 Pro", width: 393, height: 852, category: "iPhone" },
  { name: "iPhone 14", width: 390, height: 844, category: "iPhone" },
  { name: "iPhone 13 Pro Max", width: 428, height: 926, category: "iPhone" },
  { name: "iPhone 13", width: 390, height: 844, category: "iPhone" },
  { name: "iPhone SE", width: 375, height: 667, category: "iPhone" },

  // Samsung
  { name: "Samsung Galaxy S24 Ultra", width: 412, height: 915, category: "Samsung" },
  { name: "Samsung Galaxy S24", width: 412, height: 915, category: "Samsung" },
  { name: "Samsung Galaxy S23", width: 360, height: 780, category: "Samsung" },
  { name: "Samsung Galaxy A54", width: 412, height: 914, category: "Samsung" },
  { name: "Samsung Galaxy Z Fold 5", width: 344, height: 882, category: "Samsung" },

  // Google Pixel
  { name: "Google Pixel 8 Pro", width: 412, height: 915, category: "Google" },
  { name: "Google Pixel 8", width: 412, height: 915, category: "Google" },
  { name: "Google Pixel 7", width: 412, height: 915, category: "Google" },

  // Other
  { name: "OnePlus 12", width: 450, height: 1000, category: "Other" },
  { name: "Xiaomi 14", width: 440, height: 978, category: "Other" },
];

export const SCREEN_RESOLUTIONS: ScreenResolution[] = [
  { name: "320x568 (iPhone SE)", width: 320, height: 568 },
  { name: "375x667 (iPhone 8)", width: 375, height: 667 },
  { name: "390x844 (iPhone 13)", width: 390, height: 844 },
  { name: "393x852 (iPhone 15 Pro)", width: 393, height: 852 },
  { name: "412x915 (Common Android)", width: 412, height: 915 },
  { name: "428x926 (iPhone 13 Pro Max)", width: 428, height: 926 },
  { name: "430x932 (iPhone 15 Pro Max)", width: 430, height: 932 },
  { name: "360x640 (Small Android)", width: 360, height: 640 },
  { name: "360x780 (Medium Android)", width: 360, height: 780 },
  { name: "414x896 (Large Screen)", width: 414, height: 896 },
];

export const DEFAULT_PHONE_SIZE = {
  width: 390,
  height: 844,
  name: "iPhone 14",
};

export function findPhoneModelByName(name: string): PhoneModel | undefined {
  return PHONE_MODELS.find((model) => model.name === name);
}

export function findResolutionByName(name: string): ScreenResolution | undefined {
  return SCREEN_RESOLUTIONS.find((res) => res.name === name);
}

export function validateDimensions(width: number, height: number): boolean {
  return (
    width >= 280 &&
    width <= 500 &&
    height >= 500 &&
    height <= 1000 &&
    Number.isInteger(width) &&
    Number.isInteger(height)
  );
}
