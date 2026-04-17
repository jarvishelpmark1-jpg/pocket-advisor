import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion } from 'framer-motion'
import { Upload, FileSpreadsheet } from 'lucide-react'

export function DropZone({ onFile }: { onFile: (file: File) => void }) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) onFile(accepted[0])
  }, [onFile])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/x-ofx': ['.ofx'],
      'application/x-qfx': ['.qfx'],
    },
    maxFiles: 1,
    multiple: false,
  })

  return (
    <motion.div
      {...getRootProps()}
      whileTap={{ scale: 0.98 }}
      className={`
        relative overflow-hidden rounded-2xl border-2 border-dashed p-8
        flex flex-col items-center justify-center text-center
        cursor-pointer transition-colors
        ${isDragActive
          ? 'border-accent bg-accent/5'
          : 'border-border hover:border-accent/40 hover:bg-bg-card'
        }
      `}
    >
      <input {...getInputProps()} />

      <motion.div
        animate={{ y: isDragActive ? -4 : 0 }}
        className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-4"
      >
        {isDragActive ? (
          <FileSpreadsheet size={24} className="text-accent" />
        ) : (
          <Upload size={24} className="text-accent" />
        )}
      </motion.div>

      <p className="text-text-primary text-sm font-medium mb-1">
        {isDragActive ? 'Drop it here' : 'Upload a statement'}
      </p>
      <p className="text-text-muted text-xs">
        Drag & drop or tap to select a CSV, OFX, or QFX file
      </p>

      <div className="flex gap-2 mt-4">
        {['CSV', 'OFX', 'QFX'].map((ext) => (
          <span
            key={ext}
            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-bg-elevated text-text-muted"
          >
            .{ext.toLowerCase()}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
