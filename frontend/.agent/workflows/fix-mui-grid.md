---
description: Fix MUI v7 Grid component migration
---

# MUI v7 Grid Migration Guide

The project was upgraded to MUI v7 (Material UI), but many files still use the old Grid API.

## Changes Required

In MUI v7, the Grid component API changed significantly:

### Old API (MUI v5/v6):
```tsx
<Grid container spacing={3}>
    <Grid item xs={12} sm={6} md={4}>
        <Component />
    </Grid>
</Grid>
```

### New API (MUI v7):
```tsx
<Grid container spacing={3}>
    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <Component />
    </Grid>
</Grid>
```

## Key Changes:
1. **Remove `item` prop** - No longer needed, all Grid children are items by default
2. **Replace `xs`, `sm`, `md`, `lg`, `xl` props** with a single `size` object prop
3. **Format**: `size={{ xs: 12, sm: 6, md: 4 }}`

## Files to Update

Run this command to find affected files:
```powershell
rg "Grid item" --files-with-matches src/
```

## Migration Steps

// turbo-all
1. Open each file with Grid imports
2. Find all `<Grid item ...>` occurrences
3. Replace `item xs={X} sm={Y} md={Z}` with `size={{ xs: X, sm: Y, md: Z }}`
4. Run `npm run build` to verify

## Example Migration

Before:
```tsx
<Grid item xs={12} md={6}>
    <Content />
</Grid>
```

After:
```tsx
<Grid size={{ xs: 12, md: 6 }}>
    <Content />
</Grid>
```

## Quick Regex (for VSCode Find/Replace):

Find: `Grid item xs=\{(\d+)\}`
Replace: `Grid size={{ xs: $1 }}`

Find: `Grid item xs=\{(\d+)\} sm=\{(\d+)\}`
Replace: `Grid size={{ xs: $1, sm: $2 }}`

Find: `Grid item xs=\{(\d+)\} sm=\{(\d+)\} md=\{(\d+)\}`
Replace: `Grid size={{ xs: $1, sm: $2, md: $3 }}`
