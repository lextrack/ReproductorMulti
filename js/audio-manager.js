import { DEFAULT_VOLUME } from './constants.js';
import { Utils } from './utils.js';
import { GroupManager } from './group-manager.js';
import { BackupManager } from './backup-manager.js';
import { AudioPlayer } from './audio-player.js';
import { UIRenderer } from './ui-renderer.js';
import { FilterManager } from './filter-manager.js';

export class AudioManager {
    constructor() {
        this.audioElements = [];
        this.audioId = 0;
        this.audioContext = null;
        this.masterGainNode = null;
        this.playingCount = 0;
        
        this.groupManager = new GroupManager(this);
        this.backupManager = new BackupManager(this);
        this.audioPlayer = new AudioPlayer(this);
        this.uiRenderer = new UIRenderer(this);
        this.filterManager = new FilterManager(this);
        
        this.initAudioContext();
        this.setupEventListeners();
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
        document.getElementById('searchInput').addEventListener('input', () => this.filterManager.applyFilters());
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

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT') return;
            
            if (e.code === 'Space') {
                e.preventDefault();
                this.audioPlayer.togglePlayPauseAll();
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
            this.uiRenderer.updateProgress(item.id);
            if (item.isPlaying) {
                this.uiRenderer.updateHistoryTime(item.id);
            }
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
