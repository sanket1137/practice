"""
QR Verification Module for CCMS Pi Player
Displays a rotating QR code on screen for physical verification.
Owner scans QR → records video → admin approves → player starts ads.
"""

import io
import os
import sys
import time
import logging
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

try:
    import qrcode
    import requests
except ImportError as e:
    logger.error(f"Missing dependency for QR verification: {e}")
    logger.error("Install with: pip install qrcode[pil] requests")
    sys.exit(1)


# QR refresh interval (match backend TTL of 5 minutes, refresh at 4 min)
QR_REFRESH_INTERVAL_SECONDS = 240
# Status poll interval
STATUS_POLL_INTERVAL_SECONDS = 10


class QrVerificationDisplay:
    """
    Manages the QR verification flow on the player.
    
    1. Requests a QR challenge code from the backend
    2. Generates and displays the QR code fullscreen (via mpv or framebuffer)
    3. Polls verification status every 10 seconds
    4. Returns True when screen is Verified, allowing normal playback to start
    """

    def __init__(self, screen_id: str, api_key: str, api_url: str, screen_name: str = ""):
        self.screen_id = screen_id
        self.api_key = api_key
        self.api_url = api_url.rstrip("/")
        self.screen_name = screen_name
        self.current_challenge_code = None
        self.challenge_expires_at = None
        self._stop_event = threading.Event()
        self._qr_image_path = os.path.join(
            os.path.dirname(__file__), "cache", "verification_qr.png"
        )
        os.makedirs(os.path.dirname(self._qr_image_path), exist_ok=True)

    def request_qr_challenge(self) -> bool:
        """Request a new QR challenge from the backend."""
        try:
            url = f"{self.api_url}/api/v1/screens/{self.screen_id}/verification/qr-challenge"
            payload = {"apiKey": self.api_key}
            response = requests.post(url, json=payload, timeout=10)

            if response.status_code == 200:
                data = response.json().get("data", {})
                self.current_challenge_code = data.get("code")
                self.challenge_expires_at = data.get("expiresAt")
                qr_content = data.get("qrContent", "")

                if qr_content:
                    self._generate_qr_image(qr_content)
                    logger.info(f"QR challenge generated, expires at {self.challenge_expires_at}")
                    return True
                else:
                    logger.error("Empty QR content in challenge response")
                    return False
            else:
                logger.error(f"QR challenge request failed: {response.status_code} {response.text[:200]}")
                return False

        except Exception as e:
            logger.error(f"QR challenge request error: {e}")
            return False

    def poll_verification_status(self) -> str:
        """Poll the backend for current verification status. Returns status string."""
        try:
            url = f"{self.api_url}/api/v1/screens/{self.screen_id}/verification/status"
            response = requests.get(url, timeout=10)

            if response.status_code == 200:
                data = response.json().get("data", {})
                status = data.get("status", "Unverified")
                can_play = data.get("canPlay", False)
                logger.debug(f"Verification status: {status}, canPlay: {can_play}")
                return status
            else:
                logger.warning(f"Status poll failed: {response.status_code}")
                return "Unknown"

        except Exception as e:
            logger.warning(f"Status poll error: {e}")
            return "Unknown"

    def _generate_qr_image(self, content: str):
        """Generate a QR code PNG with verification instructions."""
        qr = qrcode.QRCode(
            version=None,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=12,
            border=4,
        )
        qr.add_data(content)
        qr.make(fit=True)

        try:
            from PIL import Image, ImageDraw, ImageFont
            
            # Create QR image
            qr_img = qr.make_image(fill_color="white", back_color="#0f172a")

            # Create full display image (1920x1080)
            display_width, display_height = 1920, 1080
            display = Image.new("RGB", (display_width, display_height), "#0f172a")
            draw = ImageDraw.Draw(display)

            # Center QR code
            qr_size = min(600, qr_img.size[0])
            qr_img_resized = qr_img.resize((qr_size, qr_size), Image.NEAREST)
            qr_x = (display_width - qr_size) // 2
            qr_y = 150
            display.paste(qr_img_resized, (qr_x, qr_y))

            # Add text labels
            try:
                font_large = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 36)
                font_medium = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
                font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 18)
            except OSError:
                font_large = ImageFont.load_default()
                font_medium = font_large
                font_small = font_large

            # Title
            title = "Screen Verification Required"
            bbox = draw.textbbox((0, 0), title, font=font_large)
            title_w = bbox[2] - bbox[0]
            draw.text(((display_width - title_w) // 2, 60), title, fill="#f8fafc", font=font_large)

            # Screen name
            if self.screen_name:
                bbox = draw.textbbox((0, 0), self.screen_name, font=font_medium)
                name_w = bbox[2] - bbox[0]
                draw.text(((display_width - name_w) // 2, 110), self.screen_name, fill="#94a3b8", font=font_medium)

            # Instructions below QR
            instructions = [
                "Scan this QR code with your phone to verify this screen",
                "You will need to record a short video showing the QR on screen",
                "and a 360° pan of the surroundings",
            ]
            y_pos = qr_y + qr_size + 40
            for line in instructions:
                bbox = draw.textbbox((0, 0), line, font=font_medium)
                line_w = bbox[2] - bbox[0]
                draw.text(((display_width - line_w) // 2, y_pos), line, fill="#94a3b8", font=font_medium)
                y_pos += 35

            # Status indicator
            status_text = "Waiting for verification..."
            bbox = draw.textbbox((0, 0), status_text, font=font_small)
            status_w = bbox[2] - bbox[0]
            draw.text(((display_width - status_w) // 2, display_height - 80), status_text, fill="#6366f1", font=font_small)

            # PixelSpot branding
            brand = "PixelSpot CCMS"
            bbox = draw.textbbox((0, 0), brand, font=font_small)
            brand_w = bbox[2] - bbox[0]
            draw.text(((display_width - brand_w) // 2, display_height - 40), brand, fill="#475569", font=font_small)

            display.save(self._qr_image_path)
            logger.info(f"QR verification image saved to {self._qr_image_path}")

        except ImportError:
            # Fallback: save raw QR without PIL compositing
            qr_img = qr.make_image(fill_color="white", back_color="#0f172a")
            qr_img.save(self._qr_image_path)
            logger.warning("PIL not available — saved raw QR image without instructions overlay")

    def display_qr_fullscreen(self):
        """Display the QR image fullscreen using mpv (or fbi as fallback)."""
        if not os.path.exists(self._qr_image_path):
            logger.error("QR image not found, cannot display")
            return None

        try:
            import subprocess

            # Try mpv first (image display mode)
            process = subprocess.Popen(
                [
                    "mpv",
                    "--fullscreen",
                    "--no-osc",
                    "--no-input-default-bindings",
                    "--image-display-duration=inf",
                    "--loop=inf",
                    "--really-quiet",
                    self._qr_image_path,
                ],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            logger.info("QR displayed via mpv")
            return process

        except FileNotFoundError:
            try:
                # Fallback to fbi (Linux framebuffer image viewer)
                process = subprocess.Popen(
                    ["fbi", "-T", "1", "-a", "--noverbose", self._qr_image_path],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
                logger.info("QR displayed via fbi (framebuffer)")
                return process
            except FileNotFoundError:
                logger.error("Neither mpv nor fbi available for QR display")
                return None

    def stop(self):
        """Signal the verification loop to stop."""
        self._stop_event.set()

    def run_verification_loop(self) -> bool:
        """
        Main verification loop. Blocks until screen is Verified or stopped.
        
        Returns True if verification succeeded, False if stopped/failed.
        """
        logger.info("=" * 50)
        logger.info("Entering QR verification mode")
        logger.info("=" * 50)

        display_process = None

        try:
            # Initial QR challenge
            if not self.request_qr_challenge():
                logger.error("Failed to get initial QR challenge")
                return False

            display_process = self.display_qr_fullscreen()

            last_qr_refresh = time.time()
            last_status_poll = 0

            while not self._stop_event.is_set():
                now = time.time()

                # Refresh QR challenge every QR_REFRESH_INTERVAL_SECONDS
                if now - last_qr_refresh >= QR_REFRESH_INTERVAL_SECONDS:
                    logger.info("Refreshing QR challenge...")
                    if self.request_qr_challenge():
                        # Kill old display process and restart
                        if display_process:
                            display_process.terminate()
                            display_process.wait()
                        display_process = self.display_qr_fullscreen()
                        last_qr_refresh = now
                    else:
                        logger.warning("QR refresh failed, keeping current QR")

                # Poll verification status every STATUS_POLL_INTERVAL_SECONDS
                if now - last_status_poll >= STATUS_POLL_INTERVAL_SECONDS:
                    status = self.poll_verification_status()
                    last_status_poll = now

                    if status == "Verified":
                        logger.info("Screen VERIFIED! Transitioning to normal playback.")
                        return True
                    elif status == "PendingReview":
                        logger.info("Verification submitted, awaiting admin review...")
                    elif status == "Rejected":
                        logger.warning("Verification was rejected. Continuing QR display for re-attempt.")
                        # Refresh QR for a new attempt
                        if self.request_qr_challenge():
                            if display_process:
                                display_process.terminate()
                                display_process.wait()
                            display_process = self.display_qr_fullscreen()
                            last_qr_refresh = now

                # Sleep 1 second between checks
                self._stop_event.wait(1)

            return False

        except KeyboardInterrupt:
            logger.info("Verification loop interrupted")
            return False

        finally:
            if display_process:
                try:
                    display_process.terminate()
                    display_process.wait(timeout=5)
                except Exception:
                    display_process.kill()
                logger.info("QR display process stopped")
