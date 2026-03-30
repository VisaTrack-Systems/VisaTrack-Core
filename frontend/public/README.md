# frontend/public

This directory contains static assets served by the Next.js application, including images, icons, and other public files that do not require processing or optimization during the build. Files in this directory are served at the root path (e.g., `/favicon.ico`, `/logo.svg`).

## Overview

- **Favicons and App Icons** - Browser tab icons and Apple touch icons
- **SVG Graphics** - Logo and graphic assets (`next.svg`, `vercel.svg`, etc.)
- **Static Images** - PNG, JPG image files (if any)

## Getting Started

### Referencing Assets

In Next.js React components and pages, reference assets with the public path:

```tsx
import Image from 'next/image';

export function MyComponent() {
  return (
    <>
      {/* Next.js Image component (optimized) */}
      <Image 
        src="/logo.svg" 
        alt="VisaTrack Logo" 
        width={100} 
        height={100} 
      />
      
      {/* Direct image tag (not optimized) */}
      <img src="/favicon.ico" alt="Favicon" />
      
      {/* CSS background image */}
      <div style={{ backgroundImage: 'url(/pattern.svg)' }} />
    </>
  );
}
```

### Adding New Assets

1. Add files to this `public/` directory
2. Reference using path `/filename` (no `public/` prefix)
3. For images, prefer the Next.js `<Image>` component for optimization
4. Keep file sizes small for faster loading (compress SVGs and PNGs)

### File Organization

```
public/
├── favicon.ico          # Browser tab icon
├── logo.svg            # Application logo
├── icons/              # Icon collection (optional)
│   ├── home.svg
│   ├── settings.svg
│   └── ...
├── images/             # Larger static images
│   ├── hero.png
│   ├── screenshot.png
│   └── ...
```

### Optimization Best Practices

- **SVGs**: Use SVG format for logos and icons (scalable, small)
- **Images**: Compress PNG/JPG with tools like ImageOptim before adding
- **Lazy Loading**: Use Next.js `<Image>` component for automatic lazy loading
- **Responsive**: Provide multiple sizes if image varies by device (e.g., hero banners)

## Related Documentation

- See [../](../) for Next.js app structure
- Next.js Static Files: https://nextjs.org/docs/app/building-your-application/optimizing/static-assets
- Next.js Image Optimization: https://nextjs.org/docs/app/building-your-application/optimizing/images

