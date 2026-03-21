"""
Log Cleanup Utility
Automatically deletes log files older than specified days
"""

import os
import logging
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger("CCMSPlayer")


class LogCleanup:
    """Manages automatic cleanup of old log files"""
    
    def __init__(self, logs_dir: Path, max_age_days: int = 7):
        """
        Initialize log cleanup manager
        
        Args:
            logs_dir: Directory containing log files
            max_age_days: Delete logs older than this many days (default: 7)
        """
        self.logs_dir = Path(logs_dir)
        self.max_age_days = max_age_days
        
    def cleanup_old_logs(self):
        """Delete log files older than max_age_days"""
        if not self.logs_dir.exists():
            logger.warning(f"Logs directory does not exist: {self.logs_dir}")
            return 0
        
        cutoff_date = datetime.now() - timedelta(days=self.max_age_days)
        deleted_count = 0
        total_size = 0
        
        logger.info(f"[LOG CLEANUP] Scanning for log files older than {self.max_age_days} days...")
        logger.info(f"[LOG CLEANUP] Cutoff date: {cutoff_date.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Find all .log files
        log_files = list(self.logs_dir.glob("*.log"))
        
        if not log_files:
            logger.info("[LOG CLEANUP] No log files found")
            return 0
        
        logger.info(f"[LOG CLEANUP] Found {len(log_files)} log files")
        
        for log_file in log_files:
            try:
                # Get file modification time
                file_mtime = datetime.fromtimestamp(log_file.stat().st_mtime)
                file_size = log_file.stat().st_size
                
                # Check if file is older than cutoff
                if file_mtime < cutoff_date:
                    # Delete the file
                    log_file.unlink()
                    deleted_count += 1
                    total_size += file_size
                    
                    age_days = (datetime.now() - file_mtime).days
                    logger.info(
                        f"[LOG CLEANUP] ✓ Deleted: {log_file.name} "
                        f"(age: {age_days} days, size: {file_size:,} bytes)"
                    )
                else:
                    age_days = (datetime.now() - file_mtime).days
                    logger.debug(
                        f"[LOG CLEANUP] ✗ Kept: {log_file.name} "
                        f"(age: {age_days} days)"
                    )
                    
            except Exception as e:
                logger.error(f"[LOG CLEANUP] Failed to delete {log_file.name}: {e}")
        
        if deleted_count > 0:
            logger.info(
                f"[LOG CLEANUP] Cleanup complete: {deleted_count} files deleted, "
                f"{total_size:,} bytes freed"
            )
        else:
            logger.info("[LOG CLEANUP] No old log files to delete")
        
        return deleted_count
    
    def get_log_stats(self):
        """Get statistics about log files"""
        if not self.logs_dir.exists():
            return {"count": 0, "total_size": 0, "oldest": None, "newest": None}
        
        log_files = list(self.logs_dir.glob("*.log"))
        
        if not log_files:
            return {"count": 0, "total_size": 0, "oldest": None, "newest": None}
        
        total_size = sum(f.stat().st_size for f in log_files)
        mtimes = [datetime.fromtimestamp(f.stat().st_mtime) for f in log_files]
        
        return {
            "count": len(log_files),
            "total_size": total_size,
            "oldest": min(mtimes),
            "newest": max(mtimes)
        }


def cleanup_logs_on_startup(logs_dir: Path, max_age_days: int = 7):
    """
    Convenience function to run log cleanup on player startup
    
    Args:
        logs_dir: Directory containing log files
        max_age_days: Delete logs older than this many days
    
    Returns:
        Number of files deleted
    """
    cleanup = LogCleanup(logs_dir, max_age_days)
    
    # Show current log stats
    stats = cleanup.get_log_stats()
    if stats["count"] > 0:
        logger.info(f"[LOG CLEANUP] Current logs: {stats['count']} files, {stats['total_size']:,} bytes")
        if stats["oldest"]:
            oldest_age = (datetime.now() - stats["oldest"]).days
            logger.info(f"[LOG CLEANUP] Oldest log: {oldest_age} days old")
    
    # Perform cleanup
    return cleanup.cleanup_old_logs()


if __name__ == "__main__":
    # Test cleanup
    import sys
    
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    
    logs_dir = Path(__file__).parent / "logs"
    max_age = int(sys.argv[1]) if len(sys.argv) > 1 else 7
    
    print(f"Running log cleanup (max age: {max_age} days)...")
    deleted = cleanup_logs_on_startup(logs_dir, max_age)
    print(f"Deleted {deleted} log files")
