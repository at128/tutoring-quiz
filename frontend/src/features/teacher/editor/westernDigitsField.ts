import type { UseFormRegisterReturn } from 'react-hook-form'
import { westernDigits } from './editorForm'

/**
 * A registered number field that turns Arabic-Indic digits into 0-9 as they are typed, so the field and the
 * status summary show "45", never "٤٥". The fields are plain text: a native number input follows the device's
 * regional format (Arabic Windows shows ٤٥ even in the English interface).
 */
export function withWesternDigits<Name extends string>(field: UseFormRegisterReturn<Name>): UseFormRegisterReturn<Name> {
  return {
    ...field,
    onChange: (event) => {
      const input = event.target as HTMLInputElement
      const western = westernDigits(input.value)
      if (western !== input.value) input.value = western
      return field.onChange(event)
    },
  }
}
