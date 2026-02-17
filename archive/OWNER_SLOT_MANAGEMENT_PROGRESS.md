# Owner Slot Management - Implementation Progress

## ✅ COMPLETED (Phase 1-2)

### Database Layer
- ✅ Created `OwnerContent` entity with fields: Id, ScreenId, SlotNumber, Name, FileUrl, FileHash, Duration, PricePerPlay, IsActive
- ✅ Updated `Impression` entity with `OwnerContentId` for tracking
- ✅ Configured EF Core relationships and constraints
- ✅ Created and applied migration: `AddOwnerContentSupport`

### Application Layer - Commands
- ✅ `CreateOwnerContentCommand` - Upload custom content
- ✅ `CreateOwnerContentHandler` - Validates ownership, checks active bookings, uploads file
- ✅ `DeleteOwnerContentCommand` - Remove custom content
- ✅ `DeleteOwnerContentHandler` - Soft delete with validation

### Application Layer - Queries
- ✅ `GetSlotStatusQuery` - Get status for all slots  
- ✅ `GetSlotStatusHandler` - Returns Empty/Custom/Booked status with details

### DTOs
- ✅ `CreateOwnerContentRequest`
- ✅ `OwnerContentDto`
- ✅ `SlotStatusDto`

## 🔨 IN PROGRESS

### API Endpoints
- ⚠️ Need to add to `ScreensController.cs`:
  ```csharp
  GET  /api/screens/{id}/slots/status
  POST /api/screens/{id}/slots/{slotNumber}/content
  DELETE /api/screens/{id}/slots/{slotNumber}/content
  ```
- File created: `ScreensController.OwnerSlots.cs` (partial class) but has compilation errors
- **ACTION NEEDED**: Manually add endpoints to main `ScreensController.cs`

## ⏭️ REMAINING WORK

### Phase 3: Playlist Service Priority Logic
Need to update `PlaylistService.GeneratePlaylistForScreenAsync()`:
```csharp
// Priority: Advertiser Booking > Owner Custom Content > Default Video
for (int slot = 1; slot <= screen.SlotsPerFrame; slot++)
{
    var booking = activeBookings.FirstOrDefault(b => b.SlotNumbers.Contains(slot));
    if (booking != null)
{
        // Use booking creative
    }
    else
    {
        var ownerContent = ownerContents.FirstOrDefault(oc => oc.SlotNumber == slot);
        if (ownerContent != null)
        {
            // Use owner content
        }
        else
        {
            // Use default video
        }
    }
}
```

### Phase 4: SignalR Real-Time Updates
Add to `PlayerHub.cs`:
```csharp
public async Task NotifyPlaylistUpdate(Guid screenId)
{
    await Clients.Group($"screen-{screenId}")
        .SendAsync("PlaylistUpdated", new { screenId, timestamp = DateTime.UtcNow });
}
```

Call from command handlers after content create/delete.

### Phase 5: Frontend Components

**a) LiveActivityTab.tsx**
- Fetch slot status from API
- Display 6 slot cards
- Show status: Booked (green) / Custom (yellow) / Empty (gray)
- Edit/Delete buttons
- Upload dialog

**b) UploadSlotDialog.tsx**
- Form: Name + Price Per Play + File Upload
- Validation
- Submit to POST endpoint

**c) SlotCard.tsx**
- Display slot number, status, content name
- Shows revenue for owner content
- Lock icon for booked slots

### Phase 6: Player Updates

**a) Playlist Refresh**
- Listen for SignalR `PlaylistUpdated` event
- Re-fetch playlist from backend
- Download new video if needed
- Transition seamlessly

**b) Impression Tracking**
- Track owner content plays separately
- Link to `OwnerContentId` in impression

## 📝 QUICK FIX GUIDE

To complete the backend manually:

1. **Add API Endpoints** - Copy these into `ScreensController.cs` before the closing `}`:

```csharp
[HttpGet("{id}/slots/status")]
[Authorize(Roles = "ScreenOwner,Admin")]
public async Task<ActionResult<ApiResponse<List<SlotStatusDto>>>> GetSlotStatus(Guid id)
{
    var query = new GetSlotStatusQuery { ScreenId = id };
    var result = await _mediator.Send(query);
    return Ok(ApiResponse<List<SlotStatusDto>>.SuccessResponse(result));
}

[HttpPost("{id}/slots/{slotNumber}/content")]
[Authorize(Roles = "ScreenOwner,Admin")]
public async Task<ActionResult<ApiResponse<OwnerContentDto>>> UploadSlotContent(
    Guid id, int slotNumber, [FromForm] string name, 
    [FromForm] decimal pricePerPlay, [FromForm] IFormFile file)
{
    var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);
    var command = new CreateOwnerContentCommand
    {
        ScreenId = id, OwnerId = userId, SlotNumber = slotNumber,
        Name = name, FileStream = file.OpenReadStream(),
        FileName = file.FileName, ContentType = file.ContentType,
        PricePerPlay = pricePerPlay
    };
    var result = await _mediator.Send(command);
    return Ok(ApiResponse<OwnerContentDto>.SuccessResponse(result));
}

[HttpDelete("{id}/slots/{slotNumber}/content")]
[Authorize(Roles = "ScreenOwner,Admin")]
public async Task<ActionResult<ApiResponse<object>>> DeleteSlotContent(Guid id, int slotNumber)
{
    var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier).Value);
    var command = new DeleteOwnerContentCommand { ScreenId = id, OwnerId = userId, SlotNumber = slotNumber };
    await _mediator.Send(command);
    return Ok(ApiResponse<object>.SuccessResponse(null, "Content removed"));
}
```

2. **Add using statements** at top of `ScreensController.cs`:
```csharp
using CCMS.Application.Features.OwnerContent.Commands;
using CCMS.Application.Features.OwnerContent.Queries;
using CCMS.Shared.DTOs.OwnerContent;
```

3. **Delete the partial controller file**: `ScreensController.OwnerSlots.cs`

## 🎯 Next Steps

1. Fix compilation errors (add endpoints manually as shown above)
2. Test API with Swagger
3. Implement playlist priority logic
4. Add SignalR updates
5. Build frontend components
6. Test end-to-end workflow

## 📊 Overall Progress: 40% Complete
- Database: 100%
- Backend Commands/Queries: 100%
- API Endpoints: 0% (blocked by compilation)
- Playlist Service: 0%
- SignalR: 0%
- Frontend: 0%
- Player: 0%
