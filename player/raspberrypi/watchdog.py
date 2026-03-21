"""
CCMS Player Watchdog Service
Monitors player process health and auto-restarts on crash
Run this as a separate process/service to supervise the player
"""

import os
import sys
import time
import subprocess
import signal
import logging
from datetime import datetime, timedelta
from pathlib import Path
import json

# Configuration
BASE_DIR = Path(__file__).parent
LOG_DIR = BASE_DIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / f"watchdog_{datetime.now().strftime('%Y%m%d')}.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("Watchdog")


class PlayerWatchdog:
    """Monitors and restarts the CCMS player on crash"""
    
    def __init__(self, player_script: str = "ccms_player.py"):
        self.player_script = BASE_DIR / player_script
        self.process = None
        self.is_running = False
        self.restart_count = 0
        self.max_restarts_per_hour = 5
        self.restart_times = []
        self.min_runtime_seconds = 30  # Minimum time before considering restart
        self.health_check_interval = 10  # Seconds between health checks
        self.last_start_time = None
        
        # Load config if exists
        self._load_config()
    
    def _load_config(self):
        """Load watchdog configuration from config.json"""
        config_file = BASE_DIR / "config.json"
        if config_file.exists():
            try:
                with open(config_file) as f:
                    config = json.load(f)
                    watchdog_config = config.get('watchdog', {})
                    self.max_restarts_per_hour = watchdog_config.get('max_restarts_per_hour', 5)
                    self.min_runtime_seconds = watchdog_config.get('min_runtime_seconds', 30)
                    self.health_check_interval = watchdog_config.get('health_check_interval', 10)
                    logger.info(f"Loaded watchdog config: max_restarts={self.max_restarts_per_hour}, min_runtime={self.min_runtime_seconds}s")
            except Exception as e:
                logger.warning(f"Failed to load watchdog config: {e}")
    
    def _check_restart_limit(self) -> bool:
        """Check if we've exceeded restart limit within the hour"""
        now = datetime.now()
        hour_ago = now - timedelta(hours=1)
        
        # Filter to restarts within the last hour
        self.restart_times = [t for t in self.restart_times if t > hour_ago]
        
        if len(self.restart_times) >= self.max_restarts_per_hour:
            logger.error(f"Restart limit reached ({self.max_restarts_per_hour}/hour). Waiting before next restart...")
            return False
        return True
    
    def start_player(self) -> bool:
        """Start the player process"""
        if not self.player_script.exists():
            logger.error(f"Player script not found: {self.player_script}")
            return False
        
        if not self._check_restart_limit():
            return False
        
        try:
            logger.info(f"Starting player: {self.player_script}")
            
            # Start player as subprocess
            self.process = subprocess.Popen(
                [sys.executable, str(self.player_script)],
                cwd=str(BASE_DIR),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                bufsize=1,
                universal_newlines=True
            )
            
            self.last_start_time = datetime.now()
            self.restart_times.append(self.last_start_time)
            self.restart_count += 1
            
            logger.info(f"Player started with PID: {self.process.pid} (restart #{self.restart_count})")
            return True
            
        except Exception as e:
            logger.error(f"Failed to start player: {e}")
            return False
    
    def stop_player(self):
        """Stop the player process gracefully"""
        if self.process and self.process.poll() is None:
            logger.info("Stopping player...")
            try:
                # Try graceful shutdown first
                self.process.terminate()
                try:
                    self.process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    logger.warning("Player didn't stop gracefully, forcing kill...")
                    self.process.kill()
                    self.process.wait()
                logger.info("Player stopped")
            except Exception as e:
                logger.error(f"Error stopping player: {e}")
    
    def check_health(self) -> bool:
        """Check if player process is healthy"""
        if self.process is None:
            return False
        
        # Check if process is still running
        return_code = self.process.poll()
        if return_code is not None:
            runtime = datetime.now() - self.last_start_time if self.last_start_time else timedelta(0)
            logger.warning(f"Player exited with code {return_code} after {runtime.total_seconds():.1f}s")
            return False
        
        return True
    
    def run(self):
        """Main watchdog loop"""
        logger.info("=" * 60)
        logger.info("CCMS Player Watchdog Starting")
        logger.info(f"Monitoring: {self.player_script}")
        logger.info(f"Max restarts/hour: {self.max_restarts_per_hour}")
        logger.info("=" * 60)
        
        self.is_running = True
        
        # Handle shutdown signals
        def signal_handler(signum, frame):
            logger.info(f"Received signal {signum}, shutting down...")
            self.is_running = False
            self.stop_player()
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        try:
            while self.is_running:
                # Start player if not running
                if not self.check_health():
                    # Check if it crashed too quickly (possible configuration error)
                    if self.last_start_time:
                        runtime = (datetime.now() - self.last_start_time).total_seconds()
                        if runtime < self.min_runtime_seconds and self.restart_count > 1:
                            logger.warning(f"Player crashed quickly ({runtime:.1f}s < {self.min_runtime_seconds}s)")
                            logger.warning("Possible configuration error. Waiting 30s before restart...")
                            time.sleep(30)
                    
                    # Attempt restart
                    if not self.start_player():
                        logger.error("Failed to start player, waiting 60s before retry...")
                        time.sleep(60)
                        continue
                
                # Wait before next health check
                time.sleep(self.health_check_interval)
                
        except Exception as e:
            logger.error(f"Watchdog error: {e}")
        finally:
            self.stop_player()
            logger.info("Watchdog stopped")


def main():
    """Entry point for watchdog"""
    import argparse
    
    parser = argparse.ArgumentParser(description='CCMS Player Watchdog')
    parser.add_argument('--player', default='ccms_player.py', help='Player script to monitor')
    args = parser.parse_args()
    
    watchdog = PlayerWatchdog(player_script=args.player)
    watchdog.run()


if __name__ == "__main__":
    main()
