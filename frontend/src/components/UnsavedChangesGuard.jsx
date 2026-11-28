import { useCallback } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router'
import ConfirmModal from './ConfirmModal.jsx'
export default function UnsavedChangesGuard({ dirty, busy = false }) {
 const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => dirty && (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search), [dirty]))
 useBeforeUnload(useCallback(event => { if (dirty) { event.preventDefault(); event.returnValue = '' } }, [dirty]))
 return <ConfirmModal isOpen={blocker.state === 'blocked'} title="Cambios sin guardar" message="Hay cambios sin guardar en el formulario. Puedes seguir editando o salir y descartarlos." confirmText="Salir sin guardar" cancelText="Seguir editando" busy={busy} onCancel={() => blocker.reset()} onConfirm={() => blocker.proceed()} />
}
