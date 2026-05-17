'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  onScan: (resultado: string) => void
  activo: boolean
}

export default function QRScanner({ onScan, activo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  const [escaneando, setEscaneando] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    if (activo) iniciarCamara()
    else detenerCamara()
    return () => detenerCamara()
  }, [activo])

  async function iniciarCamara() {
    setError('')
    setEscaneando(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        videoRef.current.onloadedmetadata = () => escanearFrame()
      }
    } catch (e: any) {
      setError('No se pudo acceder a la cámara. Verificá los permisos.')
      setEscaneando(false)
    }
  }

  function detenerCamara() {
    if (animRef.current) cancelAnimationFrame(animRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setEscaneando(false)
  }

  async function escanearFrame() {
    if (!videoRef.current || !streamRef.current) return

    try {
      // Usar BarcodeDetector nativo si está disponible (Chrome/Android)
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
        const codigos = await detector.detect(videoRef.current)
        if (codigos.length > 0) {
          detenerCamara()
          onScan(codigos[0].rawValue)
          return
        }
      } else {
        // Fallback: canvas + importar zxing dinámicamente
        const canvas = document.createElement('canvas')
        canvas.width = videoRef.current.videoWidth
        canvas.height = videoRef.current.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx && canvas.width > 0) {
          ctx.drawImage(videoRef.current, 0, 0)
          try {
            const { BrowserQRCodeReader } = await import('@zxing/browser')
            const reader = new BrowserQRCodeReader()
            const img = new Image()
            img.src = canvas.toDataURL()
            await new Promise(r => { img.onload = r })
            const result = await reader.decodeFromImageElement(img)
            if (result) {
              detenerCamara()
              onScan(result.getText())
              return
            }
          } catch { /* no QR en este frame, continuar */ }
        }
      }
    } catch { /* continuar */ }

    // Siguiente frame
    animRef.current = requestAnimationFrame(escanearFrame)
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-black aspect-square max-w-xs mx-auto">
      <video ref={videoRef} className="w-full h-full object-cover" muted playsInline/>
      {/* Overlay con marco */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-48 h-48">
          {/* Esquinas del marco */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg"/>
          <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg"/>
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg"/>
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg"/>
          {/* Línea de escaneo animada */}
          <div className="absolute inset-x-2 h-0.5 bg-blue-400/80 animate-scan"/>
        </div>
      </div>
      {escaneando && (
        <div className="absolute bottom-3 inset-x-0 text-center">
          <span className="text-white/70 text-xs bg-black/40 px-3 py-1 rounded-full">Apuntá al QR</span>
        </div>
      )}
    </div>
  )
}
