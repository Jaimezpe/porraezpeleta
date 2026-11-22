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

  function ask(label, callback) {
    if (action.current) return
    action.current = callback
    setTarget(label)
    setWord('')
    setStep(1)
  }
  useEffect(() => {
    if (target) dialog.current.showModal()
  }, [target])
  function finish(confirmed) {
    const callback = action.current
    action.current = null
    dialog.current.close()
    setTarget('')
    if (confirmed) callback?.()
  }
  return <Guard.Provider value={ask}>
    {children}
    <dialog ref={dialog} className="removal-dialog" aria-labelledby="removal-title" onCancel={e => { e.preventDefault(); finish(false) }}>
      <p className="section-kicker">Confirmación {step} de 2</p>
      <h2 id="removal-title">¿Eliminar {target}?</h2>
      <p>Este cambio no se puede deshacer.</p>
      {step === 2 && <label>Escribe ELIMINAR para confirmar<input autoFocus value={word} autoComplete="off" onChange={e => setWord(e.target.value)} /></label>}
      <footer>
        <button autoFocus className="secondary-button" onClick={() => finish(false)}>Cancelar</button>
        {step === 1 ? <button className="secondary-button" onClick={() => setStep(2)}>Continuar</button> :
          <button className="remove-final" disabled={word.trim() !== 'ELIMINAR'} onClick={() => finish(true)}><Trash2 size={16}/> Eliminar</button>}
      </footer>
    </dialog>
  </Guard.Provider>
}
