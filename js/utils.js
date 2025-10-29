export class Utils {
    static generateSoftColor() {
        const colorPalettes = [
            { hue: 200, satRange: [60, 75], lightRange: [80, 90] },
            { hue: 150, satRange: [55, 70], lightRange: [82, 92] },
            { hue: 280, satRange: [50, 65], lightRange: [85, 93] },
            { hue: 30, satRange: [65, 80], lightRange: [80, 88] },
            { hue: 340, satRange: [60, 75], lightRange: [85, 92] },
            { hue: 180, satRange: [55, 70], lightRange: [83, 91] },
            { hue: 50, satRange: [70, 85], lightRange: [78, 86] },
            { hue: 260, satRange: [50, 65], lightRange: [84, 92] },
            { hue: 90, satRange: [60, 75], lightRange: [81, 89] },
            { hue: 320, satRange: [55, 70], lightRange: [86, 93] },
            { hue: 170, satRange: [60, 75], lightRange: [82, 90] },
            { hue: 40, satRange: [65, 80], lightRange: [79, 87] },
            { hue: 210, satRange: [55, 70], lightRange: [84, 92] },
            { hue: 300, satRange: [50, 65], lightRange: [85, 91] },
            { hue: 120, satRange: [60, 75], lightRange: [80, 88] }
        ];
        
        const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];
        const hueVariation = Math.floor(Math.random() * 20) - 10;
        const hue = (palette.hue + hueVariation) % 360;
        const saturation = palette.satRange[0] + Math.floor(Math.random() * (palette.satRange[1] - palette.satRange[0]));
        const lightness = palette.lightRange[0] + Math.floor(Math.random() * (palette.lightRange[1] - palette.lightRange[0]));
        
        return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    static generateDarkerShade(color) {
        const match = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
        if (match) {
            const hue = match[1];
            const saturation = match[2];
            const lightness = Math.max(parseInt(match[3]) - 15, 50);
            return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        }
        return color;
    }

    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    static formatDuration(seconds) {
        if (!isFinite(seconds) || isNaN(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    static getAlertIcon(type) {
        const icons = {
            'success': 'bi-check-circle-fill',
            'danger': 'bi-x-circle-fill',
            'warning': 'bi-exclamation-triangle-fill',
            'info': 'bi-info-circle-fill'
        };
        return icons[type] || icons['info'];
    }

    static showAlert(message, type = 'info') {
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
}