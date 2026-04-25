using AutoMapper;
using CCMS.Domain.Entities;
using CCMS.Domain.Enums;
using CCMS.Domain.ValueObjects;
using CCMS.Shared.DTOs.Auth;
using CCMS.Shared.DTOs.Screens;
using CCMS.Shared.DTOs.Campaigns;
using CCMS.Shared.DTOs.Creatives;
using CCMS.Shared.DTOs.Bookings;

namespace CCMS.Application.Mappings;

public class MappingProfiles : Profile
{
    public MappingProfiles()
    {
        // User mappings
        CreateMap<User, UserDto>()
            .ForMember(dest => dest.Role, opt => opt.MapFrom(src => src.Role.ToString()))
            .ForMember(dest => dest.AccountType, opt => opt.MapFrom(src => src.AccountType.ToString()))
            .ForMember(dest => dest.AccountVisibility, opt => opt.MapFrom(src => src.AccountVisibility.ToString()));
        
        // Screen mappings
        CreateMap<Screen, ScreenDto>()
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status.ToString()))
            .ForMember(dest => dest.RevenueEstimate, opt => opt.Ignore()) // Set manually in handlers
            .ForMember(dest => dest.Images, opt => opt.MapFrom(src => 
                src.Images.OrderBy(img => img.DisplayOrder).ToList()))
            .ForMember(dest => dest.PrimaryImage, opt => opt.MapFrom(src => 
                src.Images.FirstOrDefault(img => img.IsPrimary)));
        
        // ScreenImage mapping
        CreateMap<ScreenImage, ScreenImageDto>()
            .ForMember(dest => dest.ImageType, opt => opt.MapFrom(src => src.ImageType.ToString()));
        
        CreateMap<CreateScreenRequest, Screen>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.OwnerId, opt => opt.Ignore())
            .ForMember(dest => dest.Owner, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(_ => ScreenStatus.Active))
            .ForMember(dest => dest.IsOnline, opt => opt.MapFrom(_ => false))
            .ForMember(dest => dest.LastSeenAt, opt => opt.Ignore())
            .ForMember(dest => dest.LastSyncAt, opt => opt.Ignore())
            .ForMember(dest => dest.ConnectedDeviceId, opt => opt.Ignore())
            .ForMember(dest => dest.Bookings, opt => opt.Ignore())
            .ForMember(dest => dest.Impressions, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore());
        
        CreateMap<Address, AddressDto>().ReverseMap();
        CreateMap<OperatingSchedule, OperatingScheduleDto>().ReverseMap();
        CreateMap<DaySchedule, DayScheduleDto>()
            .ForMember(dest => dest.StartTime, opt => opt.MapFrom(src => src.StartTime.ToString(@"hh\:mm")))
            .ForMember(dest => dest.EndTime, opt => opt.MapFrom(src => src.EndTime.ToString(@"hh\:mm")));
        
        CreateMap<DayScheduleDto, DaySchedule>()
            .ForMember(dest => dest.StartTime, opt => opt.MapFrom(src => TimeSpan.Parse(src.StartTime)))
            .ForMember(dest => dest.EndTime, opt => opt.MapFrom(src => TimeSpan.Parse(src.EndTime)));
        
        // Campaign mappings
        CreateMap<Campaign, CampaignDto>()
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status.ToString()))
            .ForMember(dest => dest.StartDate, opt => opt.MapFrom(src => src.StartDate.ToString("yyyy-MM-dd")))
            .ForMember(dest => dest.EndDate, opt => opt.MapFrom(src => src.EndDate.HasValue ? src.EndDate.Value.ToString("yyyy-MM-dd") : ""))
            .ForMember(dest => dest.TotalCreatives, opt => opt.MapFrom(src => src.Creatives != null ? src.Creatives.Count : 0))
            .ForMember(dest => dest.TotalBookings, opt => opt.MapFrom(src => src.Bookings != null ? src.Bookings.Count : 0))
            .ForMember(dest => dest.TotalImpressions, opt => opt.MapFrom(src => src.Bookings != null ? src.Bookings.Sum(b => b.DeliveredImpressions) : 0));
        
        CreateMap<CreateCampaignRequest, Campaign>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.AdvertiserId, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(_ => CampaignStatus.Draft));
        
        // Creative mappings
        CreateMap<Creative, CreativeDto>();
        
        // Booking mappings
        CreateMap<Booking, BookingDto>()
            .ForMember(dest => dest.ScreenName, opt => opt.MapFrom(src => src.Screen.Name))
            .ForMember(dest => dest.CampaignName, opt => opt.MapFrom(src => src.Campaign != null ? src.Campaign.Name : string.Empty))
            .ForMember(dest => dest.AdvertiserId, opt => opt.MapFrom(src => src.Campaign != null ? (Guid?)src.Campaign.AdvertiserId : null))
            .ForMember(dest => dest.CreativeId, opt => opt.MapFrom(src => src.Creative.Id))
            .ForMember(dest => dest.CreativeName, opt => opt.MapFrom(src => src.Creative.FileName))
            .ForMember(dest => dest.CreativeFileUrl, opt => opt.MapFrom(src => src.Creative.FileUrl))
            .ForMember(dest => dest.CreativeMimeType, opt => opt.MapFrom(src => src.Creative.MimeType))
            .ForMember(dest => dest.ExpectedImpressions, opt => opt.Ignore())
            .ForMember(dest => dest.DeliveredImpressions, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(src => src.Status.ToString()))
            .ForMember(dest => dest.Source, opt => opt.MapFrom(src => src.Source.ToString()))
            .ForMember(dest => dest.StartDate, opt => opt.MapFrom(src => src.StartDate.ToString("yyyy-MM-dd")))
            .ForMember(dest => dest.EndDate, opt => opt.MapFrom(src => src.EndDate.ToString("yyyy-MM-dd")))
            .ForMember(dest => dest.BookedDates, opt => opt.MapFrom(src => 
                src.DailySlotAssignments != null 
                    ? src.DailySlotAssignments.Keys.Select(d => d.ToString("yyyy-MM-dd")).ToList() 
                    : null));
        
        CreateMap<CreateBookingRequest, Booking>()
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.Status, opt => opt.MapFrom(_ => BookingStatus.Pending));
    }
}
