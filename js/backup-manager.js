import { Utils } from './utils.js';
import { DEFAULT_VOLUME } from './constants.js';

export class BackupManager {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.backupLoaded = false;
        this.backupInfo = null;
    }

    exportBackup() {
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            groups: this.audioManager.groupManager.getAllGroups().map(g => ({
                name: g.name,
                color: g.color
            })),
            audioSettings: this.audioManager.audioElements.map(item => {
                const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
                const volumeValue = slider ? parseInt(slider.value) : DEFAULT_VOLUME;
                
                return {
                    key: this.getAudioKey(item.file.name),
                    name: item.file.name,
                    groupName: item.groupId !== null && item.groupId !== undefined ? 
                        this.audioManager.groupManager.getGroup(item.groupId)?.name : null,
                    volume: volumeValue,
                    isMuted: item.isMuted,
                    isLoop: item.audio.loop
                };
            })
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `audio-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        Utils.showAlert('Respaldo exportado correctamente', 'success');
    }

    getAudioKey(name) {
        const extension = name.split('.').pop().toLowerCase();
        return `${name}_${extension}`;
    }

    importBackup(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (this.audioManager.audioElements.length === 0) {
            Utils.showAlert('Debes cargar archivos de audio primero antes de importar un respaldo', 'warning');
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                
                if (!backup.version || !backup.groups || !backup.audioSettings) {
                    throw new Error('Formato de respaldo inválido');
                }

                const currentAudioKeys = this.audioManager.audioElements.map(item => 
                    this.getAudioKey(item.file.name)
                );
                const backupAudioKeys = backup.audioSettings.map(s => s.key);
                const missingAudios = backupAudioKeys.filter(key => !currentAudioKeys.includes(key));
                
                if (missingAudios.length > 0) {
                    const missingNames = backup.audioSettings
                        .filter(s => missingAudios.includes(s.key))
                        .map(s => s.name)
                        .join(', ');
                    
                    const proceed = confirm(
                        `ADVERTENCIA: Faltan ${missingAudios.length} audio(s) que estaban en el respaldo:\n\n${missingNames}\n\n` +
                        `Para restaurar completamente el respaldo, debes recargar la página, cargar los audios y volver a cargar el respaldo.\n\n` +
                        `¿Deseas continuar? (Los audios que se eliminaron del grupo no apareceran hasta que recargues todo de nuevo)`
                    );
                    
                    if (!proceed) {
                        e.target.value = '';
                        return;
                    }
                }

                while (this.audioManager.groupManager.groups.length > 0) {
                    const group = this.audioManager.groupManager.groups[0];
                    const tagElement = document.querySelector(`[data-group-id="${group.id}"]`);
                    if (tagElement) tagElement.remove();
                    
                    const sectionElement = document.getElementById(`group-section-${group.id}`);
                    if (sectionElement) sectionElement.remove();
                    
                    this.audioManager.groupManager.groups.shift();
                }
                
                const ungroupedSection = document.getElementById('ungrouped-section');
                if (ungroupedSection) ungroupedSection.remove();
                
                this.audioManager.groupManager.groupId = 0;

                backup.groups.forEach(g => {
                    const group = {
                        id: this.audioManager.groupManager.groupId++,
                        name: g.name,
                        color: g.color,
                        collapsed: false
                    };
                    this.audioManager.groupManager.groups.push(group);
                    this.audioManager.groupManager.renderGroupTag(group);
                    this.audioManager.groupManager.renderGroupSection(group);
                });

                let configuredCount = 0;
                
                this.audioManager.audioElements.forEach(item => {
                    const audioElement = document.getElementById(`audio-item-${item.id}`);
                    if (audioElement) {
                        audioElement.remove();
                    }
                });
                
                this.audioManager.audioElements.forEach(item => {
                    const key = this.getAudioKey(item.file.name);
                    const settings = backup.audioSettings.find(s => s.key === key);
                    
                    if (settings) {
                        configuredCount++;
                        
                        if (settings.groupName) {
                            const group = this.audioManager.groupManager.groups.find(g => g.name === settings.groupName);
                            item.groupId = group ? group.id : null;
                        } else {
                            item.groupId = null;
                        }
                    } else {
                        item.groupId = null;
                    }
                    
                    this.audioManager.renderAudioItem(item);
                });

                setTimeout(() => {
                    this.audioManager.audioElements.forEach(item => {
                        const key = this.getAudioKey(item.file.name);
                        const settings = backup.audioSettings.find(s => s.key === key);
                        
                        if (settings) {
                            console.log(`[IMPORT] Aplicando a ${item.file.name}:`, {
                                volume: settings.volume,
                                isMuted: settings.isMuted,
                                isLoop: settings.isLoop,
                                groupName: settings.groupName
                            });
                            
                            const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
                            if (slider) {
                                slider.value = settings.volume;
                                item.gainNode.gain.value = settings.volume / 100;
                                const display = document.getElementById(`vol-display-${item.id}`);
                                if (display) {
                                    display.textContent = `${settings.volume}%`;
                                    if (settings.volume > 100) {
                                        display.classList.add('boosted');
                                    } else {
                                        display.classList.remove('boosted');
                                    }
                                }
                                console.log(`[IMPORT] Volumen aplicado: slider=${slider.value}, gainNode=${item.gainNode.gain.value}`);
                            }

                            const muteBtn = document.querySelector(`.btn-mute[data-id="${item.id}"]`);
                            item.isMuted = settings.isMuted;
                            if (muteBtn) {
                                if (settings.isMuted) {
                                    muteBtn.classList.add('active');
                                    muteBtn.innerHTML = '<i class="bi bi-volume-mute-fill"></i>';
                                } else {
                                    muteBtn.classList.remove('active');
                                    muteBtn.innerHTML = '<i class="bi bi-volume-mute"></i>';
                                }
                            }
                            console.log(`[IMPORT] Mute aplicado: ${item.isMuted}`);

                            const loopCheckbox = document.getElementById(`loop-${item.id}`);
                            const loopContainer = document.getElementById(`loop-container-${item.id}`);
                            if (loopCheckbox) {
                                loopCheckbox.checked = settings.isLoop;
                                item.audio.loop = settings.isLoop;
                                
                                if (settings.isLoop) {
                                    loopContainer.style.background = 'rgba(139, 92, 246, 0.1)';
                                    loopContainer.style.borderLeft = '3px solid var(--purple-color)';
                                } else {
                                    loopContainer.style.background = '#bbb7b773';
                                    loopContainer.style.borderLeft = 'none';
                                }
                            }
                            console.log(`[IMPORT] Loop aplicado: checkbox=${loopCheckbox?.checked}, audio.loop=${item.audio.loop}`);
                        } else {
                            const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
                            if (slider) {
                                slider.value = DEFAULT_VOLUME;
                                item.gainNode.gain.value = DEFAULT_VOLUME / 100;
                                const display = document.getElementById(`vol-display-${item.id}`);
                                if (display) {
                                    display.textContent = `${DEFAULT_VOLUME}%`;
                                    display.classList.remove('boosted');
                                }
                            }
                            
                            const muteBtn = document.querySelector(`.btn-mute[data-id="${item.id}"]`);
                            item.isMuted = false;
                            if (muteBtn) {
                                muteBtn.classList.remove('active');
                                muteBtn.innerHTML = '<i class="bi bi-volume-mute"></i>';
                            }
                            
                            const loopCheckbox = document.getElementById(`loop-${item.id}`);
                            const loopContainer = document.getElementById(`loop-container-${item.id}`);
                            if (loopCheckbox) {
                                loopCheckbox.checked = false;
                                item.audio.loop = false;
                                loopContainer.style.background = '#bbb7b773';
                                loopContainer.style.borderLeft = 'none';
                            }
                        }
                    });
                    
                    this.audioManager.groupManager.groups.forEach(group => {
                        this.audioManager.groupManager.updateGroupCount(group.id);
                    });
                    
                    this.audioManager.applyMute();
                    this.audioManager.groupManager.updateAllGroupSelectors();
                    this.audioManager.updateUngroupedCount();
                    this.audioManager.applyFilters();
                }, 150);

                this.backupLoaded = true;
                this.backupInfo = {
                    fileName: file.name,
                    timestamp: backup.timestamp,
                    groups: backup.groups.length,
                    audiosConfigured: configuredCount,
                    totalAudios: this.audioManager.audioElements.length
                };
                this.updateBackupStatus();

                let message = `Respaldo importado. ${this.audioManager.groupManager.groups.length} grupo(s) creados, ${configuredCount} audio(s) configurados`;
                if (missingAudios.length > 0) {
                    message += `. ${missingAudios.length} audio(s) faltantes`;
                }
                Utils.showAlert(message, missingAudios.length > 0 ? 'warning' : 'success');
            } catch (error) {
                console.error('Error al importar respaldo:', error);
                Utils.showAlert('Error al importar respaldo: ' + error.message, 'danger');
            }
        };

        reader.readAsText(file);
        e.target.value = '';
    }

    resetFactory() {
        if (!confirm('¿Estás seguro de restablecer todo de fábrica? Esto eliminará todos los grupos y restablecerá todos los ajustes.')) {
            return;
        }

        while (this.audioManager.groupManager.groups.length > 0) {
            const group = this.audioManager.groupManager.groups[0];
            const tagElement = document.querySelector(`[data-group-id="${group.id}"]`);
            if (tagElement) tagElement.remove();
            
            const sectionElement = document.getElementById(`group-section-${group.id}`);
            if (sectionElement) sectionElement.remove();
            
            this.audioManager.groupManager.groups.shift();
        }
        
        this.audioManager.groupManager.groupId = 0;

        this.audioManager.audioElements.forEach(item => {
            item.groupId = null;

            const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
            if (slider) {
                slider.value = DEFAULT_VOLUME;
                item.gainNode.gain.value = DEFAULT_VOLUME / 100;
                const display = document.getElementById(`vol-display-${item.id}`);
                if (display) {
                    display.textContent = `${DEFAULT_VOLUME}%`;
                    display.classList.remove('boosted');
                }
            }

            if (item.isMuted) {
                item.isMuted = false;
                const btn = document.querySelector(`.btn-mute[data-id="${item.id}"]`);
                if (btn) {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="bi bi-volume-mute"></i>';
                }
            }

            const loopCheckbox = document.getElementById(`loop-${item.id}`);
            const loopContainer = document.getElementById(`loop-container-${item.id}`);
            if (loopCheckbox && loopCheckbox.checked) {
                loopCheckbox.checked = false;
                item.audio.loop = false;
                if (loopContainer) {
                    loopContainer.style.background = '#bbb7b773';
                    loopContainer.style.borderLeft = 'none';
                }
            }

            const audioElement = document.getElementById(`audio-item-${item.id}`);
            if (audioElement) {
                audioElement.remove();
                this.audioManager.renderAudioItem(item);
            }
        });

        this.audioManager.applyMute();
        this.audioManager.groupManager.updateAllGroupSelectors();
        this.audioManager.updateUngroupedCount();
        this.audioManager.applyFilters();

        this.backupLoaded = false;
        this.backupInfo = null;
        this.updateBackupStatus();

        Utils.showAlert('Configuración restablecida de fábrica', 'info');
    }

    updateBackupStatus() {
        const statusDiv = document.getElementById('backupStatus');
        const statusText = document.getElementById('backupStatusText');
        
        if (this.backupLoaded && this.backupInfo) {
            const date = new Date(this.backupInfo.timestamp);
            const formattedDate = date.toLocaleDateString('es-ES', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            statusText.innerHTML = `
                <strong>Respaldo cargado:</strong> ${Utils.escapeHtml(this.backupInfo.fileName)} 
                <span class="text-muted">(${formattedDate})</span> - 
                ${this.backupInfo.groups} grupo(s), ${this.backupInfo.audiosConfigured}/${this.backupInfo.totalAudios} audio(s) configurados
            `;
            statusDiv.style.display = 'block';
        } else {
            statusDiv.style.display = 'none';
        }
    }
}