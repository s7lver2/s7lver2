# ASCII Art Images for Command Palette

This directory contains PNG images that are randomly converted to ASCII art and displayed in the command palette when opened with ⌘K / Ctrl+K.

## How to Add Your Own Images

1. **Add PNG files** to this directory (`/public/art/`)
   - Recommended size: 200x200px or larger (they'll be scaled to 30x15 for ASCII conversion)
   - Works best with high-contrast images (B&W, silhouettes, etc.)

2. **Update the manifest** in `app/components/CommandPalette.tsx`:
   ```typescript
   const ART_IMAGES: string[] = [
     '/art/1.png',
     '/art/2.png',
     '/art/3.png',
     '/art/your-image.png',  // Add your image here
   ];
   ```

3. **Clear browser cache** to see changes (or restart dev server)

## How It Works

- Each time you open the command palette (⌘K), a random image from `ART_IMAGES` is selected
- The image is loaded and scaled to a 30x15 pixel canvas
- Pixels are converted to ASCII characters based on brightness:
  - Dark pixels → `@` (darkest)
  - Light pixels → ` ` (brightest)
  - Middle tones → `%#*+=-:.`

## Tips for Best Results

- **High contrast** images work best (stark B&W, silhouettes)
- **Avoid gradients** - they often look muddy in ASCII
- **Simple shapes** render better than complex details
- **Test different sizes** - try 100x100, 200x200, etc.

## Current Sample Images

This directory includes 3 sample gradient images (1.png, 2.png, 3.png) for demonstration.
Replace them with your own for a personalized touch!
