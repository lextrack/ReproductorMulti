import { Utils } from './utils.js';
import { MAX_VOLUME, DEFAULT_VOLUME } from './constants.js';

export class UIRenderer {
    constructor(audioManager) {
        this.audioManager = audioManager;
    }

    renderAudioItem(item) {
        let container;
        
        if (item.groupId !== null && item.groupId !== undefined) {
            const group = this.audioManager.groupManager.getGroup(item.groupId);
            if (group) {
                this.audioManager.groupManager.renderGroupSection(group);
                container = document.getElementById(`group-content-${item.groupId}`);
            }
        }
        
        if (!container) {
            let ungroupedSection = document.getElementById('ungrouped-section');
            if (!ungroupedSection) {
                ungroupedSection = this.createUngroupedSection();
            }
            container = document.getElementById('ungrouped-content');
        }
        
        const div = document.createElement('div');
        div.className = 'audio-item card';
        div.id = `audio-item-${item.id}`;
        
        const groupOptions = this.audioManager.groupManager.getAllGroups().map(g => 
            `<option value="${g.id}" ${item.groupId === g.id ? 'selected' : ''}>${Utils.escapeHtml(g.name)}</option>`
        ).join('');
        
        div.innerHTML = `
            <div class="card-body">
                <div class="audio-header">
                    <div class="audio-name">
                        <i class="bi bi-file-music-fill text-primary me-2"></i>
                        ${Utils.escapeHtml(item.name)}
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
                    <button class="btn btn-secondary btn-small btn-mute" data-id="${item.id}" title="Mute">
                        <i class="bi bi-volume-mute"></i>
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
                    <div class="audio-group-selector">
                        <i class="bi bi-folder"></i>
                        <select class="group-selector" data-id="${item.id}">
                            <option value="">Sin grupo</option>
                            ${groupOptions}
                        </select>
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
        
        container.appendChild(div);
        this.attachItemEventListeners(div, item.id);
    }

    attachItemEventListeners(div, id) {
        div.querySelector('.btn-play-single').addEventListener('click', () => this.audioManager.audioPlayer.playSingle(id));
        div.querySelector('.btn-pause-single').addEventListener('click', () => this.audioManager.audioPlayer.pauseSingle(id));
        div.querySelector('.btn-remove').addEventListener('click', () => this.audioManager.audioPlayer.removeAudio(id));
        div.querySelector('.btn-mute').addEventListener('click', () => this.audioManager.toggleMute(id));
        div.querySelector('.btn-reset-volume').addEventListener('click', () => this.audioManager.audioPlayer.resetVolume(id));
        div.querySelector(`#loop-${id}`).addEventListener('change', (e) => this.audioManager.toggleLoop(id, e.target.checked));
        div.querySelector('.volume-slider').addEventListener('input', (e) => this.audioManager.changeVolume(id, e.target.value));
        div.querySelector('.progress').addEventListener('click', (e) => this.audioManager.audioPlayer.seekAudio(id, e));
        
        const groupSelector = div.querySelector('.group-selector');
        if (groupSelector) {
            groupSelector.addEventListener('change', (e) => this.audioManager.changeAudioGroup(id, e.target.value));
        }
    }

    createUngroupedSection() {
        const list = document.getElementById('audioList');
        const section = document.createElement('div');
        section.className = 'group-section';
        section.id = 'ungrouped-section';
        
        section.innerHTML = `
            <div class="group-header" data-group-id="ungrouped">
                <div class="group-header-left">
                    <i class="bi bi-chevron-down group-collapse-icon"></i>
                    <h5 class="group-title">
                        <i class="bi bi-music-note-list"></i>
                        Sin agrupar
                    </h5>
                </div>
                <div class="group-info">
                    <span class="badge bg-secondary group-badge" id="ungrouped-badge">0 audio(s)</span>
                </div>
            </div>
            <div class="group-content" id="ungrouped-content">
            </div>
        `;
        
        const header = section.querySelector('.group-header');
        header.addEventListener('click', () => {
            const content = document.getElementById('ungrouped-content');
            const icon = header.querySelector('.group-collapse-icon');
            
            header.classList.toggle('collapsed');
            content.classList.toggle('collapsed');
        });
        
        list.appendChild(section);
        this.audioManager.updateUngroupedCount();
        return section;
    }

    updatePlayingState(id, isPlaying) {
        const item = document.getElementById(`audio-item-${id}`);
        const statusBadge = document.getElementById(`status-${id}`);
        const loopIndicator = document.getElementById(`loop-indicator-${id}`);
        const playBtn = item?.querySelector('.btn-play-single');
        const pauseBtn = item?.querySelector('.btn-pause-single');
        const audioData = this.audioManager.audioElements.find(el => el.id === id);
        
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
                    statusBadge.innerHTML = '<i class="bi bi-play-fill"></i> Reproduciendo';
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
                    statusBadge.innerHTML = '<i class="bi bi-stop-fill"></i> Detenido';
                }
                playBtn?.classList.remove('active');
                pauseBtn?.classList.add('active');
            }
        }
    }

    updatePlayingCounter() {
        const count = this.audioManager.audioElements.filter(item => item.isPlaying).length;
        const counter = document.getElementById('playingCounter');
        if (counter) {
            counter.textContent = `${count} reproduciendo`;
            
            if (count > 0) {
                counter.className = 'badge bg-success ms-2';
            } else {
                counter.className = 'badge bg-secondary ms-2';
            }
        }
    }

    updateProgress(id) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
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
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (!item) return;

        const timeDisplay = document.getElementById(`time-${id}`);
        if (timeDisplay) {
            const current = Utils.formatDuration(item.audio.currentTime);
            const duration = Utils.formatDuration(item.audio.duration);
            timeDisplay.textContent = `${current} / ${duration}`;
        }
    }

    updateHistory() {
        const historyList = document.getElementById('historyList');
        const historyCounter = document.getElementById('historyCounter');
        const playingAudios = this.audioManager.audioElements.filter(item => item.isPlaying);
        
        historyCounter.textContent = playingAudios.length;
        
        if (playingAudios.length === 0) {
            historyList.innerHTML = `
                <div class="history-empty">
                    <i class="bi bi-music-note-beamed"></i>
                    <p>Ningún audio reproduciéndose</p>
                </div>
            `;
        } else {
            historyList.innerHTML = '';
            playingAudios.forEach(item => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.id = `history-item-${item.id}`;
                
                const muteIndicator = item.isMuted ? '<i class="bi bi-volume-mute-fill text-danger ms-1"></i>' : '';
                
                historyItem.innerHTML = `
                    <div class="history-item-name">
                        ${Utils.escapeHtml(item.name)}
                        ${muteIndicator}
                    </div>
                    <div class="history-item-time">
                        <i class="bi bi-clock"></i>
                        <span id="history-time-${item.id}">${Utils.formatDuration(item.audio.currentTime)}</span>
                    </div>
                `;
                
                historyItem.addEventListener('click', () => this.scrollToAudio(item.id));
                historyList.appendChild(historyItem);
            });
        }
    }

    updateHistoryTime(id) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (!item) return;
        
        const historyTime = document.getElementById(`history-time-${item.id}`);
        if (historyTime) {
            historyTime.textContent = Utils.formatDuration(item.audio.currentTime);
        }
    }

    scrollToAudio(id) {
        const audioItem = document.getElementById(`audio-item-${id}`);
        if (audioItem) {
            const rect = audioItem.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - (window.innerHeight / 2) + (rect.height / 2);
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
            
            audioItem.classList.add('highlight');
            setTimeout(() => {
                audioItem.classList.remove('highlight');
            }, 1500);
        }
    }

    showEmptyState(message = 'No hay audios cargados') {
        const list = document.getElementById('audioList');
        let emptyState = list.querySelector('.empty-state');
        
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
            const h4 = emptyState.querySelector('h4');
            if (h4) {
                h4.textContent = message;
            }
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
}