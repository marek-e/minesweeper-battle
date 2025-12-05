'use client'

import { X } from 'lucide-react'

type ModalProps = {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="m-4 w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-700 p-4">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-slate-400 transition-colors hover:text-white"
          >
            <X size={24} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}
