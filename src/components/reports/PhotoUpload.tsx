'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Upload, X, ImageIcon } from 'lucide-react'
import Image from 'next/image'

interface UploadedPhoto {
  id: string
  storage_path: string
  caption: string | null
  url: string
}

interface Props {
  reportId: string
  assetId?: string
  findingId?: string
  initialPhotos?: UploadedPhoto[]
  onUpload?: (photo: UploadedPhoto) => void
}

export default function PhotoUpload({ reportId, assetId, findingId, initialPhotos = [], onUpload }: Props) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initialPhotos)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setUploading(true)
    for (const file of acceptedFiles) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('report_id', reportId)
      if (assetId) formData.append('asset_id', assetId)
      if (findingId) formData.append('finding_id', findingId)

      const res = await fetch('/api/photos/upload', { method: 'POST', body: formData })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? 'Upload failed')
        continue
      }

      const { data } = supabase.storage.from('report-photos').getPublicUrl(json.photo.storage_path)
      const newPhoto: UploadedPhoto = { ...json.photo, url: data.publicUrl }
      setPhotos(prev => [...prev, newPhoto])
      onUpload?.(newPhoto)
    }
    setUploading(false)
    toast.success('Photos uploaded')
  }, [reportId, assetId, findingId, supabase, onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.heic'] },
    multiple: true,
    disabled: uploading,
  })

  async function removePhoto(photo: UploadedPhoto) {
    await supabase.storage.from('report-photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    toast.success('Photo removed')
  }

  async function updateCaption(photoId: string, caption: string) {
    await supabase.from('photos').update({ caption }).eq('id', photoId)
    setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, caption } : p))
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragActive ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        <Upload className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">
          {uploading ? 'Uploading…' : isDragActive ? 'Drop photos here' : 'Drag & drop photos, or click to select'}
        </p>
        <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP, HEIC</p>
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo) => (
            <div key={photo.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <Image
                  src={photo.url}
                  alt={photo.caption ?? 'Photo'}
                  fill
                  className="object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => removePhoto(photo)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
              <Input
                value={photo.caption ?? ''}
                onChange={(e) => updateCaption(photo.id, e.target.value)}
                placeholder="Caption…"
                className="mt-1.5 h-7 text-xs"
              />
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <ImageIcon className="h-3.5 w-3.5" />
          No photos uploaded yet
        </div>
      )}
    </div>
  )
}
