"""
Translates CMS remote commands into mpv operations for the Raspberry Pi player.

Called by `CmsControlClient._on_command` with the RemoteCommandDto payload.
After executing the command, acknowledges via `CmsControlClient.ack_command`.

Supported commands (case-insensitive): Play, Pause, Skip/Next, Previous,
Restart/RestartLoop, JumpTo, SetVolume, ForceSync, Reboot. Unknown command
types are NAK'd with a descriptive error.
"""

import json
import logging
import os
import sys
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)


class RemoteCommandHandler:
    def __init__(self, mpv_player, cms_client, on_force_sync=None):
        """
        Args:
            mpv_player: MPVDualPlayer instance (must expose player_a with mpv props)
            cms_client: CmsControlClient — used to call ack_command
            on_force_sync: optional callback invoked on ForceSync / playlist_updated
                           to trigger a re-handshake.
        """
        self.mpv_player = mpv_player
        self.cms_client = cms_client
        self.on_force_sync = on_force_sync

    def handle(self, cmd: Dict[str, Any]) -> None:
        command_id = cmd.get("id") or cmd.get("Id")
        command_type = (cmd.get("commandType") or cmd.get("CommandType") or "").lower()
        payload_json = cmd.get("payloadJson") or cmd.get("PayloadJson")
        payload = self._parse_payload(payload_json)

        try:
            if command_type == "play":
                self._set_pause(False)
            elif command_type == "pause":
                self._set_pause(True)
            elif command_type in ("skip", "next"):
                self._mpv_command(["playlist-next", "weak"])
            elif command_type == "previous":
                self._mpv_command(["playlist-prev", "weak"])
            elif command_type in ("restart", "restartloop"):
                self._mpv_set("playlist-pos", 0)
                self._set_pause(False)
            elif command_type == "jumpto":
                index = payload.get("index", payload.get("itemIndex"))
                if index is None:
                    raise ValueError("JumpTo requires 'index'")
                self._mpv_set("playlist-pos", int(index))
                self._set_pause(False)
            elif command_type == "setvolume":
                vol = payload.get("volume")
                if vol is None:
                    raise ValueError("SetVolume requires 'volume' (0-100)")
                # mpv 'volume' property is 0-100
                self._mpv_set("volume", max(0, min(100, float(vol) * 100 if float(vol) <= 1 else float(vol))))
            elif command_type == "forcesync":
                if self.on_force_sync:
                    self.on_force_sync()
            elif command_type == "reboot":
                self._ack(command_id, True)
                logger.warning("Reboot command — exiting process")
                # Systemd / watchdog will restart us; use _exit so no cleanup blocks.
                os._exit(0)
                return
            else:
                self._ack(command_id, False, f"Unknown command: {command_type}")
                return

            self._ack(command_id, True)
        except Exception as e:
            logger.exception("Command %s failed", command_type)
            self._ack(command_id, False, str(e))

    # ── Helpers ──

    def _set_pause(self, paused: bool) -> None:
        player = getattr(self.mpv_player, "active_player", None) or getattr(self.mpv_player, "player_a", None)
        if player is None:
            raise RuntimeError("mpv player not available")
        player.pause = paused

    def _mpv_command(self, args) -> None:
        player = getattr(self.mpv_player, "active_player", None) or getattr(self.mpv_player, "player_a", None)
        if player is None:
            raise RuntimeError("mpv player not available")
        player.command(*args)

    def _mpv_set(self, prop: str, value) -> None:
        player = getattr(self.mpv_player, "active_player", None) or getattr(self.mpv_player, "player_a", None)
        if player is None:
            raise RuntimeError("mpv player not available")
        setattr(player, prop, value)

    def _parse_payload(self, raw: Optional[str]) -> Dict[str, Any]:
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {}

    def _ack(self, command_id: Optional[str], success: bool, error: Optional[str] = None) -> None:
        if not command_id:
            logger.warning("ack skipped — no command id")
            return
        self.cms_client.ack_command(str(command_id), success, error)
