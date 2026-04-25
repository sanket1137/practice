/**
 * HTML5 video player with gapless playback using two video elements.
 */
import type { PlaylistItem } from '../api/playerApi';

export class VideoPlayer {
  private readonly container: HTMLElement;
  private videoA: HTMLVideoElement;
  private videoB: HTMLVideoElement;
  private activeVideo: HTMLVideoElement;
  private playlist: PlaylistItem[] = [];
  private currentIndex = 0;
  private onImpression: ((item: PlaylistItem, durationSeconds: number) => void) | null = null;
  private playStartTime = 0;

  constructor(container: HTMLElement) {
    this.container = container;

    this.videoA = this.createVideoElement();
    this.videoB = this.createVideoElement();
    this.videoB.style.display = 'none';

    this.container.appendChild(this.videoA);
    this.container.appendChild(this.videoB);

    this.activeVideo = this.videoA;
  }

  private createVideoElement(): HTMLVideoElement {
    const video = document.createElement('video');
    video.style.cssText =
      'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;background:#000;';
    video.muted = true; // Autoplay requires muted
    video.playsInline = true;
    video.autoplay = false;
    return video;
  }

  setOnImpression(cb: (item: PlaylistItem, durationSeconds: number) => void): void {
    this.onImpression = cb;
  }

  loadPlaylist(items: PlaylistItem[]): void {
    this.playlist = items;
    this.currentIndex = 0;
    if (items.length > 0) {
      this.playItem(0);
    }
  }

  private playItem(index: number): void {
    if (this.playlist.length === 0) return;
    this.currentIndex = index % this.playlist.length;
    const item = this.playlist[this.currentIndex];

    // Swap videos
    const incoming = this.activeVideo === this.videoA ? this.videoB : this.videoA;
    incoming.src = item.creativeUrl;
    incoming.style.display = 'block';
    incoming.load();

    incoming.oncanplay = () => {
      incoming.play().catch(console.error);
      this.playStartTime = Date.now();

      // Hide old video
      this.activeVideo.pause();
      this.activeVideo.style.display = 'none';
      this.activeVideo.removeAttribute('src');
      this.activeVideo = incoming;
    };

    incoming.onended = () => {
      const duration = Math.round((Date.now() - this.playStartTime) / 1000);
      this.onImpression?.(item, duration);
      this.playItem(this.currentIndex + 1);
    };

    incoming.onerror = () => {
      console.error(`[Player] Error loading video for slot ${item.slotNumber}`);
      // Skip to next after short delay
      setTimeout(() => this.playItem(this.currentIndex + 1), 2000);
    };

    // Preload next video into standby element
    const nextIndex = (this.currentIndex + 1) % this.playlist.length;
    const standby = this.activeVideo === this.videoA ? this.videoB : this.videoA;
    if (this.playlist[nextIndex]) {
      standby.src = this.playlist[nextIndex].creativeUrl;
      standby.load();
    }
  }

  stop(): void {
    this.videoA.pause();
    this.videoB.pause();
    this.videoA.removeAttribute('src');
    this.videoB.removeAttribute('src');
  }

  // ── Remote-control API (used by RemoteCommandHandler) ──

  pause(): void {
    this.activeVideo.pause();
  }

  resume(): void {
    this.activeVideo.play().catch(console.error);
  }

  skipNext(): void {
    this.playItem(this.currentIndex + 1);
  }

  skipPrevious(): void {
    const prev = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.playItem(prev);
  }

  jumpTo(index: number): void {
    if (index < 0 || index >= this.playlist.length) {
      throw new Error(`Invalid index ${index}`);
    }
    this.playItem(index);
  }

  restart(): void {
    this.playItem(0);
  }

  setVolume(volume: number): void {
    // Accept either 0-1 or 0-100
    const v = volume > 1 ? volume / 100 : volume;
    const clamped = Math.max(0, Math.min(1, v));
    this.videoA.volume = clamped;
    this.videoB.volume = clamped;
    // Unmute if volume > 0 so the user actually hears it
    if (clamped > 0) {
      this.videoA.muted = false;
      this.videoB.muted = false;
    }
  }
}
