# Frontend Changes for Auto Video Metadata

## Summary
Backend now automatically extracts duration, width, and height from uploaded videos using FFmpeg.
Frontend needs to be updated to remove manual inputs for these fields.

## Changes Needed in: `frontend/src/pages/creatives/UploadCreativePage.tsx`

### 1. Update Schema (Line 23-30)
**Remove** `durationSeconds`, `width`, `height` from schema:

```typescript
const creativeSchema = z.object({
    name: z.string().min(3, 'Name must be at least 3 characters'),
    type: z.enum(['Image', 'Video']),
    file: z.instanceof(File).optional(),
});
```

### 2. Update Default Values (Line 47-56)
**Remove** default values for removed fields:

```typescript
const {...} = useForm<CreativeFormData>({
    resolver: zodResolver(creativeSchema),
    defaultValues: {
        name: '',
        type: 'Video',
    },
});
```

### 3. Update Form Submission (Line 60-77)
**Remove** formData appends for metadata:

```typescript
mutationFn: async (data: CreativeFormData) => {
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('campaignId', id!);
    // Duration, width, height auto-extracted by backend!
    if (selectedFile) {
        formData.append('file', selectedFile);
    }
    
    const response = await api.post(`/creatives/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data.data;
},
```

### 4. Remove Duration Input Field (Lines 175-194)
**Delete entire Grid item** for Duration input

### 5. Remove Width Input Field (Lines 197-215)
**Delete entire Grid item** for Width input

### 6. Remove Height Input Field (Lines 217-236)
**Delete entire Grid item** for Height input

### 7. Add Info Message (Before File Upload, around line 238)
**Add** this before the file upload button:

```typescript
{/* File Upload */}
<Grid item xs={12}>
    <Box mb={2}>
        <Typography variant="body2" color="info.main" sx={{ mb: 1 }}>
            ✨ Duration and resolution will be automatically detected from your video file
        </Typography>
    </Box>
    <Button
        variant="outlined"
        component="label"
        ...
```

## Result

### Before:
- User enters: Name, Type, **Duration**, **Width**, **Height**, File
- Backend uses user input (could be wrong!)

### After:
- User enters: Name, Type, File
- Backend auto-extracts: Duration, Width, Height from actual video file
- **100% accurate, no human error!**

## Testing
1. Upload a video
2. Check that duration is correctly extracted
3. Try to book - validation will use REAL duration
4. 72-second video can NO LONGER be booked on 10-second slot!

## Notes
- Backend changes are complete
- Frontend changes are manual to avoid syntax errors
- All backend services are registered and ready
