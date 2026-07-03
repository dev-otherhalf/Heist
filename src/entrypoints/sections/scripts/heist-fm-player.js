class HeistFMPlayer {
  constructor(root) {
    if (!root || root.dataset.heistPlayerReady === 'true') return;

    this.root = root;
    this.root.dataset.heistPlayerReady = 'true';

    this.audio = root.querySelector('[data-heist-audio]');
    this.tracksScript = root.querySelector('[data-heist-tracks]');
    this.cover = root.querySelector('[data-heist-cover]');
    this.placeholder = root.querySelector('[data-heist-placeholder]');
    this.trackTitle = root.querySelector('[data-heist-track-title]');
    this.status = root.querySelector('[data-heist-status]');
    this.progress = root.querySelector('[data-heist-progress]');
    this.currentTime = root.querySelector('[data-heist-current-time]');
    this.duration = root.querySelector('[data-heist-duration]');
    this.playIcon = root.querySelector('[data-heist-play-icon]');

    this.currentIndex = 0;
    this.isSeeking = false;
    this.isShuffle = false;
    this.isLoop = false;

    this.tracks = this.getTracks();

    if (!this.audio || !this.tracks.length) {
      this.root.classList.add('is-empty');
      this.setStatus('Add MP3 track URLs in the section settings.');
      return;
    }

    this.bindEvents();
    this.loadTrack(0, false);
  }

  getTracks() {
    if (!this.tracksScript) return [];

    try {
      const tracks = JSON.parse(this.tracksScript.textContent || '[]');

      return tracks.filter((track) => {
        return track && track.audio && track.audio.trim() !== '';
      });
    } catch (error) {
      console.error('Heist FM: Invalid track JSON', error);
      return [];
    }
  }

  bindEvents() {
    this.root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-heist-action]');
      if (!button) return;

      const action = button.dataset.heistAction;

      if (action === 'toggle') {
        this.togglePlay();
      }

      if (action === 'next') {
        this.nextTrack(true);
      }

      if (action === 'previous') {
        this.previousTrack(true);
      }

      if (action === 'shuffle') {
        this.isShuffle = !this.isShuffle;
        button.classList.toggle('is-active', this.isShuffle);
        this.setStatus(this.isShuffle ? 'Shuffle on.' : 'Shuffle off.');
      }

      if (action === 'loop') {
        this.isLoop = !this.isLoop;
        this.audio.loop = this.isLoop;
        button.classList.toggle('is-active', this.isLoop);
        this.setStatus(this.isLoop ? 'Loop on.' : 'Loop off.');
      }
    });

    this.progress.addEventListener('input', () => {
      this.isSeeking = true;
      this.updateTimeFromProgress();
    });

    this.progress.addEventListener('change', () => {
      const duration = this.audio.duration;

      if (Number.isFinite(duration)) {
        this.audio.currentTime = (Number(this.progress.value) / 100) * duration;
      }

      this.isSeeking = false;
    });

    this.audio.addEventListener('loadedmetadata', () => {
      this.updateProgress();
      this.updateDuration();
    });

    this.audio.addEventListener('timeupdate', () => {
      if (!this.isSeeking) {
        this.updateProgress();
      }
    });

    this.audio.addEventListener('play', () => {
      this.root.classList.add('is-playing');
      this.playIcon.textContent = 'Ⅱ';
    });

    this.audio.addEventListener('pause', () => {
      this.root.classList.remove('is-playing');
      this.playIcon.textContent = '▶';
    });

    this.audio.addEventListener('ended', () => {
      if (!this.isLoop) {
        this.nextTrack(true);
      }
    });

    this.audio.addEventListener('error', () => {
      this.setStatus('Audio file could not load. Please check the MP3 URL.');
      this.root.classList.remove('is-playing');
      this.playIcon.textContent = '▶';
    });
  }

  loadTrack(index, shouldPlay) {
    if (!this.tracks.length) return;

    this.currentIndex = this.normalizeIndex(index);

    const track = this.tracks[this.currentIndex];

    this.audio.src = track.audio;
    this.audio.load();

    this.updateTrackUI(track);
    this.resetProgress();

    if (shouldPlay) {
      this.play();
    }
  }

  updateTrackUI(track) {
    const title = track.title || 'Untitled track';
    const artist = track.artist || '';

    this.trackTitle.textContent = artist ? `${title} — ${artist}` : title;

    if (track.cover) {
      this.cover.src = track.cover;
      this.cover.alt = title;
      this.cover.classList.add('is-visible');
      this.placeholder.classList.add('is-hidden');
    } else {
      this.cover.removeAttribute('src');
      this.cover.alt = '';
      this.cover.classList.remove('is-visible');
      this.placeholder.classList.remove('is-hidden');
    }

    this.setStatus(`Now loaded: ${title}`);
  }

  togglePlay() {
    if (this.audio.paused) {
      this.play();
    } else {
      this.audio.pause();
    }
  }

  play() {
    const playPromise = this.audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.setStatus('Click play again if the browser blocked audio.');
      });
    }
  }

  nextTrack(shouldPlay) {
    if (this.isShuffle && this.tracks.length > 1) {
      let nextIndex = this.currentIndex;

      while (nextIndex === this.currentIndex) {
        nextIndex = Math.floor(Math.random() * this.tracks.length);
      }

      this.loadTrack(nextIndex, shouldPlay);
      return;
    }

    this.loadTrack(this.currentIndex + 1, shouldPlay);
  }

  previousTrack(shouldPlay) {
    this.loadTrack(this.currentIndex - 1, shouldPlay);
  }

  normalizeIndex(index) {
    const total = this.tracks.length;

    if (index < 0) {
      return total - 1;
    }

    if (index >= total) {
      return 0;
    }

    return index;
  }

  updateProgress() {
    const duration = this.audio.duration;
    const currentTime = this.audio.currentTime;

    if (!Number.isFinite(duration)) return;

    this.progress.value = (currentTime / duration) * 100;
    this.currentTime.textContent = this.formatTime(currentTime);
  }

  updateDuration() {
    const duration = this.audio.duration;

    if (!Number.isFinite(duration)) {
      this.duration.textContent = '0:00';
      return;
    }

    this.duration.textContent = this.formatTime(duration);
  }

  updateTimeFromProgress() {
    const duration = this.audio.duration;

    if (!Number.isFinite(duration)) return;

    const previewTime = (Number(this.progress.value) / 100) * duration;
    this.currentTime.textContent = this.formatTime(previewTime);
  }

  resetProgress() {
    this.progress.value = 0;
    this.currentTime.textContent = '0:00';
    this.duration.textContent = '0:00';
  }

  setStatus(message) {
    if (this.status) {
      this.status.textContent = message;
    }
  }

  formatTime(seconds) {
    const safeSeconds = Number.isFinite(seconds) ? seconds : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);

    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}

function initHeistFMPlayers(scope = document) {
  const players = scope.querySelectorAll('[data-heist-player]');

  players.forEach((player) => {
    new HeistFMPlayer(player);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initHeistFMPlayers();
});

document.addEventListener('shopify:section:load', (event) => {
  initHeistFMPlayers(event.target);
});

document.addEventListener('shopify:section:unload', (event) => {
  const players = event.target.querySelectorAll('[data-heist-player]');

  players.forEach((player) => {
    const audio = player.querySelector('[data-heist-audio]');

    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }

    player.dataset.heistPlayerReady = 'false';
  });
});