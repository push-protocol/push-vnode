import { isValidAddress } from '../../helpers/utilsHelper'

export const validateAddress = (value) => {
  if (!isValidAddress(value)) {
    throw new Error('Invalid Address')
  }
  return value
}
