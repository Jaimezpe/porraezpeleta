import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'

const Guard = createContext(null)
export const useRemovalGuard = () => useContext(Guard)

export function RemovalGuard({ children }) {
  const dialog = useRef(null)
  const action = useRef(null)
  const [target, setTarget] = useState('')
  const [step, setStep] = useState(1)
  const [word, setWord] = useState('')

  const [verb, setVerb] = useState('Eliminar')
  function ask(label, callback, operation = 'Eliminar') {
    if (action.current) return
    action.current = callback
    setTarget(label)
    setVerb(operation)
    setWord('')
    setStep(1)
  }
  useEffect(() => {
    if (target) dialog.current.showModal()
  }, [target])
  function finish(confirmed) {
    if (confirmed && (step !== 2 || word.trim() !== verb.toUpperCase())) return
    const callback = action.current
    action.current = null
    dialog.current.close()
    setTarget('')
    if (confirmed) callback?.()
  }
  return <Guard.Provider value={ask}>
    {children}
    <dialog ref={dialog} className="removal-dialog" aria-labelledby="removal-title" onCancel={e => { e.preventDefault(); finish(false) }}>
      <p className="section-kicker" aria-live="polite">Confirmación {step} de 2</p>
      <h2 id="removal-title">¿{verb} {target}?</h2>
      <p>{verb === 'Eliminar' ? 'Este borrado es permanente.' : 'Dejará de aparecer como participante activo. Sus datos se conservarán.'}</p>
      {step === 2 && <label>Escribe {verb.toUpperCase()} para confirmar<input autoFocus value={word} spellCheck={false} autoComplete="off" onChange={e => setWord(e.target.value)} /></label>}
      <footer>
        <button autoFocus className="secondary-button" onClick={() => finish(false)}>Cancelar</button>
        {step === 1 ? <button className="secondary-button" onClick={() => setStep(2)}>Continuar</button> :
          <button className="remove-final" disabled={word.trim() !== verb.toUpperCase()} onClick={() => finish(true)}>{verb === 'Eliminar' && <Trash2 size={16}/>} {verb}</button>}
      </footer>
    </dialog>
  </Guard.Provider>
}
