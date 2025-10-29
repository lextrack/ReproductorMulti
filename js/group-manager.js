import { Utils } from './utils.js';

export class GroupManager {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.groups = [];
        this.groupId = 0;
    }

    createGroup(name) {
        if (!name) {
            Utils.showAlert('Ingresa un nombre para el grupo', 'warning');
            return null;
        }

        const group = {
            id: this.groupId++,
            name: name,
            collapsed: false,
            color: Utils.generateSoftColor(),
            playlistMode: 'none',
            currentPlayingIndex: -1
        };

        this.groups.push(group);
        this.renderGroupTag(group);
        this.renderGroupSection(group);
        this.updateAllGroupSelectors();
        Utils.showAlert(`Grupo "${name}" creado`, 'success');
        
        return group;
    }

    deleteGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        const audiosInGroup = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        
        if (audiosInGroup.length > 0) {
            if (!confirm(`¿Eliminar el grupo "${group.name}"? Los ${audiosInGroup.length} audio(s) se moverán a "Sin grupo"`)) {
                return;
            }
            
            audiosInGroup.forEach(audio => {
                audio.groupId = null;
                const audioElement = document.getElementById(`audio-item-${audio.id}`);
                if (audioElement) {
                    audioElement.remove();
                    this.audioManager.renderAudioItem(audio);
                }
            });
        }

        this.groups = this.groups.filter(g => g.id !== groupId);
        
        const tagElement = document.querySelector(`[data-group-id="${groupId}"]`);
        if (tagElement) tagElement.remove();
        
        const sectionElement = document.getElementById(`group-section-${groupId}`);
        if (sectionElement) sectionElement.remove();
        
        this.updateAllGroupSelectors();
        this.audioManager.updateUngroupedCount();
        Utils.showAlert(`Grupo "${group.name}" eliminado. Audios movidos a "Sin grupo"`, 'info');
    }

    renderGroupTag(group) {
        const container = document.getElementById('groupsList');
        const tag = document.createElement('div');
        tag.className = 'group-tag';
        tag.dataset.groupId = group.id;
        tag.style.background = group.color;
        tag.style.color = '#333';
        
        const audioCount = this.audioManager.audioElements.filter(a => a.groupId === group.id).length;
        
        tag.innerHTML = `
            <i class="bi bi-folder"></i>
            <span>${Utils.escapeHtml(group.name)}</span>
            <span class="group-count">${audioCount}</span>
            <button class="btn-delete-group" title="Eliminar grupo">
                <i class="bi bi-x-lg"></i>
            </button>
        `;
        
        tag.querySelector('.btn-delete-group').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteGroup(group.id);
        });

        tag.addEventListener('click', (e) => {
            if (!e.target.closest('.btn-delete-group')) {
                this.scrollToGroup(group.id);
            }
        });
        
        container.appendChild(tag);
    }

    scrollToGroup(groupId) {
        const groupSection = document.getElementById(`group-section-${groupId}`);
        if (groupSection) {
            const rect = groupSection.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - (window.innerHeight / 2) + (rect.height / 2);
            
            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
            
            const groupHeader = groupSection.querySelector('.group-header');
            if (groupHeader) {
                groupHeader.classList.add('highlight-group');
                setTimeout(() => {
                    groupHeader.classList.remove('highlight-group');
                }, 1500);
            }
        }
    }

    renderAllGroups() {
        const container = document.getElementById('groupsList');
        container.innerHTML = '';
        this.groups.forEach(group => this.renderGroupTag(group));
    }

    updateGroupCount(groupId) {
        const tag = document.querySelector(`[data-group-id="${groupId}"]`);
        if (tag) {
            const count = this.audioManager.audioElements.filter(a => a.groupId === groupId).length;
            const countSpan = tag.querySelector('.group-count');
            if (countSpan) countSpan.textContent = count;
        }

        const badge = document.getElementById(`group-badge-${groupId}`);
        if (badge) {
            const count = this.audioManager.audioElements.filter(a => a.groupId === groupId).length;
            badge.textContent = `${count} audio(s)`;
        }
    }

    renderGroupSection(group) {
        const list = document.getElementById('audioList');
        
        let section = document.getElementById(`group-section-${group.id}`);
        if (section) return;
        
        section = document.createElement('div');
        section.className = 'group-section';
        section.id = `group-section-${group.id}`;
        
        const darkerColor = Utils.generateDarkerShade(group.color);
        
        section.innerHTML = `
            <div class="group-header ${group.collapsed ? 'collapsed' : ''}" data-group-id="${group.id}" style="background: linear-gradient(135deg, ${group.color} 0%, ${darkerColor} 100%);">
                <div class="group-header-left">
                    <i class="bi bi-chevron-down group-collapse-icon" style="color: #333;"></i>
                    <h5 class="group-title" style="color: #333;">
                        <i class="bi bi-folder"></i>
                        ${Utils.escapeHtml(group.name)}
                    </h5>
                    <span class="playlist-indicator" id="playlist-indicator-${group.id}" style="display: none;">
                        <i class="bi bi-music-note-list"></i>
                    </span>
                </div>
                <div class="group-info">
                    <span class="badge bg-dark group-badge" id="group-badge-${group.id}">0 audio(s)</span>
                    <div class="group-controls">
                        <button class="btn btn-success btn-small btn-group-control" data-action="play">
                            <i class="bi bi-play-fill"></i>
                        </button>
                        <button class="btn btn-warning btn-small btn-group-control" data-action="pause">
                            <i class="bi bi-pause-fill"></i>
                        </button>
                        <button class="btn btn-danger btn-small btn-group-control" data-action="stop">
                            <i class="bi bi-stop-fill"></i>
                        </button>
                        <button class="btn btn-secondary btn-small btn-group-control" data-action="mute" title="Mute">
                            <i class="bi bi-volume-mute"></i>
                        </button>
                        <button class="btn btn-info btn-small btn-group-control" data-action="playlist" title="Reproducción continua">
                            <i class="bi bi-skip-forward-fill"></i>
                        </button>
                        <button class="btn btn-purple btn-small btn-group-control" data-action="playlist-loop" title="Reproducción continua en bucle">
                            <i class="bi bi-arrow-repeat"></i>
                        </button>
                    </div>
                </div>
            </div>
            <div class="group-content ${group.collapsed ? 'collapsed' : ''}" id="group-content-${group.id}" style="background: ${group.color};">
            </div>
        `;
        
        const header = section.querySelector('.group-header');
        header.addEventListener('click', (e) => {
            if (e.target.closest('.btn-group-control')) return;
            this.toggleGroupCollapse(group.id);
        });
        
        section.querySelectorAll('.btn-group-control').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.groupAction(group.id, action);
            });
        });
        
        const ungroupedSection = document.getElementById('ungrouped-section');
        if (ungroupedSection) {
            list.insertBefore(section, ungroupedSection);
        } else {
            list.appendChild(section);
        }
    }

    toggleGroupCollapse(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        group.collapsed = !group.collapsed;
        
        const header = document.querySelector(`.group-header[data-group-id="${groupId}"]`);
        const content = document.getElementById(`group-content-${groupId}`);
        
        if (header && content) {
            if (group.collapsed) {
                header.classList.add('collapsed');
                content.classList.add('collapsed');
            } else {
                header.classList.remove('collapsed');
                content.classList.remove('collapsed');
            }
        }
    }

    groupAction(groupId, action) {
        const audios = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        const group = this.groups.find(g => g.id === groupId);
        
        switch(action) {
            case 'play':
                audios.forEach(audio => this.audioManager.audioPlayer.playSingle(audio.id));
                break;
            case 'pause':
                audios.forEach(audio => this.audioManager.audioPlayer.pauseSingle(audio.id));
                break;
            case 'stop':
                this.stopPlaylist(groupId);
                audios.forEach(audio => {
                    this.audioManager.audioPlayer.pauseSingle(audio.id);
                    audio.audio.currentTime = 0;
                });
                break;
            case 'mute':
                this.toggleGroupMute(groupId);
                break;
            case 'playlist':
                this.togglePlaylistMode(groupId, 'continuous');
                break;
            case 'playlist-loop':
                this.togglePlaylistMode(groupId, 'loop');
                break;
        }
    }

    togglePlaylistMode(groupId, mode) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        const playlistBtn = document.querySelector(`.group-header[data-group-id="${groupId}"] .btn-group-control[data-action="playlist"]`);
        const loopBtn = document.querySelector(`.group-header[data-group-id="${groupId}"] .btn-group-control[data-action="playlist-loop"]`);
        const indicator = document.getElementById(`playlist-indicator-${groupId}`);

        if (group.playlistMode === mode) {
            this.stopPlaylist(groupId);
        } else {
            const audios = this.audioManager.audioElements.filter(a => a.groupId === groupId);
            
            audios.forEach(audio => {
                audio.audio.pause();
                audio.audio.currentTime = 0;
            });

            group.playlistMode = mode;
            group.currentPlayingIndex = -1;

            playlistBtn?.classList.remove('active');
            loopBtn?.classList.remove('active');

            if (mode === 'continuous') {
                playlistBtn?.classList.add('active');
                indicator.style.display = 'inline-flex';
                indicator.innerHTML = '<i class="bi bi-skip-forward-fill"></i>';
                indicator.title = 'Reproducción continua activa';
                Utils.showAlert('Modo reproducción continua activado', 'info');
            } else if (mode === 'loop') {
                loopBtn?.classList.add('active');
                indicator.style.display = 'inline-flex';
                indicator.innerHTML = '<i class="bi bi-arrow-repeat"></i>';
                indicator.title = 'Reproducción continua en bucle activa';
                Utils.showAlert('Modo reproducción continua en bucle activado', 'info');
            }

            this.startPlaylist(groupId);
        }
    }

    startPlaylist(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group || group.playlistMode === 'none') return;

        const audios = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        if (audios.length === 0) return;

        audios.forEach(audio => {
            audio.audio.removeEventListener('ended', audio._playlistEndedHandler);
            
            if (audio.audio.loop) {
                audio._wasLooping = true;
                audio.audio.loop = false;
                audio.element.loop = false;
                
                const loopCheckbox = document.getElementById(`loop-${audio.id}`);
                const loopContainer = document.getElementById(`loop-container-${audio.id}`);
                if (loopCheckbox) {
                    loopCheckbox.checked = false;
                    if (loopContainer) {
                        loopContainer.style.background = '#bbb7b773';
                        loopContainer.style.borderLeft = 'none';
                    }
                }
            } else {
                audio._wasLooping = false;
            }
        });

        audios.forEach((audio, index) => {
            audio._playlistEndedHandler = () => this.handlePlaylistAudioEnded(groupId, index);
            audio.audio.addEventListener('ended', audio._playlistEndedHandler);
        });

        audios.forEach(audio => {
            audio.audio.loop = false;
            audio.element.loop = false;
        });

        group.currentPlayingIndex = 0;
        this.audioManager.audioPlayer.playSingle(audios[0].id);
    }

    handlePlaylistAudioEnded(groupId, audioIndex) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group || group.playlistMode === 'none') return;

        const audios = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        const currentAudio = audios[audioIndex];
        
        if (currentAudio && currentAudio.audio.loop) {
            currentAudio.audio.loop = false;
        }
        
        const nextIndex = audioIndex + 1;

        if (nextIndex < audios.length) {
            group.currentPlayingIndex = nextIndex;
            setTimeout(() => {
                if (audios[nextIndex].audio.loop) {
                    audios[nextIndex].audio.loop = false;
                }
                this.audioManager.audioPlayer.playSingle(audios[nextIndex].id);
            }, 300);
        } else {
            if (group.playlistMode === 'loop') {
                group.currentPlayingIndex = 0;
                setTimeout(() => {
                    if (audios[0].audio.loop) {
                        audios[0].audio.loop = false;
                    }
                    this.audioManager.audioPlayer.playSingle(audios[0].id);
                }, 300);
            } else {
                this.stopPlaylist(groupId);
                Utils.showAlert('Lista de reproducción finalizada', 'success');
            }
        }
    }

    stopPlaylist(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        group.playlistMode = 'none';
        group.currentPlayingIndex = -1;

        const audios = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        audios.forEach(audio => {
            if (audio._playlistEndedHandler) {
                audio.audio.removeEventListener('ended', audio._playlistEndedHandler);
                delete audio._playlistEndedHandler;
            }
            
            if (audio._wasLooping) {
                audio.audio.loop = true;
                
                const loopCheckbox = document.getElementById(`loop-${audio.id}`);
                const loopContainer = document.getElementById(`loop-container-${audio.id}`);
                if (loopCheckbox) {
                    loopCheckbox.checked = true;
                    if (loopContainer) {
                        loopContainer.style.background = 'rgba(139, 92, 246, 0.1)';
                        loopContainer.style.borderLeft = '3px solid var(--purple-color)';
                    }
                }
                delete audio._wasLooping;
            }
        });

        const playlistBtn = document.querySelector(`.group-header[data-group-id="${groupId}"] .btn-group-control[data-action="playlist"]`);
        const loopBtn = document.querySelector(`.group-header[data-group-id="${groupId}"] .btn-group-control[data-action="playlist-loop"]`);
        const indicator = document.getElementById(`playlist-indicator-${groupId}`);

        playlistBtn?.classList.remove('active');
        loopBtn?.classList.remove('active');
        if (indicator) {
            indicator.style.display = 'none';
        }
    }

    toggleGroupMute(groupId) {
        const audios = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        const groupBtn = document.querySelector(`.group-header[data-group-id="${groupId}"] .btn-group-control[data-action="mute"]`);
        
        const allMuted = audios.every(a => a.isMuted);
        
        audios.forEach(a => {
            a.isMuted = !allMuted;
            const btn = document.querySelector(`.btn-mute[data-id="${a.id}"]`);
            if (btn) {
                if (a.isMuted) {
                    btn.classList.add('active');
                    btn.innerHTML = '<i class="bi bi-volume-mute-fill"></i>';
                } else {
                    btn.classList.remove('active');
                    btn.innerHTML = '<i class="bi bi-volume-mute"></i>';
                }
            }
        });

        if (!allMuted) {
            groupBtn?.classList.add('active');
        } else {
            groupBtn?.classList.remove('active');
        }

        this.audioManager.applyMute();
        this.audioManager.updateHistory();
    }

    playGroupAudios(groupId) {
        const audiosInGroup = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        audiosInGroup.forEach(audio => {
            if (audio.audio.paused) {
                this.audioManager.audioPlayer.playSingle(audio.id);
            }
        });
    }

    pauseGroupAudios(groupId) {
        const audiosInGroup = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        audiosInGroup.forEach(audio => {
            if (!audio.audio.paused) {
                this.audioManager.audioPlayer.pauseSingle(audio.id);
            }
        });
    }

    stopGroupAudios(groupId) {
        const audiosInGroup = this.audioManager.audioElements.filter(a => a.groupId === groupId);
        audiosInGroup.forEach(audio => {
            this.audioManager.stopAudio(audio.id);
        });
    }

    updateAllGroupSelectors() {
        this.audioManager.audioElements.forEach(item => {
            let selector = document.querySelector(`.group-selector[data-id="${item.id}"]`);
            
            if (!selector) {
                const audioControls = document.querySelector(`#audio-item-${item.id} .audio-controls`);
                if (audioControls) {
                    const selectorDiv = document.createElement('div');
                    selectorDiv.className = 'audio-group-selector';
                    selectorDiv.innerHTML = `
                        <i class="bi bi-folder"></i>
                        <select class="group-selector" data-id="${item.id}">
                            <option value="">Sin grupo</option>
                        </select>
                    `;
                    audioControls.appendChild(selectorDiv);
                    selector = selectorDiv.querySelector('.group-selector');
                    selector.addEventListener('change', (e) => this.audioManager.changeAudioGroup(item.id, e.target.value));
                }
            }
            
            if (selector) {
                const currentValue = selector.value;
                const groupOptions = this.groups.map(g => 
                    `<option value="${g.id}" ${item.groupId == g.id ? 'selected' : ''}>${Utils.escapeHtml(g.name)}</option>`
                ).join('');
                
                selector.innerHTML = `
                    <option value="">Sin grupo</option>
                    ${groupOptions}
                `;
                selector.value = currentValue;
            }
        });
    }

    getGroup(groupId) {
        return this.groups.find(g => g.id === groupId);
    }

    getAllGroups() {
        return this.groups;
    }

    reset() {
        this.groups.forEach(g => {
            const tagElement = document.querySelector(`[data-group-id="${g.id}"]`);
            if (tagElement) tagElement.remove();
            
            const sectionElement = document.getElementById(`group-section-${g.id}`);
            if (sectionElement) sectionElement.remove();
        });

        this.groups = [];
        this.groupId = 0;
    }
}