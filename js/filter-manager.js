export class FilterManager {
    constructor(audioManager) {
        this.audioManager = audioManager;
        this.currentFilter = 'all';
    }

    handleFilterClick(e) {
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        this.currentFilter = e.currentTarget.dataset.filter;
        this.applyFilters();
    }

    applyFilters() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        let visibleCount = 0;
        
        this.audioManager.audioElements.forEach(item => {
            const element = document.getElementById(`audio-item-${item.id}`);
            if (!element) return;
            
            const matchesSearch = item.name.toLowerCase().includes(searchTerm);
            const matchesFilter = this.matchesCurrentFilter(item);
            
            if (matchesSearch && matchesFilter) {
                element.style.display = '';
                visibleCount++;
            } else {
                element.style.display = 'none';
            }
        });

        // Actualizar visibilidad de secciones de grupo
        this.audioManager.groupManager.getAllGroups().forEach(group => {
            const groupSection = document.getElementById(`group-section-${group.id}`);
            if (groupSection) {
                const visibleAudios = this.audioManager.audioElements.filter(item => {
                    if (item.groupId !== group.id) return false;
                    const audioItem = document.getElementById(`audio-item-${item.id}`);
                    return audioItem && audioItem.style.display !== 'none';
                });
                
                groupSection.style.display = visibleAudios.length > 0 ? 'block' : 'none';
            }
        });

        // Actualizar visibilidad de sección sin agrupar
        const ungroupedSection = document.getElementById('ungrouped-section');
        if (ungroupedSection) {
            const visibleUngrouped = this.audioManager.audioElements.filter(item => {
                if (item.groupId !== null && item.groupId !== undefined) return false;
                const audioItem = document.getElementById(`audio-item-${item.id}`);
                return audioItem && audioItem.style.display !== 'none';
            });
            
            ungroupedSection.style.display = visibleUngrouped.length > 0 ? 'block' : 'none';
        }
        
        // Mostrar mensaje si no hay resultados
        if (visibleCount === 0 && this.audioManager.audioElements.length > 0) {
            this.audioManager.showEmptyState('No se encontraron audios con los filtros aplicados');
        } else if (this.audioManager.audioElements.length > 0) {
            this.audioManager.hideEmptyState();
        }
        
        this.updateFilterCounts();
    }

    matchesCurrentFilter(item) {
        switch (this.currentFilter) {
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

    updateFilterCounts() {
        const counts = {
            all: this.audioManager.audioElements.length,
            playing: this.audioManager.audioElements.filter(i => i.isPlaying).length,
            paused: this.audioManager.audioElements.filter(i => 
                !i.isPlaying && i.audio.currentTime > 0 && !i.audio.ended
            ).length,
            stopped: this.audioManager.audioElements.filter(i => 
                !i.isPlaying && (i.audio.currentTime === 0 || i.audio.ended)
            ).length,
            loop: this.audioManager.audioElements.filter(i => i.audio.loop).length
        };

        document.querySelectorAll('.filter-btn').forEach(btn => {
            const filter = btn.dataset.filter;
            const span = btn.querySelector('span');
            if (span && counts[filter] !== undefined) {
                const text = span.textContent.split('(')[0].trim();
                span.textContent = `${text} (${counts[filter]})`;
            }
        });
    }
}
