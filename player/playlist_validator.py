"""
Playlist Validator - Validates playlist items against current date/time and slot assignments
"""

from datetime import datetime, date
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)


class PlaylistValidator:
    """Validates playlist items against current date/time and DailySlotAssignments"""
    
    def __init__(self, screen_schedule: dict):
        """
        Initialize validator with screen's operating schedule
        
        Args:
            screen_schedule: Dictionary with day schedules (Monday, Tuesday, etc.)
        """
        self.schedule = screen_schedule
    
    def is_valid_for_playback(self, item: dict, current_time: datetime) -> bool:
        """
        Check if playlist item should play right now
        
        Args:
            item: Playlist item dictionary
            current_time: Current datetime to validate against
            
        Returns:
            True if item is valid for playback, False otherwise
        """
        # Filler content (default video) always valid
        if item.get('isFillerContent') or item.get('IsFillerContent'):
            return True
        
        # Check 1: Within operating hours RIGHT NOW
        if not self._is_within_operating_hours(current_time):
            logger.debug(f"Outside operating hours: {current_time}")
            return False
        
        # Check 2: Has slot assignment for TODAY
        if not self._has_slot_for_date(item, current_time.date()):
            logger.debug(f"No slot assignment for today: {current_time.date()}")
            return False
        
        # Check 3: Within booking date range
        if not self._is_within_booking_period(item, current_time):
            logger.debug(f"Outside booking period")
            return False
            
        return True
    
    def _has_slot_for_date(self, item: dict, check_date: date) -> bool:
        """
        Check if booking has slot assigned for specific date
        
        Args:
            item: Playlist item with dailySlotAssignments
            check_date: Date to check assignment for
            
        Returns:
            True if slot is assigned for the date, False otherwise
        """
        booking_id = item.get('bookingId') or item.get('BookingId')
        if not booking_id:
            return False
        
        # Get DailySlotAssignmentsJson from item
        # Backend sends this as part of playlist item
        assignments_json = item.get('dailySlotAssignments', '{}')
        
        try:
            if isinstance(assignments_json, str):
                assignments = json.loads(assignments_json) if assignments_json else {}
            else:
                assignments = assignments_json or {}
            
            # Check if today's date exists in assignments
            # Format: {"2025-12-30T00:00:00": 1, "2025-12-31T00:00:00": 2}
            for date_str, slot_num in assignments.items():
                # Parse date from "2025-12-30T00:00:00" or "2025-12-30"
                date_part = date_str.split('T')[0]
                try:
                    assigned_date = datetime.strptime(date_part, '%Y-%m-%d').date()
                except ValueError:
                    continue
                
                if assigned_date == check_date:
                    # Also verify slot number matches
                    item_slot = item.get('slotNumber') or item.get('SlotNumber')
                    if int(slot_num) == item_slot:
                        return True
            
            return False
        except (json.JSONDecodeError, ValueError, TypeError) as e:
            logger.error(f"Error parsing slot assignments: {e}")
            return False
    
    def _is_within_operating_hours(self, current_time: datetime) -> bool:
        """Check if current time is within today's operating hours"""
        day_schedule = self._get_schedule_for_day(current_time.date())
        
        if not day_schedule or not day_schedule.get('isOperating'):
            return False
        
        # Parse start and end times
        start_time_str = day_schedule.get('startTime', '00:00')
        end_time_str = day_schedule.get('endTime', '23:59')
        
        start_time = self._parse_time_to_datetime(start_time_str, current_time.date())
        end_time = self._parse_time_to_datetime(end_time_str, current_time.date())
        
        # Handle overnight schedules (e.g., 18:00 - 02:00)
        if end_time < start_time:
            # If we're before start time, we might be in yesterday's overnight period
            if current_time.time() < start_time.time():
                # Check if yesterday was operating and ended after midnight
                yesterday = current_time.date() - timedelta(days=1)
                yesterday_schedule = self._get_schedule_for_day(yesterday)
                if yesterday_schedule and yesterday_schedule.get('isOperating'):
                    yesterday_end = self._parse_time_to_datetime(
                        yesterday_schedule.get('endTime', '23:59'),
                        yesterday
                    )
                    yesterday_start = self._parse_time_to_datetime(
                        yesterday_schedule.get('startTime', '00:00'),
                        yesterday
                    )
                    if yesterday_end < yesterday_start:
                        # Overnight schedule from yesterday
                        return current_time.time() <= end_time.time()
            else:
                # We're after start time in today's overnight schedule
                return True
        else:
            # Normal schedule - check if within hours
            return start_time <= current_time <= end_time
        
        return False
    
    def _is_within_booking_period(self, item: dict, current_time: datetime) -> bool:
        """Check if current date is within booking's StartDate and EndDate"""
        # This would need StartDate/EndDate from the playlist item
        # For now, return True if we have a booking_id (backend should filter)
        return bool(item.get('bookingId') or item.get('BookingId'))
    
    def _get_schedule_for_day(self, check_date: date) -> Optional[dict]:
        """Get operating schedule for a specific date"""
        day_name = check_date.strftime('%A')  # Monday, Tuesday, etc.
        return self.schedule.get(day_name) or self.schedule.get(day_name.lower())
    
    def _parse_time_to_datetime(self, time_str: str, on_date: date) -> datetime:
        """
        Parse time string to datetime on specific date
        
        Args:
            time_str: Time string in format "HH:MM" or "HH:MM:SS"
            on_date: Date to apply the time to
            
        Returns:
            datetime object
        """
        from datetime import time, timedelta
        
        # Parse time string
        parts = time_str.split(':')
        hours = int(parts[0])
        minutes = int(parts[1]) if len(parts) > 1 else 0
        seconds = int(parts[2]) if len(parts) > 2 else 0
        
        return datetime.combine(on_date, time(hours, minutes, seconds))
