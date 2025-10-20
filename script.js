const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_VOLUME = 200;
const DEFAULT_VOLUME = 100;

class AudioManager {
    constructor() {
        this.audioElements = [];
        this.audioId = 0;
        this.audioContext = null;
        this.playingCount = 0;
        this.initAudioContext();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.hideEmptyState();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.error('Web Audio API no soportada:', e);
            this.showAlert('Tu navegador no soporta Web Audio API', 'danger');
        }
    }

    setupEventListeners() {
        document.getElementById('audioFile').addEventListener('change', (e) => this.handleFileInput(e));
        document.getElementById('searchInput').addEventListener('input', () => this.filterAudios());
        document.getElementById('playAllBtn').addEventListener('click', () => this.playAll());
        document.getElementById('pauseAllBtn').addEventListener('click', () => this.pauseAll());
        document.getElementById('stopAllBtn').addEventListener('click', () => this.stopAll());
        document.getElementById('resetAllVolumes').addEventListener('click', () => this.resetAllVolumes());
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePlayPauseAll();
            }
        });
    }

    handleFileInput(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.hideEmptyState();
        }
        
        for (let file of files) {
            if (this.validateFile(file)) {
                this.addAudio(file);
            }
        }
        e.target.value = '';
    }

    validateFile(file) {
        if (!file.type.startsWith('audio/')) {
            this.showAlert(`"${file.name}" no es un archivo de audio válido`, 'warning');
            return false;
        }
        
        if (file.size > MAX_FILE_SIZE) {
            this.showAlert(`"${file.name}" es demasiado grande (máx. 100MB)`, 'warning');
            return false;
        }
        
        return true;
    }

    addAudio(file) {
        const id = this.audioId++;
        const url = URL.createObjectURL(file);
        const audio = new Audio(url);
        
        const source = this.audioContext.createMediaElementSource(audio);
        const gainNode = this.audioContext.createGain();
        
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        const audioItem = {
            id: id,
            audio: audio,
            name: file.name,
            url: url,
            gainNode: gainNode,
            source: source,
            hasError: false,
            isPlaying: false
        };

        this.setupAudioEventListeners(audioItem);
        this.audioElements.push(audioItem);
        this.renderAudioItem(audioItem);
    }

    setupAudioEventListeners(item) {
        item.audio.addEventListener('play', () => {
            this.audioContext.resume();
            item.isPlaying = true;
            this.updatePlayingState(item.id, true);
            this.updatePlayingCounter();
        });
        
        item.audio.addEventListener('pause', () => {
            item.isPlaying = false;
            this.updatePlayingState(item.id, false);
            this.updatePlayingCounter();
        });
        
        item.audio.addEventListener('ended', () => {
            item.isPlaying = false;
            this.updatePlayingState(item.id, false);
            this.updatePlayingCounter();
        });
        
        item.audio.addEventListener('error', (e) => {
            this.handleAudioError(item.id, e);
        });

        item.audio.addEventListener('timeupdate', () => {
            this.updateProgress(item.id);
        });

        item.audio.addEventListener('loadedmetadata', () => {
            this.updateDuration(item.id);
        });
    }

    renderAudioItem(item) {
        const list = document.getElementById('audioList');
        
        const div = document.createElement('div');
        div.className = 'audio-item card';
        div.id = `audio-item-${item.id}`;
        
        div.innerHTML = `
            <div class="card-body">
                <div class="audio-header">
                    <div class="audio-name">
                        <i class="bi bi-file-music-fill text-primary me-2"></i>
                        ${this.escapeHtml(item.name)}
                    </div>
                    <div class="audio-status">
                        <span class="status-badge bg-secondary" id="status-${item.id}">
                            <i class="bi bi-pause-fill"></i> Detenido
                        </span>
                        <span class="loop-indicator" id="loop-indicator-${item.id}" style="display: none;">
                            <i class="bi bi-arrow-repeat"></i>
                        </span>
                        <span class="audio-time badge bg-light text-dark" id="time-${item.id}">0:00 / 0:00</span>
                    </div>
                </div>
                
                <div class="audio-controls">
                    <button class="btn btn-success btn-small btn-play-single" data-id="${item.id}">
                        <i class="bi bi-play-fill"></i>
                    </button>
                    <button class="btn btn-warning btn-small btn-pause-single" data-id="${item.id}">
                        <i class="bi bi-pause-fill"></i>
                    </button>
                    <button class="btn btn-danger btn-small btn-remove" data-id="${item.id}">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                    <button class="btn btn-purple btn-small btn-reset-volume" data-id="${item.id}">
                        <span>Reset volumen</span>
                    </button>
                    <div class="loop-toggle" id="loop-container-${item.id}">
                        <input type="checkbox" class="form-check-input" id="loop-${item.id}" data-id="${item.id}">
                        <label for="loop-${item.id}">
                            <span>Loop</span>
                        </label>
                    </div>
                </div>
                
                <div class="progress-container">
                    <div class="progress" data-id="${item.id}" style="cursor: pointer;">
                        <div class="progress-bar" id="progress-${item.id}" role="progressbar" style="width: 0%"></div>
                    </div>
                </div>
                
                <div class="volume-control">
                    <span class="volume-label">
                        <i class="bi bi-volume-up-fill"></i>
                    </span>
                    <input type="range" min="0" max="${MAX_VOLUME}" value="${DEFAULT_VOLUME}" 
                           data-id="${item.id}" class="form-range volume-slider">
                    <span class="volume-label volume-display" id="vol-display-${item.id}">${DEFAULT_VOLUME}%</span>
                </div>
                
                <div class="error-message" id="error-${item.id}" style="display: none;">
                    <i class="bi bi-exclamation-triangle-fill"></i>
                    <span></span>
                </div>
            </div>
        `;
        
        list.appendChild(div);
        this.attachItemEventListeners(div, item.id);
    }

    attachItemEventListeners(div, id) {
        div.querySelector('.btn-play-single').addEventListener('click', () => this.playSingle(id));
        div.querySelector('.btn-pause-single').addEventListener('click', () => this.pauseSingle(id));
        div.querySelector('.btn-remove').addEventListener('click', () => this.removeAudio(id));
        div.querySelector('.btn-reset-volume').addEventListener('click', () => this.resetVolume(id));
        div.querySelector(`#loop-${id}`).addEventListener('change', (e) => this.toggleLoop(id, e.target.checked));
        div.querySelector('.volume-slider').addEventListener('input', (e) => this.changeVolume(id, e.target.value));
        div.querySelector('.progress').addEventListener('click', (e) => this.seekAudio(id, e));
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updatePlayingState(id, isPlaying) {
        const item = document.getElementById(`audio-item-${id}`);
        const statusBadge = document.getElementById(`status-${id}`);
        const loopIndicator = document.getElementById(`loop-indicator-${id}`);
        const playBtn = item?.querySelector('.btn-play-single');
        const pauseBtn = item?.querySelector('.btn-pause-single');
        const audioData = this.audioElements.find(el => el.id === id);
        
        if (item && statusBadge) {
            item.classList.remove('playing', 'paused');
            
            if (loopIndicator && audioData) {
                if (audioData.audio.loop) {
                    loopIndicator.style.display = 'inline-flex';
                } else {
                    loopIndicator.style.display = 'none';
                }
            }
            
            if (isPlaying) {
                if (audioData && audioData.audio.loop) {
                    item.classList.add('playing', 'looping');
                    statusBadge.className = 'status-badge bg-purple';
                    statusBadge.innerHTML = '<i class="bi bi-arrow-repeat"></i> Loop';
                } else {
                    item.classList.add('playing');
                    statusBadge.className = 'status-badge bg-success';
                    statusBadge.innerHTML = '<i class="bi bi-play-fill"></i> Play';
                }
                playBtn?.classList.add('active');
                pauseBtn?.classList.remove('active');
            } else {
                if (audioData && audioData.audio.currentTime > 0 && !audioData.audio.ended) {
                    item.classList.add('paused');
                    statusBadge.className = 'status-badge bg-warning';
                    statusBadge.innerHTML = '<i class="bi bi-pause-fill"></i> Pausa';
                } else {
                    statusBadge.className = 'status-badge bg-secondary';
                    statusBadge.innerHTML = '<i class="bi bi-stop-fill"></i> Stop';
                }
                playBtn?.classList.remove('active');
                pauseBtn?.classList.add('active');
            }
        }
    }

    updatePlayingCounter() {
        const count = this.audioElements.filter(item => item.isPlaying).length;
        const counter = document.getElementById('playingCounter');
        if (counter) {
            counter.textContent = `${count} reproduciendo`;
            
            if (count > 0) {
                counter.className = 'badge bg-success ms-2';
            } else {
                counter.className = 'badge bg-primary ms-2';
            }
        }
    }

    updateProgress(id) {
        const item = this.audioElements.find(el => el.id === id);
        if (!item || !item.audio.duration) return;

        const progressBar = document.getElementById(`progress-${id}`);
        const percent = (item.audio.currentTime / item.audio.duration) * 100;
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
        }

        this.updateTimeDisplay(id);
    }

    updateDuration(id) {
        this.updateTimeDisplay(id);
    }

    updateTimeDisplay(id) {
        const item = this.audioElements.find(el => el.id === id);
        if (!item) return;

        const timeDisplay = document.getElementById(`time-${id}`);
        if (timeDisplay) {
            const current = this.formatTime(item.audio.currentTime);
            const duration = this.formatTime(item.audio.duration);
            timeDisplay.textContent = `${current} / ${duration}`;
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    seekAudio(id, e) {
        const item = this.audioElements.find(el => el.id === id);
        if (!item || !item.audio.duration) return;

        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        item.audio.currentTime = percent * item.audio.duration;
    }

    handleAudioError(id, error) {
        const item = this.audioElements.find(el => el.id === id);
        if (!item) return;

        item.hasError = true;
        const audioItem = document.getElementById(`audio-item-${id}`);
        const errorMsg = document.getElementById(`error-${id}`);
        
        if (audioItem) {
            audioItem.classList.add('error');
        }
        
        if (errorMsg) {
            errorMsg.style.display = 'flex';
            errorMsg.querySelector('span').textContent = 'Error al cargar el audio';
        }

        console.error('Error en audio:', item.name, error);
    }

    playSingle(id) {
        const item = this.audioElements.find(el => el.id === id);
        if (item && !item.hasError) {
            this.audioContext.resume().then(() => {
                item.audio.play().catch(e => {
                    console.error('Error al reproducir:', e);
                    this.showAlert('Error al reproducir el audio', 'danger');
                });
            });
        }
    }

    pauseSingle(id) {
        const item = this.audioElements.find(el => el.id === id);
        if (item) {
            item.audio.pause();
        }
    }

    removeAudio(id) {
        const index = this.audioElements.findIndex(el => el.id === id);
        if (index !== -1) {
            const item = this.audioElements[index];
            item.audio.pause();
            URL.revokeObjectURL(item.url);
            this.audioElements.splice(index, 1);
            
            const element = document.getElementById(`audio-item-${id}`);
            if (element) {
                element.remove();
            }
            
            if (this.audioElements.length === 0) {
                this.showEmptyState();
            }
            
            this.updatePlayingCounter();
        }
    }

    toggleLoop(id, checked) {
        const item = this.audioElements.find(el => el.id === id);
        const audioItem = document.getElementById(`audio-item-${id}`);
        const loopContainer = document.getElementById(`loop-container-${id}`);
        
        if (item) {
            item.audio.loop = checked;
            
            if (checked) {
                loopContainer.style.background = 'rgba(139, 92, 246, 0.1)';
                loopContainer.style.borderLeft = '3px solid var(--purple-color)';
            } else {
                audioItem.classList.remove('looping');
                loopContainer.style.background = '#f8f9fa';
                loopContainer.style.borderLeft = 'none';
            }
            
            if (item.isPlaying) {
                this.updatePlayingState(id, true);
            }
        }
    }

    changeVolume(id, value) {
        const item = this.audioElements.find(el => el.id === id);
        const display = document.getElementById(`vol-display-${id}`);
        
        if (item && display) {
            item.gainNode.gain.value = value / 100;
            display.textContent = `${value}%`;
            
            if (value > 100) {
                display.classList.add('boosted');
            } else {
                display.classList.remove('boosted');
            }
        }
    }

    resetVolume(id) {
        const item = this.audioElements.find(el => el.id === id);
        if (item) {
            const slider = document.querySelector(`.volume-slider[data-id="${id}"]`);
            if (slider) {
                slider.value = DEFAULT_VOLUME;
                this.changeVolume(id, DEFAULT_VOLUME);
            }
        }
    }

    resetAllVolumes() {
        this.audioElements.forEach(item => {
            this.resetVolume(item.id);
        });
        this.showAlert('Todos los volúmenes han sido restablecidos', 'success');
    }

    playAll() {
        this.audioContext.resume().then(() => {
            let playedCount = 0;
            this.audioElements.forEach(item => {
                if (!item.hasError) {
                    item.audio.play().catch(e => {
                        console.error('Error al reproducir:', e);
                    });
                    playedCount++;
                }
            });
            
            if (playedCount > 0) {
                this.showAlert(`Reproduciendo ${playedCount} audio(s)`, 'success');
            }
        });
    }

    pauseAll() {
        let pausedCount = 0;
        this.audioElements.forEach(item => {
            if (item.isPlaying) {
                item.audio.pause();
                pausedCount++;
            }
        });
        
        if (pausedCount > 0) {
            this.showAlert(`${pausedCount} audio(s) pausado(s)`, 'warning');
        }
    }

    stopAll() {
        let stoppedCount = 0;
        this.audioElements.forEach(item => {
            if (!item.audio.paused || item.audio.currentTime > 0) {
                item.audio.pause();
                item.audio.currentTime = 0;
                stoppedCount++;
            }
        });
        
        if (stoppedCount > 0) {
            this.showAlert(`${stoppedCount} audio(s) detenido(s)`, 'danger');
        }
    }

    togglePlayPauseAll() {
        const anyPlaying = this.audioElements.some(item => !item.audio.paused);
        if (anyPlaying) {
            this.pauseAll();
        } else {
            this.playAll();
        }
    }

    filterAudios() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        let visibleCount = 0;
        
        this.audioElements.forEach(item => {
            const audioItem = document.getElementById(`audio-item-${item.id}`);
            if (audioItem) {
                if (item.name.toLowerCase().includes(searchTerm)) {
                    audioItem.style.display = 'block';
                    visibleCount++;
                } else {
                    audioItem.style.display = 'none';
                }
            }
        });
        
        if (visibleCount === 0 && searchTerm !== '') {
            this.showEmptyState('No se encontraron audios con ese nombre');
        } else if (this.audioElements.length > 0) {
            this.hideEmptyState();
        }
    }

    showEmptyState(message = 'No hay audios cargados') {
        const list = document.getElementById('audioList');
        const emptyState = list.querySelector('.empty-state');
        
        if (!emptyState) {
            const div = document.createElement('div');
            div.className = 'empty-state text-center py-5';
            div.innerHTML = `
                <i class="bi bi-music-note-beamed display-1 text-white-50"></i>
                <h4 class="text-white mt-3">${message}</h4>
                <p class="text-white-50">Selecciona archivos de audio para comenzar</p>
            `;
            list.appendChild(div);
        } else {
            emptyState.querySelector('h4').textContent = message;
            emptyState.style.display = 'block';
        }
    }

    hideEmptyState() {
        const list = document.getElementById('audioList');
        const emptyState = list.querySelector('.empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }

    showAlert(message, type = 'info') {
        let alertContainer = document.getElementById('alertContainer');
        if (!alertContainer) {
            alertContainer = document.createElement('div');
            alertContainer.id = 'alertContainer';
            alertContainer.style.position = 'fixed';
            alertContainer.style.top = '20px';
            alertContainer.style.right = '20px';
            alertContainer.style.zIndex = '9999';
            alertContainer.style.maxWidth = '400px';
            document.body.appendChild(alertContainer);
        }

        const alert = document.createElement('div');
        alert.className = `alert alert-${type} alert-dismissible fade show`;
        alert.setAttribute('role', 'alert');
        alert.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        
        const icon = this.getAlertIcon(type);
        alert.innerHTML = `
            <i class="bi ${icon} me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

        alertContainer.appendChild(alert);

        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 150);
        }, 2000);
    }

    getAlertIcon(type) {
        const icons = {
            'success': 'bi-check-circle-fill',
            'danger': 'bi-x-circle-fill',
            'warning': 'bi-exclamation-triangle-fill',
            'info': 'bi-info-circle-fill'
        };
        return icons[type] || icons['info'];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const audioManager = new AudioManager();
});