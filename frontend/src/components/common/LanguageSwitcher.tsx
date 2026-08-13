import { useTranslation } from 'react-i18next';
import { Select, MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import LanguageIcon from '@mui/icons-material/Language';
import { SUPPORTED_LANGUAGES, isRtlLanguage } from '../../i18n';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const handleChange = (e: SelectChangeEvent<string>) => {
    const code = e.target.value;
    i18n.changeLanguage(code);
    const dir = isRtlLanguage(code) ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', code);
  };

  return (
    <Select
      value={i18n.language in Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l.code, true])) ? i18n.language : 'en'}
      onChange={handleChange}
      size="small"
      variant="outlined"
      startAdornment={<LanguageIcon sx={{ mr: 0.5, fontSize: 18, color: 'text.secondary' }} />}
      sx={{
        color: 'text.primary',
        fontSize: '0.85rem',
        minWidth: 120,
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: 'rgba(255,255,255,0.15)',
        },
        '& .MuiSelect-icon': { color: 'text.secondary' },
      }}
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <MenuItem key={lang.code} value={lang.code}>
          {lang.name}
        </MenuItem>
      ))}
    </Select>
  );
}
