import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { errorText } from './queries'

type Conversion<I> = { ok: true; input: I } | { ok: false; error: string }

interface Options<D, I> {
  /** The row as stored on the server, as editable text. */
  saved: D
  toInput: (draft: D) => Conversion<I>
  save: (input: I) => Promise<unknown>
  /** Called after a successful save, typically to refresh the lists. */
  onSaved: () => unknown
}

/**
 * Editing state of one grid row.
 *
 * The user's edits live as a draft over the server values and are dropped only
 * after a successful save (and only if the user did not keep typing meanwhile),
 * so a late response never overwrites newer input and a refused save keeps
 * what was typed. Nothing is sent when the row is unchanged, and the same
 * payload is never sent twice at once (Enter followed by blur).
 */
export function useDraftRow<D extends object, I>({ saved, toInput, save, onSaved }: Options<D, I>) {
  const [edits, setEdits] = useState<D | null>(null)
  const [invalid, setInvalid] = useState<string | null>(null)
  const inFlight = useRef<string | null>(null)

  const mutation = useMutation({
    mutationFn: save,
    onSuccess: onSaved,
    onSettled: () => {
      inFlight.current = null
    },
  })

  const draft = edits ?? saved

  const commit = (next: D, sent: D | null) => {
    const result = toInput(next)
    if (!result.ok) {
      setInvalid(result.error)
      return
    }
    setInvalid(null)

    const stored = toInput(saved)
    if (stored.ok && JSON.stringify(stored.input) === JSON.stringify(result.input)) return

    const payload = JSON.stringify(result.input)
    if (payload === inFlight.current) return
    inFlight.current = payload

    mutation.mutate(result.input, {
      onSuccess: () => setEdits((current) => (current === sent ? null : current)),
    })
  }

  return {
    draft,
    /** `immediate` is set for controls with no "finished typing" moment (selects, checkboxes). */
    change: (next: D, immediate: boolean) => {
      setEdits(next)
      if (immediate) commit(next, next)
    },
    /** The user left a text field or pressed Enter. */
    commit: () => commit(draft, edits),
    /** The key of the client-side validation error, if the draft cannot be saved. */
    invalid,
    serverError: mutation.isError ? errorText(mutation.error) : null,
  }
}
