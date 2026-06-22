import './assets/main.css'
import '@renderer/i18n'
import { suppressBenignTransitionAbortErrors } from '@renderer/lib/suppress-benign-rejections'

suppressBenignTransitionAbortErrors()

if (window.location.hash.startsWith('#/projection')) {
  void import('./projection-entry')
} else {
  void import('./control-entry')
}
