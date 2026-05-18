'use client'
import {useEffect, useState} from 'react'
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  confirmColor: 'error' | 'primary'
  confirmDisabled?: boolean
  onConfirm: () => Promise<void>
  onCancel: () => void
  children?: React.ReactNode
}

export default function ConfirmDialog({
                                        open,
                                        title,
                                        message,
                                        confirmLabel,
                                        confirmColor,
                                        confirmDisabled,
                                        onConfirm,
                                        onCancel,
                                        children,
                                      }: ConfirmDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) setError(null)
  }, [open])

  const handleConfirm = async () => {
    setLoading(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <DialogContentText>{message}</DialogContentText>
        {children}
        {error && <Alert severity="error" sx={{mt: 1}}>{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} variant="outlined" autoFocus>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          color={confirmColor}
          disabled={loading || !!confirmDisabled}
        >
          {loading ? <CircularProgress size={20} color="inherit"/> : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
