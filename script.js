const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_VOLUME = 200;
const DEFAULT_VOLUME = 100;

class AudioManager {
    constructor() {
        this.audioElements = [];
        this.audioId = 0;
        this.audioContext = null;
        this.playingCount = 0;
        this.currentFilter = 'all';
        this.groups = [];
        this.groupId = 0;
        this.backupLoaded = false;
        this.backupInfo = null;
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
        document.getElementById('searchInput').addEventListener('input', () => this.applyFilters());
        document.getElementById('playAllBtn').addEventListener('click', () => this.playAll());
        document.getElementById('pauseAllBtn').addEventListener('click', () => this.pauseAll());
        document.getElementById('stopAllBtn').addEventListener('click', () => this.stopAll());
        document.getElementById('resetAllVolumes').addEventListener('click', () => this.resetAllVolumes());
        document.getElementById('createGroupBtn').addEventListener('click', () => this.createGroup());
        document.getElementById('newGroupName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createGroup();
        });
        document.getElementById('exportBackupBtn').addEventListener('click', () => this.exportBackup());
        document.getElementById('importBackupBtn').addEventListener('click', () => {
            document.getElementById('backupFile').click();
        });
        document.getElementById('backupFile').addEventListener('change', (e) => this.importBackup(e));
        document.getElementById('resetFactoryBtn').addEventListener('click', () => this.resetFactory());
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleFilterClick(e));
        });
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

    generateSoftColor() {
        const hue = Math.floor(Math.random() * 360);
        const saturation = 65 + Math.floor(Math.random() * 20);
        const lightness = 85 + Math.floor(Math.random() * 10);
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    generateDarkerShade(color) {
        const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match) {
            const hue = match[1];
            const saturation = match[2];
            const lightness = Math.max(parseInt(match[3]) - 15, 50);
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        return color;
    }

    createGroup() {
        const input = document.getElementById('newGroupName');
        const name = input.value.trim();
        
        if (!name) {
            this.showAlert('Ingresa un nombre para el grupo', 'warning');
            return;
        }

        const group = {
            id: this.groupId++,
            name: name,
            collapsed: false,
            color: this.generateSoftColor()
        };

        this.groups.push(group);
        this.renderGroupTag(group);
        this.renderGroupSection(group);
        this.updateAllGroupSelectors();
        input.value = '';
        this.showAlert(`Grupo "${name}" creado`, 'success');
    }

    deleteGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        const audiosInGroup = this.audioElements.filter(a => a.groupId === groupId);
        
        if (audiosInGroup.length > 0) {
            if (!confirm(`¿Eliminar el grupo "${group.name}"? Los ${audiosInGroup.length} audio(s) se moverán a "Sin grupo"`)) {
                return;
            }
            
            audiosInGroup.forEach(audio => {
                audio.groupId = null;
                const audioElement = document.getElementById(`audio-item-${audio.id}`);
                if (audioElement) {
                    audioElement.remove();
                    this.renderAudioItem(audio);
                }
            });
        }

        this.groups = this.groups.filter(g => g.id !== groupId);
        
        const tagElement = document.querySelector(`[data-group-id="${groupId}"]`);
        if (tagElement) tagElement.remove();
        
        const sectionElement = document.getElementById(`group-section-${groupId}`);
        if (sectionElement) sectionElement.remove();
        
        this.updateAllGroupSelectors();
        this.updateUngroupedCount();
        this.showAlert(`Grupo "${group.name}" eliminado. Audios movidos a "Sin grupo"`, 'info');
    }

    renderGroupTag(group) {
        const container = document.getElementById('groupsList');
        const tag = document.createElement('div');
        tag.className = 'group-tag';
        tag.dataset.groupId = group.id;
        tag.style.background = group.color;
        tag.style.color = '#333';
        
        const audioCount = this.audioElements.filter(a => a.groupId === group.id).length;
        
        tag.innerHTML = `
            <i class="bi bi-folder"></i>
            <span>${this.escapeHtml(group.name)}</span>
            <span class="group-count">${audioCount}</span>
            <button class="btn-delete-group" title="Eliminar grupo">
                <i class="bi bi-x-lg"></i>
            </button>
        `;
        
        tag.querySelector('.btn-delete-group').addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteGroup(group.id);
        });
        
        container.appendChild(tag);
    }

    renderAllGroups() {
        const container = document.getElementById('groupsList');
        container.innerHTML = '';
        this.groups.forEach(group => this.renderGroupTag(group));
    }

    updateGroupCount(groupId) {
        const tag = document.querySelector(`[data-group-id="${groupId}"]`);
        if (tag) {
            const count = this.audioElements.filter(a => a.groupId === groupId).length;
            const countSpan = tag.querySelector('.group-count');
            if (countSpan) countSpan.textContent = count;
        }

        const badge = document.getElementById(`group-badge-${groupId}`);
        if (badge) {
            const count = this.audioElements.filter(a => a.groupId === groupId).length;
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
        
        const darkerColor = this.generateDarkerShade(group.color);
        
        section.innerHTML = `
            <div class="group-header ${group.collapsed ? 'collapsed' : ''}" data-group-id="${group.id}" style="background: linear-gradient(135deg, ${group.color} 0%, ${darkerColor} 100%);">
                <div class="group-header-left">
                    <i class="bi bi-chevron-down group-collapse-icon" style="color: #333;"></i>
                    <h5 class="group-title" style="color: #333;">
                        <i class="bi bi-folder"></i>
                        ${this.escapeHtml(group.name)}
                    </h5>
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
        const audios = this.audioElements.filter(a => a.groupId === groupId);
        
        switch(action) {
            case 'play':
                audios.forEach(audio => this.playSingle(audio.id));
                break;
            case 'pause':
                audios.forEach(audio => this.pauseSingle(audio.id));
                break;
            case 'stop':
                audios.forEach(audio => {
                    this.pauseSingle(audio.id);
                    audio.audio.currentTime = 0;
                });
                break;
            case 'mute':
                this.toggleGroupMute(groupId);
                break;
        }
    }

    updateAllGroupSelectors() {
        this.audioElements.forEach(item => {
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
                    selector.addEventListener('change', (e) => this.changeAudioGroup(item.id, e.target.value));
                }
            }
            
            if (selector) {
                const currentValue = selector.value;
                const groupOptions = this.groups.map(g => 
                    `<option value="${g.id}" ${item.groupId == g.id ? 'selected' : ''}>${this.escapeHtml(g.name)}</option>`
                ).join('');
                
                selector.innerHTML = `
                    <option value="">Sin grupo</option>
                    ${groupOptions}
                `;
                selector.value = currentValue;
            }
        });
    }

    handleFilterClick(e) {
        const btn = e.currentTarget;
        const filter = btn.dataset.filter;
        
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        this.currentFilter = filter;
        this.applyFilters();
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        let visibleCount = 0;
        
        this.audioElements.forEach(item => {
            const audioItem = document.getElementById(`audio-item-${item.id}`);
            if (audioItem) {
                const matchesSearch = item.name.toLowerCase().includes(searchTerm);
                const matchesFilter = this.checkFilter(item);
                
                if (matchesSearch && matchesFilter) {
                    audioItem.style.display = 'block';
                    visibleCount++;
                } else {
                    audioItem.style.display = 'none';
                }
            }
        });

        this.groups.forEach(group => {
            const section = document.getElementById(`group-section-${group.id}`);
            if (section) {
                const audiosInGroup = this.audioElements.filter(a => a.groupId === group.id);
                const visibleInGroup = audiosInGroup.filter(a => {
                    const audioItem = document.getElementById(`audio-item-${a.id}`);
                    return audioItem && audioItem.style.display !== 'none';
                });
                
                section.style.display = visibleInGroup.length > 0 ? 'block' : 'none';
            }
        });

        const ungroupedSection = document.getElementById('ungrouped-section');
        if (ungroupedSection) {
            const ungroupedAudios = this.audioElements.filter(a => !a.groupId);
            const visibleUngrouped = ungroupedAudios.filter(a => {
                const audioItem = document.getElementById(`audio-item-${a.id}`);
                return audioItem && audioItem.style.display !== 'none';
            });
            
            ungroupedSection.style.display = visibleUngrouped.length > 0 ? 'block' : 'none';
        }
        
        if (visibleCount === 0 && this.audioElements.length > 0) {
            this.showEmptyState('No se encontraron audios con los filtros aplicados');
        } else if (this.audioElements.length > 0) {
            this.hideEmptyState();
        }
    }

    checkFilter(item) {
        switch(this.currentFilter) {
            case 'all':
                return true;
            case 'playing':
                return item.isPlaying;
            case 'paused':
                return !item.isPlaying && item.audio.currentTime > 0 && !item.audio.ended;
            case 'stopped':
                return !item.isPlaying && (item.audio.currentTime === 0 || item.audio.ended);
            case 'loop':
                return item.audio.loop;
            default:
                return true;
        }
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

    getAudioKey(name) {
        const extension = name.split('.').pop().toLowerCase();
        return `${name}_${extension}`;
    }

    addAudio(file, groupId = null) {
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
            isPlaying: false,
            groupId: groupId,
            isMuted: false,
            originalVolume: DEFAULT_VOLUME
        };

        this.setupAudioEventListeners(audioItem);
        this.audioElements.push(audioItem);
        this.renderAudioItem(audioItem);
        
        if (groupId !== null && groupId !== undefined) {
            this.updateGroupCount(groupId);
        } else {
            this.updateUngroupedCount();
        }
    }

    setupAudioEventListeners(item) {
        item.audio.addEventListener('play', () => {
            this.audioContext.resume();
            item.isPlaying = true;
            this.updatePlayingState(item.id, true);
            this.updatePlayingCounter();
            this.updateHistory();
            this.applyFilters();
        });
        
        item.audio.addEventListener('pause', () => {
            item.isPlaying = false;
            this.updatePlayingState(item.id, false);
            this.updatePlayingCounter();
            this.updateHistory();
            this.applyFilters();
        });
        
        item.audio.addEventListener('ended', () => {
            item.isPlaying = false;
            this.updatePlayingState(item.id, false);
            this.updatePlayingCounter();
            this.updateHistory();
            this.applyFilters();
        });
        
        item.audio.addEventListener('error', (e) => {
            this.handleAudioError(item.id, e);
        });

        item.audio.addEventListener('timeupdate', () => {
            this.updateProgress(item.id);
            if (item.isPlaying) {
                this.updateHistoryTime(item.id);
            }
        });

        item.audio.addEventListener('loadedmetadata', () => {
            this.updateDuration(item.id);
        });
    }

    renderAudioItem(item) {
        let container;
        
        if (item.groupId !== null && item.groupId !== undefined) {
            const group = this.groups.find(g => g.id === item.groupId);
            if (group) {
                this.renderGroupSection(group);
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
        
        const groupOptions = this.groups.map(g => 
            `<option value="${g.id}" ${item.groupId === g.id ? 'selected' : ''}>${this.escapeHtml(g.name)}</option>`
        ).join('');
        
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
        this.updateUngroupedCount();
        return section;
    }

    updateUngroupedCount() {
        const badge = document.getElementById('ungrouped-badge');
        if (badge) {
            const count = this.audioElements.filter(a => a.groupId === null || a.groupId === undefined).length;
            badge.textContent = `${count} audio(s)`;
        }
    }

    attachItemEventListeners(div, id) {
        div.querySelector('.btn-play-single').addEventListener('click', () => this.playSingle(id));
        div.querySelector('.btn-pause-single').addEventListener('click', () => this.pauseSingle(id));
        div.querySelector('.btn-remove').addEventListener('click', () => this.removeAudio(id));
        div.querySelector('.btn-mute').addEventListener('click', () => this.toggleMute(id));
        div.querySelector('.btn-reset-volume').addEventListener('click', () => this.resetVolume(id));
        div.querySelector(`#loop-${id}`).addEventListener('change', (e) => this.toggleLoop(id, e.target.checked));
        div.querySelector('.volume-slider').addEventListener('input', (e) => this.changeVolume(id, e.target.value));
        div.querySelector('.progress').addEventListener('click', (e) => this.seekAudio(id, e));
        
        const groupSelector = div.querySelector('.group-selector');
        if (groupSelector) {
            groupSelector.addEventListener('change', (e) => this.changeAudioGroup(id, e.target.value));
        }
    }

    changeAudioGroup(audioId, newGroupId) {
        const item = this.audioElements.find(el => el.id === audioId);
        if (!item) return;

        const oldGroupId = item.groupId;
        item.groupId = newGroupId === '' ? null : parseInt(newGroupId);

        const audioElement = document.getElementById(`audio-item-${audioId}`);
        if (audioElement) {
            audioElement.remove();
            this.renderAudioItem(item);
        }

        if (oldGroupId !== null && oldGroupId !== undefined) {
            this.updateGroupCount(oldGroupId);
        } else {
            this.updateUngroupedCount();
        }
        
        if (item.groupId !== null && item.groupId !== undefined) {
            this.updateGroupCount(item.groupId);
        } else {
            this.updateUngroupedCount();
        }

        this.applyFilters();
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
        const count = this.audioElements.filter(item => item.isPlaying).length;
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
            const groupId = item.groupId;
            
            item.audio.pause();
            URL.revokeObjectURL(item.url);
            this.audioElements.splice(index, 1);
            
            const element = document.getElementById(`audio-item-${id}`);
            if (element) {
                element.remove();
            }
            
            if (groupId !== null && groupId !== undefined) {
                this.updateGroupCount(groupId);
            } else {
                this.updateUngroupedCount();
            }
            
            if (this.audioElements.length === 0) {
                this.showEmptyState();
            }
            
            this.updatePlayingCounter();
            this.updateHistory();
            this.applyFilters();
        }
    }

    toggleMute(id) {
        const item = this.audioElements.find(el => el.id === id);
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

        this.applyMute();
        this.updateHistory();
    }

    toggleGroupMute(groupId) {
        const audios = this.audioElements.filter(a => a.groupId === groupId);
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

        this.applyMute();
        this.updateHistory();
    }

    applyMute() {
        this.audioElements.forEach(item => {
            if (item.isMuted) {
                item.gainNode.gain.value = 0;
            } else {
                const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
                const volume = slider ? slider.value : DEFAULT_VOLUME;
                item.gainNode.gain.value = volume / 100;
            }
        });
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
                loopContainer.style.background = '#bbb7b773';
                loopContainer.style.borderLeft = 'none';
            }
            
            if (item.isPlaying) {
                this.updatePlayingState(id, true);
            }
            
            this.applyFilters();
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

    updateHistory() {
        const historyList = document.getElementById('historyList');
        const historyCounter = document.getElementById('historyCounter');
        const playingAudios = this.audioElements.filter(item => item.isPlaying);
        
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
                        ${this.escapeHtml(item.name)}
                    </div>
                    <div class="history-item-time">
                        <i class="bi bi-clock"></i>
                        <span id="history-time-${item.id}">${this.formatTime(item.audio.currentTime)}</span>
                        ${muteIndicator}
                    </div>
                `;
                
                historyItem.addEventListener('click', () => this.scrollToAudio(item.id));
                historyList.appendChild(historyItem);
            });
        }
    }

    updateHistoryTime(id) {
        const item = this.audioElements.find(el => el.id === id);
        if (!item || !item.isPlaying) return;
        
        const historyTime = document.getElementById(`history-time-${id}`);
        if (historyTime) {
            historyTime.textContent = this.formatTime(item.audio.currentTime);
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

    exportBackup() {
        const backup = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            groups: this.groups.map(g => ({
                name: g.name,
                color: g.color
            })),
            audioSettings: this.audioElements.map(item => ({
                key: this.getAudioKey(item.name),
                name: item.name,
                groupName: item.groupId !== null && item.groupId !== undefined ? 
                    this.groups.find(g => g.id === item.groupId)?.name : null,
                volume: parseInt(document.querySelector(`.volume-slider[data-id="${item.id}"]`)?.value || DEFAULT_VOLUME),
                isMuted: item.isMuted,
                isLoop: item.audio.loop
            }))
        };

        const dataStr = JSON.stringify(backup, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audio-backup-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);

        this.showAlert('Respaldo exportado correctamente', 'success');
    }

    importBackup(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (this.audioElements.length === 0) {
            this.showAlert('Debes cargar archivos de audio primero antes de importar un respaldo', 'warning');
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

                while (this.groups.length > 0) {
                    const group = this.groups[0];
                    const tagElement = document.querySelector(`[data-group-id="${group.id}"]`);
                    if (tagElement) tagElement.remove();
                    
                    const sectionElement = document.getElementById(`group-section-${group.id}`);
                    if (sectionElement) sectionElement.remove();
                    
                    this.groups.shift();
                }
                
                this.groupId = 0;

                backup.groups.forEach(g => {
                    const group = {
                        id: this.groupId++,
                        name: g.name,
                        color: g.color,
                        collapsed: false
                    };
                    this.groups.push(group);
                    this.renderGroupTag(group);
                    this.renderGroupSection(group);
                });

                let configuredCount = 0;
                this.audioElements.forEach(item => {
                    const key = this.getAudioKey(item.name);
                    const settings = backup.audioSettings.find(s => s.key === key);
                    
                    if (settings) {
                        configuredCount++;
                        const oldGroupId = item.groupId;
                        
                        if (settings.groupName) {
                            const group = this.groups.find(g => g.name === settings.groupName);
                            item.groupId = group ? group.id : null;
                        } else {
                            item.groupId = null;
                        }

                        const audioElement = document.getElementById(`audio-item-${item.id}`);
                        if (audioElement) {
                            audioElement.remove();
                        }
                        
                        this.renderAudioItem(item);

                        setTimeout(() => {
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
                            }

                            const muteBtn = document.querySelector(`.btn-mute[data-id="${item.id}"]`);
                            if (settings.isMuted && !item.isMuted) {
                                item.isMuted = true;
                                if (muteBtn) {
                                    muteBtn.classList.add('active');
                                    muteBtn.innerHTML = '<i class="bi bi-volume-mute-fill"></i>';
                                }
                            } else if (!settings.isMuted && item.isMuted) {
                                item.isMuted = false;
                                if (muteBtn) {
                                    muteBtn.classList.remove('active');
                                    muteBtn.innerHTML = '<i class="bi bi-volume-mute"></i>';
                                }
                            }

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
                        }, 100);
                        
                        if (oldGroupId !== null && oldGroupId !== undefined) {
                            this.updateGroupCount(oldGroupId);
                        }
                        if (item.groupId !== null && item.groupId !== undefined) {
                            this.updateGroupCount(item.groupId);
                        }
                    }
                });

                this.applyMute();
                this.updateAllGroupSelectors();
                this.updateUngroupedCount();
                this.applyFilters();

                this.backupLoaded = true;
                this.backupInfo = {
                    fileName: file.name,
                    timestamp: backup.timestamp,
                    groups: backup.groups.length,
                    audiosConfigured: configuredCount,
                    totalAudios: this.audioElements.length
                };
                this.updateBackupStatus();

                const notConfigured = this.audioElements.length - configuredCount;
                let message = `Respaldo importado. ${this.groups.length} grupo(s) creados, ${configuredCount} audio(s) configurados`;
                if (notConfigured > 0) {
                    message += `. ${notConfigured} audio(s) sin configuración en el respaldo`;
                }
                this.showAlert(message, 'success');
            } catch (error) {
                console.error('Error al importar respaldo:', error);
                this.showAlert('Error al importar respaldo: ' + error.message, 'danger');
            }
        };

        reader.readAsText(file);
        e.target.value = '';
    }

    resetFactory() {
        if (!confirm('¿Estás seguro de restablecer todo de fábrica? Esto eliminará todos los grupos y restablecerá todos los ajustes.')) {
            return;
        }

        this.groups.forEach(g => {
            const tagElement = document.querySelector(`[data-group-id="${g.id}"]`);
            if (tagElement) tagElement.remove();
            
            const sectionElement = document.getElementById(`group-section-${g.id}`);
            if (sectionElement) sectionElement.remove();
        });

        this.groups = [];
        this.groupId = 0;

        this.audioElements.forEach(item => {
            item.groupId = null;

            const slider = document.querySelector(`.volume-slider[data-id="${item.id}"]`);
            if (slider) {
                slider.value = DEFAULT_VOLUME;
                this.changeVolume(item.id, DEFAULT_VOLUME);
            }

            if (item.isMuted) {
                this.toggleMute(item.id);
            }

            const loopCheckbox = document.getElementById(`loop-${item.id}`);
            if (loopCheckbox && loopCheckbox.checked) {
                loopCheckbox.checked = false;
                this.toggleLoop(item.id, false);
            }

            const audioElement = document.getElementById(`audio-item-${item.id}`);
            if (audioElement) {
                audioElement.remove();
                this.renderAudioItem(item);
            }
        });

        this.updateAllGroupSelectors();
        this.updateUngroupedCount();
        this.applyFilters();

        this.backupLoaded = false;
        this.backupInfo = null;
        this.updateBackupStatus();

        this.showAlert('Configuración restablecida de fábrica', 'info');
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
                <strong>Configuración cargada:</strong> ${this.escapeHtml(this.backupInfo.fileName)} 
                <span class="text-muted">(${formattedDate})</span> - 
                ${this.backupInfo.groups} grupo(s), ${this.backupInfo.audiosConfigured}/${this.backupInfo.totalAudios} audio(s) configurados
            `;
            statusDiv.style.display = 'block';
        } else {
            statusDiv.style.display = 'none';
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
        }, 3000);
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