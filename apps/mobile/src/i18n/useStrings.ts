import { useLanguageStore } from '@/state/languageStore';
import { type ChromeStrings, STRINGS } from './strings';

export function useStrings(): ChromeStrings {
  return STRINGS[useLanguageStore((state) => state.language)];
}
