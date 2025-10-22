# Reproductor Multi-Audio

Aplicación web para reproducción simultánea de múltiples archivos de audio. Ideal para producciones en vivo, teatro, podcasts y eventos.

## Características

### Control de Audio
- Reproducción simultánea de múltiples audios
- Control individual por audio (reproducción, pausa, volumen, loop, mute)
- Controles globales para todos los audios
- Control de volumen hasta 200%
- Barra de progreso interactiva con navegación por clic
- Atajo de teclado (Espacio para pausar/reanudar todo)

### Organización
- Sistema de grupos (opcional) con colores aleatorios para organizar audios (por actos, escenas, etc.). Para audios que no estan en un grupo, estos quedan la seccion "Sin agrupar"
- Controles por grupo (reproducción, pausa, stop, mute grupal)
- Grupos colapsables para mejor visualización

### Búsqueda y Filtros
- Búsqueda instantánea de audios por nombre
- Sistema de filtros múltiples:
  - Todos los audios
  - Reproduciendo
  - Pausados
  - Detenidos
  - En loop

### Monitoreo
- Historial en tiempo real de audios reproduciéndose
- Indicador visual de audios que estan en estado de reproducción pero que se encuentran muteados en el historial
- Contador de audios en reproducción
- Contador de audios por grupo
- Navegación rápida a audios desde el historial (scroll automático con highlight si se selecciona un audio del historial)

### Respaldo y Restauración de Configuración
- Exportación de configuración completa en formato JSON
- Importación de configuración guardada
- Guarda: grupos, volúmenes, estados de mute y loop
- Identificación de audios por nombre y formato
- Indicador de configuración cargada con detalles
- Restablecimiento de fábrica para limpiar toda la configuración

## Uso del Sistema de Respaldo

1. **Cargar audios:** Primero selecciona y carga tus archivos de audio
2. **Configurar:** Crea grupos, ajusta volúmenes, configura mute/loop según necesites
3. **Exportar:** Guarda tu configuración en un archivo JSON
4. **Importar:** En futuras sesiones, carga primero los mismos archivos de audio y luego importa la configuración

**Nota:** El sistema identifica audios por nombre y formato. Si renombras o cambias el formato de un archivo, no se le aplicará la configuración guardada.

## Requisitos

- Navegador web moderno con soporte para Web Audio API
- Archivos de audio en formato compatible (MP3, WAV, OGG, AAC, etc.)
- Máximo 50MB por archivo de audio

## Licencia

Proyecto bajo la licencia MIT