"""
CMS control hub client for Raspberry Pi player.

Connects to `/hubs/cms` on the CCMS backend using the screen's API key as
the `access_token` query parameter. Receives `command` and `playlist_updated`
events from the dashboard; sends acknowledgements back via `AckCommand`.

Paired with:
  - remote_command_handler.RemoteCommandHandler — translates commands into mpv ops
  - cms_pair.py — CLI to claim a 6-char pairing code and persist credentials

This module is additive: it does NOT replace the existing marketplace
SignalR connection (`/hubs/playback`). Both run concurrently; marketplace
screens simply never receive commands because no CmsOwner owns them.
"""

import logging
from typing import Callable, Optional, Dict, Any

try:
    from signalrcore.hub_connection_builder import HubConnectionBuilder
except ImportError:
    HubConnectionBuilder = None

logger = logging.getLogger(__name__)


class CmsControlClient:
    """Thin SignalR wrapper for the CMS control hub."""

    def __init__(self, api_url: str, screen_id: str, api_key: str):
        self.api_url = api_url.rstrip("/")
        self.screen_id = screen_id
        self.api_key = api_key
        self._conn = None
        self._connected = False
        self._on_command: Optional[Callable[[Dict[str, Any]], None]] = None
        self._on_playlist_updated: Optional[Callable[[Dict[str, Any]], None]] = None

    def set_on_command(self, cb: Callable[[Dict[str, Any]], None]) -> None:
        self._on_command = cb

    def set_on_playlist_updated(self, cb: Callable[[Dict[str, Any]], None]) -> None:
        self._on_playlist_updated = cb

    def connect(self) -> bool:
        if HubConnectionBuilder is None:
            logger.error("signalrcore not installed — CMS hub disabled")
            return False
        try:
            hub_url = f"{self.api_url}/hubs/cms?access_token={self.api_key}"
            logger.info("Connecting to CMS hub: %s/hubs/cms", self.api_url)
            self._conn = (
                HubConnectionBuilder()
                .with_url(hub_url)
                .configure_logging(logging.WARNING)
                .with_automatic_reconnect({
                    "type": "raw",
                    "keep_alive_interval": 10,
                    "reconnect_interval": 5,
                    "max_attempts": 20,
                })
                .build()
            )
            self._conn.on_open(self._on_open)
            self._conn.on_close(self._on_close)
            self._conn.on_error(lambda e: logger.error("CMS hub error: %s", e))
            self._conn.on("command", self._handle_command)
            self._conn.on("playlist_updated", self._handle_playlist_updated)
            self._conn.on("player_online", lambda _: logger.debug("player_online"))
            self._conn.on("player_offline", lambda _: logger.debug("player_offline"))
            self._conn.on("command_ack", lambda _: logger.debug("command_ack"))
            self._conn.start()
            return True
        except Exception as e:
            logger.error("Failed to connect to CMS hub: %s", e)
            return False

    def _on_open(self) -> None:
        self._connected = True
        logger.info("CMS hub connected — subscribing as player")
        try:
            self._conn.send("SubscribePlayer", [self.screen_id, self.api_key])
        except Exception as e:
            logger.error("SubscribePlayer failed: %s", e)

    def _on_close(self) -> None:
        self._connected = False
        logger.warning("CMS hub connection closed")

    def _handle_command(self, data) -> None:
        """`data` is a list of args as delivered by signalrcore."""
        payload = data[0] if isinstance(data, list) and data else data
        if not isinstance(payload, dict):
            logger.warning("CMS command: unexpected payload type %s", type(payload))
            return
        logger.info("CMS command received: %s", payload.get("commandType"))
        if self._on_command:
            try:
                self._on_command(payload)
            except Exception as e:
                logger.exception("on_command handler raised: %s", e)

    def _handle_playlist_updated(self, data) -> None:
        payload = data[0] if isinstance(data, list) and data else data
        if not isinstance(payload, dict):
            payload = {}
        logger.info("CMS playlist_updated received")
        if self._on_playlist_updated:
            try:
                self._on_playlist_updated(payload)
            except Exception as e:
                logger.exception("on_playlist_updated handler raised: %s", e)

    def ack_command(self, command_id: str, success: bool, error: Optional[str] = None) -> None:
        if not self._connected or self._conn is None:
            logger.warning("ack_command skipped — not connected")
            return
        try:
            req = {"CommandId": command_id, "Success": success, "ErrorMessage": error}
            self._conn.send("AckCommand", [req])
        except Exception as e:
            logger.error("ack_command failed: %s", e)

    def stop(self) -> None:
        if self._conn is None:
            return
        try:
            self._conn.stop()
        except Exception:
            pass
        self._conn = None
        self._connected = False
