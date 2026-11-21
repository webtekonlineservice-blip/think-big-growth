'use client'

import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { ArrowDownToLine, ArrowUpToLine, GripVertical, RotateCw, Scaling, Trash2 } from 'lucide-react'
import type { SocialPhotoLayer } from '@/lib/models/SocialPost'

export type CollagePreset = 'grid' | 'featured' | 'freeform' | 'mosaic' | 'strip' | 'stack'
export interface CollagePhoto { id: string; label: string; src: string; removable?: boolean }

interface PointerInteraction {
  id: string
  mode: 'move' | 'resize' | 'rotate'
  startX: number
  startY: number
  stageWidth: number
  stageHeight: number
  startLayer: SocialPhotoLayer
  centerX: number
  centerY: number
  startAngle: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function createPhotoLayers(ids: string[], preset: CollagePreset, aspectRatio = 1): SocialPhotoLayer[] {
  const count = ids.length
  return ids.map((photo_id, index) => {
    let x = 0.04, y = 0.06, width = 0.44, height = 0.42, rotation = 0
    if (preset === 'grid') {
      const cols = count === 1 ? 1 : 2
      const rows = Math.ceil(count / cols)
      const gap = 0.04
      width = (0.92 - gap * (cols - 1)) / cols
      height = (0.88 - gap * (rows - 1)) / rows
      x = 0.04 + (index % cols) * (width + gap)
      y = 0.06 + Math.floor(index / cols) * (height + gap)
    } else if (preset === 'featured') {
      if (index === 0 || count === 1) {
        x = 0.04; y = 0.08; width = count === 1 ? 0.78 : 0.62; height = 0.84
      } else {
        const remaining = count - 1
        const gap = 0.025
        width = 0.31
        height = (0.84 - gap * (remaining - 1)) / remaining
        x = 0.65
        y = 0.08 + (index - 1) * (height + gap)
      }
    } else if (preset === 'mosaic') {
      if (count === 1) {
        x = 0.10; y = 0.08; width = 0.80; height = 0.84
      } else if (index === 0) {
        x = 0.04; y = 0.06; width = 0.57; height = 0.88; rotation = -1
      } else if (index === 1) {
        x = 0.63; y = 0.06; width = 0.33; height = count === 2 ? 0.88 : 0.42; rotation = 2
      } else if (index === 2) {
        x = 0.63; y = 0.52; width = 0.33; height = 0.42; rotation = -2
      } else {
        x = 0.34; y = 0.68; width = 0.25; height = 0.25; rotation = 3
      }
    } else if (preset === 'strip') {
      const gap = 0.025
      if (aspectRatio > 1.3) {
        width = (0.92 - gap * (count - 1)) / count
        height = 0.76
        x = 0.04 + index * (width + gap)
        y = 0.12
      } else {
        width = 0.84
        height = (0.88 - gap * (count - 1)) / count
        x = 0.08
        y = 0.06 + index * (height + gap)
      }
    } else if (preset === 'stack') {
      if (count === 1) {
        x = 0.16; y = 0.12; width = 0.68; height = 0.76; rotation = -2
      } else if (count === 2) {
        x = index === 0 ? 0.08 : 0.36
        y = index === 0 ? 0.16 : 0.12
        width = 0.58; height = 0.68; rotation = index === 0 ? -6 : 6
      } else if (count === 3) {
        const placements: [number, number, number, number, number][] = [
          [0.04, 0.16, 0.58, 0.68, -6],
          [0.42, 0.09, 0.54, 0.60, 5],
          [0.25, 0.34, 0.58, 0.58, -2],
        ]
        ;[x, y, width, height, rotation] = placements[index]
      } else {
        const placements: [number, number, number, number, number][] = [
          [0.05, 0.12, 0.50, 0.53, -6],
          [0.44, 0.10, 0.50, 0.52, 5],
          [0.11, 0.42, 0.50, 0.50, 3],
          [0.42, 0.40, 0.50, 0.50, -4],
        ]
        ;[x, y, width, height, rotation] = placements[index]
      }
    } else if (count === 1) {
      x = 0.17; y = 0.12; width = 0.66; height = 0.76; rotation = -1
    } else if (index === 0) {
      x = 0.04; y = 0.16; width = 0.64; height = 0.70; rotation = -3
    } else if (index === 1) {
      x = 0.50; y = 0.05; width = 0.46; height = count === 2 ? 0.58 : 0.42; rotation = 4
    } else if (index === 2) {
      x = 0.50; y = 0.50; width = 0.46; height = 0.43; rotation = -2
    } else {
      x = 0.05; y = 0.64; width = 0.34; height = 0.29; rotation = 3
    }
    return { photo_id, x, y, width, height, rotation, zoom: 1, z_index: index + 1 }
  })
}

export default function CollageEditor({
  photos, layers, preset, aspectRatio, onChange, onPresetChange, onRemove,
}: {
  photos: CollagePhoto[]
  layers: SocialPhotoLayer[]
  preset: CollagePreset
  aspectRatio: number
  onChange: (layers: SocialPhotoLayer[]) => void
  onPresetChange: (preset: CollagePreset) => void
  onRemove: (photoId: string) => void
}) {
  const stageRef = useRef<HTMLDivElement>(null)
  const interaction = useRef<PointerInteraction | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [editedLayers, setEditedLayers] = useState(layers)
  useEffect(() => setEditedLayers(layers), [layers])
  const selected = editedLayers.find((layer) => layer.photo_id === selectedId)
  const selectedPhoto = photos.find((photo) => photo.id === selectedId)

  const updateLayer = (id: string, update: (layer: SocialPhotoLayer) => SocialPhotoLayer) => {
    const next = editedLayers.map((layer) => layer.photo_id === id ? update(layer) : layer)
    setEditedLayers(next)
    onChange(next)
  }

  const startInteraction = (event: PointerEvent, id: string, mode: PointerInteraction['mode']) => {
    event.preventDefault()
    event.stopPropagation()
    const stage = stageRef.current
    const layer = editedLayers.find((item) => item.photo_id === id)
    if (!stage || !layer) return
    const rect = stage.getBoundingClientRect()
    const centerX = rect.left + (layer.x + layer.width / 2) * rect.width
    const centerY = rect.top + (layer.y + layer.height / 2) * rect.height
    interaction.current = {
      id, mode, startX: event.clientX, startY: event.clientY,
      stageWidth: rect.width, stageHeight: rect.height, startLayer: { ...layer },
      centerX, centerY,
      startAngle: Math.atan2(event.clientY - centerY, event.clientX - centerX),
    }
    setSelectedId(id)
    stage.setPointerCapture(event.pointerId)
  }

  const moveInteraction = (event: PointerEvent) => {
    const active = interaction.current
    if (!active) return
    const dx = (event.clientX - active.startX) / active.stageWidth
    const dy = (event.clientY - active.startY) / active.stageHeight
    setEditedLayers((current) => current.map((layer) => {
      if (layer.photo_id !== active.id) return layer
      if (active.mode === 'move') {
        const x = active.startLayer.x + dx
        const y = active.startLayer.y + dy
        return {
          ...layer,
          x: clamp(x, -layer.width + 0.14, 1 - 0.14),
          y: clamp(y, -layer.height + 0.14, 1 - 0.14),
        }
      }
      if (active.mode === 'resize') {
        const scale = clamp(1 + (dx + dy) / 2, 0.35, 2.2)
        const width = clamp(active.startLayer.width * scale, 0.18, 0.92)
        const height = clamp(active.startLayer.height * scale, 0.18, 0.92)
        return {
          ...layer,
          width, height,
          x: clamp(active.startLayer.x, -width + 0.14, 1 - 0.14),
          y: clamp(active.startLayer.y, -height + 0.14, 1 - 0.14),
        }
      }
      const angle = Math.atan2(event.clientY - active.centerY, event.clientX - active.centerX)
      const degrees = active.startLayer.rotation + (angle - active.startAngle) * 180 / Math.PI
      return { ...layer, rotation: Math.round(degrees) }
    }))
  }

  const finishInteraction = () => {
    interaction.current = null
    onChange(editedLayers)
  }

  const changeZoom = (zoom: number) => {
    if (selected) updateLayer(selected.photo_id, (layer) => ({ ...layer, zoom }))
  }

  const changeRotation = (rotation: number) => {
    if (selected) updateLayer(selected.photo_id, (layer) => ({ ...layer, rotation }))
  }

  const moveLayer = (direction: 'front' | 'back') => {
    if (!selected) return
    const z = editedLayers.map((layer) => layer.z_index)
    const z_index = direction === 'front' ? Math.max(...z) + 1 : Math.min(...z) - 1
    updateLayer(selected.photo_id, (layer) => ({ ...layer, z_index }))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-gray-400">Drag to place · corner to resize · handle to rotate · use layers to overlap photos</p>
        <div className="flex flex-wrap gap-1">
          {([
            ['freeform', 'Freeform'],
            ['grid', 'Grid'],
            ['featured', 'Feature + stack'],
            ['mosaic', 'Mosaic'],
            ['strip', 'Film strip'],
            ['stack', 'Polaroid stack'],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => onPresetChange(value)}
              className={`px-2.5 py-1 rounded-full text-xs border ${preset === value ? 'bg-brand-blue border-brand-blue text-white' : 'border-gray-700 text-gray-400 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={stageRef}
        className="relative w-full overflow-hidden rounded-xl border border-gray-600 bg-gray-950 touch-none"
        style={{ aspectRatio: String(aspectRatio), backgroundImage: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,.06), transparent 68%)' }}
        onPointerMove={moveInteraction}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
        onPointerDown={() => setSelectedId('')}
      >
        {editedLayers.slice().sort((a, b) => a.z_index - b.z_index).map((layer) => {
          const photo = photos.find((item) => item.id === layer.photo_id)
          if (!photo) return null
          const active = layer.photo_id === selectedId
          return (
            <div
              key={layer.photo_id}
              onPointerDown={(event) => startInteraction(event, layer.photo_id, 'move')}
              className="absolute select-none"
              style={{
                left: `${layer.x * 100}%`, top: `${layer.y * 100}%`,
                width: `${layer.width * 100}%`, height: `${layer.height * 100}%`,
                zIndex: layer.z_index,
                transform: `rotate(${layer.rotation}deg)`,
                touchAction: 'none',
              }}
            >
              <div className={`h-full w-full overflow-hidden rounded-md border-[5px] bg-white shadow-[0_8px_24px_rgba(0,0,0,.4)] ${active ? 'border-white ring-2 ring-brand-blue' : 'border-white/90'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.src} alt={photo.label || 'Collage photo'} draggable={false}
                  className="h-full w-full object-cover pointer-events-none"
                  style={{ transform: `scale(${layer.zoom})` }} />
              </div>
              {active && (
                <>
                  <button type="button" aria-label="Rotate photo" title="Drag to rotate" onPointerDown={(event) => startInteraction(event, layer.photo_id, 'rotate')}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-gray-900 border border-gray-500 text-white p-1.5 cursor-alias">
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" aria-label="Resize photo" title="Drag to resize" onPointerDown={(event) => startInteraction(event, layer.photo_id, 'resize')}
                    className="absolute -bottom-2 -right-2 rounded-full bg-brand-blue text-white p-1.5 cursor-nwse-resize">
                    <Scaling className="w-3.5 h-3.5" />
                  </button>
                  <GripVertical className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-white drop-shadow pointer-events-none" />
                </>
              )}
            </div>
          )
        })}
        {!photos.length && <p className="absolute inset-0 grid place-items-center text-xs text-gray-500">Add photos to start arranging the collage.</p>}
      </div>

      {selected && selectedPhoto && (
        <div className="grid sm:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center border border-gray-700 rounded-lg p-3 bg-gray-900/60">
          <div className="space-y-2">
            <p className="truncate text-xs font-medium text-gray-200" title={selectedPhoto.label}>{selectedPhoto.label}</p>
            <label className="flex items-center justify-between gap-3 text-xs text-gray-400">
              <span>Zoom</span><span>{selected.zoom.toFixed(1)}×</span>
              <input aria-label="Zoom selected photo" type="range" min="1" max="2.8" step="0.05" value={selected.zoom}
                onChange={(event) => changeZoom(Number(event.target.value))} className="w-36 accent-brand-blue" />
            </label>
            <label className="flex items-center justify-between gap-3 text-xs text-gray-400">
              <span>Rotation</span><span>{selected.rotation}°</span>
              <input aria-label="Rotate selected photo" type="range" min="-45" max="45" step="1" value={clamp(selected.rotation, -45, 45)}
                onChange={(event) => changeRotation(Number(event.target.value))} className="w-36 accent-brand-blue" />
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => moveLayer('back')} className="flex items-center gap-1 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-gray-300 hover:text-white">
              <ArrowDownToLine className="w-3.5 h-3.5" /> Send back
            </button>
            <button type="button" onClick={() => moveLayer('front')} className="flex items-center gap-1 border border-gray-700 rounded-lg px-2.5 py-2 text-xs text-gray-300 hover:text-white">
              <ArrowUpToLine className="w-3.5 h-3.5" /> Bring forward
            </button>
            {selectedPhoto.removable !== false && (
              <button type="button" onClick={() => onRemove(selected.photo_id)} aria-label={`Remove ${selectedPhoto.label} from collage`}
                className="flex items-center gap-1 border border-red-900/70 rounded-lg px-2.5 py-2 text-xs text-red-300 hover:text-red-200">
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
