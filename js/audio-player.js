import { Utils } from './utils.js';
import { MAX_FILE_SIZE, DEFAULT_VOLUME } from './constants.js';

const FADE_DURATION_SECONDS = 0.3;
const FADE_DURATION_MS = Math.round(FADE_DURATION_SECONDS * 1000);

export class AudioPlayer {
    constructor(audioManager) {
        this.audioManager = audioManager;
    }

    cancelPendingPause(item) {
        if (item._fadeTimer) {
            clearTimeout(item._fadeTimer);
            item._fadeTimer = null;
        }
    }

    fadeAndPause(item, reset = false) {
        if (item.audio.paused && !reset) return false;
        this.cancelPendingPause(item);
        const currentTime = this.audioManager.audioContext.currentTime;
        item.gainNode.gain.cancelScheduledValues(currentTime);
        item.gainNode.gain.setValueAtTime(item.gainNode.gain.value, currentTime);
        item.gainNode.gain.linearRampToValueAtTime(0.01, currentTime + FADE_DURATION_SECONDS);
        item._fadeTimer = setTimeout(() => {
            item._fadeTimer = null;
            item.audio.pause();
            if (reset) item.audio.currentTime = 0;
        }, FADE_DURATION_MS);
        return true;
    }

    validateFile(file) {
        if (!file.type.startsWith('audio/')) {
            Utils.showAlert(`"${file.name}" no es un archivo de audio válido`, 'warning');
            return false;
        }
        
        if (file.size > MAX_FILE_SIZE) {
            Utils.showAlert(`"${file.name}" es demasiado grande (máx. 100MB)`, 'warning');
            return false;
        }
        
        return true;
    }

    handleFileInput(e) {
        const files = e.target.files;
        if (files.length > 0) {
            this.audioManager.hideEmptyState();
        }
        
        for (let file of files) {
            if (this.validateFile(file)) {
                this.audioManager.addAudio(file);
            }
        }
        e.target.value = '';
    }

    playSingle(id) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (item && !item.hasError && this.audioManager.audioContext) {
            this.cancelPendingPause(item);
            this.audioManager.audioContext.resume().then(() => {
                this.cancelPendingPause(item);
                const slider = document.querySelector(`.volume-slider[data-id="${id}"]`);
                const sliderValue = slider ? parseFloat(slider.value) : item.volume;
                const targetVolume = item.isMuted ? 0 : (sliderValue / 100);
                
                const currentTime = this.audioManager.audioContext.currentTime;
                
                item.gainNode.gain.cancelScheduledValues(currentTime);

                item.gainNode.gain.setValueAtTime(0.01, currentTime);
                item.gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + FADE_DURATION_SECONDS);
                
                item.audio.play().catch(e => {
                    console.error('Error al reproducir:', e);
                    Utils.showAlert('Error al reproducir el audio', 'danger');
                });
            }).catch(() => Utils.showAlert('No se pudo activar el audio en este navegador', 'danger'));
        }
    }

    pauseSingle(id) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (item && this.audioManager.audioContext) this.fadeAndPause(item);
    }

    stopSingle(id) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (item && this.audioManager.audioContext) this.fadeAndPause(item, true);
    }

    playAll() {
        if (!this.audioManager.audioContext) return;
        this.audioManager.groupManager.stopAllPlaylists();
        this.audioManager.audioContext.resume().then(() => {
            let playedCount = 0;
            const currentTime = this.audioManager.audioContext.currentTime;
            
            this.audioManager.audioElements.forEach(item => {
                if (!item.hasError) {
                    this.cancelPendingPause(item);
                    const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
                    const sliderValue = slider ? parseFloat(slider.value) : item.volume;
                    const targetVolume = item.isMuted ? 0 : (sliderValue / 100);
                    
                    item.gainNode.gain.cancelScheduledValues(currentTime);
                    
                    item.gainNode.gain.setValueAtTime(0.01, currentTime);
                    item.gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + FADE_DURATION_SECONDS);
                    
                    item.audio.play().catch(e => {
                        console.error('Error al reproducir:', e);
                    });
                    playedCount++;
                }
            });
            
            if (playedCount > 0) {
                Utils.showAlert(`Reproduciendo ${playedCount} audio(s)`, 'success');
            }
        }).catch(() => Utils.showAlert('No se pudo activar el audio en este navegador', 'danger'));
    }

    pauseAll() {
        let pausedCount = 0;
        this.audioManager.audioElements.forEach(item => {
            if (item.isPlaying) {
                if (this.fadeAndPause(item)) pausedCount++;
            }
        });
        
        if (pausedCount > 0) {
            Utils.showAlert(`${pausedCount} audio(s) pausado(s)`, 'warning');
        }
    }

    stopAll() {
        this.audioManager.groupManager.stopAllPlaylists();
        let stoppedCount = 0;
        
        this.audioManager.audioElements.forEach(item => {
            if (!item.audio.paused || item.audio.currentTime > 0) {
                if (this.fadeAndPause(item, true)) stoppedCount++;
            }
        });
        
        if (stoppedCount > 0) {
            Utils.showAlert(`${stoppedCount} audio(s) detenido(s)`, 'danger');
        }
    }

    togglePlayPauseAll() {
        const anyPlaying = this.audioManager.audioElements.some(item => !item.audio.paused);
        if (anyPlaying) {
            this.pauseAll();
        } else {
            this.playAll();
        }
    }

    seekAudio(id, e) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (!item || !item.audio.duration) return;

        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        item.audio.currentTime = percent * item.audio.duration;
    }

    toggleLoop(id, checked) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        const audioItem = document.getElementById(`audio-item-${id}`);
        const loopContainer = document.getElementById(`loop-container-${id}`);
        
        if (item) {
            item.audio.loop = checked;
            
            if (checked) {
                loopContainer.style.background = 'rgba(139, 92, 246, 0.1)';
                loopContainer.style.borderLeft = '3px solid var(--purple-color)';
            } else {
                audioItem.classList.remove('looping');
                loopContainer.style.background = '#bbb7b773';
                loopContainer.style.borderLeft = 'none';
            }
            
            if (item.isPlaying) {
                this.audioManager.updatePlayingState(id, true);
            }
            
            this.audioManager.applyFilters();
        }
    }

    changeVolume(id, value) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        const display = document.getElementById(`vol-display-${id}`);
        
        if (item) {
            item.volume = Number(value);
            item.gainNode.gain.value = item.isMuted ? 0 : item.volume / 100;
            if (display) display.textContent = `${item.volume}%`;
            
            if (item.volume > 100) {
                display?.classList.add('boosted');
            } else {
                display?.classList.remove('boosted');
            }
        }
    }

    resetVolume(id) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (item) {
            const slider = document.querySelector(`.volume-slider[data-id="${id}"]`);
            if (slider) {
                slider.value = DEFAULT_VOLUME;
                this.changeVolume(id, DEFAULT_VOLUME);
            }
        }
    }

    resetAllVolumes() {
        this.audioManager.audioElements.forEach(item => {
            this.resetVolume(item.id);
        });
        Utils.showAlert('Todos los volúmenes han sido restablecidos', 'success');
    }

    toggleMute(id) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
        if (!item) return;

        const btn = document.querySelector(`.btn-mute[data-id="${id}"]`);
        
        item.isMuted = !item.isMuted;
        
        if (item.isMuted) {
            btn.classList.add('active');
            btn.innerHTML = '<i class="bi bi-volume-mute-fill"></i>';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<i class="bi bi-volume-mute"></i>';
        }

        this.audioManager.applyMute();
        this.audioManager.updateHistory();
    }

    applyMute() {
        this.audioManager.audioElements.forEach(item => {
            if (item.isMuted) {
                item.gainNode.gain.value = 0;
            } else {
                const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
                const volume = slider ? slider.value : item.volume;
                item.gainNode.gain.value = volume / 100;
            }
        });
    }

    removeAudio(id) {
        const index = this.audioManager.audioElements.findIndex(el => el.id === id);
        if (index !== -1) {
            const item = this.audioManager.audioElements[index];
            const groupId = item.groupId;
            this.audioManager.groupManager.stopPlaylist(groupId);
            this.cancelPendingPause(item);
            
            item.audio.pause();
            if (item._playlistEndedHandler) {
                item.audio.removeEventListener('ended', item._playlistEndedHandler);
                delete item._playlistEndedHandler;
            }
            if (item._timeUpdateRafId) {
                cancelAnimationFrame(item._timeUpdateRafId);
                item._timeUpdateRafId = null;
            }
            try {
                item.source?.disconnect();
                item.gainNode?.disconnect();
            } catch (e) {
                console.warn('No se pudieron desconectar nodos de audio:', e);
            }
            item.audio.removeAttribute('src');
            item.audio.load();
            URL.revokeObjectURL(item.url);
            this.audioManager.audioElements.splice(index, 1);
            
            const element = document.getElementById(`audio-item-${id}`);
            if (element) {
                element.remove();
            }
            this.audioManager.onAudioRemoved(id);
            
            if (groupId !== null && groupId !== undefined) {
                this.audioManager.groupManager.updateGroupCount(groupId);
            } else {
                this.audioManager.updateUngroupedCount();
            }
            
            if (this.audioManager.audioElements.length === 0) {
                this.audioManager.showEmptyState();
            }
            
            this.audioManager.updatePlayingCounter();
            this.audioManager.updateHistory();
            this.audioManager.applyFilters();
        }
    }

    handleAudioError(id, error) {
        const item = this.audioManager.audioElements.find(el => el.id === id);
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
}
