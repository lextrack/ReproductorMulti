import { DEFAULT_VOLUME } from './constants.js';
import { Utils } from './utils.js';
import { GroupManager } from './group-manager.js';
import { BackupManager } from './backup-manager.js';
import { AudioPlayer } from './audio-player.js';
import { UIRenderer } from './ui-renderer.js';
import { FilterManager } from './filter-manager.js';

const SEARCH_DEBOUNCE_MS = 120;
const TIME_UPDATE_INTERVAL_MS = 150;
const COMMAND_MAX_RESULTS = 8;

export class AudioManager {
    constructor() {
        this.audioElements = [];
        this.audioId = 0;
        this.audioContext = null;
        this.masterGainNode = null;
        this.playingCount = 0;
        this.searchDebounceTimer = null;
        this.focusedAudioId = null;
        this.compactMode = false;
        this.commandPaletteOpen = false;
        this.commandPaletteSelection = 0;
        this.commandPaletteActions = [];
        
        this.groupManager = new GroupManager(this);
        this.backupManager = new BackupManager(this);
        this.audioPlayer = new AudioPlayer(this);
        this.uiRenderer = new UIRenderer(this);
        this.filterManager = new FilterManager(this);
        
        this.initAudioContext();
        this.setupEventListeners();
        this.setupQuickActionsBar();
        this.setupCommandPalette();
        this.setupKeyboardShortcuts();
        this.setupMasterVolume();
        this.uiRenderer.hideEmptyState();
    }

    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.connect(this.audioContext.destination);
            this.masterGainNode.gain.value = 1.0;
        } catch (e) {
            console.error('Web Audio API no soportada:', e);
            Utils.showAlert('Tu navegador no soporta Web Audio API', 'danger');
        }
    }

    setupMasterVolume() {
        const masterSlider = document.getElementById('masterVolumeSlider');
        const masterDisplay = document.getElementById('masterVolumeDisplay');
        
        if (masterSlider && masterDisplay) {
            masterSlider.addEventListener('input', (e) => {
                const value = parseFloat(e.target.value);
                this.masterGainNode.gain.value = value / 100;
                masterDisplay.textContent = `${value}%`;
            });
        }
    }

    setupEventListeners() {
        document.getElementById('audioFile').addEventListener('change', (e) => this.audioPlayer.handleFileInput(e));
        document.getElementById('searchInput').addEventListener('input', () => {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = setTimeout(() => {
                this.filterManager.applyFilters();
            }, SEARCH_DEBOUNCE_MS);
        });
        document.getElementById('playAllBtn').addEventListener('click', () => this.audioPlayer.playAll());
        document.getElementById('pauseAllBtn').addEventListener('click', () => this.audioPlayer.pauseAll());
        document.getElementById('stopAllBtn').addEventListener('click', () => this.audioPlayer.stopAll());
        document.getElementById('resetAllVolumes').addEventListener('click', () => this.audioPlayer.resetAllVolumes());
        document.getElementById('createGroupBtn').addEventListener('click', () => this.createGroup());
        document.getElementById('newGroupName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createGroup();
        });
        document.getElementById('exportBackupBtn').addEventListener('click', () => this.backupManager.exportBackup());
        document.getElementById('importBackupBtn').addEventListener('click', () => {
            document.getElementById('backupFile').click();
        });
        document.getElementById('backupFile').addEventListener('change', (e) => this.backupManager.importBackup(e));
        document.getElementById('resetFactoryBtn').addEventListener('click', () => this.backupManager.resetFactory());
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.filterManager.handleFilterClick(e));
        });
    }

    setupQuickActionsBar() {
        document.getElementById('quickPlayPauseBtn')?.addEventListener('click', () => this.audioPlayer.togglePlayPauseAll());
        document.getElementById('quickStopBtn')?.addEventListener('click', () => this.audioPlayer.stopAll());
        document.getElementById('quickMuteAllBtn')?.addEventListener('click', () => this.toggleMuteAll());
        document.getElementById('quickFilterPlayingBtn')?.addEventListener('click', () => this.filterManager.setFilter('playing'));
        document.getElementById('quickCompactBtn')?.addEventListener('click', () => this.toggleCompactMode());
        document.getElementById('quickCommandPaletteBtn')?.addEventListener('click', () => this.openCommandPalette());
    }

    setupCommandPalette() {
        this.commandPaletteBackdrop = document.getElementById('commandPaletteBackdrop');
        this.commandPaletteInput = document.getElementById('commandPaletteInput');
        this.commandPaletteResults = document.getElementById('commandPaletteResults');

        if (!this.commandPaletteBackdrop || !this.commandPaletteInput || !this.commandPaletteResults) return;

        this.commandPaletteBackdrop.addEventListener('click', (e) => {
            if (e.target === this.commandPaletteBackdrop) {
                this.closeCommandPalette();
            }
        });

        this.commandPaletteInput.addEventListener('input', (e) => {
            this.renderCommandPaletteResults(e.target.value.trim());
        });

        this.commandPaletteInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (this.commandPaletteActions.length === 0) return;
                this.commandPaletteSelection = (this.commandPaletteSelection + 1) % this.commandPaletteActions.length;
                this.renderCommandPaletteResults(this.commandPaletteInput.value.trim());
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (this.commandPaletteActions.length === 0) return;
                this.commandPaletteSelection = (this.commandPaletteSelection - 1 + this.commandPaletteActions.length) % this.commandPaletteActions.length;
                this.renderCommandPaletteResults(this.commandPaletteInput.value.trim());
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                this.executeCommandPaletteAction(this.commandPaletteSelection);
                return;
            }

            if (e.key === 'Escape') {
                e.preventDefault();
                this.closeCommandPalette();
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.openCommandPalette();
                return;
            }

            if (this.commandPaletteOpen) {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    this.closeCommandPalette();
                }
                return;
            }

            const target = e.target;
            const isEditableElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
            if (isEditableElement) return;
            
            if (e.code === 'Space') {
                e.preventDefault();
                this.audioPlayer.togglePlayPauseAll();
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.focusRelativeAudio(1);
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.focusRelativeAudio(-1);
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                this.controlFocusedAudio('playPause');
                return;
            }

            if (e.key.toLowerCase() === 'm') {
                e.preventDefault();
                this.controlFocusedAudio('mute');
                return;
            }

            if (e.key.toLowerCase() === 'l') {
                e.preventDefault();
                this.controlFocusedAudio('loop');
            }
        });
    }

    createGroup() {
        const input = document.getElementById('newGroupName');
        const name = input.value.trim();
        
        const group = this.groupManager.createGroup(name);
        if (group) {
            input.value = '';
        }
    }

    addAudio(file, groupId = null) {
        const id = this.audioId++;
        const url = URL.createObjectURL(file);
        const audio = new Audio(url);
        
        try {
            const source = this.audioContext.createMediaElementSource(audio);
            const gainNode = this.audioContext.createGain();
            
            source.connect(gainNode);
            gainNode.connect(this.masterGainNode);
            
            const audioItem = {
                id: id,
                audio: audio,
                element: audio,
                name: file.name,
                file: file,
                url: url,
                gainNode: gainNode,
                source: source,
                hasError: false,
                isPlaying: false,
                groupId: groupId,
                isMuted: false,
                originalVolume: DEFAULT_VOLUME
            };

            this.setupAudioEventListeners(audioItem);
            this.audioElements.push(audioItem);
            this.uiRenderer.renderAudioItem(audioItem);

            if (this.focusedAudioId === null) {
                this.setFocusedAudio(audioItem.id);
            }
            
            if (groupId !== null && groupId !== undefined) {
                this.groupManager.updateGroupCount(groupId);
            } else {
                this.updateUngroupedCount();
            }
        } catch (e) {
            console.error('Error al crear audio:', e);
            Utils.showAlert('Error al cargar el audio: ' + file.name, 'danger');
        }
    }

    setupAudioEventListeners(item) {
        item.audio.addEventListener('play', () => {
            this.audioContext.resume();
            item.isPlaying = true;
            this.updatePlayingState(item.id, true);
            this.uiRenderer.updatePlayingCounter();
            this.uiRenderer.updateHistory();
            this.filterManager.applyFilters();
        });
        
        item.audio.addEventListener('pause', () => {
            item.isPlaying = false;
            this.updatePlayingState(item.id, false);
            this.uiRenderer.updatePlayingCounter();
            this.uiRenderer.updateHistory();
            this.filterManager.applyFilters();
        });
        
        item.audio.addEventListener('ended', () => {
            item.isPlaying = false;
            this.updatePlayingState(item.id, false);
            this.uiRenderer.updatePlayingCounter();
            this.uiRenderer.updateHistory();
            this.filterManager.applyFilters();
        });
        
        item.audio.addEventListener('error', (e) => {
            this.audioPlayer.handleAudioError(item.id, e);
        });

        item.audio.addEventListener('timeupdate', () => {
            if (item._timeUpdateRafId) return;

            item._timeUpdateRafId = requestAnimationFrame(() => {
                item._timeUpdateRafId = null;

                const now = performance.now();
                if (now - (item._lastTimeUiUpdate || 0) < TIME_UPDATE_INTERVAL_MS) return;
                item._lastTimeUiUpdate = now;

                this.uiRenderer.updateProgress(item.id);
                if (item.isPlaying) {
                    this.uiRenderer.updateHistoryTime(item.id);
                }
            });
        });

        item.audio.addEventListener('loadedmetadata', () => {
            this.uiRenderer.updateDuration(item.id);
        });
    }

    changeAudioGroup(audioId, newGroupId) {
        const item = this.audioElements.find(el => el.id === audioId);
        if (!item) return;

        const oldGroupId = item.groupId;
        item.groupId = newGroupId === '' ? null : parseInt(newGroupId);

        const audioElement = document.getElementById(`audio-item-${audioId}`);
        if (audioElement) {
            audioElement.remove();
            this.uiRenderer.renderAudioItem(item);
        }

        if (oldGroupId !== null && oldGroupId !== undefined) {
            this.groupManager.updateGroupCount(oldGroupId);
        } else {
            this.updateUngroupedCount();
        }
        
        if (item.groupId !== null && item.groupId !== undefined) {
            this.groupManager.updateGroupCount(item.groupId);
        } else {
            this.updateUngroupedCount();
        }

        this.filterManager.applyFilters();
    }

    openCommandPalette() {
        if (!this.commandPaletteBackdrop || !this.commandPaletteInput) return;
        this.commandPaletteOpen = true;
        this.commandPaletteBackdrop.classList.add('visible');
        this.commandPaletteInput.value = '';
        this.commandPaletteSelection = 0;
        this.renderCommandPaletteResults('');
        this.commandPaletteInput.focus();
    }

    closeCommandPalette() {
        if (!this.commandPaletteBackdrop) return;
        this.commandPaletteOpen = false;
        this.commandPaletteBackdrop.classList.remove('visible');
    }

    renderCommandPaletteResults(query) {
        if (!this.commandPaletteResults) return;

        const normalizedQuery = query.toLowerCase();
        const staticActions = [
            { label: 'Reproducir todo', run: () => this.audioPlayer.playAll() },
            { label: 'Pausar todo', run: () => this.audioPlayer.pauseAll() },
            { label: 'Detener todo', run: () => this.audioPlayer.stopAll() },
            { label: 'Mutear/desmutear todo', run: () => this.toggleMuteAll() },
            { label: 'Filtrar: reproduciendo', run: () => this.filterManager.setFilter('playing') },
            { label: 'Filtrar: todos', run: () => this.filterManager.setFilter('all') },
            { label: this.compactMode ? 'Desactivar modo compacto' : 'Activar modo compacto', run: () => this.toggleCompactMode() }
        ];

        const audioActions = this.audioElements.map(item => ({
            label: `Ir a: ${item.name}`,
            run: () => this.setFocusedAudio(item.id, { scroll: true })
        }));

        this.commandPaletteActions = [...staticActions, ...audioActions].filter(action => action.label.toLowerCase().includes(normalizedQuery)).slice(0, COMMAND_MAX_RESULTS);

        if (this.commandPaletteActions.length === 0) {
            this.commandPaletteSelection = 0;
            this.commandPaletteResults.innerHTML = '<div class="command-item-empty">Sin resultados</div>';
            return;
        }

        if (this.commandPaletteSelection >= this.commandPaletteActions.length) {
            this.commandPaletteSelection = 0;
        }

        this.commandPaletteResults.innerHTML = '';
        this.commandPaletteActions.forEach((action, index) => {
            const item = document.createElement('button');
            item.type = 'button';
            item.className = `command-item ${index === this.commandPaletteSelection ? 'active' : ''}`;
            item.textContent = action.label;
            item.addEventListener('click', () => this.executeCommandPaletteAction(index));
            this.commandPaletteResults.appendChild(item);
        });
    }

    executeCommandPaletteAction(index) {
        const action = this.commandPaletteActions[index];
        if (!action) return;
        action.run();
        this.closeCommandPalette();
    }

    updateUngroupedCount() {
        const badge = document.getElementById('ungrouped-badge');
        if (badge) {
            const count = this.audioElements.filter(a => a.groupId === null || a.groupId === undefined).length;
            badge.textContent = `${count} audio(s)`;
        }
    }

    updatePlayingState(id, isPlaying) {
        this.uiRenderer.updatePlayingState(id, isPlaying);
    }

    updatePlayingCounter() {
        this.uiRenderer.updatePlayingCounter();
    }

    updateHistory() {
        this.uiRenderer.updateHistory();
    }

    renderAudioItem(item) {
        this.uiRenderer.renderAudioItem(item);
    }

    applyFilters() {
        this.filterManager.applyFilters();
    }

    applyMute() {
        this.audioPlayer.applyMute();
    }

    toggleMuteAll() {
        if (this.audioElements.length === 0) return;
        const allMuted = this.audioElements.every(item => item.isMuted);
        this.audioElements.forEach(item => {
            if (item.isMuted !== !allMuted) {
                this.audioPlayer.toggleMute(item.id);
            }
        });
    }

    toggleCompactMode(forceState = null) {
        this.compactMode = forceState === null ? !this.compactMode : Boolean(forceState);
        document.body.classList.toggle('compact-mode', this.compactMode);

        const compactBtn = document.getElementById('quickCompactBtn');
        if (compactBtn) {
            compactBtn.classList.toggle('active', this.compactMode);
            compactBtn.innerHTML = this.compactMode
                ? '<i class="bi bi-layout-text-window"></i> Vista normal'
                : '<i class="bi bi-layout-text-window-reverse"></i> Modo compacto';
        }
    }

    setFocusedAudio(id, options = {}) {
        const { scroll = false } = options;
        const targetElement = document.getElementById(`audio-item-${id}`);
        if (!targetElement) return;

        if (this.focusedAudioId !== null) {
            const previous = document.getElementById(`audio-item-${this.focusedAudioId}`);
            previous?.classList.remove('keyboard-focused');
        }

        this.focusedAudioId = id;
        targetElement.classList.add('keyboard-focused');

        if (scroll) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    focusRelativeAudio(direction) {
        const visibleIds = Array.from(document.querySelectorAll('#audioList .audio-item'))
            .filter(el => getComputedStyle(el).display !== 'none')
            .map(el => parseInt(el.id.replace('audio-item-', ''), 10))
            .filter(id => !Number.isNaN(id));

        if (visibleIds.length === 0) return;

        const currentIndex = visibleIds.indexOf(this.focusedAudioId);
        const nextIndex = currentIndex === -1
            ? 0
            : (currentIndex + direction + visibleIds.length) % visibleIds.length;

        this.setFocusedAudio(visibleIds[nextIndex], { scroll: true });
    }

    controlFocusedAudio(action) {
        if (this.focusedAudioId === null) return;

        const item = this.audioElements.find(el => el.id === this.focusedAudioId);
        if (!item) return;

        if (action === 'playPause') {
            if (item.isPlaying) {
                this.audioPlayer.pauseSingle(item.id);
            } else {
                this.audioPlayer.playSingle(item.id);
            }
            return;
        }

        if (action === 'mute') {
            this.audioPlayer.toggleMute(item.id);
            return;
        }

        if (action === 'loop') {
            const nextLoopState = !item.audio.loop;
            const loopCheckbox = document.getElementById(`loop-${item.id}`);
            if (loopCheckbox) {
                loopCheckbox.checked = nextLoopState;
            }
            this.audioPlayer.toggleLoop(item.id, nextLoopState);
        }
    }

    onAudioRemoved(id) {
        if (this.focusedAudioId !== id) return;

        const visibleIds = Array.from(document.querySelectorAll('#audioList .audio-item'))
            .map(el => parseInt(el.id.replace('audio-item-', ''), 10))
            .filter(audioId => !Number.isNaN(audioId));

        if (visibleIds.length === 0) {
            this.focusedAudioId = null;
            return;
        }

        this.setFocusedAudio(visibleIds[0]);
    }

    showEmptyState(message) {
        this.uiRenderer.showEmptyState(message);
    }

    hideEmptyState() {
        this.uiRenderer.hideEmptyState();
    }

    playAudio(id) {
        this.audioPlayer.playSingle(id);
    }

    pauseAudio(id) {
        this.audioPlayer.pauseSingle(id);
    }

    stopAudio(id) {
        const item = this.audioElements.find(el => el.id === id);
        if (item) {
            item.audio.pause();
            item.audio.currentTime = 0;
        }
    }

    changeVolume(id, value) {
        this.audioPlayer.changeVolume(id, value);
    }

    toggleLoop(id, checked) {
        this.audioPlayer.toggleLoop(id, checked);
    }

    toggleMute(id) {
        this.audioPlayer.toggleMute(id);
    }
}
