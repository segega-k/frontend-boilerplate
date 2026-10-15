import 'server-only';
import { createServerI18next } from 'next-i18next/server';
import { i18nConfig } from '@/i18n.config';

// One shared i18next instance per process; the language is resolved per request from the [locale] root param.
// Only getT() / getFixedT are allowed, never changeLanguage on this instance.
export const { getT, getResources, generateI18nStaticParams } = createServerI18next(i18nConfig);
