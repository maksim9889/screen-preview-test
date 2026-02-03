/**
 * Shared Type Definitions
 *
 * This file contains type definitions that are shared between client and server code.
 * Types here must NOT import from .server files to ensure they can be safely bundled
 * for both environments.
 *
 * @module types
 */

/**
 * Application configuration structure
 *
 * Represents a complete home screen editor configuration including
 * carousel images, text section, call-to-action button, and section ordering.
 */
export interface AppConfig {
  /** Carousel/image gallery configuration */
  carousel: {
    /** Array of image URLs */
    images: string[];
    /** Aspect ratio for image display */
    aspectRatio: "portrait" | "landscape" | "square";
  };
  /** Text section configuration */
  textSection: {
    /** Main heading text */
    title: string;
    /** Hex color code for title */
    titleColor: string;
    /** Description/body text */
    description: string;
    /** Hex color code for description */
    descriptionColor: string;
  };
  /** Call-to-action button configuration */
  cta: {
    /** Button label text */
    label: string;
    /** Button destination URL */
    url: string;
    /** Hex color code for button background */
    backgroundColor: string;
    /** Hex color code for button text */
    textColor: string;
  };
  /** Optional custom ordering of sections (defaults to carousel, textSection, cta) */
  sectionOrder?: string[];
}
