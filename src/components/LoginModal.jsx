import { useState } from 'react'
import { ArrowLeft, Check, LoaderCircle, Mail } from 'lucide-react'
import { Modal } from './UI'

export function LoginModal({ open, onClose, participants, configured, onRequestCode, onVerifyCode }) {
  const [participantId, setParticipantId] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')

  function reset() {
    setEmail('')
    setCode('')
    setStatus('idle')
    setError('')
  }

  async function requestCode(event) {
    event.preventDefault()
    if (!participantId) return
    setStatus('sending')
    setError('')
    try {
      const destination = await onRequestCode(participantId)
      setEmail(destination)
      setStatus('code')
    } catch (requestError) {
      setError(requestError.message || 'No se pudo enviar el codigo')
      setStatus('idle')
    }
  }

  async function verify(event) {
    event.preventDefault()
    setStatus('verifying')
    setError('')
    try {
      await onVerifyCode(email, code)
      setStatus('done')
      onClose()
    } catch (verifyError) {
      setError('El codigo no es correcto o ha caducado')
      setStatus('code')
    }
  }

  const close = () => {
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={close} title="Entrar en tu porra" eyebrow="Acceso privado">
      {!configured ? (
        <div className="setup-message">
          <Mail size={24} />
          <strong>Falta conectar Supabase</strong>
          <p>Cuando añadas las claves aparecerá aquí la lista real de participantes.</p>
        </div>
      ) : status === 'code' || status === 'verifying' ? (
        <form className="auth-form" onSubmit={verify}>
          <button className="text-button text-button--back" type="button" onClick={reset}>
            <ArrowLeft size={16} /> Cambiar participante
          </button>
          <div className="mail-sent">
            <span className="mail-sent__icon"><Check size={18} /></span>
            <p>Se ha enviado un correo a</p>
            <strong>{email}</strong>
          </div>
          <label className="field-label" htmlFor="access-code">Codigo de 6 cifras</label>
          <input
            id="access-code"
            className="code-input"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            autoFocus
          />
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button primary-button--full" type="submit" disabled={code.length !== 6 || status === 'verifying'}>
            {status === 'verifying' ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
            Comprobar codigo
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={requestCode}>
          <p className="modal-intro">Selecciona tu nombre. Recibirás un código en el correo que ha guardado la organización.</p>
          <label className="field-label" htmlFor="participant">Participante</label>
          <select id="participant" value={participantId} onChange={(event) => setParticipantId(event.target.value)}>
            <option value="">Elige tu nombre</option>
            {participants.map((participant) => (
              <option value={participant.id} key={participant.id}>{participant.display_name}</option>
            ))}
          </select>
          {!participants.length && <p className="form-hint">La organización todavía no ha añadido participantes.</p>}
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button primary-button--full" type="submit" disabled={!participantId || status === 'sending'}>
            {status === 'sending' ? <LoaderCircle className="spin" size={18} /> : <Mail size={18} />}
            Enviar codigo
          </button>
        </form>
      )}
    </Modal>
  )
}
