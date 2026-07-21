import { useCallback, useEffect, useState } from 'react'
import { AdminDashboard } from './components/AdminDashboard'
import { Landing } from './components/Landing'
import { LoginModal } from './components/LoginModal'
import { MaintenanceGate } from './components/MaintenanceGate'
import { PredictionView } from './components/PredictionView'
import { UserDashboard } from './components/UserDashboard'
import { LoadingScreen, Modal } from './components/UI'
import {
  EMPTY_SNAPSHOT,
  checkMaintenanceAccess,
  getCurrentSession,
  loadAuthenticatedSnapshot,
  loadPublicSnapshot,
  onAuthChange,
  requestLoginCode,
  savePrediction,
  signOut,
  unlockMaintenanceAccess,
  verifyLoginCode,
} from './lib/repository'
import './App.css'

function App() {
  const [snapshot, setSnapshot] = useState(null)
  const [session, setSession] = useState(null)
  const [loginOpen, setLoginOpen] = useState(false)
  const [publicParticipantId, setPublicParticipantId] = useState('')
  const [loadError, setLoadError] = useState('')
  const [maintenance, setMaintenance] = useState({
    checking: true,
    busy: false,
    unlocked: false,
    error: '',
    retry: false,
  })

  const refresh = useCallback(async (activeSession = null) => {
    setLoadError('')
    try {
      const next = activeSession?.user?.id
        ? await loadAuthenticatedSnapshot(activeSession.user.id)
        : await loadPublicSnapshot()
      setSnapshot(next)
      return next
    } catch (error) {
      setLoadError('No se pudo conectar con Supabase. Revisa la configuracion del proyecto.')
      setSnapshot((current) => current || { ...EMPTY_SNAPSHOT, configured: false })
      return null
    }
  }, [])

  const checkAccess = useCallback(async () => {
    setMaintenance((current) => ({ ...current, checking: true, busy: true, error: '', retry: false }))
    try {
      const access = await checkMaintenanceAccess()
      setMaintenance({ checking: false, busy: false, unlocked: access.unlocked, error: '', retry: false })
    } catch (error) {
      setMaintenance({
        checking: false,
        busy: false,
        unlocked: false,
        error: error.message || 'No se pudo comprobar el acceso',
        retry: true,
      })
    }
  }, [])

  useEffect(() => {
    checkAccess()
  }, [checkAccess])

  useEffect(() => {
    if (maintenance.checking || !maintenance.unlocked) return undefined
    let mounted = true
    getCurrentSession().then((currentSession) => {
      if (!mounted) return
      setSession(currentSession)
      refresh(currentSession)
    })
    const unsubscribe = onAuthChange((nextSession) => {
      setSession(nextSession)
      refresh(nextSession)
    })
    return () => {
      mounted = false
      unsubscribe()
    }
  }, [maintenance.checking, maintenance.unlocked, refresh])

  async function handleMaintenanceUnlock(password) {
    setMaintenance((current) => ({ ...current, busy: true, error: '', retry: false }))
    try {
      await unlockMaintenanceAccess(password)
      setMaintenance({ checking: false, busy: false, unlocked: true, error: '', retry: false })
    } catch (error) {
      setMaintenance((current) => ({
        ...current,
        busy: false,
        error: error.message || 'No se pudo comprobar la contraseña',
      }))
    }
  }

  async function handleVerify(email, code) {
    const nextSession = await verifyLoginCode(email, code)
    setSession(nextSession)
    await refresh(nextSession)
  }

  async function handleSignOut() {
    await signOut()
    setSession(null)
    setSnapshot(await loadPublicSnapshot())
  }

  async function handleSavePrediction(participantId, prediction, submit) {
    await savePrediction(participantId, prediction, submit)
    await refresh(session)
  }

  if (maintenance.checking) return <LoadingScreen />
  if (!maintenance.unlocked) {
    return (
      <MaintenanceGate
        busy={maintenance.busy}
        error={maintenance.error}
        onSubmit={handleMaintenanceUnlock}
        onRetry={maintenance.retry ? checkAccess : null}
      />
    )
  }
  if (!snapshot) return <LoadingScreen />

  const viewer = snapshot.viewer
  const isAdmin = viewer?.role === 'admin'
  const publicParticipant = snapshot.participants.find((item) => item.id === publicParticipantId)

  return (
    <>
      {loadError && <div className="global-alert">{loadError}</div>}
      {viewer ? (
        isAdmin ? (
          <AdminDashboard
            snapshot={snapshot}
            onRefresh={() => refresh(session)}
            onSavePrediction={handleSavePrediction}
            onSignOut={handleSignOut}
          />
        ) : (
          <UserDashboard snapshot={snapshot} onSave={handleSavePrediction} onSignOut={handleSignOut} />
        )
      ) : (
        <Landing
          snapshot={snapshot}
          onLogin={() => setLoginOpen(true)}
          onViewPrediction={setPublicParticipantId}
        />
      )}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        participants={snapshot.participants}
        configured={snapshot.configured}
        onRequestCode={requestLoginCode}
        onVerifyCode={handleVerify}
      />

      <Modal
        open={Boolean(publicParticipantId)}
        onClose={() => setPublicParticipantId('')}
        title={`Porra de ${publicParticipant?.display_name || ''}`}
        eyebrow={snapshot.competition.name}
        wide
      >
        <PredictionView snapshot={snapshot} participantId={publicParticipantId} />
      </Modal>
    </>
  )
}

export default App
