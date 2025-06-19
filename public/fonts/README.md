# Font Files Placeholder

This directory should contain the following font files for the Shabby Chic design:

## Required Font Files:

### Allura (Cursive - Main Headers)
- `Allura-Regular.woff2`
- `Allura-Regular.woff`

### Playfair Display (Serif - Subheaders)
- `PlayfairDisplay-Regular.woff2`
- `PlayfairDisplay-Regular.woff`
- `PlayfairDisplay-Bold.woff2`
- `PlayfairDisplay-Bold.woff`

### Roboto (Sans-serif - Body Text)
- `Roboto-Regular.woff2`
- `Roboto-Regular.woff`
- `Roboto-Medium.woff2`
- `Roboto-Medium.woff`

## How to Add Fonts:

1. Download fonts from Google Fonts or other sources
2. Convert to WOFF2 and WOFF formats for web optimization
3. Place files in this directory
4. The CSS in `src/styles/global.css` will automatically load them

## Performance Benefits:
- Self-hosted fonts load faster than CDN
- No external requests
- Better privacy compliance
- Consistent loading across all environments

## Fallbacks:
The CSS includes fallback fonts:
- Allura → cursive
- Playfair Display → serif  
- Roboto → sans-serif
