# Reproductor Multi-Audio

Aplicacion web para reproduccion simultanea de multiples pistas de audio.
Pensada para uso en vivo: teatro, podcast, eventos, streaming y operacion tecnica.

## Objetivo

Controlar muchas pistas rapido, con estados claros, grupos, filtros y atajos de teclado.

## Caracteristicas principales

### Control de audio
- Reproduccion simultanea de multiples audios.
- Control individual por pista: reproducir, pausar, eliminar, mute, loop y volumen.
- Controles globales: reproducir todo, pausar todo, detener todo, reset de volumenes.
- Volumen por pista hasta 200%.
- Volumen maestro global.
- Barra de progreso con seek por clic.

### Organizacion
- Grupos opcionales para ordenar pistas por acto, escena o categoria.
- Seccion automatica `Sin agrupar`.
- Controles por grupo: play, pause, stop, mute y modo playlist.
- Grupos colapsables.

### Busqueda y filtros
- Busqueda por nombre en tiempo real (con debounce para mejor rendimiento).
- Filtros por estado:
  - Todos
  - Reproduciendo
  - Pausados
  - Detenidos
  - En loop

### Operacion rapida en vivo
- Barra superior fija de acciones rapidas:
  - Reproducir/Pausar
  - Detener
  - Silenciar todo
  - Solo reproduciendo
  - Modo compacto
- Paleta de comandos con `Ctrl+K`.
- Navegacion por teclado entre pistas visibles:
  - `ArrowUp` / `ArrowDown`: mover foco
  - `Enter`: reproducir/pausar pista enfocada
  - `M`: mute pista enfocada
  - `L`: loop pista enfocada
  - `Space`: reproducir/pausar todo

### Monitoreo
- Panel lateral con audios reproduciendose.
- Contador de pistas activas.
- Click en historial para saltar al audio correspondiente.

### Respaldo y restauracion
- Exportar configuracion a JSON.
- Importar configuracion guardada.
- Incluye grupos y ajustes por pista (volumen, mute, loop, grupo asignado).
- Estado visual de respaldo cargado.
- Restablecimiento de fabrica.

## Requisitos

- Navegador moderno con soporte Web Audio API.
- Formatos compatibles del navegador (MP3, WAV, OGG, AAC, etc).
- Tamano maximo por archivo: **100MB**.

## Flujo de trabajo típico

1. Carga tus archivos desde `Agregar Archivos de Audio`.
2. (Opcional) Crea grupos y asigna pistas.
3. Ajusta volumen, loop y mute segun tu sesion.
4. Usa la barra rapida o atajos de teclado para operar durante el vivo.
5. Exporta respaldo cuando termines la configuracion.

## Flujo recomendado para respaldo

1. Cargar audios.
2. Configurar grupos y estados.
3. Exportar respaldo.
4. En una sesion futura: cargar primero los mismos audios y luego importar JSON.

Nota: el sistema identifica audios por nombre y extension. Si cambias nombre o formato, esa pista no matchea contra el respaldo anterior.

## Licencia

MIT
