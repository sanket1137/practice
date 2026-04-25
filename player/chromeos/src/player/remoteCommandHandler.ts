/**
 * Translates CMS RemoteCommands into VideoPlayer operations.
 *
 * Receives a RemoteCommandPayload, dispatches to the matching VideoPlayer
 * method, then acks the command via CmsControlClient. Unknown / invalid
 * commands are NAK'd with a descriptive error message.
 */
import type { VideoPlayer } from './videoPlayer';
import type {
  CmsControlClient,
  RemoteCommandPayload,
} from '../realtime/cmsControlClient';

export class RemoteCommandHandler {
  constructor(
    private readonly player: VideoPlayer,
    private readonly cmsClient: CmsControlClient,
    private readonly onForceSync: () => void
  ) {}

  async handle(cmd: RemoteCommandPayload): Promise<void> {
    const type = (cmd.commandType || '').toLowerCase();
    const payload = this.parsePayload(cmd.payloadJson);

    try {
      switch (type) {
        case 'play':
          this.player.resume();
          break;
        case 'pause':
          this.player.pause();
          break;
        case 'skip':
        case 'next':
          this.player.skipNext();
          break;
        case 'previous':
          this.player.skipPrevious();
          break;
        case 'restart':
        case 'restartloop':
          this.player.restart();
          break;
        case 'jumpto': {
          const index = payload.index ?? payload.itemIndex;
          if (typeof index !== 'number') {
            throw new Error("JumpTo requires numeric 'index'");
          }
          this.player.jumpTo(index);
          break;
        }
        case 'setvolume': {
          if (typeof payload.volume !== 'number') {
            throw new Error("SetVolume requires numeric 'volume'");
          }
          this.player.setVolume(payload.volume);
          break;
        }
        case 'forcesync':
          this.onForceSync();
          break;
        case 'reboot':
          await this.cmsClient.ackCommand(cmd.id, true);
          // ChromeOS player reboot = page reload (triggers handshake + re-auth)
          setTimeout(() => window.location.reload(), 300);
          return;
        default:
          await this.cmsClient.ackCommand(cmd.id, false, `Unknown command: ${cmd.commandType}`);
          return;
      }
      await this.cmsClient.ackCommand(cmd.id, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[RemoteCmd] ${cmd.commandType} failed:`, msg);
      await this.cmsClient.ackCommand(cmd.id, false, msg);
    }
  }

  private parsePayload(raw: string | null): Record<string, unknown> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
}
